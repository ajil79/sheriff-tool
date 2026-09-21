// The wizard stepper marked a visited step "done" purely by having been
// passed (i < activeIdx), not by whether its required fields were actually
// filled — a false-reassuring checkmark. And the Validate panel's warnings
// were plain, non-interactive text with no way to jump to the step that
// needed fixing, unlike the Recruit Guide's existing wizardGoToCard()
// mechanism. Both are now wired together: a matched warning gets a "Fix →"
// button, and a visited step with an outstanding matched warning shows
// "has-issues" instead of "done".
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

const setField = (window, id, value) => {
  const elm = window.document.getElementById(id);
  if (!elm) return false;
  elm.value = value;
  elm.dispatchEvent(new window.Event('input', { bubbles: true }));
  elm.dispatchEvent(new window.Event('change', { bubbles: true }));
  return true;
};

// showWizardStep() isn't exposed on window — navigate the same way a user
// does, by clicking the real stepper chip for that step.
const goToStep = (document, num) => {
  const chip = document.querySelector(`[data-step-target="${num}"]`);
  if (chip) chip.click();
  return !!chip;
};

(async () => {
  const errors = [];
  const vc = new VirtualConsole().on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://sheriff-tool.vercel.app/', virtualConsole: vc,
  });
  const { window } = dom;
  const { document } = window;
  // jsdom does not implement scrollIntoView (by design — it has no real layout
  // engine); showWizardStep() calls it on navigation. Stub it like any other
  // jsdom test dealing with real DOM scrolling.
  window.Element.prototype.scrollIntoView = () => {};
  await sleep(500);

  window.showToolPage('report');
  await sleep(100);
  // Default report type is sheriff_arrest; leave charges/officers/etc. blank
  // so validateDraft() has real warnings, then jump ahead to Step 2 (charges)
  // so Step 1 is "visited" and can be checked for a has-issues/done chip.
  check('navigated to step 2 via its chip', goToStep(document, 2), true);
  await sleep(100);

  console.log('\n── Validate panel offers a "Fix →" button for a recognized warning');
  document.getElementById('validateBtn').click();
  await sleep(100);
  const fixBtn = document.querySelector('#validationPanel [data-jump-card="chargesCard"]');
  check('a Fix button targeting chargesCard is rendered', !!fixBtn, true);

  const stepBefore = document.querySelector('.wizard-step.active')?.dataset.step;
  check('currently on step 2', stepBefore, '2');
  fixBtn.click();
  await sleep(100);
  const stepAfter = document.querySelector('.wizard-step.active')?.dataset.step;
  check('clicking Fix jumps to the step containing chargesCard', stepAfter, '2');

  console.log('\n── a visited step with an outstanding warning shows has-issues, not done');
  // Step 1 (reportMetaCard/offenderCard) is missing header date/time and
  // entered-by — visit step 3 so step 1 becomes "visited" in the stepper.
  goToStep(document, 1);
  await sleep(50);
  goToStep(document, 3);
  await sleep(100);
  const chips = Array.from(document.querySelectorAll('.wizard-chip'));
  const step1Chip = chips.find(c => c.dataset.stepTarget === '1');
  check('step 1 chip exists', !!step1Chip, true);
  check('step 1 chip shows has-issues (missing header fields)', step1Chip.classList.contains('has-issues'), true);
  check('step 1 chip does NOT show a false "done"', step1Chip.classList.contains('done'), false);

  console.log('\n── a genuinely complete step shows done');
  setField(window, 'reportDateTime', '14/06/2026 20:50');
  setField(window, 'enteredBy', 'SRF 116 | Stephen Palmes');
  setField(window, 'offenderName', 'Test Offender');
  await sleep(100);
  // The stepper only recomputes has-issues/done on navigation (not on every
  // keystroke) — revisit step 1 then move on, same as a user checking back.
  goToStep(document, 1);
  await sleep(50);
  goToStep(document, 3);
  await sleep(100);
  const step1ChipAfter = Array.from(document.querySelectorAll('.wizard-chip')).find(c => c.dataset.stepTarget === '1');
  check('step 1 chip now shows done once its fields are filled', step1ChipAfter.classList.contains('done'), true);
  check('step 1 chip no longer shows has-issues', step1ChipAfter.classList.contains('has-issues'), false);

  check('no page errors throughout', errors.length, 0);
  window.close();

  console.log('\n' + '─'.repeat(70));
  console.log(fails === 0 ? 'PASS: wizard validation jump-to-step and has-issues chips verified.' : `FAIL: ${fails} check(s)`);
  process.exit(fails === 0 ? 0 : 1);
})();
