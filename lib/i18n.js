'use strict';

function isSpanish() {
  const forced = process.env.HIGGSFIELD_GUARD_LANG;
  if (forced) return /^es/i.test(forced);
  let locale = '';
  try { locale = Intl.DateTimeFormat().resolvedOptions().locale || ''; } catch { /* no Intl data */ }
  return /^es/i.test(locale || process.env.LC_ALL || process.env.LANG || '');
}

const en = {
  credits: (n) => `${n} credits`,
  unknown: 'cost not calculated',
  atLeast: (n) => `at least ${n} credits`,
  balanceUnknown: 'unknown',
  spend: (tool, items, total, balance) => `Higgsfield ${tool}: ${items}.${total ? ` Total: ${total}.` : ''} Balance: ${balance}.`,
  askTail: 'Approve?',
  denyTail: (cmd) => `Blocked by higgsfield-guard. To allow it, run this in your own terminal, then retry: ${cmd}`,
  shell: (balance) => `This command runs Higgsfield generations, which spend credits. Balance: ${balance}. Check the price first with "higgsfield generate cost".`,
  self: (cmd) => `Blocked by higgsfield-guard: only the user can approve spending or remove the guard, from their own terminal (${cmd}).`,
  failure: (why) => `higgsfield-guard could not check this Higgsfield call (${why}). It may spend credits.`,
  approved: (a) => (a.once ? 'Allowance: the next Higgsfield call, ' : `Allowance: ${a.credits} credits, `) + `until ${new Date(a.expiresAt).toLocaleTimeString()}.`,
  cleared: 'Allowance cleared.',
  noAllowance: 'No allowance.',
};

const es = {
  credits: (n) => `${n} créditos`,
  unknown: 'costo sin calcular',
  atLeast: (n) => `al menos ${n} créditos`,
  balanceUnknown: 'desconocido',
  spend: (tool, items, total, balance) => `Higgsfield ${tool}: ${items}.${total ? ` Total: ${total}.` : ''} Saldo: ${balance}.`,
  askTail: '¿Lo apruebas?',
  denyTail: (cmd) => `Bloqueado por higgsfield-guard. Para permitirlo, corre esto en tu propia terminal y vuelve a intentar: ${cmd}`,
  shell: (balance) => `Este comando corre generaciones de Higgsfield, que gastan créditos. Saldo: ${balance}. Revisa el precio antes con "higgsfield generate cost".`,
  self: (cmd) => `Bloqueado por higgsfield-guard: solo tú puedes aprobar gastos o quitar el guardrail, desde tu propia terminal (${cmd}).`,
  failure: (why) => `higgsfield-guard no pudo revisar esta llamada a Higgsfield (${why}). Puede gastar créditos.`,
  approved: (a) => (a.once ? 'Permiso: la próxima llamada a Higgsfield, ' : `Permiso: ${a.credits} créditos, `) + `hasta las ${new Date(a.expiresAt).toLocaleTimeString()}.`,
  cleared: 'Permiso borrado.',
  noAllowance: 'No hay permiso vigente.',
};

const t = () => (isSpanish() ? es : en);

module.exports = { t, isSpanish };
