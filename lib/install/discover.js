'use strict';
const path = require('node:path');
const { readText } = require('./files');

const HF = /higgsfield/i;

function fromJson(file, pick) {
  try {
    const data = JSON.parse(readText(file) ?? 'null');
    return Object.entries(pick(data) ?? {}).filter(([, cfg]) => HF.test(JSON.stringify(cfg))).map(([name]) => name);
  } catch {
    return [];
  }
}

function fromCodexToml(file) {
  const text = readText(file) ?? '';
  const found = new Set();
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const header = /^\s*\[mcp_servers\.(?:"([^"]+)"|([^\].]+))/.exec(line);
    if (header) { current = header[1] ?? header[2]; continue; }
    if (/^\s*\[/.test(line)) { current = null; continue; }
    if (current && HF.test(line)) found.add(current);
  }
  return [...found];
}

/** Names of MCP servers whose config points at Higgsfield, in every agent's user config. */
function discoverServers(home) {
  const projects = (d) => Object.values(d?.projects ?? {}).reduce((acc, p) => ({ ...acc, ...(p?.mcpServers ?? {}) }), {});
  const names = [
    ...fromJson(path.join(home, '.claude.json'), (d) => ({ ...(d?.mcpServers ?? {}), ...projects(d) })),
    ...fromJson(path.join(home, '.cursor', 'mcp.json'), (d) => d?.mcpServers),
    ...fromJson(path.join(home, '.gemini', 'settings.json'), (d) => d?.mcpServers),
    ...fromCodexToml(path.join(home, '.codex', 'config.toml')),
  ];
  return [...new Set(names)].sort();
}

module.exports = { discoverServers };
