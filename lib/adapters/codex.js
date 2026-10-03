'use strict';
const { genericCall, PASS } = require('./common');
const { isInsideGuard } = require('../classify');

module.exports = {
  name: 'codex',
  mode: 'block',
  parse(i) {
    if (i.tool_name === 'apply_patch') {
      const text = JSON.stringify(i.tool_input ?? '');
      const paths = [...text.matchAll(/\*\*\* (?:Add|Update|Delete) File: ([^\\"\n]+)/g)].map((m) => m[1].trim());
      if (!paths.length) return null;
      return { kind: 'write', path: paths.find((p) => isInsideGuard(p, i.cwd)) ?? paths[0], cwd: i.cwd, paths };
    }
    return genericCall(i.tool_name, i.tool_input, i.cwd);
  },
  render(d) {
    if (d.action === 'pass') return PASS;
    if (d.error) return { stdout: '', stderr: d.reason, code: 2 };
    return { stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: d.reason } }), stderr: '', code: 0 };
  },
};
