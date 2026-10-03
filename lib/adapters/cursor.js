'use strict';
const { PASS } = require('./common');

module.exports = {
  name: 'cursor',
  mode: 'ask',
  parse(i) {
    if (i.hook_event_name === 'beforeMCPExecution') {
      let args = i.tool_input;
      if (typeof args === 'string') { try { args = JSON.parse(args); } catch { args = {}; } }
      return { kind: 'mcp', server: String(i.mcp_server_name ?? ''), url: String(i.mcp_server_url ?? i.url ?? i.command ?? ''), tool: String(i.tool_name ?? '').replace(/^MCP:/, ''), args: args ?? {} };
    }
    if (i.hook_event_name === 'beforeShellExecution') return { kind: 'shell', command: String(i.command ?? ''), cwd: i.cwd };
    if (i.hook_event_name === 'preToolUse' && (i.tool_name === 'Write' || i.tool_name === 'Delete')) {
      const ti = i.tool_input ?? {};
      return { kind: 'write', path: ti.file_path ?? ti.path ?? ti.target_file, cwd: i.cwd };
    }
    return null;
  },
  render(d) {
    if (d.action === 'pass') return PASS;
    return { stdout: JSON.stringify({ permission: d.action, user_message: d.reason, agent_message: d.reason }), stderr: '', code: 0 };
  },
};
