'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { guardHome } = require('./paths');

const LOCK_WAIT_MS = 5000;
const LOCK_STALE_MS = 5000;
const file = () => path.join(guardHome(), 'allowance.json');
const lockDir = () => path.join(guardHome(), 'allowance.lock');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withLock(fn) {
  fs.mkdirSync(guardHome(), { recursive: true });
  const started = Date.now();
  for (;;) {
    try {
      fs.mkdirSync(lockDir());
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try {
        if (Date.now() - fs.statSync(lockDir()).mtimeMs > LOCK_STALE_MS) { fs.rmdirSync(lockDir()); continue; }
      } catch { /* released meanwhile */ }
      if (Date.now() - started > LOCK_WAIT_MS) throw new Error('allowance lock timeout');
      await sleep(20 + Math.random() * 30);
    }
  }
  try {
    return await fn();
  } finally {
    try { fs.rmdirSync(lockDir()); } catch { /* already released */ }
  }
}

function read(now = Date.now()) {
  try {
    const a = JSON.parse(fs.readFileSync(file(), 'utf8'));
    return a && a.expiresAt > now ? a : null;
  } catch {
    return null;
  }
}

function write(a) {
  const tmp = `${file()}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(a));
  fs.renameSync(tmp, file());
}

async function approve({ credits = 0, once = false, minutes = 10, now = Date.now() } = {}) {
  if (!once && !(Number(credits) > 0)) throw new Error('credits must be a positive number');
  if (!(Number(minutes) > 0)) throw new Error('minutes must be a positive number');
  return withLock(() => {
    const a = { credits: once ? 0 : Number(credits), once, expiresAt: now + Number(minutes) * 60_000, createdAt: now };
    write(a);
    return a;
  });
}

async function clear() {
  return withLock(() => { try { fs.unlinkSync(file()); } catch { /* nothing to clear */ } });
}

/** Spends from the allowance when it covers `cost` (null = unknown). True means the call is covered. */
async function consume(cost, now = Date.now()) {
  return withLock(() => {
    const a = read(now);
    if (!a) return false;
    if (a.once) { fs.unlinkSync(file()); return true; }
    if (cost === null || cost === undefined || cost > a.credits) return false;
    a.credits = Math.round((a.credits - cost) * 100) / 100;
    write(a);
    return true;
  });
}

module.exports = { approve, clear, consume, read };
