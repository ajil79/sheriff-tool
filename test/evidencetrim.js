// renderAll() used to populate evidenceItems twice: once with a per-line trim
// (immediately discarded), then again via ensureLines(...).split("\n") WITHOUT
// trimming individual lines — the version that stuck. A leading space on an
// evidence line (e.g. a hand-edited draft with " 3x Widget") broke the
// "NxItem" quantity-parsing regex, showing qty 1 / text "3x Widget" instead of
// qty 3 / text "Widget". Both duplicate population blocks, and the duplicated
// evidence-row HTML template, are now one shared getLines()/renderEvidenceRowsHtml().
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const file = (process.argv[2] || __dirname + '/../index.html');
const html = fs.readFileSync(file, 'utf8');
let fails = 0;
const check = (label, got, want) => {
  const ok = got === want;
  if (!ok) fails++;
  console.log(`   ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(58)} ${JSON.stringify(got)}${ok ? '' : '  want ' + JSON.stringify(want)}`);
};

(async () => {
  const errors = [];
  const vc = new VirtualConsole().on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://sheriff-tool.vercel.app/', virtualConsole: vc,
    beforeParse(w) {
      w.localStorage.setItem('sheriff_report_autosave', JSON.stringify({
        __type: 'sheriff_report_state',
        __schema: 1,
        savedAt: Date.now(),
        // A leading space before the qty prefix, and a bare item with trailing
        // whitespace, exactly as a hand-edited or pasted draft might contain.
        state: { evidence: ' 3x Widget\nBWC footage  \n\t2x Evidence bag' },
      }));
    },
  });
  await sleep(600);
  const d = dom.window.document;
  const rows = Array.from(d.querySelectorAll('#evidenceList .evidence-row'));

  check('page loaded without error', errors.length, 0);
  check('3 evidence rows rendered', rows.length, 3);

  const readRow = (row) => ({
    qty: row.querySelector('[data-ev-qty]')?.value,
    text: row.querySelector('.ev-text')?.textContent,
  });

  const row0 = readRow(rows[0]);
  check('row 0 qty parsed correctly despite leading space', row0.qty, '3');
  check('row 0 text does not include the qty prefix', row0.text, 'Widget');

  const row1 = readRow(rows[1]);
  check('row 1 (no qty prefix) defaults to qty 1', row1.qty, '1');
  check('row 1 text is trimmed of trailing whitespace', row1.text, 'BWC footage');

  const row2 = readRow(rows[2]);
  check('row 2 qty parsed correctly despite leading tab', row2.qty, '2');
  check('row 2 text', row2.text, 'Evidence bag');

  dom.window.close();

  console.log('\n' + '─'.repeat(66));
  console.log(fails === 0 ? 'PASS: evidence lines are trimmed before qty parsing.' : `FAIL: ${fails} check(s)`);
  process.exit(fails === 0 ? 0 : 1);
})();
