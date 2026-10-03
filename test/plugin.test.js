'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const json = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const BIN = path.join(ROOT, 'bin', 'higgsfield-guard.js');

test('the plugin manifest matches the package', () => {
  const plugin = json('.claude-plugin/plugin.json');
  const pkg = json('package.json');
  assert.equal(plugin.name, 'higgsfield-guard');
  assert.equal(plugin.version, pkg.version);
  assert.equal(plugin.license, 'MIT');
});

test('the marketplace lists this repo as the plugin', () => {
  const m = json('.claude-plugin/marketplace.json');
  assert.equal(m.name, 'higgsfield-guard');
  assert.ok(m.owner.name);
  assert.deepEqual(m.plugins.map((p) => [p.name, p.source]), [['higgsfield-guard', './']]);
});

test('the plugin hook runs the guard for Claude Code with the installer\'s matcher', () => {
  const { AGENTS } = require('../lib/install/agents');
  const hooks = json('hooks/hooks.json').hooks;
  const pre = hooks.PreToolUse[0];
  assert.equal(pre.matcher, JSON.parse(AGENTS.claude.add(null, 'x')).hooks.PreToolUse[0].matcher);
  assert.equal(pre.hooks[0].command, 'node "${CLAUDE_PLUGIN_ROOT}/bin/higgsfield-guard.js" hook --agent claude');
  assert.equal(hooks.SessionStart[0].hooks[0].command, 'node "${CLAUDE_PLUGIN_ROOT}/bin/higgsfield-guard.js" sync');
  assert.ok(fs.existsSync(BIN));
});

test('sync records Higgsfield MCP servers with any name, and prints nothing', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hg-sync-'));
  fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ projects: { '/w': { mcpServers: { hf: { type: 'http', url: 'https://mcp.higgsfield.ai/mcp' } } } } }));
  const guard = path.join(home, 'guard');
  const r = spawnSync(process.execPath, [BIN, 'sync'], { env: { ...process.env, HOME: home, USERPROFILE: home, HIGGSFIELD_GUARD_HOME: guard }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(guard, 'config.json'), 'utf8')).servers, ['hf']);
});

test('install removes its own Claude Code hook once the plugin is enabled', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hg-move-'));
  process.env.HIGGSFIELD_GUARD_HOME = path.join(home, 'guard');
  const file = path.join(home, '.claude', 'settings.json');
  fs.mkdirSync(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify({ model: 'opus' }, null, 2) + '\n');
  const { install } = require('../lib/install');
  install({ home, pkgRoot: ROOT });
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  s.enabledPlugins = { 'higgsfield-guard@higgsfield-guard': true };
  fs.writeFileSync(file, JSON.stringify(s, null, 2) + '\n');
  install({ home, pkgRoot: ROOT });
  const after = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(after.hooks?.PreToolUse, undefined);
  assert.deepEqual(after.enabledPlugins, { 'higgsfield-guard@higgsfield-guard': true });
  assert.equal(after.model, 'opus');
});

test('install leaves Claude Code to the plugin when the plugin is enabled', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hg-plugin-'));
  process.env.HIGGSFIELD_GUARD_HOME = path.join(home, 'guard');
  const settings = JSON.stringify({ enabledPlugins: { 'higgsfield-guard@higgsfield-guard': true } }, null, 2) + '\n';
  fs.mkdirSync(path.join(home, '.claude'));
  fs.writeFileSync(path.join(home, '.claude', 'settings.json'), settings);
  const { install, statusLines } = require('../lib/install');
  assert.match(install({ home, pkgRoot: ROOT }), /claude\s+protected by the Claude Code plugin/);
  assert.equal(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'), settings);
  assert.match(statusLines(home).join('\n'), /claude\s+protected \(plugin\)/);
});
