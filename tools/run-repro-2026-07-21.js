/*
 * Runner della suite 2026-07-21 (WP-M4q -> M6c): esegue tutti i repro-*-2026-07-21.js
 * e stampa un riassunto. Esce con codice != 0 se anche uno solo fallisce.
 * Uso: node tools/run-repro-2026-07-21.js
 */
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');
const dir = __dirname;
const files = fs.readdirSync(dir)
  .filter(f => /^repro-.*-2026-07-21\.js$/.test(f) && f !== 'repro-harness-2026-07-21.js')
  .sort();
let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8' });
  const out = (r.stdout || '').trim().split('\n').pop() || '';
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log((ok ? '  OK   ' : '  FAIL ') + f.padEnd(38) + ' ' + out);
}
console.log('\n=== suite 2026-07-21: ' + (files.length - failed) + '/' + files.length + ' file OK ===');
process.exit(failed ? 1 : 0);
