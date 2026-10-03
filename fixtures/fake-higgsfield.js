#!/usr/bin/env node
'use strict';
// Stand-in for the Higgsfield CLI in tests: prices are duration x rate, rate 12 at 1080p, 7 otherwise, 3 for drafts.
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(`--${k}`); return i === -1 ? undefined : args[i + 1]; };
if (process.env.FAKE_HF_HANG) {
  setTimeout(() => {}, 20000); // long enough to trip every timeout, short enough not to leave orphans on Linux and macOS
} else if (args[0] === 'account') {
  console.log('someone@example.com — plus plan, 200.24 credits');
} else if (args[0] === 'generate' && args[1] === 'cost') {
  const model = args[2];
  if (model === 'nope') { console.error('Error: unknown model'); process.exit(1); }
  if (model === 'flaky' && opt('mode')) { console.error('Error: unsupported'); process.exit(1); }
  const rate = opt('draft') === 'true' ? 3 : opt('resolution') === '1080p' ? 12 : 7;
  console.log(`${Number(opt('duration') ?? 5) * rate} credits`);
} else {
  console.error(`unexpected: ${args.join(' ')}`);
  process.exit(1);
}
