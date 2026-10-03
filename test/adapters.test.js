'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
process.env.HIGGSFIELD_GUARD_HOME = '/home/u/.higgsfield-guard';
const A = require('../lib/adapters');
const { mcpName } = require('../lib/adapters/common');

const ask = { action: 'ask', reason: 'Approve?' };
const deny = { action: 'deny', reason: 'Blocked.' };
const pass = { action: 'pass' };

test('mcpName handles both naming styles', () => {
  assert.deepEqual(mcpName('mcp__claude_ai_Higgsfield__generate_video'), { server: 'claude_ai_Higgsfield', tool: 'generate_video' });
  assert.deepEqual(mcpName('mcp_higgsfield_generate_video'), { server: 'higgsfield', tool: 'generate_video' });
  assert.deepEqual(mcpName('mcp_claude_ai_Higgsfield_balance'), { server: 'claude_ai_Higgsfield', tool: 'balance' });
  assert.equal(mcpName('Bash'), null);
});

test('claude', () => {
  assert.deepEqual(A.claude.parse({ tool_name: 'mcp__claude_ai_Higgsfield__generate_video', tool_input: { params: { model: 'x' } }, cwd: '/w' }),
    { kind: 'mcp', server: 'claude_ai_Higgsfield', tool: 'generate_video', args: { params: { model: 'x' } } });
  assert.deepEqual(A.claude.parse({ tool_name: 'PowerShell', tool_input: { command: 'higgsfield account' }, cwd: '/w' }), { kind: 'shell', command: 'higgsfield account', cwd: '/w' });
  assert.deepEqual(A.claude.parse({ tool_name: 'Edit', tool_input: { file_path: '/a/b' }, cwd: '/w' }), { kind: 'write', path: '/a/b', cwd: '/w' });
  assert.equal(A.claude.parse({ tool_name: 'Read', tool_input: {} }), null);
  assert.deepEqual(A.claude.render(pass), { stdout: '', stderr: '', code: 0 });
  assert.deepEqual(JSON.parse(A.claude.render(ask).stdout), { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: 'Approve?' } });
  assert.equal(A.claude.mode, 'ask');
});

test('cursor', () => {
  assert.deepEqual(A.cursor.parse({ hook_event_name: 'beforeMCPExecution', tool_name: 'generate_image', tool_input: '{"params":{"model":"x"}}', mcp_server_name: 'media', mcp_server_url: 'https://mcp.higgsfield.ai' }),
    { kind: 'mcp', server: 'media', url: 'https://mcp.higgsfield.ai', tool: 'generate_image', args: { params: { model: 'x' } } });
  assert.deepEqual(A.cursor.parse({ hook_event_name: 'beforeShellExecution', command: 'higgsfield generate create x', cwd: '/w' }), { kind: 'shell', command: 'higgsfield generate create x', cwd: '/w' });
  assert.deepEqual(A.cursor.parse({ hook_event_name: 'preToolUse', tool_name: 'Write', tool_input: { file_path: '/x' }, cwd: '/w' }), { kind: 'write', path: '/x', cwd: '/w' });
  assert.equal(A.cursor.parse({ hook_event_name: 'preToolUse', tool_name: 'Read', tool_input: {} }), null);
  assert.equal(A.cursor.render(pass).stdout, '');
  assert.deepEqual(JSON.parse(A.cursor.render(ask).stdout), { permission: 'ask', user_message: 'Approve?', agent_message: 'Approve?' });
});

test('codex', () => {
  assert.deepEqual(A.codex.parse({ tool_name: 'mcp__higgsfield__generate_video', tool_input: { params: {} }, cwd: '/w' }), { kind: 'mcp', server: 'higgsfield', tool: 'generate_video', args: { params: {} } });
  assert.deepEqual(A.codex.parse({ tool_name: 'Bash', tool_input: { command: 'ls' }, cwd: '/w' }), { kind: 'shell', command: 'ls', cwd: '/w' });
  const patch = A.codex.parse({ tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n*** Update File: notes.md\n*** Add File: /home/u/.higgsfield-guard/allowance.json\n*** End Patch' }, cwd: '/w' });
  assert.deepEqual(patch, { kind: 'write', path: '/home/u/.higgsfield-guard/allowance.json', cwd: '/w', paths: ['notes.md', '/home/u/.higgsfield-guard/allowance.json'] });
  assert.equal(A.codex.mode, 'block');
  assert.deepEqual(JSON.parse(A.codex.render(deny).stdout), { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'Blocked.' } });
  assert.deepEqual(A.codex.render({ ...deny, error: true }), { stdout: '', stderr: 'Blocked.', code: 2 });
});

test('gemini', () => {
  assert.deepEqual(A.gemini.parse({ tool_name: 'run_shell_command', tool_input: { command: 'ls' }, cwd: '/w' }), { kind: 'shell', command: 'ls', cwd: '/w' });
  assert.deepEqual(A.gemini.parse({ tool_name: 'mcp_higgsfield_generate_image', tool_input: { params: {} }, cwd: '/w' }), { kind: 'mcp', server: 'higgsfield', tool: 'generate_image', args: { params: {} } });
  assert.deepEqual(A.gemini.parse({ tool_name: 'replace', tool_input: { file_path: '/x' }, cwd: '/w' }), { kind: 'write', path: '/x', cwd: '/w' });
  assert.deepEqual(JSON.parse(A.gemini.render(deny).stdout), { decision: 'deny', reason: 'Blocked.' });
  assert.deepEqual(A.gemini.render({ ...deny, error: true }), { stdout: '', stderr: 'Blocked.', code: 2 });
});

test('kimi', () => {
  assert.deepEqual(A.kimi.parse({ tool_name: 'Bash', tool_input: { command: 'higgsfield generate create x' }, cwd: '/w' }), { kind: 'shell', command: 'higgsfield generate create x', cwd: '/w' });
  assert.deepEqual(A.kimi.render(pass), { stdout: '', stderr: '', code: 0 });
  assert.deepEqual(A.kimi.render(deny), { stdout: '', stderr: 'Blocked.', code: 2 });
});
