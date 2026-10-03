'use strict';
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const SKIP = new Set(['prompt', 'medias', 'folder_id', 'count', 'use_unlim', 'get_cost', 'declined_preset_id', 'preset_id', 'draft_job_id', 'avatars', 'product_ids']);
const MEDIA_FLAGS = { start_image: '--start-image', end_image: '--end-image', image: '--image', video: '--video', audio: '--audio' };
const SAFE_KEY = /^[a-z][a-z0-9_]*$/;
const SAFE_MODEL = /^[\w.-]+$/;
const MINIMAL = ['duration', 'resolution', 'generate_audio', 'draft'];

/** The Higgsfield CLI as [command, ...prefixArgs], or null. A Windows npm shim is resolved to its JS entry, so no shell is ever used. */
function findCli(env = process.env) {
  const forced = env.HIGGSFIELD_GUARD_CLI;
  if (forced) return /\.[cm]?js$/i.test(forced) ? [process.execPath, forced] : [forced];
  const dirs = (env.PATH || env.Path || '').split(path.delimiter).filter(Boolean);
  for (const d of dirs) {
    if (process.platform === 'win32') {
      const exe = path.join(d, 'higgsfield.exe');
      if (fs.existsSync(exe)) return [exe];
      const js = path.join(d, 'node_modules', '@higgsfield', 'cli', 'bin', 'higgsfield.js');
      if (fs.existsSync(path.join(d, 'higgsfield.cmd')) && fs.existsSync(js)) return [process.execPath, js];
    } else {
      const bin = path.join(d, 'higgsfield');
      try { fs.accessSync(bin, fs.constants.X_OK); return [bin]; } catch { /* keep looking */ }
    }
  }
  return null;
}

function run(cli, args, timeoutMs) {
  return new Promise((resolve) => {
    if (!cli) return resolve(null);
    execFile(cli[0], [...cli.slice(1), ...args], { timeout: timeoutMs, windowsHide: true }, (err, stdout) => resolve(err ? null : String(stdout)));
  });
}

function parseCredits(text) {
  const m = /(\d[\d,]*(?:\.\d+)?)\s*credits?/i.exec(text ?? '');
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

function costFlags(p) {
  const flags = [];
  for (const [k, v] of Object.entries(p)) {
    if (SKIP.has(k) || !SAFE_KEY.test(k) || v === null || v === undefined || typeof v === 'object') continue;
    flags.push(`--${k}`, String(v));
  }
  for (const m of Array.isArray(p.medias) ? p.medias : []) {
    const flag = MEDIA_FLAGS[m?.role];
    if (flag && typeof m.value === 'string') flags.push(flag, m.value);
  }
  return flags;
}

function withoutModel(flags) {
  const i = flags.indexOf('--model');
  return i === -1 ? flags : [...flags.slice(0, i), ...flags.slice(i + 2)];
}

function createCost({ cli = findCli(), timeoutMs = 15000 } = {}) {
  const price = async (model, flags) => parseCredits(await run(cli, ['generate', 'cost', model, '--prompt', 'x', ...flags], timeoutMs));
  return {
    async cost(p) {
      if (!p || typeof p.model !== 'string' || !SAFE_MODEL.test(p.model)) return null;
      const full = await price(p.model, withoutModel(costFlags(p)));
      if (full !== null) return full;
      const minimal = MINIMAL.filter((k) => p[k] !== undefined && p[k] !== null).flatMap((k) => [`--${k}`, String(p[k])]);
      return price(p.model, minimal);
    },
    async balance() {
      return parseCredits(await run(cli, ['account', 'status'], timeoutMs));
    },
  };
}

module.exports = { createCost, findCli, costFlags, parseCredits };
