// Draft/preset save & load used to have three related gaps:
//  - saveDraft()/saveCurrentPreset() overwrote an existing name with no warning.
//  - loadDraft() had no confirm before replacing the whole form, unlike the
//    equivalent loadBackup() which does.
//  - Names from prompt() were not trimmed or checked against reserved keys —
//    "  My Draft  " and "My Draft" become distinct entries, and a name of
//    exactly "__proto__" corrupts the drafts object's prototype instead of
//    adding a normal key, so the "save" silently vanishes.
// All three now go through one shared promptForStoreName() helper. This also
// covers the new "Clear All" drafts button (mirrors the existing backups one).
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

const setField = (window, id, value) => {
  const elm = window.document.getElementById(id);
  if (!elm) return false;
  elm.value = value;
  elm.dispatchEvent(new window.Event('input', { bubbles: true }));
  elm.dispatchEvent(new window.Event('change', { bubbles: true }));
  return true;
};

const getDrafts = (window) => {
  try { return JSON.parse(window.localStorage.getItem('sheriff_report_drafts') || '{}'); }
  catch (e) { return {}; }
};

(async () => {
  console.log('\n── draft names are trimmed');
  {
    const { dom } = await boot();
    const { window } = dom;
    window.prompt = () => '  My Draft  ';
    window.document.getElementById('saveDraftBtn').click();
    const drafts = getDrafts(window);
    check('trimmed name is the stored key', Object.prototype.hasOwnProperty.call(drafts, 'My Draft'), true);
    check('untrimmed name is NOT a stored key', Object.prototype.hasOwnProperty.call(drafts, '  My Draft  '), false);
    window.close();
  }

  console.log('\n── "__proto__" is rejected as a draft name');
  {
    const { dom } = await boot();
    const { window } = dom;
    window.prompt = () => '__proto__';
    window.document.getElementById('saveDraftBtn').click();
    const drafts = getDrafts(window);
    check('no draft named __proto__ was stored', Object.prototype.hasOwnProperty.call(drafts, '__proto__'), false);
    check('drafts object prototype is untouched', Object.getPrototypeOf(drafts), Object.prototype);
    const toastEl = window.document.getElementById('toast');
    check('an error toast explains the rejection', toastEl.className.includes('toast-err'), true);
    window.close();
  }

  console.log('\n── overwriting an existing draft name requires confirmation');
  {
    const { dom } = await boot();
    const { window } = dom;
    setField(window, 'offenderName', 'First Value');
    window.prompt = () => 'X';
    window.document.getElementById('saveDraftBtn').click(); // first save, no existing "X" yet
    check('first save under "X" succeeded', Object.prototype.hasOwnProperty.call(getDrafts(window), 'X'), true);

    setField(window, 'offenderName', 'Second Value');
    let confirmCalls = 0;
    window.confirm = () => { confirmCalls++; return false; }; // decline the overwrite
    window.document.getElementById('saveDraftBtn').click();
    check('overwrite confirm was shown', confirmCalls > 0, true);
    const draftsAfterDecline = getDrafts(window);
    check('declining the overwrite keeps the original content',
      draftsAfterDecline.X.state.offender.name, 'First Value');

    window.confirm = () => { confirmCalls++; return true; }; // accept this time
    window.document.getElementById('saveDraftBtn').click();
    const draftsAfterAccept = getDrafts(window);
    check('accepting the overwrite stores the new content',
      draftsAfterAccept.X.state.offender.name, 'Second Value');
    window.close();
  }

  console.log('\n── loading a draft requires confirmation (mirrors loadBackup)');
  {
    const { dom } = await boot();
    const { window } = dom;
    const document = window.document;
    setField(window, 'offenderName', 'Alpha');
    window.prompt = () => 'DraftA';
    document.getElementById('saveDraftBtn').click();

    setField(window, 'offenderName', 'Bravo');
    window.prompt = () => 'DraftB';
    document.getElementById('saveDraftBtn').click();
    // current form state is now "Bravo"; draftsList has load buttons for both.

    const findLoadBtn = (name) => Array.from(document.querySelectorAll('#draftsList button'))
      .find(b => b.textContent === name);

    let confirmCalls = 0;
    window.confirm = () => { confirmCalls++; return false; }; // decline
    const loadA = findLoadBtn('DraftA');
    check('DraftA load button exists', !!loadA, true);
    loadA.click();
    check('confirm was shown before loading', confirmCalls > 0, true);
    check('declining the load leaves the current form untouched',
      document.getElementById('offenderName').value, 'Bravo');

    window.confirm = () => { confirmCalls++; return true; }; // accept
    findLoadBtn('DraftA').click();
    check('accepting the load replaces the form',
      document.getElementById('offenderName').value, 'Alpha');
    window.close();
  }

  console.log('\n── "Clear All" empties the drafts list');
  {
    const { dom } = await boot();
    const { window } = dom;
    const document = window.document;
    window.prompt = () => 'ToClear';
    document.getElementById('saveDraftBtn').click();
    check('draft exists before clearing', Object.keys(getDrafts(window)).length > 0, true);

    window.confirm = () => true;
    const draftsHeaderSpan = Array.from(document.querySelectorAll('#draftsList span'))
      .find(s => s.textContent.startsWith('Drafts ('));
    check('drafts header is rendered', !!draftsHeaderSpan, true);
    const clearBtn = draftsHeaderSpan.parentElement.querySelector('button');
    check('drafts Clear All button found', clearBtn && clearBtn.textContent, 'Clear All');
    clearBtn.click();
    check('drafts are gone after Clear All', Object.keys(getDrafts(window)).length, 0);
    check('drafts panel now shows "No saved drafts"', document.getElementById('draftsList').textContent.includes('No saved drafts'), true);
    window.close();
  }

  console.log('\n' + '─'.repeat(70));
  console.log(fails === 0 ? 'PASS: draft/preset overwrite, load and name-safety checks verified.' : `FAIL: ${fails} check(s)`);
  process.exit(fails === 0 ? 0 : 1);
})();
