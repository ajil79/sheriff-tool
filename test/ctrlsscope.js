// The global Ctrl+S handler used to fire saveDraft() (which prompts for a
// draft name) from ANY tab, including the Debt Tool, Sheriff Logs and Recruit
// Guide — none of which have anything to do with a report draft. It's now
// scoped to only fire while the Report Tool tab is active.
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
  });
  const { window } = dom;
  const { document } = window;
  await sleep(500);

  let promptCalls = 0;
  window.prompt = () => { promptCalls++; return null; };

  const fireCtrlS = () => {
    const evt = new window.KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(evt);
  };

  console.log('\n── Ctrl+S from a non-report tab does nothing');
  window.showToolPage('debt');
  await sleep(50);
  check('Debt Tool tab is active', document.getElementById('debtPage').classList.contains('active'), true);
  promptCalls = 0;
  fireCtrlS();
  check('saveDraft prompt was NOT triggered from the Debt Tool tab', promptCalls, 0);

  window.showToolPage('sherifflogs');
  await sleep(50);
  promptCalls = 0;
  fireCtrlS();
  check('saveDraft prompt was NOT triggered from the Sheriff Logs tab', promptCalls, 0);

  window.showToolPage('guide');
  await sleep(50);
  promptCalls = 0;
  fireCtrlS();
  check('saveDraft prompt was NOT triggered from the Recruit Guide tab', promptCalls, 0);

  console.log('\n── Ctrl+S from the Report Tool tab still works');
  window.showToolPage('report');
  await sleep(50);
  check('Report Tool tab is active', document.getElementById('reportPage').classList.contains('active'), true);
  promptCalls = 0;
  fireCtrlS();
  check('saveDraft prompt WAS triggered from the Report Tool tab', promptCalls, 1);

  check('no page errors throughout', errors.length, 0);
  window.close();

  console.log('\n' + '─'.repeat(66));
  console.log(fails === 0 ? 'PASS: Ctrl+S is scoped to the Report Tool tab.' : `FAIL: ${fails} check(s)`);
  process.exit(fails === 0 ? 0 : 1);
})();
