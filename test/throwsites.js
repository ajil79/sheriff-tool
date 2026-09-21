// Verifies the nine JSON.parse(JSON.stringify(INITIAL_STATE.<key>)) sites can no
// longer throw, by evaluating that exact expression against the real INITIAL_STATE
// extracted from the file. Also checks the legacy-draft coercion path.
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const file = (process.argv[2] || __dirname + '/../index.html');
const html = fs.readFileSync(file, 'utf8');

// Extract INITIAL_STATE verbatim by brace matching.
const start = html.indexOf('const INITIAL_STATE = {');
let depth = 0, i = html.indexOf('{', start), end = i;
for (; i < html.length; i++) {
  if (html[i] === '{') depth++;
  else if (html[i] === '}') { depth--; if (!depth) { end = i; break; } }
}
const INITIAL_STATE = new Function('return ' + html.slice(start + 'const INITIAL_STATE = '.length, end + 1))();

const KEYS = ['trafficWarrant', 'bailConditions', 'fieldContact', 'searchSeizure', 'vehicleInspection'];
console.log('── clone sites: JSON.parse(JSON.stringify(INITIAL_STATE.<key>))');
let fails = 0;
for (const k of KEYS) {
  let verdict;
  try {
    const cloned = JSON.parse(JSON.stringify(INITIAL_STATE[k]));
    verdict = cloned && typeof cloned === 'object'
      ? `ok    -> {${Object.keys(cloned).join(', ')}}`
      : `FAIL  -> cloned to ${JSON.stringify(cloned)}`;
    if (!cloned || typeof cloned !== 'object') fails++;
  } catch (e) {
    verdict = `THROWS -> ${e.constructor.name}: ${e.message}`;
    fails++;
  }
  console.log(`   ${k.padEnd(19)} ${verdict}`);
}

// Legacy draft: an old autosave whose reportType no longer exists must not throw,
// AND the actual input cards must become visible, not just the dropdown value.
//
// Regression under test: the dropdown correcting itself was not enough — the very
// first renderAll() (loadAutosave(); renderAll();) runs before the guarded
// updateReportTypeUI() wrapper is installed, so it hits the base version (no
// default/else branch) and leaves sheriffWarrantCard/chargesCard/officersCard/
// sentenceCard/narrativeCard all display:none. initSheriffUpgradeLayer() later
// fixed state.reportType and the dropdown's value but never re-ran
// updateReportTypeUI() to restore card visibility — a recruit with an old draft
// would see an almost-empty Report Tool with the dropdown claiming otherwise.
const LEGACY_REPORT_TYPES = ['arrest', 'sheriff_arrest_legacy', 'sheriff_warrant_legacy', 'bail_conditions', 'traffic_warrant', 'field_contact', 'search_seizure', 'vehicle_inspection'];
const CARD_IDS = ['sheriffWarrantCard', 'chargesCard', 'officersCard', 'sentenceCard', 'narrativeCard'];

(async () => {
  console.log('\n── legacy report types: dropdown AND cards must both correct themselves');
  for (const legacyType of LEGACY_REPORT_TYPES) {
    const errors = [];
    const vc = new VirtualConsole()
      .on('jsdomError', e => errors.push(e.message))
      .on('error', (...a) => errors.push(a.join(' ')));
    const dom = new JSDOM(html, {
      runScripts: 'dangerously', pretendToBeVisual: true,
      url: 'https://sheriff-tool.vercel.app/', virtualConsole: vc,
      beforeParse(w) {
        w.localStorage.setItem('sheriff_report_autosave', JSON.stringify({
          reportType: legacyType,
          offender: { name: 'Legacy Draft' },
        }));
      },
    });
    await new Promise(r => setTimeout(r, 600));
    const d = dom.window.document;
    const sel = d.getElementById('reportType');
    const coercedOk = sel && sel.value === 'sheriff_arrest';
    const hiddenCards = CARD_IDS.filter(id => {
      const card = d.getElementById(id);
      return !card || card.style.display === 'none' || dom.window.getComputedStyle(card).display === 'none';
    });
    const ok = coercedOk && errors.length === 0 && hiddenCards.length === 0;
    if (!ok) fails++;
    console.log(`   ${ok ? 'ok  ' : 'FAIL'}  reportType: "${legacyType}"`.padEnd(70) +
      `dropdown=${sel ? sel.value : '(none)'}${hiddenCards.length ? ' hidden-cards=' + hiddenCards.join(',') : ''}${errors.length ? ' errors=' + errors.join('|') : ''}`);
    dom.window.close();
  }

  console.log('\n' + '─'.repeat(58));
  console.log(fails === 0 ? 'PASS: no throw sites, legacy drafts coerce cleanly and cards render.' : `FAIL: ${fails} problem(s)`);
  process.exit(fails === 0 ? 0 : 1);
})();
