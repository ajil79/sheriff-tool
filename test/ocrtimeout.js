// ensureTesseract()'s CDN script load had no timeout — a stalled request
// (captive portal, flaky VPN) fires neither onload nor onerror, so the promise
// never resolved and the UI was stuck on "Loading OCR library (optional)..."
// forever. It now races a 15s timer that resolves false.
//
// Pure-function test: extract the real OCR-loading block verbatim (brace
// matching, same approach as test/dobvalidator.js/test/ocrbug.js) and run it
// under stubs, with a fake setTimeout so the 15s wait doesn't have to be a
// real 15s wait.
const fs = require('fs');
const path = require('path');

const target = process.argv[2] || path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(target, 'utf8');

const startMarker = 'const OCR_LOCAL_ASSET_BASE = ';
const start = html.indexOf(startMarker);
if (start < 0) throw new Error('OCR asset block not found');
const fnStart = html.indexOf('async function ensureTesseract()', start);
if (fnStart < 0) throw new Error('ensureTesseract not found');
// Brace-match from ensureTesseract's opening `{` to its matching `}`.
let depth = 0, i = html.indexOf('{', fnStart), end = i;
for (; i < html.length; i++) {
  if (html[i] === '{') depth++;
  else if (html[i] === '}') { depth--; if (!depth) { end = i; break; } }
}
// The block from OCR_LOCAL_ASSET_BASE through probeLocalOcrAssets() and into
// ensureTesseract() is one contiguous region in the source — grab it whole so
// every free variable/function ensureTesseract() references is included.
const block = html.slice(start, end + 1);

let failed = 0;
const check = (label, got, want) => {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(52)} ${JSON.stringify(got)}${ok ? '' : '  want ' + JSON.stringify(want)}`);
};

async function run(scenario) {
  const timers = []; // {cb, delay}
  const calls = { scriptsCreated: 0, clearedTimers: 0 };
  const fakeSetTimeout = (cb, delay) => { const id = timers.length; timers.push({ cb, delay, cleared: false }); return id; };
  const fakeClearTimeout = (id) => { if (timers[id]) { timers[id].cleared = true; calls.clearedTimers++; } };

  const scriptEl = { set src(v) {}, async: false, crossOrigin: null, onload: null, onerror: null };
  const fakeDocument = {
    createElement: () => { calls.scriptsCreated++; return scriptEl; },
    head: { appendChild: () => { scenario.onScriptAppended && scenario.onScriptAppended(scriptEl); } },
  };
  const fakeWindow = {}; // no Tesseract yet
  const fakeNavigator = { onLine: true };
  const fakeFetch = async () => { throw new Error('no local assets in test'); };

  const factory = new Function('document', 'window', 'navigator', 'fetch', 'setTimeout', 'clearTimeout', `
    ${block}
    return ensureTesseract;
  `);
  const ensureTesseract = factory(fakeDocument, fakeWindow, fakeNavigator, fakeFetch, fakeSetTimeout, fakeClearTimeout);

  const resultPromise = ensureTesseract();
  // Let the internal probeLocalOcrAssets() await settle before poking timers.
  await new Promise(r => setImmediate(r));
  await new Promise(r => setImmediate(r));

  scenario.act && scenario.act(timers, scriptEl);

  const result = await resultPromise;
  return { result, timers, calls };
}

(async () => {
  console.log('\n── a stalled load (no onload/onerror) resolves false once the timer fires');
  {
    const { result, timers } = await run({
      act: (timers) => {
        // Simulate 15s passing with the request still stalled: fire the timer.
        const t = timers.find(t => !t.cleared);
        if (t) t.cb();
      },
    });
    check('a timer was scheduled', timers.length > 0, true);
    check('the scheduled delay is 15000ms', timers[0] && timers[0].delay, 15000);
    check('ensureTesseract() resolves false instead of hanging', result, false);
  }

  console.log('\n── a successful load resolves true AND cancels the timer');
  {
    const { result, timers } = await run({
      act: (timers, scriptEl) => { scriptEl.onload(); },
    });
    check('ensureTesseract() resolves true', result, true);
    check('the timeout timer was cleared (no stray future rejection)', timers[0] && timers[0].cleared, true);
  }

  console.log('\n── a normal onerror still resolves false AND cancels the timer');
  {
    const { result, timers } = await run({
      act: (timers, scriptEl) => { scriptEl.onerror(); },
    });
    check('ensureTesseract() resolves false', result, false);
    check('the timeout timer was cleared', timers[0] && timers[0].cleared, true);
  }

  console.log('\n' + '─'.repeat(66));
  console.log(failed === 0 ? 'PASS: OCR load timeout verified.' : `FAIL: ${failed} check(s)`);
  process.exit(failed === 0 ? 0 : 1);
})();
