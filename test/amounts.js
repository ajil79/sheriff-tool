// Money and phone normalisation. Pure string handling, so the real functions are
// extracted from index.html and exercised directly — no jsdom needed.
//
// Regression under test: normalizeSheriffAmount used to strip every non-digit,
// decimal point included, so "$13,301.50" became "1330150" — 100x the real debt,
// interpolated straight into a !cleardebt bot command.
const fs = require('fs');
const path = require('path');

const target = process.argv[2] || path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(target, 'utf8');

function grab(name) {
  const i = src.indexOf('function ' + name);
  if (i < 0) throw new Error('not found: ' + name);
  const bodyStart = src.indexOf('{', src.indexOf(') {', i));
  let d = 0, k;
  for (k = bodyStart; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) break; }
  }
  return src.slice(i, k + 1);
}

const normalizeSheriffAmount = new Function(grab('normalizeSheriffAmount') + '; return normalizeSheriffAmount;')();
const normalizeSheriffPhone = new Function(grab('normalizeSheriffPhone') + '; return normalizeSheriffPhone;')();
const formatSheriffAmountForText = new Function(
  grab('normalizeSheriffAmount') + grab('formatSheriffAmountForText') + '; return formatSheriffAmountForText;')();

let failed = 0;
const eq = (label, got, want) => {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(46)} ${JSON.stringify(got)}${ok ? '' : '  want ' + JSON.stringify(want)}`);
};

console.log('normalizeSheriffAmount');
eq('the reported bug: $13,301.50', normalizeSheriffAmount('$13,301.50'), '13301.50');
eq('whole amount stays whole', normalizeSheriffAmount('13301'), '13301');
eq('thousands separator only', normalizeSheriffAmount('$1,717'), '1717');
eq('single decimal place kept', normalizeSheriffAmount('13301.5'), '13301.5');
eq('third decimal dropped', normalizeSheriffAmount('13301.509'), '13301.50');
eq('trailing lone dot dropped', normalizeSheriffAmount('13301.'), '13301');
eq('multiple dots do not merge digits', normalizeSheriffAmount('13.301.50'), '13.30');
eq('no digits at all', normalizeSheriffAmount('abc'), '');
eq('empty', normalizeSheriffAmount(''), '');
eq('null-safe', normalizeSheriffAmount(null), '');
eq('never emits a separator', /[,$ ]/.test(normalizeSheriffAmount('$13,301.50')), false);

console.log('\nnormalizeSheriffPhone (must stay digits-only)');
eq('real phone', normalizeSheriffPhone('330201'), '330201');
eq('short phone', normalizeSheriffPhone('1717'), '1717');
eq('strips punctuation', normalizeSheriffPhone('330-201'), '330201');
eq('a dot is not kept', normalizeSheriffPhone('330.201'), '330201');

console.log('\nformatSheriffAmountForText');
eq('cents shown in full', formatSheriffAmountForText('$13,301.50'), '$13,301.50');
eq('whole amount gains no .00', formatSheriffAmountForText('13301'), '$13,301');
eq('one decimal padded to two', formatSheriffAmountForText('13301.5'), '$13,301.50');
eq('falls back when unparseable', formatSheriffAmountForText('abc'), 'outstanding government debt');

console.log('');
console.log(failed ? `${failed} failed` : 'all amount checks passed');
process.exit(failed ? 1 : 0);
