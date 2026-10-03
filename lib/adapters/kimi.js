'use strict';
const { genericCall, PASS } = require('./common');

module.exports = {
  name: 'kimi',
  mode: 'block',
  parse(i) {
    return genericCall(i.tool_name ?? i.tool, i.tool_input ?? i.input, i.cwd);
  },
  render(d) {
    if (d.action === 'pass') return PASS;
    return { stdout: '', stderr: d.reason, code: 2 };
  },
};
