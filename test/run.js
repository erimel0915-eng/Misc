#!/usr/bin/env node
/* Runs every check against the real game logic, headlessly.
 *   node test/run.js
 * Exits non-zero if anything fails, so it works as a pre-push gate. */
const { execFileSync } = require('child_process');
const path = require('path');

const SUITES = [
  ['validate.js',   'level structure, reachability, script references'],
  ['lasers.js',     'beam coverage vs. standable ground'],
  ['sim.js',        'engine, echoes, hazards, dialogue, endings, menus'],
  ['puzzles.js',    'the jump ladder and the first Echo puzzle'],
  ['solve-cut.js',  'the laser corridor, solved the intended way'],
  ['playthrough.js','all 26 rooms, start to ending'],
];

let failed = [];
for (const [file, what] of SUITES) {
  process.stdout.write(`\n\x1b[1m── ${file}\x1b[0m  ${what}\n`);
  try {
    const out = execFileSync(process.execPath, [path.join(__dirname, file)], { encoding: 'utf8' });
    const tail = out.trim().split('\n').slice(-1)[0];
    console.log('   ' + tail.trim());
  } catch (e) {
    failed.push(file);
    console.log((e.stdout || '').trim().split('\n').slice(-14).join('\n'));
    console.log(`   \x1b[31mFAILED\x1b[0m`);
  }
}
console.log(failed.length
  ? `\n\x1b[31m${failed.length} suite(s) failed: ${failed.join(', ')}\x1b[0m\n`
  : `\n\x1b[32mall ${SUITES.length} suites passed\x1b[0m\n`);
process.exit(failed.length ? 1 : 0);
