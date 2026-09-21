// The "Instruction Block (optional override)" field (#swInstruction) is always
// visible/editable regardless of report type, but only the Debt Enforcement
// generator used to actually read it — Arrest, Questioning and Court silently
// ignored it and always emitted the canned Action Notice text, even though a
// Sheriff typing into the field would reasonably believe it was being used.
//
// Drives the real page through the DOM exactly as a user would: set a custom
// instruction, generate all four report types, confirm the custom text now
// appears verbatim in all four (previously only Debt). Then clear the field
// and confirm all four fall back to their original canned Action Notice text.
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

const CUSTOM = 'CUSTOM TEST INSTRUCTION XYZ — contact SRF 000 directly.';
const TYPES = ['sheriff_arrest', 'sheriff_warrant', 'sheriff_court', 'sheriff_debt'];

(async () => {
  const errors = [];
  const vc = new VirtualConsole().on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://sheriff-tool.vercel.app/', virtualConsole: vc,
  });
  const { window } = dom;
  const { document } = window;
  await sleep(500);

  const set = (id, value) => {
    const elm = document.getElementById(id);
    if (!elm) return false;
    elm.value = value;
    elm.dispatchEvent(new window.Event('input', { bubbles: true }));
    elm.dispatchEvent(new window.Event('change', { bubbles: true }));
    return true;
  };

  const setType = async (type) => {
    const sel = document.getElementById('reportType');
    sel.value = type;
    sel.dispatchEvent(new window.Event('change', { bubbles: true }));
    await sleep(500); // preview render is debounced 200ms — give it real margin
  };

  // Fill enough fields that every generator produces real (non-NIL) output —
  // the check is specifically about whether the instruction text appears, not
  // about full-field coverage.
  set('offenderName', 'Test Offender');
  set('officersList', 'SRF 116 - Sheriff Sergeant Stephen Palmes');
  set('swWarrantName', 'Test Offender');

  console.log('\n── custom Instruction Block override is honored by all 4 types');
  set('swInstruction', CUSTOM);
  await sleep(500);
  for (const type of TYPES) {
    await setType(type);
    const preview = document.getElementById('preview');
    const text = preview ? preview.textContent : '';
    check(`${type}: preview includes the custom instruction`, text.includes(CUSTOM), true);
    check(`${type}: preview does NOT include the canned notice's first line`,
      /PLEASE (DETAIN|ARREST)|PLEASE CONTACT A SHERIFF/.test(text), false);
  }

  console.log('\n── clearing the override restores each type\'s canned Action Notice');
  set('swInstruction', '');
  await sleep(500);
  const cannedFirstLine = {
    sheriff_arrest: 'PLEASE ARREST THE INDIVIDUAL AND PROCESS THE LISTED CHARGE AND SENTENCE.',
    sheriff_warrant: 'PLEASE DETAIN THE INDIVIDUAL, COMPLETE THE OUTSTANDING QUESTIONS',
    sheriff_court: 'PLEASE ARREST THE INDIVIDUAL AND PROCESS THE COURT-ORDERED OUTCOME',
    sheriff_debt: 'PLEASE CONTACT A SHERIFF MEMBER ONCE THE INDIVIDUAL IS IN CUSTODY',
  };
  for (const type of TYPES) {
    await setType(type);
    const preview = document.getElementById('preview');
    const text = preview ? preview.textContent : '';
    check(`${type}: preview no longer includes the custom instruction`, text.includes(CUSTOM), false);
    check(`${type}: preview includes its canned Action Notice`, text.includes(cannedFirstLine[type]), true);
  }

  check('no page errors throughout', errors.length, 0);
  window.close();

  console.log('\n' + '─'.repeat(70));
  console.log(fails === 0 ? 'PASS: Instruction Block override applies to all 4 report types.' : `FAIL: ${fails} check(s)`);
  process.exit(fails === 0 ? 0 : 1);
})();
