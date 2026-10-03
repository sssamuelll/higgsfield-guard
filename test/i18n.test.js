'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { t, isSpanish } = require('../lib/i18n');

test('English when forced to en', () => {
  process.env.HIGGSFIELD_GUARD_LANG = 'en';
  assert.equal(isSpanish(), false);
  assert.equal(t().askTail, 'Approve?');
  assert.equal(t().credits(60), '60 credits');
});

test('Spanish when forced to es-VE', () => {
  process.env.HIGGSFIELD_GUARD_LANG = 'es-VE';
  assert.equal(isSpanish(), true);
  assert.equal(t().askTail, '¿Lo apruebas?');
  assert.match(t().denyTail('higgsfield-guard approve 60'), /higgsfield-guard approve 60/);
  delete process.env.HIGGSFIELD_GUARD_LANG;
});
