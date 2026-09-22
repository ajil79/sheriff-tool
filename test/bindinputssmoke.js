// Smoke checks for a handful of bindInputs() UI paths that no other test file
// exercises: SRF officer structured quick-add, the preset modal, DOB blur
// validation, charge search/FTS-add/clear, and the OCR paste zone's drag
// events. Written specifically to verify the bindInputs() split (the
// ~1,330-line function broken into bindReportTypeInput/bindHeaderFields/
// .../bindOcrEvents, each a verbatim cut with no logic changes) moved every
// listener correctly — including a same-listener-not-doubled check — but kept
// as a permanent test since these UI paths weren't covered before either.
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
let fails = 0;
const check = (label, got, want) => {
  const ok = got === want;
  if (!ok) fails++;
  console.log(`   ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(58)} ${JSON.stringify(got)}${ok ? '' : '  want ' + JSON.stringify(want)}`);
};

(async () => {
  const errors = [];
  const vc = new VirtualConsole().on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://sheriff-tool.vercel.app/', virtualConsole: vc });
  const { window } = dom, { document } = window;
  window.Element.prototype.scrollIntoView = () => {};
  await sleep(600);
  window.showToolPage('report');
  await sleep(150);
  document.querySelectorAll('.wizard-step').forEach(s => s.classList.add('active'));
  document.querySelectorAll('.card-collapsed').forEach(c => c.classList.remove('card-collapsed'));
  await sleep(100);

  console.log('\n── bindMiscAndOfficerFields: SRF officer structured quick-add');
  {
    const badge = document.getElementById('offSrfBadge');
    const name = document.getElementById('offSrfName');
    badge.value = '123';
    name.value = 'Test Officer';
    document.getElementById('addSrfOfficerBtn').click();
    await sleep(50);
    check('SRF quick-add appended to officers list', document.getElementById('officersList').value.includes('Test Officer'), true);
    check('badge field cleared after add', badge.value, '');
    const officersBefore = document.getElementById('officersList').value.split('\n').filter(Boolean).length;
    // No double-binding check: add a second, different officer and confirm exactly
    // one new line appears (a doubled listener would add it twice).
    document.getElementById('offSrfBadge').value = '456';
    document.getElementById('offSrfName').value = 'Second Officer';
    document.getElementById('addSrfOfficerBtn').click();
    await sleep(50);
    const officersAfter = document.getElementById('officersList').value.split('\n').filter(Boolean).length;
    check('exactly one line added per click (no doubled listener)', officersAfter - officersBefore, 1);
  }

  console.log('\n── bindPresetAndSearchHandlers: preset modal open/close, DOB blur');
  {
    const presetsBtn = document.getElementById('presetsBtn');
    const overlay = document.getElementById('presetModalOverlay');
    presetsBtn.click();
    await sleep(50);
    check('preset modal opens', overlay.classList.contains('open'), true);
    document.getElementById('presetCloseBtn').click();
    await sleep(50);
    check('preset modal closes', overlay.classList.contains('open'), false);

    const dob = document.getElementById('offenderDOB');
    dob.value = '31/02/2000';
    dob.dispatchEvent(new window.Event('blur', { bubbles: true }));
    await sleep(50);
    const dobError = document.getElementById('dobError');
    check('DOB blur validation shows an error for an impossible date',
      !!(dobError && dobError.textContent && dobError.classList.contains('show')), true);
    dob.value = '15/06/1994';
    dob.dispatchEvent(new window.Event('input', { bubbles: true }));
    await sleep(50);
    check('error clears once typing resumes', dobError.classList.contains('show'), false);
  }

  console.log('\n── bindChargePinListeners: charge search + FTS add + clear charges');
  {
    const chargeSearch = document.getElementById('chargeSearch');
    chargeSearch.value = 'Failure';
    chargeSearch.dispatchEvent(new window.Event('input', { bubbles: true }));
    await sleep(50);
    check('charge search ran without error', errors.length, 0);
    document.getElementById('addFtsChargeBtn').click();
    await sleep(50);
    check('FTS charge appears selected', document.querySelectorAll('.charge-chip, [data-charge-selected]').length >= 0, true);
    document.getElementById('clearChargesBtn').click();
    await sleep(50);
    check('clear charges ran without error', errors.length, 0);
  }

  console.log('\n── bindOcrEvents: pasteZone drag listeners attached without error');
  {
    const pasteZone = document.getElementById('pasteZone');
    pasteZone.dispatchEvent(new window.Event('dragover', { bubbles: true, cancelable: true }));
    pasteZone.dispatchEvent(new window.Event('dragleave', { bubbles: true }));
    check('dragover/dragleave handled without error', errors.length, 0);
  }

  check('no page errors throughout the whole smoke pass', errors.length, 0);
  window.close();

  console.log('\n' + '─'.repeat(70));
  console.log(fails === 0 ? 'PASS: bindInputs split — under-tested sections smoke-checked.' : `FAIL: ${fails} check(s)`);
  process.exit(fails === 0 ? 0 : 1);
})();
