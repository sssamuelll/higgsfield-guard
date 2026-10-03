'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { AGENTS } = require('./agents');
const { discoverServers } = require('./discover');
const { readText, stamp } = require('./files');
const { guardHome } = require('../paths');

const runtimeBin = () => path.join(guardHome(), 'runtime', 'bin', 'higgsfield-guard.js').replace(/\\/g, '/');
const hookCommand = (name) => `node "${runtimeBin()}" hook --agent ${name}`;
const configFile = () => path.join(guardHome(), 'config.json');
const readConfig = () => { try { return JSON.parse(fs.readFileSync(configFile(), 'utf8')); } catch { return {}; } };
const short = (home, p) => p.replace(home, '~').replace(/\\/g, '/');

function onPath(name) {
  const exts = process.platform === 'win32' ? ['.cmd', '.exe', ''] : [''];
  return (process.env.PATH || process.env.Path || '').split(path.delimiter).some((d) => exts.some((e) => d && fs.existsSync(path.join(d, name + e))));
}

/** The Claude Code plugin is enabled in the user's settings, so Claude Code needs no settings hook. */
function pluginEnabled(home) {
  try {
    const s = JSON.parse(readText(path.join(home, '.claude', 'settings.json')) ?? '{}');
    return Object.entries(s.enabledPlugins ?? {}).some(([id, on]) => on && id.startsWith('higgsfield-guard@'));
  } catch {
    return false;
  }
}

function copyRuntime(pkgRoot) {
  const runtime = path.join(guardHome(), 'runtime');
  if (path.resolve(pkgRoot) === path.resolve(runtime)) return;
  fs.rmSync(runtime, { recursive: true, force: true });
  for (const part of ['bin', 'lib']) fs.cpSync(path.join(pkgRoot, part), path.join(runtime, part), { recursive: true });
  fs.copyFileSync(path.join(pkgRoot, 'package.json'), path.join(runtime, 'package.json'));
}

function install({ home = os.homedir(), pkgRoot = path.join(__dirname, '..', '..'), agents } = {}) {
  fs.mkdirSync(guardHome(), { recursive: true });
  copyRuntime(pkgRoot);
  const previous = readConfig();
  const config = {
    version: require(path.join(pkgRoot, 'package.json')).version,
    approveCmd: onPath('higgsfield-guard') ? 'higgsfield-guard approve' : `node "${runtimeBin()}" approve`,
    servers: discoverServers(home),
    agents: previous.agents ?? {},
    installedAt: new Date().toISOString(),
  };
  const rows = [];
  for (const a of Object.values(AGENTS)) {
    if (agents && !agents.includes(a.name)) continue;
    if (!a.detect(home)) { rows.push(`${a.name.padEnd(7)} not found`); continue; }
    if (a.name === 'claude' && pluginEnabled(home)) {
      const current = readText(a.file(home));
      if (current !== null && a.has(current)) { // moved to the plugin: drop the old settings hook so it does not ask twice
        fs.writeFileSync(a.file(home), a.remove(current));
        if (config.agents.claude?.backup) fs.rmSync(config.agents.claude.backup, { force: true });
        delete config.agents.claude;
      }
      rows.push(`${a.name.padEnd(7)} protected by the Claude Code plugin`);
      continue;
    }
    const file = a.file(home);
    try {
      const before = readText(file);
      const after = a.add(before, hookCommand(a.name));
      let backup = config.agents[a.name]?.backup ?? null;
      const firstTime = !config.agents[a.name];
      if (before !== null && firstTime) {
        backup = `${file}.higgsfield-guard-backup-${stamp()}`;
        fs.writeFileSync(backup, before);
      }
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, after);
      config.agents[a.name] = { file, backup, created: firstTime ? before === null : (config.agents[a.name].created ?? false) };
      rows.push(`${a.name.padEnd(7)} ${short(home, file)}${backup && firstTime ? `  (backup: ${path.basename(backup)})` : ''}`);
    } catch (e) {
      rows.push(`${a.name.padEnd(7)} skipped: ${short(home, file)} could not be read as plain ${path.extname(file).slice(1).toUpperCase()} (${e.message})`);
    }
  }
  fs.writeFileSync(configFile(), `${JSON.stringify(config, null, 2)}\n`);
  return [`higgsfield-guard ${config.version} installed.`, ...rows.map((r) => `  ${r}`), config.servers.length ? `Higgsfield MCP servers found: ${config.servers.join(', ')}` : 'Higgsfield MCP servers are recognised by name or URL.', 'Restart any agent session that is already open.'].join('\n');
}

/**
 * The file as it was before install: its text, null when install created it, or undefined when the
 * user changed it since (then only our entry is removed). Proven by re-adding our entry to the backup.
 */
function original(a, recorded, current) {
  if (!recorded) return undefined;
  const before = recorded.created ? null : readText(recorded.backup ?? '');
  if (!recorded.created && before === null) return undefined;
  try { return a.add(before, hookCommand(a.name)) === current ? before : undefined; } catch { return undefined; }
}

function uninstall({ home = os.homedir(), purge = false } = {}) {
  const config = readConfig();
  const rows = [];
  for (const a of Object.values(AGENTS)) {
    const recorded = config.agents?.[a.name];
    const file = recorded?.file ?? a.file(home);
    const current = readText(file);
    if (current === null || !a.has(current)) continue;
    const before = original(a, recorded, current);
    if (before === null) fs.rmSync(file, { force: true });
    else if (before !== undefined) fs.writeFileSync(file, before);
    else fs.writeFileSync(file, a.remove(current));
    if (recorded?.backup) fs.rmSync(recorded.backup, { force: true });
    rows.push(`  ${a.name.padEnd(7)} ${short(home, file)}`);
  }
  fs.rmSync(path.join(guardHome(), 'runtime'), { recursive: true, force: true });
  fs.rmSync(configFile(), { force: true });
  if (purge) fs.rmSync(guardHome(), { recursive: true, force: true });
  return ['higgsfield-guard removed from:', ...rows, purge ? 'Log and allowance deleted.' : `Log kept in ${short(home, guardHome())}.`].join('\n');
}

function statusLines(home = os.homedir()) {
  return Object.values(AGENTS).map((a) => {
    if (!a.detect(home)) return `${a.name.padEnd(7)} not found`;
    if (a.name === 'claude' && pluginEnabled(home)) return `${a.name.padEnd(7)} protected (plugin)`;
    return `${a.name.padEnd(7)} ${a.has(readText(a.file(home))) ? 'protected' : 'not protected (run higgsfield-guard install)'}`;
  });
}

module.exports = { install, uninstall, statusLines, hookCommand };
