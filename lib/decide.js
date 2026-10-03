'use strict';
const { classify } = require('./classify');
const { t } = require('./i18n');

const fmt = (n) => String(Math.round(n * 100) / 100);

function item(p, cost, m) {
  const parts = [p?.model ?? '?'];
  if (p?.duration) parts.push(`${p.duration}s`);
  if (p?.resolution) parts.push(p.resolution);
  return `${parts.join(' ')}: ${cost === null ? m.unknown : m.credits(fmt(cost))}`;
}

async function decide(call, ctx) {
  const m = t();
  const c = classify(call, ctx.config || {});
  if (c.type === 'other' || c.type === 'free') return { action: 'pass' };
  if (c.type === 'self') {
    ctx.deps.log({ agent: ctx.agent, decision: 'deny-self', tool: call.tool ?? call.kind });
    return { action: 'deny', reason: m.self(`${ctx.approveCmd} <credits>`) };
  }
  const [costs, balance] = await Promise.all([Promise.all(c.requests.map((p) => ctx.deps.cost(p))), ctx.deps.balance()]);
  const known = c.requests.length > 0 && costs.every((x) => x !== null);
  const total = costs.reduce((s, x) => s + (x ?? 0), 0);
  const entry = { agent: ctx.agent, tool: call.tool ?? 'shell', cost: known ? total : null, balance };
  if (await ctx.deps.consume(known ? total : null)) {
    ctx.deps.log({ ...entry, decision: 'allowance' });
    return { action: 'pass' };
  }
  const bal = balance === null ? m.balanceUnknown : fmt(balance);
  let summary;
  if (call.kind === 'mcp') {
    const items = c.requests.map((p, i) => item(p, costs[i], m)).join('; ');
    const sum = c.requests.length > 1 ? (known ? m.credits(fmt(total)) : m.atLeast(fmt(total))) : null;
    summary = m.spend(call.tool, items, sum, bal);
  } else {
    summary = m.shell(bal);
  }
  if (ctx.mode === 'ask') {
    ctx.deps.log({ ...entry, decision: 'ask' });
    return { action: 'ask', reason: `${summary} ${m.askTail}` };
  }
  ctx.deps.log({ ...entry, decision: 'deny' });
  const approve = known ? `${ctx.approveCmd} ${Math.ceil(total)}` : `${ctx.approveCmd} --once`;
  return { action: 'deny', reason: `${summary} ${m.denyTail(approve)}` };
}

module.exports = { decide };
