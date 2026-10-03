'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'hg-install-'));
process.env.HIGGSFIELD_GUARD_HOME = path.join(HOME, '.higgsfield-guard');
process.env.HIGGSFIELD_GUARD_LANG = 'en';
const { install, uninstall, statusLines } = require('../lib/install');
const PKG = path.join(__dirname, '..');
const w = (rel, text) => { fs.mkdirSync(path.dirname(path.join(HOME, rel)), { recursive: true }); fs.writeFileSync(path.join(HOME, rel), text); };
const r = (rel) => fs.readFileSync(path.join(HOME, rel), 'utf8');

const claudeBefore = JSON.stringify({ permissions: { allow: ['Read'] }, hooks: { SubagentStart: [{ matcher: '*', hooks: [{ type: 'command', command: 'node kpi.js' }] }] } }, null, 2) + '\n';
const codexBefore = '{\n    "hooks": {}\n}\n';
const kimiBefore = '# my model\ndefault_model = "kimi-code/k3"\n\n[thinking]\nenabled = true\n';
const claudeJson = JSON.stringify({ mcpServers: { media: { type: 'http', url: 'https://mcp.higgsfield.ai/mcp' }, other: { command: 'x' } } });

w('.claude/settings.json', claudeBefore);
w('.claude.json', claudeJson);
w('.codex/hooks.json', codexBefore);
w('.kimi-code/config.toml', kimiBefore);
fs.mkdirSync(path.join(HOME, '.cursor'));

test('install adds one entry per detected agent and copies the runtime', () => {
  const report = install({ home: HOME, pkgRoot: PKG });
  assert.match(report, /claude/);
  assert.match(report, /gemini\s+not found/);
  const claude = JSON.parse(r('.claude/settings.json'));
  assert.equal(claude.hooks.PreToolUse.length, 1);
  assert.match(claude.hooks.PreToolUse[0].hooks[0].command, /higgsfield-guard\.js" hook --agent claude$/);
  assert.deepEqual(claude.permissions, { allow: ['Read'] });
  assert.equal(JSON.parse(r('.codex/hooks.json')).hooks.PreToolUse[0].hooks[0].commandWindows.includes('--agent codex'), true);
  assert.equal(JSON.parse(r('.cursor/hooks.json')).hooks.beforeMCPExecution.length, 1);
  assert.match(r('.kimi-code/config.toml'), /# >>> higgsfield-guard[\s\S]*event = "PreToolUse"[\s\S]*# <<< higgsfield-guard/);
  assert.ok(r('.kimi-code/config.toml').startsWith(kimiBefore));
  assert.ok(fs.existsSync(path.join(HOME, '.higgsfield-guard', 'runtime', 'bin', 'higgsfield-guard.js')));
  const config = JSON.parse(fs.readFileSync(path.join(HOME, '.higgsfield-guard', 'config.json'), 'utf8'));
  assert.deepEqual(config.servers, ['media']);
  assert.ok(fs.readdirSync(path.join(HOME, '.claude')).some((f) => f.includes('higgsfield-guard-backup')));
});

test('install twice keeps one entry', () => {
  install({ home: HOME, pkgRoot: PKG });
  assert.equal(JSON.parse(r('.claude/settings.json')).hooks.PreToolUse.length, 1);
  assert.equal(r('.kimi-code/config.toml').split('# >>> higgsfield-guard').length, 2);
});

test('status lists protected agents', () => {
  const lines = statusLines(HOME).join('\n');
  assert.match(lines, /claude\s+protected/);
  assert.match(lines, /gemini\s+not found/);
});

test('uninstall restores every file byte for byte', () => {
  uninstall({ home: HOME });
  assert.equal(r('.claude/settings.json'), claudeBefore);
  assert.equal(r('.codex/hooks.json'), codexBefore);
  assert.equal(r('.kimi-code/config.toml'), kimiBefore);
  assert.equal(fs.existsSync(path.join(HOME, '.cursor', 'hooks.json')), false);
  assert.equal(fs.existsSync(path.join(HOME, '.higgsfield-guard', 'runtime')), false);
});

test('uninstall removes only its own entries when the user changed the file meanwhile', () => {
  install({ home: HOME, pkgRoot: PKG });
  const s = JSON.parse(r('.claude/settings.json'));
  s.model = 'opus';
  fs.writeFileSync(path.join(HOME, '.claude/settings.json'), JSON.stringify(s, null, 2) + '\n');
  uninstall({ home: HOME });
  const after = JSON.parse(r('.claude/settings.json'));
  assert.equal(after.model, 'opus');
  assert.equal(after.hooks.PreToolUse, undefined);
  assert.equal(after.hooks.SubagentStart.length, 1);
});

test('reinstalling, then uninstalling, keeps edits the user made in between', () => {
  install({ home: HOME, pkgRoot: PKG });
  const s = JSON.parse(r('.claude/settings.json'));
  s.theme = 'dark';
  w('.claude/settings.json', JSON.stringify(s, null, 2) + '\n');
  const c = JSON.parse(r('.cursor/hooks.json'));
  c.hooks.stop = [{ command: 'node mine.js' }];
  w('.cursor/hooks.json', JSON.stringify(c, null, 2) + '\n');
  install({ home: HOME, pkgRoot: PKG });
  uninstall({ home: HOME });
  assert.equal(JSON.parse(r('.claude/settings.json')).theme, 'dark');
  assert.deepEqual(JSON.parse(r('.cursor/hooks.json')).hooks.stop, [{ command: 'node mine.js' }]);
});

test('a config that is not plain JSON is skipped and the rest still installs', () => {
  const jsonc = '{\n  // my comment\n  "theme": "x"\n}\n';
  w('.gemini/settings.json', jsonc);
  const report = install({ home: HOME, pkgRoot: PKG });
  assert.match(report, /gemini\s+skipped/);
  assert.equal(r('.gemini/settings.json'), jsonc);
  assert.equal(JSON.parse(r('.claude/settings.json')).hooks.PreToolUse.length, 1);
  assert.ok(fs.existsSync(path.join(process.env.HIGGSFIELD_GUARD_HOME, 'config.json')));
  uninstall({ home: HOME });
});
