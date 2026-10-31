#!/bin/bash
set -e
npm install
node scripts/repair-quote-totals.mjs
