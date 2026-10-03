'use strict';
const os = require('node:os');
const path = require('node:path');

/** Where higgsfield-guard keeps its runtime copy, config, allowance and log. */
function guardHome() {
  return process.env.HIGGSFIELD_GUARD_HOME || path.join(os.homedir(), '.higgsfield-guard');
}

module.exports = { guardHome };
