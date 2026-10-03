'use strict';

/** Splits an MCP tool name: `mcp__server__tool` (Claude Code, Codex) or `mcp_server_tool` (Gemini). */
function mcpName(name) {
  let m = /^mcp__(.+?)__(.+)$/.exec(name);
  if (m) return { server: m[1], tool: m[2] };
  m = /^mcp_(.*?higgsfield[^_]*)_(.+)$/i.exec(name);
  if (m) return { server: m[1], tool: m[2] };
  m = /^mcp_([^_]+)_(.+)$/.exec(name);
  return m ? { server: m[1], tool: m[2] } : null;
}

/** Best effort for agents whose tool names are not fully documented. */
function genericCall(toolName, input, cwd) {
  const name = String(toolName ?? '');
  const ti = input && typeof input === 'object' ? input : {};
  const mcp = mcpName(name);
  if (mcp) return { kind: 'mcp', ...mcp, args: ti };
  if (typeof ti.command === 'string' && /bash|shell|command|terminal|exec/i.test(name)) return { kind: 'shell', command: ti.command, cwd };
  const p = ti.file_path ?? ti.path ?? ti.target_file;
  if (typeof p === 'string' && /write|edit|replace|patch|create|delete/i.test(name)) return { kind: 'write', path: p, cwd };
  return null;
}

const PASS = { stdout: '', stderr: '', code: 0 };

module.exports = { mcpName, genericCall, PASS };
