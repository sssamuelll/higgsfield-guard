'use strict';
const { mcpName, PASS } = require('./common');

const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

module.exports = {
  name: 'claude',
  mode: 'ask',
  parse(i) {
    const tool = String(i.tool_name ?? '');
    const ti = i.tool_input ?? {};
    const mcp = tool.startsWith('mcp__') ? mcpName(tool) : null;
    if (mcp) return { kind: 'mcp', ...mcp, args: ti };
    if (tool === 'Bash' || tool === 'PowerShell') return { kind: 'shell', command: String(ti.command ?? ''), cwd: i.cwd };
    if (WRITE_TOOLS.has(tool)) return { kind: 'write', path: ti.file_path ?? ti.notebook_path, cwd: i.cwd };
    return null;
  },
  render(d) {
    if (d.action === 'pass') return PASS;
    return { stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: d.action, permissionDecisionReason: d.reason } }), stderr: '', code: 0 };
  },
};
