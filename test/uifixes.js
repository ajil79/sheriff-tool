// Verifies the two intended behaviour changes, driven through the real DOM.
//  1. ID status banner: hidden by default, loud+amber when CONFIRMED is set
//     without a basis, loud+green once a basis is entered.
//  2. renderDrafts() survives a corrupt backups entry (it throws today).
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const file = (process.argv[2] || __dirname + '/../index.html');
const html = fs.readFileSync(file, 'utf8');
let fails = 0;
const check = (label, got, want) => {
  const ok = got === want;
  if (!ok) fails++;
  console.log(`   ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(46)} ${JSON.stringify(got)}${ok ? '' : '  want ' + JSON.stringify(want)}`);
};

async function boot(seed) {
  const errors = [];
  const vc = new VirtualConsole().on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://sheriff-tool.vercel.app/', virtualConsole: vc,
    beforeParse(w) { if (seed) seed(w); },
  });
  await sleep(500);
  return { dom, errors };
}

(async () => {
  // ---- 1. ID status banner -------------------------------------------------
  console.log('\n── ID status banner');
  {
    const { dom } = await boot();
    const d = dom.window.document;
    const banner = d.getElementById('swIdStatusWarn');
    const cls = () => banner.className;
    const fire = (el, t) => el.dispatchEvent(new dom.window.Event(t, { bubbles: true }));

    check('starts hidden (no .show)', /\bshow\b/.test(cls()), false);
    check('is centred', dom.window.getComputedStyle(banner).textAlign, 'center');

    // Set CONFIRMED with no basis -> blocked, amber, visible
    const sel = d.getElementById('swIdStatus');
    sel.value = 'CONFIRMED'; fire(sel, 'change');
    await sleep(150);
    check('no basis -> visible', /\bshow\b/.test(cls()), true);
    check('no basis -> amber (.warn)', /\bwarn\b/.test(cls()), true);
    check('no basis -> not green', /\bok\b/.test(cls()), false);
    check('no basis -> status forced UNCONFIRMED', sel.value, 'UNCONFIRMED');

    // Enter a basis -> confirmed, green
    const basis = d.getElementById('swIdBasis');
    basis.value = 'Government ID sighted'; fire(basis, 'input'); fire(basis, 'change');
    await sleep(250);
    check('with basis -> visible', /\bshow\b/.test(cls()), true);
    check('with basis -> green (.ok)', /\bok\b/.test(cls()), true);
    check('with basis -> no longer amber', /\bwarn\b/.test(cls()), false);
    const detail = banner.querySelector('.id-status-detail').textContent;
    check('with basis -> echoes the basis', detail.includes('Government ID sighted'), true);
    const size = parseFloat(dom.window.getComputedStyle(banner.querySelector('.id-status-title')).fontSize);
    check('title is larger than the old 12px', size > 12, true);
    dom.window.close();
  }

  // ---- 2. corrupt backups must not break the drafts panel ------------------
  console.log('\n── renderDrafts() with a corrupt backups entry');
  {
    const { dom, errors } = await boot(w => {
      w.localStorage.setItem('sheriff_report_backups', '{not valid json');
      w.localStorage.setItem('sheriff_report_drafts', JSON.stringify({
        'Test draft': { savedAt: Date.now(), state: { reportType: 'sheriff_arrest' } },
      }));
    });
    const d = dom.window.document;
    const openBtn = d.getElementById('draftsBtn') || d.getElementById('openDraftsBtn');
    if (openBtn) { openBtn.click(); await sleep(300); }
    const list = d.getElementById('draftsList');
    check('page loaded without error', errors.length, 0);
    check('drafts list element exists', !!list, true);
    check('drafts panel rendered content', !!(list && list.children.length > 0), true);
    dom.window.close();
  }

  console.log('\n' + '─'.repeat(64));
  console.log(fails === 0 ? 'PASS: both behaviour changes verified.' : `FAIL: ${fails} check(s)`);
  process.exit(fails === 0 ? 0 : 1);
})();
