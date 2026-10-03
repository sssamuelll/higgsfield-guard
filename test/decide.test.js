'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.HIGGSFIELD_GUARD_LANG = 'en';
process.env.HIGGSFIELD_GUARD_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'hg-decide-'));
const { decide } = require('../lib/decide');
const log = require('../lib/log');

function ctx(mode, o = {}) {
  const logged = [];
  return {
    logged,
    agent: 'test', mode, config: {}, approveCmd: 'higgsfield-guard approve',
    deps: {
      cost: async (p) => (o.costs ?? { seedance_2_5: 60, kling3_0_turbo: 7.5 })[p.model] ?? null,
      balance: async () => (o.balance === undefined ? 200.24 : o.balance),
      consume: async () => o.consume ?? false,
      log: (e) => logged.push(e),
    },
  };
}
const video = (params) => ({ kind: 'mcp', server: 'higgsfield', tool: 'generate_video', args: { params } });

test('unrelated and free calls pass without logging', async () => {
  const c = ctx('ask');
  assert.deepEqual(await decide({ kind: 'shell', command: 'ls', cwd: '.' }, c), { action: 'pass' });
  assert.deepEqual(await decide({ kind: 'mcp', server: 'higgsfield', tool: 'balance', args: {} }, c), { action: 'pass' });
  assert.equal(c.logged.length, 0);
});

test('ask mode shows model, cost and balance', async () => {
  const c = ctx('ask');
  const d = await decide(video({ model: 'seedance_2_5', duration: 5, resolution: '1080p' }), c);
  assert.equal(d.action, 'ask');
  assert.equal(d.reason, 'Higgsfield generate_video: seedance_2_5 5s 1080p: 60 credits. Balance: 200.24. Approve?');
  assert.equal(c.logged[0].decision, 'ask');
});

test('block mode names the exact approve command', async () => {
  const d = await decide(video({ model: 'seedance_2_5', duration: 5 }), ctx('block'));
  assert.equal(d.action, 'deny');
  assert.match(d.reason, /higgsfield-guard approve 60$/);
});

test('unknown cost asks for --once and says so', async () => {
  const d = await decide(video({ model: 'mystery' }), ctx('block', { balance: null }));
  assert.match(d.reason, /mystery: cost not calculated\. Balance: unknown\./);
  assert.match(d.reason, /approve --once$/);
});

test('batches add up', async () => {
  const call = { kind: 'mcp', server: 'higgsfield', tool: 'generate_video_batch', args: { requests: [{ params: { model: 'seedance_2_5' } }, { params: { model: 'kling3_0_turbo' } }] } };
  const d = await decide(call, ctx('ask'));
  assert.match(d.reason, /seedance_2_5: 60 credits; kling3_0_turbo: 7\.5 credits\. Total: 67\.5 credits\./);
  const partial = await decide({ ...call, args: { requests: [{ params: { model: 'seedance_2_5' } }, { params: { model: 'mystery' } }] } }, ctx('ask'));
  assert.match(partial.reason, /Total: at least 60 credits\./);
});

test('an allowance lets the call pass and is logged', async () => {
  const c = ctx('block', { consume: true });
  assert.deepEqual(await decide(video({ model: 'seedance_2_5' }), c), { action: 'pass' });
  assert.equal(c.logged[0].decision, 'allowance');
  assert.equal(c.logged[0].cost, 60);
});

test('self-approval is denied in every mode', async () => {
  const d = await decide({ kind: 'shell', command: 'higgsfield-guard approve 500', cwd: '.' }, ctx('ask'));
  assert.equal(d.action, 'deny');
  assert.match(d.reason, /only the user can approve/);
});

test('shell spends explain themselves', async () => {
  const d = await decide({ kind: 'shell', command: 'higgsfield generate create z_image --prompt x', cwd: '.' }, ctx('ask'));
  assert.match(d.reason, /^This command runs Higgsfield generations/);
});

test('the log renders a table', () => {
  log.append({ agent: 'claude', decision: 'ask', tool: 'generate_video', cost: 60, balance: 200 });
  const table = log.render(log.readLast(5));
  assert.match(table, /claude\s+ask\s+generate_video\s+60\s+200/);
});
