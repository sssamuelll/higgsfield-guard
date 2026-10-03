'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.HIGGSFIELD_GUARD_LANG = 'en';
process.env.HIGGSFIELD_GUARD_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'hg-cmd-'));
process.env.HIGGSFIELD_GUARD_CLI = path.join(__dirname, '..', 'fixtures', 'fake-higgsfield.js');
const commands = require('../lib/commands');
const allowance = require('../lib/allowance');

const call = (argv) => {
  const opt = (name) => { const i = argv.indexOf(`--${name}`); if (i === -1) return undefined; const v = argv[i + 1]; return v === undefined || v.startsWith('--') ? true : v; };
  return { argv, opt };
};

test('approve, once and clear', async () => {
  assert.match(await commands.approve(call(['approve', '120', '--minutes', '30'])), /^Allowance: 120 credits, until/);
  assert.equal(allowance.read().credits, 120);
  assert.match(await commands.approve(call(['approve', '--once'])), /^Allowance: the next Higgsfield call/);
  assert.equal(await commands.approve(call(['approve', '--clear'])), 'Allowance cleared.');
  await assert.rejects(commands.approve(call(['approve'])), /credits/);
});

test('status reports CLI, balance and allowance', async () => {
  await commands.approve(call(['approve', '50']));
  const s = await commands.status(call(['status']));
  assert.match(s, /Higgsfield CLI: found, balance 200\.24 credits/);
  assert.match(s, /Allowance: 50 credits/);
});

test('log renders the last entries', async () => {
  require('../lib/log').append({ agent: 'codex', decision: 'deny', tool: 'generate_image', cost: 2, balance: 198 });
  assert.match(await commands.log(call(['log', '--n', '5'])), /codex\s+deny\s+generate_image/);
});
