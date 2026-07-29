#!/usr/bin/env node
// Runs every check and reports pass/fail. `npm test`.
//
// There is no framework here on purpose — the app has no build step and no
// runtime dependencies, and the tests should not drag in a toolchain either.
// jsdom is the only devDependency.
//
// The important one is output equivalence: capture.js generates all four warrant
// types and diffs them against test/baseline.txt. Almost every change to this
// tool should leave that output byte-identical. If it changes and you did not
// mean it to, something is wrong. If you did mean it, regenerate with:
//     node test/capture.js index.html test/baseline.txt
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const target = process.argv[2] || path.join(__dirname, '..', 'index.html');
const here = f => path.join(__dirname, f);

const CHECKS = [
  ['syntax', 'inline <script> parses'],
  ['equivalence', 'generated warrants match test/baseline.txt'],
  ['leap.js', 'ten real LEAP / licence samples parse correctly'],
  ['amounts.js', 'money keeps its decimal point; phones stay digits-only'],
  ['flags.js', 'LEAP risk flags, incl. "YES [ACTIVE CRIMINAL WARRANT]"'],
  ['ocrbug.js', 'no phantom "Traffic vehicle" rows in the OCR review modal'],
  ['throwsites.js', 'INITIAL_STATE clone sites + legacy draft load'],
  ['uifixes.js', 'ID status banner states + corrupt-backup drafts panel'],
];

let failed = 0;
const run = (script) => {
  try { execFileSync(process.execPath, [here(script), target], { stdio: 'pipe' }); return null; }
  catch (e) { return (e.stdout || Buffer.from('')).toString() + (e.stderr || Buffer.from('')).toString(); }
};

console.log(`sheriff-tool tests — ${path.relative(process.cwd(), target)}\n`);

for (const [name, desc] of CHECKS) {
  let err = null;
  if (name === 'syntax') {
    const html = fs.readFileSync(target, 'utf8');
    const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
    let m;
    while ((m = re.exec(html))) {
      try { new Function(m[1]); } catch (e) { err = 'SyntaxError: ' + e.message; }
    }
  } else if (name === 'equivalence') {
    const tmp = path.join(require('os').tmpdir(), 'sheriff-capture-' + process.pid + '.txt');
    try {
      execFileSync(process.execPath, [here('capture.js'), target, tmp], { stdio: 'pipe' });
      const got = fs.readFileSync(tmp, 'utf8');
      const want = fs.readFileSync(here('baseline.txt'), 'utf8');
      if (got !== want) err = 'generated warrant output differs from test/baseline.txt';
      fs.unlinkSync(tmp);
    } catch (e) { err = String(e.message || e); }
  } else {
    err = run(name);
  }

  if (err) { failed++; console.log(`  FAIL  ${desc}`); console.log('        ' + String(err).trim().split('\n').slice(-3).join('\n        ')); }
  else console.log(`  ok    ${desc}`);
}

console.log('');
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
