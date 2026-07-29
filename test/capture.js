// Output-equivalence harness for sheriff-tool.
// Drives the page through the DOM exactly as a user would, then dumps the
// generated preview text for every live report type. Implementation-agnostic
// on purpose: it must stay valid while internals are refactored.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const htmlPath = (process.argv[2] || __dirname + '/../index.html');
const outPath = process.argv[3];
if (!htmlPath || !outPath) {
  console.error('usage: node capture.js <index.html> <out.txt>');
  process.exit(2);
}

// Fixed field values. Keyed by element id; only ids that exist get filled.
const FIELDS = {
  enteredBy: 'Stephen Palmes',
  reportDateTime: '14/06/2026 20:50',
  enteredUnit: 'SRF 116',
  offenderName: 'Marcus Bellamy',
  offenderDOB: '1994-08-21',
  offenderSex: 'M',
  offenderAddress: '12 Power Street, Pillbox Hill',
  offenderPhone: '555104',
  officersList: 'SRF 116 - Sheriff Sergeant Stephen Palmes',
  summary: 'Vehicle stopped, ID sighted, then failed to remain stopped and fled.',
  evidence: 'Bodycam Link: [TRAINING EXAMPLE]',
  sentence: '',
  sentenceApproval: '',
  victims: '',
  sigName: 'Stephen Palmes',
  sigRank: 'Sheriff Sergeant',
  sigDivision: "Sheriff's Office",
  sigCallsign: 'SRF 116',
  swRego: 'VHY 86',
  swModel: 'OBEY OMNIS VENUMM',
  swColour: 'YELLOW',
  swOwner: 'Marcus Bellamy',
  swMrcWeeks: '65',
  swIdBasis: 'Government ID sighted',
  swImpoundTime: '5 Months',
  swImpoundPrice: '$250,000',
  swApprovedBy: 'Jack Fkn-Kone',
  swDebtDeadline: '18/02/2026',
  swCourtCharges: 'Contempt of Court | MEDIUM',
  swImprisonmentWeeks: '70',
  swCourtFees: '25,000',
  swCourtActions: '15 Actions',
  swMagistrate: 'Evelyn Hart',
};

const TYPES = ['sheriff_arrest', 'sheriff_warrant', 'sheriff_court', 'sheriff_debt'];

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const errors = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://sheriff-tool.vercel.app/',
    virtualConsole: new (require('jsdom').VirtualConsole)()
      .on('jsdomError', e => errors.push('jsdomError: ' + e.message))
      .on('error', (...a) => errors.push('error: ' + a.join(' '))),
  });
  const { window } = dom;
  const { document } = window;

  await sleep(400); // let init run

  const set = (id, value) => {
    const elm = document.getElementById(id);
    if (!elm) return false;
    elm.value = value;
    elm.dispatchEvent(new window.Event('input', { bubbles: true }));
    elm.dispatchEvent(new window.Event('change', { bubbles: true }));
    return true;
  };

  const out = [];
  let filledReport = {};

  for (const type of TYPES) {
    const sel = document.getElementById('reportType');
    if (!sel) { out.push(`!! #reportType missing`); break; }
    sel.value = type;
    sel.dispatchEvent(new window.Event('change', { bubbles: true }));
    await sleep(120);

    for (const [id, val] of Object.entries(FIELDS)) {
      const ok = set(id, val);
      if (!(id in filledReport)) filledReport[id] = ok;
    }

    await sleep(500); // debounce is 200ms
    const pre = document.getElementById('preview');
    out.push(`════════════════ ${type} ════════════════`);
    out.push(pre ? pre.textContent : '!! #preview missing');
    out.push('');
  }

  const missing = Object.entries(filledReport).filter(([, ok]) => !ok).map(([id]) => id);
  out.push('════════════════ meta ════════════════');
  out.push('fields not found: ' + (missing.length ? missing.join(', ') : '(none)'));
  out.push('page errors: ' + (errors.length ? errors.join(' | ') : '(none)'));

  fs.writeFileSync(outPath, out.join('\n'));
  console.log('wrote', outPath);
  console.log('fields not found:', missing.length ? missing.join(', ') : '(none)');
  console.log('page errors:', errors.length ? errors.length : 0);
  if (errors.length) errors.slice(0, 5).forEach(e => console.log('  ' + e));
  window.close();
})();
