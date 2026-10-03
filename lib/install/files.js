'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');

const MARK = 'higgsfield-guard.js" hook --agent';
const ours = (h) => typeof h?.command === 'string' && h.command.includes(MARK);
const readText = (file) => { try { return fs.readFileSync(file, 'utf8'); } catch { return null; } };
const sha = (text) => crypto.createHash('sha256').update(text ?? '').digest('hex');
const stamp = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

module.exports = { MARK, ours, readText, sha, stamp };
