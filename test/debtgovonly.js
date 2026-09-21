// The "government-only" debt filter's real UI was removed; #debtGovOnly is a
// checkbox permanently hidden inside a display:none "removed Sheriff Ops Helper"
// stub. processDebtToolInput() used to hard-bail whenever state.debtTool.govOnly
// was false, and the ONLY code path that could set it back to true was that same
// unreachable checkbox's own change listener — a permanent dead end for anyone
// whose persisted state carries govOnly:false (old/hand-edited data; the default
// is true so this can't happen from normal use).
//
// Drives the real page: seed an autosave with govOnly:false plus a genuinely
// qualifying overdue debt line, click Process Debt, and confirm it now
// self-heals and completes (toast-ok "Debt processed...") instead of refusing
// forever. Also confirms the normal default (govOnly:true) happy path shows no
// spurious self-heal toast.
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

// A single genuinely-qualifying overdue government debt line: status N, well
// over 14 days old, description starting with "GOV" (matches processDebtToolInput's
// regex + qualifying-description check).
const QUALIFYING_DEBT_LINE = '01/01/2020 N $500 GOV INVOICE: Outstanding Government Debt';

async function boot(govOnly) {
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
        state: { debtTool: { govOnly } },
      }));
    },
  });
  await sleep(600);
  return { dom, errors };
}

(async () => {
  console.log('\n── Debt Tool govOnly:false (legacy/corrupted data) self-heals instead of blocking');
  {
    const { dom, errors } = await boot(false);
    const d = dom.window.document;
    d.getElementById('debtInput').value = QUALIFYING_DEBT_LINE;
    d.getElementById('debtProcessBtn').click();
    await sleep(300);
    const toastEl = d.getElementById('toast');
    check('page loaded without error', errors.length, 0);
    check('final toast is the success toast, not the old blocking refusal',
      toastEl.textContent.startsWith('Debt processed'), true);
    check('final toast is styled ok (not warn/err)', toastEl.className.includes('toast-ok'), true);
    check('final toast does NOT show the old "re-enable the filter" refusal',
      toastEl.textContent.includes('Re-enable the government-only filter'), false);
    dom.window.close();
  }

  console.log('\n── Debt Tool govOnly:true (normal default) — no spurious self-heal noise');
  {
    const { dom, errors } = await boot(true);
    const d = dom.window.document;
    d.getElementById('debtInput').value = QUALIFYING_DEBT_LINE;
    d.getElementById('debtProcessBtn').click();
    await sleep(300);
    const toastEl = d.getElementById('toast');
    check('page loaded without error', errors.length, 0);
    check('final toast is still the success toast', toastEl.textContent.startsWith('Debt processed'), true);
    check('final toast does not mention the legacy self-heal',
      toastEl.textContent.includes('Government-only debt filter was reset'), false);
    dom.window.close();
  }

  console.log('\n' + '─'.repeat(66));
  console.log(fails === 0 ? 'PASS: Debt Tool govOnly dead-end self-heals; happy path unaffected.' : `FAIL: ${fails} check(s)`);
  process.exit(fails === 0 ? 0 : 1);
})();
