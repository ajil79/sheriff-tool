# Sheriff Tool — Claude Code Guide

## What this is
Single-file offline-capable web app (`index.html`) for Sheriff warrant paperwork. No build step, no framework, no bundler — vanilla HTML/CSS/JS.

## Running locally
```bash
npm run dev        # serves at http://localhost:3000 (just wraps `npx serve .`)
```
Or just open `index.html` directly in a browser — no server needed.
There is nothing to install to *run* the app: `package.json` declares no
runtime dependencies. `jsdom` is a devDependency needed only to run the test
suite (see Testing below) — run `npm install` once before `npm test`.

## Architecture
Everything lives in `index.html`:
- **CSS** — all styles inline in `<style>`, dark/light mode via CSS variables + `body.light-mode` class
- **HTML** — tabbed layout (`.tool-nav` + `.tool-page` sections)
- **JS** — all inline in `<script>` at bottom of body

## Tab/page sections
| Nav label | `data-tool-page` | What it does |
|-----------|-----------------|--------------|
| Recruit Guide | `guide` | Plain-English patrol walkthroughs — the default landing tab |
| Debt Tool | `debt` | Debt enforcement warrant helper |
| Sheriff Logs | `sherifflogs` | Builds the Discord bot log commands |
| Report Tool | `report` | Warrant report builder (5-step wizard) |

## Report types
| Value | Label |
|-------|-------|
| `sheriff_arrest` | Sheriff Warrant for Arrest |
| `sheriff_warrant` | Sheriff Warrant for Questioning |
| `sheriff_court` | Sheriff Court Warrant |
| `sheriff_debt` | Sheriff Debt Enforcement Warrant |

`ENABLED_REPORT_TYPES` is the live list. `LEGACY_REPORT_TYPES` names retired ones
kept only so old autosaved drafts still load — `sheriffGuardType()` coerces them
to `sheriff_arrest`. Don't remove either.

## Key globals / patterns
- `debouncedRenderPreview()` — rebuilds the preview from `state`; called on every input event. There is no undebounced `renderPreview()`. Wraps the dispatch in try/catch — a thrown error shows an error toast and leaves the last-good preview on screen instead of freezing silently.
- `generateSheriffArrest()` / `...Warrant()` — both one-line wrappers around `buildSheriffFieldWarrant(kind)` ('arrest'/'questioning'), which does the actual ~90%-shared assembly; `...Court()` / `...DebtWarrant()` are separate, unmerged. `resolveActionNotice(type)` resolves the canned Action Notice unless the Instruction Block override (`state.sheriffWarrant.instruction`) is set, in which case that replaces it — used by all four generators.
- `renderAll()` — pushes `state` back into the fields, after a draft/autosave load
- `state` / `INITIAL_STATE` — single source of truth; the DOM is rendered from it, never read as truth. `deepMerge()` (the only path into `state` from persisted JSON) treats a stored `null` on a key whose default is an object as "keep the default" rather than overwriting it — don't remove that guard when touching state loading.
- `bindInputs()` — wires every input/button; itself just calls 14 `bindXInputs()` sub-functions (bindReportTypeInput, bindHeaderFields, bindOffenderFields, bindDefectsPanelInputs, bindSheriffWarrantFields, bindDebtToolInputs, bindNarrativeFields, bindEvidenceEntry, bindMiscAndOfficerFields, bindItemsList, bindFormActionButtons, bindPresetAndSearchHandlers, bindChargePinListeners, bindOcrEvents) — grep for `function bindInputs` to find the call sequence, then jump to whichever sub-function owns the field you're editing.
- `toast(msg, type)` — bottom toast (`ok` / `warn` / `err`); `#toast` carries `role="status" aria-live="polite"`, so this is also the screen-reader feedback channel — don't silently swallow an error path that should toast.
- `escapeHtml(str)` — XSS-safe string insertion; required for any user text going into `innerHTML`
- `norm(v)` — trim + null-safe coerce to `""`; most comparisons go through it
- OCR via Tesseract.js (loaded from jsDelivr CDN on demand, `OCR_CDN_ASSET_BASE` pins only the major version so no SRI hash is applied — see the comment at `ensureTesseract()`; degrades cleanly offline, with a 15s timeout if the CDN request stalls instead of hanging forever). Google Fonts (IBM Plex Sans/Mono) is a second, similarly-optional network dependency — both fail closed to system fonts / no OCR rather than breaking the app.

## Domain rules come from source documents
Sentence lengths, debt tiers and Action Notice wording quote two handbooks and are
cited inline where they appear — Sheriff Warrant Handbook v1.0 (rev 06/07/2026)
and the 2026 *Out and About* handbook. Check the citation before changing a value
that looks arbitrary.

## Testing
```bash
npm install         # one-time, only needed for the test suite (jsdom)
npm test            # runs test/run.js — every check, pass/fail
```
The suite is deliberately framework-free — no test runner, no assertion
library. It has no runtime dependencies and the tests shouldn't drag one in
either; `jsdom` is the only devDependency. Each check is a plain Node script
in `test/`, either driving the real page through `jsdom` (`runScripts:
'dangerously'`) the way a user would, or extracting a real function verbatim
by brace-matching and exercising it directly with stubs when jsdom isn't
needed (see `test/amounts.js`, `test/dobvalidator.js`). Add a new file and
register it in `test/run.js`'s `CHECKS` array; most existing files exist
because of one specific past regression, and are named/commented after it.

The most important check is **equivalence**: `test/capture.js` generates all
four warrant types from a fixed sample state and diffs the output against
`test/baseline.txt`. Almost every change to this tool should leave that
byte-identical. If it changes and you didn't mean it to, something broke. If
you did mean it (e.g. you fixed a bug that changes generated text),
regenerate deliberately and review the diff line-by-line before committing:
```bash
node test/capture.js index.html test/baseline.txt
```
This is also the tool to use before/after any refactor that touches the
warrant generators (like the `buildSheriffFieldWarrant()` merge) — it should
stay green with zero regeneration needed if the refactor is truly behavior-
preserving.

A few things aren't meaningfully testable via jsdom and are manual-verify
only: CSS visual regressions (contrast, touch-target sizing — a real
screenshot beats a computed-style assertion), and real SRI-hash enforcement
against a live CDN.

## Data persistence
All data is `localStorage` only — nothing sent to any server.
Key prefix: `sheriff_`
Keys: `sheriff_report_autosave`, `sheriff_report_drafts`, `sheriff_report_presets`, `sheriff_report_last_preset`

## Deployment
- **Vercel**: push to `main` on GitHub (`ajil79/sheriff-tool`) → auto-deploys to `sheriff-tool.vercel.app`
- `vercel.json` configured with security headers

## Editing tips for Claude Code
- The file is large — `grep` for the banner comments to navigate: `// ====` in the JS, `<!-- ═══ -->` around the wizard steps in the HTML. There is a full section map in the block comment at the top of `<script>`.
- CSS variables are in `:root` at the top of `<style>` — change colours there
- Run `npm install && npm test` before and after a change, especially anything touching the warrant generators or `bindInputs()`'s sub-functions — see Testing above
- To push changes: `git add index.html && git commit -m "..." && git push origin main`

## Accepted trade-offs (don't "fix" these without reading why)
- CSP's `script-src 'unsafe-inline'` (index.html, `<head>`) — required because there's no build step to generate per-deploy nonces/hashes and 100% of the JS is inline. Removing it needs a build step first.
- No Subresource Integrity hash on the Tesseract CDN script — `OCR_CDN_ASSET_BASE` pins only the major version (`tesseract.js@4`), so the served bytes aren't stable; a hash would start silently hard-failing on the next upstream patch release. See the comment at `ensureTesseract()`.
