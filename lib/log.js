'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { guardHome } = require('./paths');

const file = () => path.join(guardHome(), 'log.jsonl');

function append(entry) {
  try {
    fs.mkdirSync(guardHome(), { recursive: true });
    fs.appendFileSync(file(), `${JSON.stringify({ time: new Date().toISOString(), ...entry })}\n`);
  } catch { /* the log never blocks a decision */ }
}

function readLast(n = 20) {
  let lines;
  try { lines = fs.readFileSync(file(), 'utf8').trim().split('\n'); } catch { return []; }
  return lines.slice(-n).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

function render(entries) {
  if (!entries.length) return 'No decisions logged yet.';
  const head = ['time', 'agent', 'decision', 'tool', 'cost', 'balance'];
  const rows = entries.map((e) => [String(e.time).slice(0, 19).replace('T', ' '), e.agent ?? '', e.decision ?? '', e.tool ?? '', e.cost ?? '?', e.balance ?? '?'].map(String));
  const width = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  return [head, ...rows].map((r) => r.map((c, i) => c.padEnd(width[i])).join('  ').trimEnd()).join('\n');
}

module.exports = { append, readLast, render };
