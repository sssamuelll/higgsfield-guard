#!/usr/bin/env node
'use strict';
const pkg = require('../package.json');
const adapters = require('../lib/adapters');
const { runHook, failure } = require('../lib/hook');

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const v = argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};

function finish({ stdout = '', stderr = '', code = 0 }) {
  if (stderr) process.stderr.write(stderr.endsWith('\n') ? stderr : `${stderr}\n`);
  process.stdout.write(stdout, () => process.exit(code));
}

function hookMain(agent) {
  const deadline = Number(process.env.HIGGSFIELD_GUARD_DEADLINE_MS) || 45000;
  const timer = setTimeout(() => {
    const adapter = adapters[agent];
    finish(adapter ? failure(adapter, 'timed out') : { stderr: 'higgsfield-guard: timed out', code: 2 });
  }, deadline);
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => (raw += d));
  process.stdin.on('end', async () => {
    const result = await runHook(String(agent), raw);
    clearTimeout(timer);
    finish(result);
  });
}

const HELP = `higgsfield-guard ${pkg.version}: your AI agent asks before it spends Higgsfield credits.

  higgsfield-guard install [--agents claude,cursor,codex,gemini,kimi]
  higgsfield-guard uninstall [--purge]
  higgsfield-guard status
  higgsfield-guard approve <credits> [--minutes 10] | --once | --clear
  higgsfield-guard log [--n 20]
`;

async function main() {
  if (cmd === 'hook') return hookMain(opt('agent'));
  if (cmd === '--version' || cmd === '-v' || cmd === 'version') return finish({ stdout: `${pkg.version}\n` });
  const commands = require('../lib/commands');
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h' || !commands[cmd]) return finish({ stdout: HELP, code: cmd && !['help', '--help', '-h'].includes(cmd) ? 1 : 0 });
  try {
    const out = await commands[cmd]({ argv, opt });
    finish({ stdout: out ? `${out}\n` : '' });
  } catch (e) {
    finish({ stderr: `higgsfield-guard: ${e.message}`, code: 1 });
  }
}

main();
