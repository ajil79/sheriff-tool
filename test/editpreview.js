// Edit Preview mode only pauses debouncedRenderPreview()'s overwrite of the
// preview while it's on — nothing ever captured manual edits back into state,
// so the instant another bound field changed, edits were silently discarded
// with zero warning. The fix: turning edit mode OFF now confirms if the edited
// text has diverged from what state would currently regenerate.
//
// Drives the real page: toggle edit mode on, mutate the preview text, toggle
// off, and confirm the browser confirm() dialog is invoked. Then repeat without
// editing anything, and confirm it is NOT invoked (no confirm-fatigue for the
// common case of just looking at the preview in edit mode).
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
  console.log('\n── editing the preview then turning edit mode off prompts a confirm');
  {
    const { dom, errors } = await boot();
    const { window } = dom;
    const document = window.document;
    let confirmCalls = 0;
    let confirmReturn = true;
    window.confirm = (msg) => { confirmCalls++; return confirmReturn; };

    const editBtn = document.getElementById('editPreviewBtn');
    const preview = document.getElementById('preview');

    editBtn.click(); // turn ON
    check('edit mode is on (contentEditable)', preview.contentEditable, 'true');
    preview.textContent = preview.textContent + '\nMANUALLY EDITED LINE THAT WILL NOT MATCH STATE';
    confirmReturn = false; // cancel — edit mode should stay on
    editBtn.click(); // attempt to turn OFF
    check('confirm() was called', confirmCalls > 0, true);
    check('cancelling the confirm keeps edit mode on', preview.contentEditable, 'true');

    confirmReturn = true; // accept this time
    editBtn.click(); // turn OFF for real
    check('accepting the confirm turns edit mode off', preview.contentEditable, 'false');
    check('no page errors throughout', errors.length, 0);
    window.close();
  }

  console.log('\n── turning edit mode off WITHOUT editing anything does not prompt');
  {
    const { dom, errors } = await boot();
    const { window } = dom;
    const document = window.document;
    let confirmCalls = 0;
    window.confirm = () => { confirmCalls++; return true; };

    const editBtn = document.getElementById('editPreviewBtn');
    const preview = document.getElementById('preview');

    editBtn.click(); // turn ON — preview text is exactly whatever state currently generates
    editBtn.click(); // turn OFF without touching the text at all
    check('confirm() was NOT called', confirmCalls, 0);
    check('edit mode is off', preview.contentEditable, 'false');
    check('no page errors throughout', errors.length, 0);
    window.close();
  }

  console.log('\n' + '─'.repeat(66));
  console.log(fails === 0 ? 'PASS: Edit Preview warns before discarding unsaved manual edits.' : `FAIL: ${fails} check(s)`);
  process.exit(fails === 0 ? 0 : 1);
})();
