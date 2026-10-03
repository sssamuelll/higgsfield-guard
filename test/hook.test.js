'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const BIN = path.join(__dirname, '..', 'bin', 'higgsfield-guard.js');
const FAKE = path.join(__dirname, '..', 'fixtures', 'fake-higgsfield.js');
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'hg-hook-'));
const env = { ...process.env, HIGGSFIELD_GUARD_HOME: HOME, HIGGSFIELD_GUARD_CLI: FAKE, HIGGSFIELD_GUARD_LANG: 'en' };

function hook(agent, payload, extraEnv = {}) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [BIN, 'hook', '--agent', agent], { env: { ...env, ...extraEnv } });
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (d) => (stdout += d));
    p.stderr.on('data', (d) => (stderr += d));
    p.on('close', (code) => resolve({ stdout, stderr, code }));
    p.stdin.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
  });
}
const video = { tool_name: 'mcp__claude_ai_Higgsfield__generate_video', tool_input: { params: { model: 'seedance_2_5', duration: 5, resolution: '1080p' } }, cwd: HOME };

test('claude: a generation asks with the price', async () => {
  const r = await hook('claude', video);
  const out = JSON.parse(r.stdout).hookSpecificOutput;
  assert.equal(out.permissionDecision, 'ask');
  assert.match(out.permissionDecisionReason, /60 credits\. Balance: 200\.24\. Approve\?/);
});

test('claude: unrelated commands pass silently', async () => {
  assert.deepEqual(await hook('claude', { tool_name: 'Bash', tool_input: { command: 'ls' }, cwd: HOME }), { stdout: '', stderr: '', code: 0 });
});

test('codex: a generation is denied with the approve command', async () => {
  const r = await hook('codex', { ...video, tool_name: 'mcp__higgsfield__generate_video' });
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.permissionDecisionReason, /approve 60$/);
});

test('kimi: a CLI generation exits 2 with the reason', async () => {
  const r = await hook('kimi', { tool_name: 'Bash', tool_input: { command: 'higgsfield generate create z_image --prompt x' }, cwd: HOME });
  assert.equal(r.code, 2);
  assert.match(r.stderr, /approve --once/);
});

test('kimi: a script that drives the CLI is blocked end to end', async () => {
  fs.writeFileSync(path.join(HOME, 'make.py'), "import subprocess\nsubprocess.run(['higgsfield', 'generate', 'create', 'z_image'])\n");
  const r = await hook('kimi', { tool_name: 'Bash', tool_input: { command: 'python make.py' }, cwd: HOME });
  assert.equal(r.code, 2);
  assert.match(r.stderr, /runs Higgsfield generations/);
});

test('unreadable input fails closed', async () => {
  const r = await hook('claude', 'not json');
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'ask');
  const k = await hook('kimi', 'not json');
  assert.equal(k.code, 2);
});

test('a hanging CLI hits the deadline and fails closed', async () => {
  const started = Date.now();
  const r = await hook('claude', video, { FAKE_HF_HANG: '1', HIGGSFIELD_GUARD_DEADLINE_MS: '800' });
  assert.ok(Date.now() - started < 6000);
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.permissionDecisionReason, /could not check/);
});

test('claude: a server from the project .mcp.json is gated end to end', async () => {
  fs.writeFileSync(path.join(HOME, '.mcp.json'), JSON.stringify({ mcpServers: { hf: { type: 'http', url: 'https://mcp.higgsfield.ai/mcp' } } }));
  const r = await hook('claude', { ...video, tool_name: 'mcp__hf__generate_video' });
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'ask');
});

test('an allowance lets a blocked agent through', async () => {
  process.env.HIGGSFIELD_GUARD_HOME = HOME;
  await require('../lib/allowance').approve({ credits: 60 });
  const r = await hook('codex', { ...video, tool_name: 'mcp__higgsfield__generate_video' });
  assert.deepEqual(r, { stdout: '', stderr: '', code: 0 });
});

test('unknown agent is an error', async () => {
  const r = await hook('nope', video);
  assert.equal(r.code, 2);
});
