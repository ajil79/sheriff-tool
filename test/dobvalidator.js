// VALIDATORS.dob checked day<1||day>31 but never confirmed the constructed
// Date actually round-trips — new Date(2000, 1, 31) silently rolls over to
// March, so "31/02/2000" passed validation with no warning and the invalid
// string still landed on the generated warrant. Pure-function test: extract
// the real VALIDATORS object verbatim (brace matching, same approach as
// test/throwsites.js uses for INITIAL_STATE) and exercise .dob directly —
// no jsdom needed, matching test/amounts.js's convention for pure logic.
const fs = require('fs');
const path = require('path');

const target = process.argv[2] || path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(target, 'utf8');

const start = src.indexOf('const VALIDATORS = {');
if (start < 0) throw new Error('VALIDATORS not found');
let depth = 0, i = src.indexOf('{', start), end = i;
for (; i < src.length; i++) {
  if (src[i] === '{') depth++;
  else if (src[i] === '}') { depth--; if (!depth) { end = i; break; } }
}
const VALIDATORS = new Function('return ' + src.slice(start + 'const VALIDATORS = '.length, end + 1))();

let failed = 0;
const eq = (label, got, want) => {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(46)} ${JSON.stringify(got)}${ok ? '' : '  want ' + JSON.stringify(want)}`);
};

console.log('VALIDATORS.dob — day-of-month must actually exist in the given month');
eq('the reported bug: Feb 31 no longer silently passes', VALIDATORS.dob('31/02/2000'), 'Invalid day for that month');
eq('Apr 31 (30-day month) rejected', VALIDATORS.dob('31/04/2000'), 'Invalid day for that month');
eq('leap year Feb 29 still valid', VALIDATORS.dob('29/02/2024'), null);
eq('non-leap year Feb 29 rejected', VALIDATORS.dob('29/02/2023'), 'Invalid day for that month');
eq('ordinary valid date unaffected', VALIDATORS.dob('15/06/1994'), null);
eq('2-digit year still works', VALIDATORS.dob('15/06/05'), null); // -> 2005, safely in the past
eq('month still validated first', VALIDATORS.dob('15/13/2000'), 'Invalid month');
eq('empty stays optional (null = no error)', VALIDATORS.dob(''), null);

console.log('');
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
