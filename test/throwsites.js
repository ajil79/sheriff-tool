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

// Legacy draft: an old autosave whose reportType no longer exists must not throw.
(async () => {
  const errors = [];
  const vc = new VirtualConsole()
    .on('jsdomError', e => errors.push(e.message))
    .on('error', (...a) => errors.push(a.join(' ')));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://sheriff-tool.vercel.app/', virtualConsole: vc,
    beforeParse(w) {
      w.localStorage.setItem('sheriff_report_autosave', JSON.stringify({
        reportType: 'traffic_warrant',
        offender: { name: 'Legacy Draft' },
      }));
    },
  });
  await new Promise(r => setTimeout(r, 600));
  const sel = dom.window.document.getElementById('reportType');
  console.log('\n── legacy draft (reportType: "traffic_warrant")');
  console.log(`   coerced to    : ${sel ? sel.value : '(no selector)'}`);
  console.log(`   page errors   : ${errors.length ? errors.join(' | ') : '(none)'}`);
  const legacyOk = sel && sel.value === 'sheriff_arrest' && errors.length === 0;
  if (!legacyOk) fails++;
  console.log('\n' + '─'.repeat(58));
  console.log(fails === 0 ? 'PASS: no throw sites, legacy draft coerces cleanly.' : `FAIL: ${fails} problem(s)`);
  dom.window.close();
  process.exit(fails === 0 ? 0 : 1);
})();
