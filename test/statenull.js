// Regression tests for two related fixes:
//  1. deepMerge() used to let an explicit `null` on a saved state key (e.g. a
//     hand-edited or corrupted sheriff_report_autosave/draft entry) clobber the
//     INITIAL_STATE default object for that key. The warrant generators read
//     state.sheriffWarrant/.offender/.debtTool/.sheriffLogs fields unconditionally,
//     so a null sub-object threw inside the 200ms preview debounce with zero
//     user-visible feedback.
//  2. debouncedRenderPreview()'s generator dispatch had no try/catch, so any
//     thrown error there (this one included) silently froze the live preview.
//
// Part A drives the real page through jsdom with corrupted saved state and
// proves the page boots and renders without throwing (verifies fix #1, and
// implicitly that fix #2's safety net does not spuriously fire on valid data).
// Part B extracts the real debounced-preview callback body verbatim and
// exercises it directly with a stubbed generator that throws, proving the
// try/catch + toast scaffolding actually catches and reports (verifies fix #2
// in isolation, since fix #1 closes off the only realistic saved-state path
// that used to trigger it).
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const file = (process.argv[2] || __dirname + '/../index.html');
const html = fs.readFileSync(file, 'utf8');
let fails = 0;
const check = (label, got, want) => {
  const ok = got === want;
  if (!ok) fails++;
  console.log(`   ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(52)} ${JSON.stringify(got)}${ok ? '' : '  want ' + JSON.stringify(want)}`);
};

(async () => {
  // ---- Part A: corrupted saved state must not throw / must render ----------
  console.log('\n── deepMerge null-guard: corrupted autosave with null sub-objects');
  {
    const errors = [];
    const vc = new VirtualConsole()
      .on('jsdomError', e => errors.push(e.message))
      .on('error', (...a) => errors.push(a.join(' ')));
    const dom = new JSDOM(html, {
      runScripts: 'dangerously', pretendToBeVisual: true,
      url: 'https://sheriff-tool.vercel.app/', virtualConsole: vc,
      beforeParse(w) {
        w.localStorage.setItem('sheriff_report_autosave', JSON.stringify({
          __type: 'sheriff_report_state',
          __schema: 1,
          savedAt: Date.now(),
          state: {
            reportType: 'sheriff_arrest',
            sheriffWarrant: null,
            offender: null,
            debtTool: null,
            sheriffLogs: null,
          },
        }));
      },
    });
    await sleep(700);
    const d = dom.window.document;
    check('page loaded without a thrown/uncaught error', errors.length, 0);
    const preview = d.getElementById('preview');
    check('preview element exists', !!preview, true);
    check('preview rendered non-empty text (generator did not silently fail)',
      !!(preview && preview.textContent && preview.textContent.trim().length > 0), true);
    const toastEl = d.getElementById('toast');
    check('no error toast fired for what is now valid (defaulted) state',
      !!(toastEl && toastEl.className.includes('toast-err')), false);
    dom.window.close();
  }

  // ---- Part B: try/catch scaffolding actually catches a thrown generator ---
  console.log('\n── debouncedRenderPreview try/catch: a thrown generator must not escape');
  {
    // Extract the debounced callback's body verbatim by brace-matching, then run
    // it under stubs — same approach as test/ocrbug.js uses for
    // buildOcrReviewChanges(). The stub replaces generateCurrentReportText with
    // one that throws, simulating any generator failure the real function could
    // hit; the extracted body is the real, unmodified try/catch/toast logic.
    const marker = 'const debouncedRenderPreview = debounce(() => {';
    const start = html.indexOf(marker);
    if (start < 0) throw new Error('debouncedRenderPreview definition not found');
    const bodyStart = start + marker.length - 1; // the '{'
    let depth = 0, k;
    for (k = bodyStart; k < html.length; k++) {
      if (html[k] === '{') depth++;
      else if (html[k] === '}') { depth--; if (!depth) break; }
    }
    const callbackBody = html.slice(bodyStart + 1, k); // between the { and matching }

    const calls = { toastArgs: null, consoleErrored: false, charCountUpdated: false };
    const stub = new Function('calls', `
      // Stubbed closure environment for the extracted callback body.
      function generateCurrentReportText() { throw new Error("boom: simulated generator failure"); }
      const state = { reportType: "sheriff_arrest" };
      const window = { _editPreviewMode: false };
      const el = { preview: { textContent: "" } };
      function normalizeGeneratedReport(s) { return s; }
      function updateCharCount() { calls.charCountUpdated = true; }
      function toast(msg, type) { calls.toastArgs = [msg, type]; }
      const console = { error: (...a) => { calls.consoleErrored = true; } };
      (function() {
        ${callbackBody}
      })();
      return calls;
    `);
    let thrown = null;
    try { stub(calls); } catch (e) { thrown = e; }
    check('no exception escaped the callback', thrown === null, true);
    check('toast was called', !!(calls.toastArgs), true);
    check('toast type was "err"', calls.toastArgs && calls.toastArgs[1], 'err');
    check('console.error was called (visible in devtools)', calls.consoleErrored, true);
    check('updateCharCount was NOT called on the error path (preview left as-is)', calls.charCountUpdated, false);
  }

  console.log('\n' + '─'.repeat(70));
  console.log(fails === 0 ? 'PASS: state-null guard and preview try/catch both verified.' : `FAIL: ${fails} check(s)`);
  process.exit(fails === 0 ? 0 : 1);
})();
