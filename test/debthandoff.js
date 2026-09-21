// "Fill Debt Warrant Report" and "Switch to Debt Warrant" both populate/set
// Sheriff debt warrant fields but never actually navigated to the Report
// Tool tab, despite the UI copy ("push all data here automatically", "click
// Fill Debt Warrant Report to push the data into the Report Tool") implying
// one click is enough. Both now call showToolPage('report').
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

const QUALIFYING_DEBT_LINE = '01/01/2020 N $500 GOV INVOICE: Outstanding Government Debt';

async function boot() {
  const errors = [];
  const vc = new VirtualConsole().on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://sheriff-tool.vercel.app/', virtualConsole: vc,
  });
  await sleep(500);
  return { dom, errors };
}

(async () => {
  console.log('\n── "Fill Debt Warrant Report" navigates to the Report Tool in one click');
  {
    const { dom, errors } = await boot();
    const { window } = dom;
    const document = window.document;

    window.showToolPage('debt');
    await sleep(100);
    document.getElementById('debtInput').value = QUALIFYING_DEBT_LINE;
    document.getElementById('debtProcessBtn').click();
    await sleep(300);

    check('still on the Debt Tool tab before applying', document.getElementById('debtPage').classList.contains('active'), true);
    document.getElementById('debtApplyBtn').click();
    await sleep(150);

    // The apply path opens a "review changes" confirmation modal — accept it.
    const applyBtn = document.getElementById('changeReviewApplyBtn');
    const overlay = document.getElementById('changeReviewOverlay');
    if (overlay && overlay.classList.contains('open') && applyBtn) applyBtn.click();
    await sleep(200);

    // Note: applying debt-tool values to the warrant does NOT itself set
    // reportType (that remains "Switch to Debt Warrant"'s job, tested below) —
    // the fix here is specifically that it now navigates, matching the UI
    // copy's promise that one click is enough to "push the data" and see it.
    check('navigated to the Report Tool tab automatically',
      document.getElementById('reportPage').classList.contains('active'), true);
    check('no longer on the Debt Tool tab',
      document.getElementById('debtPage').classList.contains('active'), false);
    check('no page errors throughout', errors.length, 0);
    window.close();
  }

  console.log('\n── "Switch to Debt Warrant" also navigates to the Report Tool');
  {
    const { dom, errors } = await boot();
    const { window } = dom;
    const document = window.document;

    window.showToolPage('debt');
    await sleep(100);
    check('starting on the Debt Tool tab', document.getElementById('debtPage').classList.contains('active'), true);
    document.getElementById('debtSwitchReportBtn').click();
    await sleep(150);

    check('report type switched to Sheriff Debt Enforcement Warrant',
      document.getElementById('reportType').value, 'sheriff_debt');
    check('navigated to the Report Tool tab automatically',
      document.getElementById('reportPage').classList.contains('active'), true);
    check('no page errors throughout', errors.length, 0);
    window.close();
  }

  console.log('\n' + '─'.repeat(70));
  console.log(fails === 0 ? 'PASS: Debt-to-Report hand-off navigates in one click.' : `FAIL: ${fails} check(s)`);
  process.exit(fails === 0 ? 0 : 1);
})();
