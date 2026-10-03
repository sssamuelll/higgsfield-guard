'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createCost, costFlags, parseCredits, findCli } = require('../lib/cost');

const FAKE = path.join(__dirname, '..', 'fixtures', 'fake-higgsfield.js');
const cli = [process.execPath, FAKE];

test('parseCredits reads the CLI output', () => {
  assert.equal(parseCredits('60 credits'), 60);
  assert.equal(parseCredits('someone — plus plan, 1,001.5 credits'), 1001.5);
  assert.equal(parseCredits('Error: nope'), null);
  assert.equal(parseCredits(null), null);
});

test('costFlags keeps scalars and media roles, drops the rest', () => {
  const flags = costFlags({ model: 'seedance_2_5', prompt: 'long text', duration: 5, resolution: '1080p', generate_audio: false, draft_job_id: 'x', medias: [{ role: 'start_image', value: 'id1' }, { role: 'weird', value: 'id2' }], 'Bad Key': 1 });
  assert.deepEqual(flags, ['--model', 'seedance_2_5', '--duration', '5', '--resolution', '1080p', '--generate_audio', 'false', '--start-image', 'id1']);
});

test('cost and balance through a CLI', async () => {
  const c = createCost({ cli, timeoutMs: 5000 });
  assert.equal(await c.cost({ model: 'seedance_2_5', duration: 5, resolution: '1080p' }), 60);
  assert.equal(await c.cost({ model: 'flaky', mode: 'omni_reference', duration: 5, resolution: '720p' }), 35);
  assert.equal(await c.cost({ model: 'nope' }), null);
  assert.equal(await c.cost({ prompt: 'no model' }), null);
  assert.equal(await c.balance(), 200.24);
});

test('no CLI means unknown, never an exception', async () => {
  const c = createCost({ cli: null });
  assert.equal(await c.cost({ model: 'seedance_2_5' }), null);
  assert.equal(await c.balance(), null);
});

test('a hanging CLI times out to unknown', async () => {
  process.env.FAKE_HF_HANG = '1';
  const started = Date.now();
  const c = createCost({ cli, timeoutMs: 300 });
  assert.equal(await c.balance(), null);
  assert.ok(Date.now() - started < 5000);
  delete process.env.FAKE_HF_HANG;
});

test('HIGGSFIELD_GUARD_CLI overrides discovery', () => {
  assert.deepEqual(findCli({ HIGGSFIELD_GUARD_CLI: FAKE }), [process.execPath, FAKE]);
  assert.equal(findCli({ PATH: '' }), null);
});
