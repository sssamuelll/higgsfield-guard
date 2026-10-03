# Privacy

higgsfield-guard runs on your computer. It has no server, no account and no telemetry, and nobody, its author included, receives anything from it.

## What it reads

- The tool calls your AI agent is about to make, which the agent's hook hands to it, to decide whether a call spends Higgsfield credits.
- Script files a command is about to run, to check whether they start a Higgsfield generation.
- Your agent configuration files, such as `~/.claude.json` and project `.mcp.json` files, to find MCP servers that point at Higgsfield. These files can contain your account email. The guard keeps only the server names.
- The output of `higgsfield account status`, to show your credit balance. That output includes your email. The guard keeps only the balance.

## What it sends

Nothing of its own. To price a generation, it runs your Higgsfield CLI, which asks Higgsfield's servers using your account. It passes the model and its settings, never your prompt. Higgsfield's privacy policy covers that request.

## What it stores

Only on your computer, in `~/.higgsfield-guard/`:

- `log.jsonl`: the time, agent, decision, tool name, cost and balance for each Higgsfield call it stopped or let through.
- `allowance.json`: the allowance you granted, while it lasts.
- `config.json`: the names of the Higgsfield MCP servers it found.

Nothing expires on its own. Delete that folder, or run `higgsfield-guard uninstall --purge`, to remove all of it.

## Contact

Questions go to the issues: https://github.com/sssamuelll/higgsfield-guard/issues

Updated 3 October 2026.
