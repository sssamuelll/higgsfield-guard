'use strict';
const fs = require('node:fs');
const path = require('node:path');
const adapters = require('./adapters');
const { decide } = require('./decide');
const { createCost } = require('./cost');
const allowance = require('./allowance');
const log = require('./log');
const { t } = require('./i18n');
const { guardHome } = require('./paths');

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(path.join(guardHome(), 'config.json'), 'utf8')); } catch { return {}; }
}

function failure(adapter, why) {
  return adapter.render({ action: adapter.mode === 'ask' ? 'ask' : 'deny', reason: t().failure(why), error: true });
}

async function runHook(agentName, raw) {
  const adapter = adapters[agentName];
  if (!adapter) return { stdout: '', stderr: `higgsfield-guard: unknown agent "${agentName}"`, code: 2 };
  let input;
  try { input = JSON.parse(raw); } catch { return failure(adapter, 'unreadable hook input'); }
  let call;
  try { call = adapter.parse(input ?? {}); } catch (e) { return failure(adapter, `unreadable call: ${e.message}`); }
  if (!call) return adapter.render({ action: 'pass' });
  if (call.kind === 'mcp' && !call.cwd && typeof input.cwd === 'string') call.cwd = input.cwd; // finds project .mcp.json servers
  try {
    const config = loadConfig();
    const cost = createCost();
    const deps = { cost: cost.cost, balance: cost.balance, consume: allowance.consume, log: log.append };
    const d = await decide(call, { agent: agentName, mode: adapter.mode, config, approveCmd: config.approveCmd || 'higgsfield-guard approve', deps });
    return adapter.render(d);
  } catch (e) {
    return failure(adapter, e.message);
  }
}

module.exports = { runHook, failure };
