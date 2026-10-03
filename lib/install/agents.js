'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { ours } = require('./files');

const parse = (text) => (text && text.replace(/^﻿/, '').trim() ? JSON.parse(text.replace(/^﻿/, '')) : {});
const dump = (data) => `${JSON.stringify(data, null, 2)}\n`;
const exists = (p) => fs.existsSync(p);

// Claude Code, Codex and Gemini share { hooks: { Event: [ { matcher, hooks: [ {...} ] } ] } }.
function nested(event, entry) {
  return {
    add(text, cmd) {
      const data = parse(text);
      data.hooks ??= {};
      data.hooks[event] = (data.hooks[event] ?? []).filter((e) => !(e.hooks ?? []).some(ours));
      data.hooks[event].push(entry(cmd));
      return dump(data);
    },
    remove(text) {
      const data = parse(text);
      if (!data.hooks?.[event]) return text;
      data.hooks[event] = data.hooks[event].filter((e) => !(e.hooks ?? []).some(ours));
      if (!data.hooks[event].length) delete data.hooks[event];
      return dump(data);
    },
    has(text) {
      try { return (parse(text).hooks?.[event] ?? []).some((e) => (e.hooks ?? []).some(ours)); } catch { return false; }
    },
  };
}

const CURSOR_EVENTS = {
  beforeMCPExecution: (cmd) => ({ command: cmd, timeout: 60 }),
  beforeShellExecution: (cmd) => ({ command: cmd, timeout: 60 }),
  preToolUse: (cmd) => ({ command: cmd, timeout: 60, matcher: 'Write|Delete' }),
};

const cursor = {
  add(text, cmd) {
    const data = parse(text);
    data.version ??= 1;
    data.hooks ??= {};
    for (const [event, make] of Object.entries(CURSOR_EVENTS)) {
      data.hooks[event] = (data.hooks[event] ?? []).filter((h) => !ours(h));
      data.hooks[event].push(make(cmd));
    }
    return dump(data);
  },
  remove(text) {
    const data = parse(text);
    for (const event of Object.keys(CURSOR_EVENTS)) {
      if (!data.hooks?.[event]) continue;
      data.hooks[event] = data.hooks[event].filter((h) => !ours(h));
      if (!data.hooks[event].length) delete data.hooks[event];
    }
    return dump(data);
  },
  has(text) {
    try { return Object.keys(CURSOR_EVENTS).some((e) => (parse(text).hooks?.[e] ?? []).some(ours)); } catch { return false; }
  },
};

const BEGIN = '# >>> higgsfield-guard (managed block: higgsfield-guard uninstall removes it)';
const END = '# <<< higgsfield-guard';
const BLOCK = /\n?# >>> higgsfield-guard[^\n]*\n[\s\S]*?# <<< higgsfield-guard\n?/g;
const kimi = {
  add(text, cmd) {
    const base = (text ?? '').replace(BLOCK, '');
    const sep = base === '' || base.endsWith('\n') ? '' : '\n';
    return `${base}${sep}\n${BEGIN}\n[[hooks]]\nevent = "PreToolUse"\nmatcher = ".*"\ncommand = '${cmd}'\ntimeout = 60\n${END}\n`;
  },
  remove(text) {
    return (text ?? '').replace(BLOCK, '');
  },
  has(text) {
    return /# >>> higgsfield-guard/.test(text ?? '');
  },
};

const AGENTS = {
  claude: {
    name: 'claude',
    file: (home) => path.join(home, '.claude', 'settings.json'),
    detect: (home) => exists(path.join(home, '.claude')),
    ...nested('PreToolUse', (cmd) => ({ matcher: 'mcp__.*|Bash|PowerShell|Write|Edit|MultiEdit|NotebookEdit', hooks: [{ type: 'command', command: cmd, timeout: 60 }] })),
  },
  cursor: {
    name: 'cursor',
    file: (home) => path.join(home, '.cursor', 'hooks.json'),
    detect: (home) => exists(path.join(home, '.cursor')),
    ...cursor,
  },
  codex: {
    name: 'codex',
    file: (home) => path.join(home, '.codex', 'hooks.json'),
    detect: (home) => exists(path.join(home, '.codex')),
    ...nested('PreToolUse', (cmd) => ({ matcher: '.*', hooks: [{ type: 'command', command: cmd, commandWindows: cmd, timeout: 60 }] })),
  },
  gemini: {
    name: 'gemini',
    file: (home) => path.join(home, '.gemini', 'settings.json'),
    detect: (home) => exists(path.join(home, '.gemini')),
    ...nested('BeforeTool', (cmd) => ({ matcher: '.*', hooks: [{ name: 'higgsfield-guard', type: 'command', command: cmd, timeout: 60000 }] })),
  },
  kimi: {
    name: 'kimi',
    file: (home) => (exists(path.join(home, '.kimi-code')) ? path.join(home, '.kimi-code', 'config.toml') : path.join(home, '.kimi', 'config.toml')),
    detect: (home) => exists(path.join(home, '.kimi-code')) || exists(path.join(home, '.kimi')),
    ...kimi,
  },
};

module.exports = { AGENTS };
