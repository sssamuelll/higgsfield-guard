'use strict';
const { genericCall, PASS } = require('./common');

module.exports = {
  name: 'gemini',
  mode: 'block',
  parse(i) {
    const call = genericCall(i.tool_name, i.tool_input, i.cwd);
    const ctx = i.mcp_context;
    if (call?.kind === 'mcp' && ctx && typeof ctx === 'object') {
      call.server = String(ctx.server_name ?? ctx.serverName ?? call.server);
      if (ctx.url) call.url = String(ctx.url);
    }
    return call;
  },
  render(d) {
    if (d.action === 'pass') return PASS;
    if (d.error) return { stdout: '', stderr: d.reason, code: 2 };
    return { stdout: JSON.stringify({ decision: 'deny', reason: d.reason }), stderr: '', code: 0 };
  },
};
