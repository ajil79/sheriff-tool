// Static accessibility checks — one combined pass over the booted page:
//  - #toast has role="status"/aria-live so screen readers hear save/validation
//    feedback (previously silent; #undoBar already had this).
//  - exactly one <h1> exists (the app title was a plain <div>).
//  - the three icon-only "✕" close buttons have an accessible name.
//  - the three Debt Tool file inputs have an accessible name (their adjacent
//    drop-zone divs already did; the inputs themselves did not).
//  - the four readonly OCR/status fields have an accessible name + aria-live.
//  - all four .tool-page sections have a <main> landmark (previously only 2 of 4).
//  - a rendered wizard stepper chip carries role="tab" + aria-controls
//    pointing at a real, matching tabpanel.
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
const hasAccessibleName = (el) =>
  !!(el && ((el.getAttribute('aria-label') || '').trim() || (el.getAttribute('title') || '').trim() || (el.textContent || '').trim()));

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

  console.log('\n── toast is announced to screen readers');
  const toast = document.getElementById('toast');
  check('#toast has role="status"', toast?.getAttribute('role'), 'status');
  check('#toast has aria-live="polite"', toast?.getAttribute('aria-live'), 'polite');

  console.log('\n── exactly one <h1> landmark');
  check('document has exactly one <h1>', document.querySelectorAll('h1').length, 1);
  check('the <h1> is the app title', document.querySelector('h1')?.textContent.trim(), 'Sheriff Tool');

  console.log('\n── icon-only close buttons have an accessible name');
  // Trigger renderSelectedDefectsChips() indirectly isn't needed — the
  // remove-defect button template is checked via its literal source below,
  // since it only renders once a defect is selected. The validation-close-btn
  // instances render on demand too, so seed a minimal warning and click Validate.
  document.getElementById('validateBtn')?.click();
  await sleep(100);
  const closeButtons = Array.from(document.querySelectorAll('.validation-close-btn'));
  check('at least one validation-close-btn rendered', closeButtons.length > 0, true);
  check('every validation-close-btn has an accessible name', closeButtons.every(hasAccessibleName), true);
  // The remove-defect button template (built in JS, not always in the live DOM)
  // is checked directly against source for the aria-label attribute.
  check('remove-defect button template includes aria-label',
    html.includes('data-remove-defect') && /aria-label="Remove this defect"/.test(html), true);

  console.log('\n── Debt Tool file inputs and OCR/status fields have accessible names');
  const fileInputIds = ['debtDumpImgFile', 'debtImgFile', 'debtFinanceImgFile'];
  fileInputIds.forEach(id => {
    check(`#${id} has an accessible name`, hasAccessibleName(document.getElementById(id)), true);
  });
  const statusFieldIds = ['ocrStatus', 'debtOcrStatus', 'debtFinanceOcrStatus', 'debtDumpStatus'];
  statusFieldIds.forEach(id => {
    const el = document.getElementById(id);
    check(`#${id} has an accessible name`, hasAccessibleName(el), true);
    check(`#${id} has aria-live`, el?.getAttribute('aria-live'), 'polite');
  });

  console.log('\n── all 4 tool pages have a <main> landmark');
  check('exactly 4 <main> landmarks', document.querySelectorAll('main').length, 4);
  ['guidePage', 'reportPage', 'debtPage', 'sheriffLogsPage'].forEach(pageId => {
    const page = document.getElementById(pageId);
    check(`#${pageId} contains a <main>`, !!(page && page.querySelector('main')), true);
  });

  console.log('\n── wizard stepper chips carry tab semantics');
  window.showToolPage('report');
  await sleep(100);
  const chip = document.querySelector('.wizard-chip');
  check('a wizard chip is rendered', !!chip, true);
  check('chip has role="tab"', chip?.getAttribute('role'), 'tab');
  const controlsId = chip?.getAttribute('aria-controls');
  check('chip has aria-controls', !!controlsId, true);
  const panel = controlsId ? document.getElementById(controlsId) : null;
  check('aria-controls points at a real element', !!panel, true);
  check('that element is a tabpanel', panel?.getAttribute('role'), 'tabpanel');
  check('the active chip has aria-selected=true', document.querySelector('.wizard-chip.active')?.getAttribute('aria-selected'), 'true');

  check('no page errors throughout', errors.length, 0);
  window.close();

  console.log('\n' + '─'.repeat(70));
  console.log(fails === 0 ? 'PASS: all accessibility checks verified.' : `FAIL: ${fails} check(s)`);
  process.exit(fails === 0 ? 0 : 1);
})();
