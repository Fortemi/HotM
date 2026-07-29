#!/usr/bin/env node

const { runCli } = require('./verify-live-asset-ci-receipt-matrix.cjs');

if (require.main === module) {
  process.exit(runCli(process.argv.slice(2)));
}

module.exports = require('./verify-live-asset-ci-receipt-matrix.cjs');
