'use strict';
const fs = require('node:fs');
const path = require('node:path');
const allowance = require('./allowance');
const log = require('./log');
const { createCost, findCli } = require('./cost');
const { t } = require('./i18n');
const { guardHome } = require('./paths');

async function approve({ argv, opt }) {
  const m = t();
  if (opt('clear')) { await allowance.clear(); return m.cleared; }
  const minutes = opt('minutes') === undefined ? 10 : Number(opt('minutes'));
  if (opt('once')) return m.approved(await allowance.approve({ once: true, minutes }));
  const credits = Number(argv[1]);
  if (!(credits > 0)) throw new Error('approve needs a number of credits, or --once, or --clear');
  return m.approved(await allowance.approve({ credits, minutes }));
}

async function status(ctx = {}) {
  const m = t();
  const lines = [];
  let config = {};
  try { config = JSON.parse(fs.readFileSync(path.join(guardHome(), 'config.json'), 'utf8')); } catch { /* not installed */ }
  const installers = (() => { try { return require('./install'); } catch { return null; } })();
  if (installers && installers.statusLines) lines.push(...installers.statusLines(ctx.home));
  else lines.push(`Agents: ${Object.keys(config.agents ?? {}).join(', ') || 'none'}`);
  const cli = findCli();
  const balance = cli ? await createCost({ cli }).balance() : null;
  lines.push(cli ? `Higgsfield CLI: found, balance ${balance === null ? 'unknown (log in with "higgsfield auth login")' : `${balance} credits`}` : 'Higgsfield CLI: not found (prices show as "cost not calculated")');
  const a = allowance.read();
  lines.push(a ? m.approved(a) : m.noAllowance);
  return lines.join('\n');
}

async function logCmd({ opt }) {
  const n = Number(opt('n')) || 20;
  return log.render(log.readLast(n));
}

/** SessionStart hook of the Claude Code plugin: records Higgsfield MCP servers whatever their name. Prints nothing. */
async function sync() {
  try {
    const file = path.join(guardHome(), 'config.json');
    let config = {};
    try { config = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* first run */ }
    config.servers = require('./install/discover').discoverServers(require('node:os').homedir());
    fs.mkdirSync(guardHome(), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
  } catch { /* never block a session start; servers named "higgsfield" are still recognised */ }
  return '';
}

async function installCmd({ opt }) {
  const agents = typeof opt('agents') === 'string' ? opt('agents').split(',').map((s) => s.trim()) : undefined;
  const out = require('./install').install({ agents });
  const cli = findCli();
  const note = cli ? '' : '\nThe Higgsfield CLI was not found: prompts will say "cost not calculated". Install it and run "higgsfield auth login" to see prices.';
  const codexToml = require('./install/files').readText(path.join(require('node:os').homedir(), '.codex', 'config.toml')) ?? '';
  const codexNote = /^\s*hooks\s*=\s*false/m.test(codexToml) ? '\nCodex has hooks turned off ([features] hooks = false in ~/.codex/config.toml): set it to true so the guard runs.' : '';
  return out + note + codexNote;
}

async function uninstallCmd({ opt }) {
  return require('./install').uninstall({ purge: Boolean(opt('purge')) });
}

module.exports = { approve, status, log: logCmd, sync, install: installCmd, uninstall: uninstallCmd };
