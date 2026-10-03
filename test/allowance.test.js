'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

process.env.HIGGSFIELD_GUARD_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'hg-allow-'));
const a = require('../lib/allowance');

test('credits are deducted until they run out', async () => {
  await a.approve({ credits: 60 });
  assert.equal(await a.consume(25), true);
  assert.equal(a.read().credits, 35);
  assert.equal(await a.consume(40), false);
  assert.equal(await a.consume(null), false);
  assert.equal(await a.consume(35), true);
  assert.equal(await a.consume(1), false);
});

test('allowances expire', async () => {
  await a.approve({ credits: 60, minutes: 10, now: Date.now() - 11 * 60_000 });
  assert.equal(a.read(), null);
  assert.equal(await a.consume(1), false);
});

test('--once covers one call of any cost', async () => {
  await a.approve({ once: true });
  assert.equal(await a.consume(null), true);
  assert.equal(await a.consume(null), false);
});

test('clear and validation', async () => {
  await a.approve({ credits: 10 });
  await a.clear();
  assert.equal(a.read(), null);
  await assert.rejects(a.approve({ credits: 0 }));
  await assert.rejects(a.approve({ credits: -5 }));
});

test('four processes cannot spend one allowance twice', async () => {
  await a.approve({ credits: 60 });
  const lib = path.join(__dirname, '..', 'lib', 'allowance.js').replace(/\\/g, '/');
  const one = () => new Promise((resolve) => {
    const p = spawn(process.execPath, ['-e', `require('${lib}').consume(60).then((r) => process.stdout.write(String(r)))`], { env: process.env });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('close', () => resolve(out));
  });
  const results = await Promise.all([one(), one(), one(), one()]);
  assert.deepEqual(results.sort(), ['false', 'false', 'false', 'true']);
});
