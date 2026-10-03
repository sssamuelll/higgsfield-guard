# higgsfield-guard

Your AI agent asks before it spends Higgsfield credits.

[![test](https://github.com/sssamuelll/higgsfield-guard/actions/workflows/test.yml/badge.svg)](https://github.com/sssamuelll/higgsfield-guard/actions/workflows/test.yml) [Español](README.es.md)

Built after an agent spent 801 of 1,001 credits in 16 minutes, without showing a single price. Higgsfield has no spending cap on the account, the MCP server or the CLI, and support does not restore credits used by completed generations. higgsfield-guard puts the price and your approval in front of every generation, in every agent you use.

## What you see

In Claude Code and Cursor, every generation stops at a prompt:

```
Higgsfield generate_video: seedance_2_5 5s 1080p: 60 credits. Balance: 200.24. Approve?
```

Codex, Gemini CLI and Kimi Code can only block, so the agent gets the price and the command that allows it:

```
Higgsfield generate_video: seedance_2_5 5s 1080p: 60 credits. Balance: 200.24.
Blocked by higgsfield-guard. To allow it, run this in your own terminal, then retry: higgsfield-guard approve 60
```

## Install

Needs Node.js 18 or newer.

### Claude Code

Inside Claude Code:

```
/plugin marketplace add sssamuelll/higgsfield-guard
/plugin install higgsfield-guard@higgsfield-guard
```

Then restart Claude Code. The plugin needs nothing else. The `higgsfield-guard` command, for allowances, `status` and the log, comes with the npm install below.

### Cursor, Codex CLI, Gemini CLI and Kimi Code

```
npm install -g github:sssamuelll/higgsfield-guard
higgsfield-guard install
```

`install` finds the agents on your machine, adds one hook to each and backs up every file it changes. When the Claude Code plugin is enabled, it leaves Claude Code to the plugin. Without the plugin, it protects Claude Code too. Restart any agent session that is already open.

Moving Claude Code from the npm hook to the plugin: enable the plugin, then run `higgsfield-guard install` again. It removes the old Claude Code hook, so Claude Code does not ask twice.

To see prices and your balance in the prompts, install the [Higgsfield CLI](https://github.com/higgsfield-ai/cli) and run `higgsfield auth login`. Without it the guard still stops every generation, and the prompt says "cost not calculated".

## Agents

| Agent | Without an allowance | Where the hook goes | Tested |
|---|---|---|---|
| Claude Code | asks you | the plugin, or `PreToolUse` in `~/.claude/settings.json` | live |
| Cursor | asks you | `beforeMCPExecution`, `beforeShellExecution`, `preToolUse` in `~/.cursor/hooks.json` | from the docs |
| Codex CLI | blocks | `PreToolUse` in `~/.codex/hooks.json` | from the docs |
| Gemini CLI | blocks | `BeforeTool` in `~/.gemini/settings.json` | from the docs |
| Kimi Code | blocks | `[[hooks]]` in `~/.kimi-code/config.toml` or `~/.kimi/config.toml` | from the docs |

"From the docs" adapters follow each agent's official hook documentation and are tested with the payloads it describes. If you use one of them, an issue with the output of `higgsfield-guard log` helps.

## Allowances

An allowance lets a batch run without one prompt per job, and it is how you let a blocked call through in Codex, Gemini CLI and Kimi Code.

```
higgsfield-guard approve 120              # 120 credits for the next 10 minutes
higgsfield-guard approve 120 --minutes 30
higgsfield-guard approve --once           # the next call, whatever it costs
higgsfield-guard approve --clear
```

Every generation that fits is deducted and logged. Agents cannot approve for themselves. The guard blocks any agent command that runs `higgsfield-guard approve` or `uninstall`, and any agent edit inside `~/.higgsfield-guard`.

## What passes and what stops

These pass without asking: balance, transactions, prices (`get_cost`, `higgsfield generate cost`), model, preset and generation lists, uploads, and waiting on jobs that already exist.

Everything else stops, including tools Higgsfield adds after this release. Scripts are read before they run, so `python make_video.py` stops too when the script calls `higgsfield generate create`.

The Higgsfield MCP server is recognised by its name or its URL, whatever you called it in your agent's config.

## Commands

| Command | What it does |
|---|---|
| `higgsfield-guard install [--agents claude,codex]` | Adds the hooks and copies the guard to `~/.higgsfield-guard/runtime` |
| `higgsfield-guard uninstall [--purge]` | Removes exactly what `install` added; `--purge` also deletes the log |
| `higgsfield-guard status` | Protected agents, current allowance, CLI and balance |
| `higgsfield-guard approve` | Grants an allowance, as shown above |
| `higgsfield-guard log [--n 20]` | The last decisions: time, agent, tool, cost, balance |

## How it works

```
agent ── tool call ──▶ hook ──▶ higgsfield-guard
                                  │
              not Higgsfield, or free ──▶ passes
              an agent approving itself ──▶ blocked
              a generation ──▶ price and balance from the Higgsfield CLI
                                  │
              an allowance covers it ──▶ passes, deducted, logged
              otherwise ──▶ asks you (Claude Code, Cursor)
                            blocks with the price (Codex, Gemini CLI, Kimi Code)
```

If anything inside the guard fails or takes too long, the call is asked or blocked. It never passes in silence.

## Limits

- It stops accidental spending by an agent that runs its hooks. Software set on getting around it could edit the agent's settings or call the API some other way.
- Claude Code's `bypassPermissions` and `dontAsk` modes skip hook prompts.
- It protects the agents on the machine where it is installed. The claude.ai app and higgsfield.ai are outside its reach.
- The guard needs Node.js to start. If an agent cannot launch it at all, that agent decides what happens to the call, and most let it run.
- Scripts are read one file deep: the script the command names. Imports, `npm run` scripts and `make` targets are not followed.
- An agent config that is not plain JSON, for example one with comments, is skipped, and `install` says which one.

## Uninstall

The Claude Code plugin, inside Claude Code:

```
/plugin uninstall higgsfield-guard@higgsfield-guard
```

The npm install, in your own terminal:

```
higgsfield-guard uninstall
npm uninstall -g higgsfield-guard
```

## Questions

**Does it send anything anywhere?** Not on its own. To show a price and your balance, it runs your Higgsfield CLI, which asks Higgsfield's servers with your account. It passes the model and its settings, never your prompt. Decisions go to a local log on your machine.

**Does it slow my agent down?** Calls unrelated to Higgsfield return in milliseconds. A generation waits a second or two for its price.

**I use the Higgsfield connector from claude.ai inside Claude Code.** It is covered. Its tools are named `mcp__claude_ai_Higgsfield__*`.

**Can an allowance last longer than 10 minutes?** Yes, with `--minutes`.

## Adding an agent

An adapter is a file in `lib/adapters/` with `parse` (the agent's payload to a neutral call) and `render` (the decision to the agent's output), plus an entry in `lib/install/agents.js`. Its tests use the payloads from the agent's own docs. Windsurf, OpenCode and Goose are next.

## Privacy

It runs on your machine and has no telemetry. What it reads, sends and stores: [PRIVACY.md](PRIVACY.md).

## License

MIT. Not affiliated with or endorsed by Higgsfield.
