// The per-command Copy button on the Sheriff Logs tab blocks on
// validateSheriffLogState() so a command still containing literal placeholder
// text (e.g. "First-name", "Amount-owed") can't be copied into a Discord
// command channel — "Copy All Commands" used to skip that same check
// entirely and copy whatever was there, placeholders included.
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

  let copyAttempted = false;
  document.execCommand = () => { copyAttempted = true; return true; };

  window.showToolPage('sherifflogs');
  await sleep(200);

  console.log('\n── Copy All is blocked while required debtor fields are missing');
  copyAttempted = false;
  document.getElementById('slCopyAllBtn').click();
  await sleep(150);
  const toastEl1 = document.getElementById('toast');
  check('a warn toast explains the missing field', toastEl1.className.includes('toast-warn'), true);
  check('toast does not claim success', toastEl1.textContent.includes('All Sheriff commands copied'), false);
  check('clipboard copy was never attempted', copyAttempted, false);

  console.log('\n── Copy All proceeds once every required field is filled');
  window.showToolPage('debt');
  await sleep(100);
  setField(window, 'debtDebtorFirstName', 'James');
  setField(window, 'debtDebtorLastName', 'Brown');
  setField(window, 'debtDebtorPhone', '555123');
  setField(window, 'debtAmountOwedPaid', '5000');
  window.showToolPage('sherifflogs');
  await sleep(100);
  setField(window, 'slDetails', 'Mr Brown will be paying 5000 in one go.');
  setField(window, 'slOutcome', 'Mr Brown paid in full at the station.');
  await sleep(200);

  copyAttempted = false;
  document.getElementById('slCopyAllBtn').click();
  await sleep(150);
  const toastEl2 = document.getElementById('toast');
  check('toast reports the copy attempt, not a validation issue',
    toastEl2.textContent.includes('All Sheriff commands copied') || toastEl2.textContent.includes('Failed to copy commands'), true);
  check('clipboard copy WAS attempted', copyAttempted, true);

  check('no page errors throughout', errors.length, 0);
  window.close();

  console.log('\n' + '─'.repeat(70));
  console.log(fails === 0 ? 'PASS: Copy All is validated the same way per-command Copy is.' : `FAIL: ${fails} check(s)`);
  process.exit(fails === 0 ? 0 : 1);
})();
