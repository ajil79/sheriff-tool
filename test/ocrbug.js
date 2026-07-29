// Reproduces the phantom "Traffic vehicle" rows by running the REAL source of
// buildOcrReviewChanges() extracted verbatim from index.html, under a minimal
// stub of the globals it closes over. Tesseract can't run in jsdom, so this
// exercises the exact function the OCR path calls rather than the UI around it.
const fs = require('fs');

const html = fs.readFileSync((process.argv[2] || __dirname + '/../index.html'), 'utf8');

// Extract buildOcrReviewChanges by brace matching, verbatim.
const start = html.indexOf('function buildOcrReviewChanges');
if (start < 0) { console.error('function not found'); process.exit(2); }
let depth = 0, i = html.indexOf('{', start), end = i;
for (; i < html.length; i++) {
  if (html[i] === '{') depth++;
  else if (html[i] === '}') { depth--; if (!depth) { end = i; break; } }
}
const src = html.slice(start, end + 1);

// Stubs for what the function closes over.
const norm = v => String(v == null ? '' : v).trim();
const getLines = v => norm(v) ? norm(v).split('\n').filter(Boolean) : [];
const countUniqueAddedLines = () => 0;
const buildWeaponsEvidenceLines = a => a;
const parseEvidenceSerials = () => [];

// A MELROADS-style OCR result, as the parser would hand it over.
const parsed = {
  offender: { name: 'Marcus Bellamy' },
  vehicle: {
    rego: 'VHY 86', model: 'OBEY OMNIS VENUMM', colour: 'YELLOW',
    registered: 'NO', expires: '18/05/2026 - 11:13', stolen: 'NO',
    suspended: 'NO', owner: 'MARCUS BELLAMY',
  },
};

function run(label, trafficWarrantState, enabledTypes) {
  const state = {
    offender: {}, sheriffWarrant: {}, trafficWarrant: trafficWarrantState,
    officersList: '', itemsList: '', evidence: '', enteredBy: '', enteredUnit: '',
  };
  const fn = new Function(
    'state', 'norm', 'getLines', 'countUniqueAddedLines',
    'buildWeaponsEvidenceLines', 'parseEvidenceSerials', 'ENABLED_REPORT_TYPES',
    src + '; return buildOcrReviewChanges;'
  )(state, norm, getLines, countUniqueAddedLines, buildWeaponsEvidenceLines, parseEvidenceSerials,
    enabledTypes || ['sheriff_arrest', 'sheriff_warrant', 'sheriff_court', 'sheriff_debt']);

  const changes = fn(parsed, '');
  const bySection = {};
  changes.forEach(c => { bySection[c.section] = (bySection[c.section] || 0) + 1; });
  const phantom = changes.filter(c => c.section === 'Traffic vehicle');
  console.log(`\n── ${label}`);
  console.log(`   total rows shown to the user : ${changes.length}`);
  console.log(`   rows by section              : ${JSON.stringify(bySection)}`);
  console.log(`   phantom "Traffic vehicle"    : ${phantom.length}`);
  if (phantom.length) console.log(`   e.g. "${phantom[0].section} - ${phantom[0].label}"`);
  return phantom.length;
}

// As shipped: traffic_warrant is not in ENABLED_REPORT_TYPES.
const live = run('as shipped (traffic_warrant not enabled)', { rego: '', model: '' });
// If the feature is ever re-enabled, the rows must come back.
const revived = run('feature revived (traffic_warrant enabled)', { rego: '', model: '' },
  ['sheriff_arrest', 'sheriff_warrant', 'sheriff_court', 'sheriff_debt', 'traffic_warrant']);

console.log('\n' + '─'.repeat(62));
const ok = live === 0 && revived === 8;
console.log(ok
  ? `PASS: 0 phantom rows as shipped; all ${revived} return if the feature is re-enabled.`
  : `FAIL: shipped=${live} (want 0), revived=${revived} (want 8)`);
process.exit(ok ? 0 : 1);
