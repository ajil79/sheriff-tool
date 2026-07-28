# Sheriff Tool v3

Warrant paperwork, debt enforcement and Discord log commands for the BBRP
Victorian Sheriff's Office. Single-file web app — live at
[sheriff-tool.vercel.app](https://sheriff-tool.vercel.app/).

Pushes to `main` deploy automatically.

## What it does

| Tab | Purpose |
|-----|---------|
| **Recruit Guide** | Plain-English walkthroughs for the situations you hit on patrol. The default landing tab. |
| **Debt Tool** | Parses a person's LEAP financial records, applies the debt tiers, says what to do next |
| **Sheriff Logs** | Builds the `!interact` / `!adddebt` / `!addplan` bot commands |
| **Report Tool** | The warrant builder — a 5-step wizard producing text to paste into the MDT |

It produces **text a Sheriff copies out**. It is a drafting aid, not a system of
record — the handbook is explicit that the writing Sheriff, not the tool, is
responsible for the warrant being correct.

## Running it locally

```bash
npm run dev     # serves at http://localhost:3000
```

Or just open `index.html` in a browser. There is no build step and nothing to
install — `package.json` has no dependencies, it only wraps `npx serve`.

## Files

| File | Purpose |
|------|---------|
| `index.html` | The entire app — styles, markup and script in one file |
| `vercel.json` | Static-build config plus three response headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) |
| `package.json` | Metadata and the local dev script. No dependencies. |
| `CLAUDE.md` | Working notes for Claude Code sessions |

## Code tour — start here if you're reviewing

Everything is inline in `index.html`: `<style>` at the top, then the markup, then
all the JS in one `<script>` at the bottom (from ~line 2100). That is deliberate —
the tool has to run by double-clicking the file and keep working with no network,
so there is no build step and no bundler.

**Read the block comment at the top of `<script>` first.** It is the map: what the
app does, the data model, the section layout, and two things that look like dead
code but are load-bearing. Sections are marked with `// ====` banners you can grep
for.

The path worth tracing first is how a warrant gets built:

```
input event
  -> bindInputs() handler writes to `state`
  -> debouncedRenderPreview()
  -> generateSheriffArrest() / ...Warrant() / ...Court() / ...DebtWarrant()
  -> <pre id="preview">
```

`state` is the single source of truth. The DOM is rendered from it and never read
back as truth, so the preview always matches what gets copied out.

### Things that will save you time

**Magic numbers usually aren't.** Sentence lengths, debt tier boundaries and Action
Notice wording quote the Sheriff Warrant Handbook v1.0 and the 2026 *Out and About*
handbook, cited inline at each use. Worth checking the citation before flagging a
value as arbitrary — the tier boundaries in particular were confirmed with Sheriff
leadership because the handbook wording is ambiguous at the edges.

**All data is `localStorage`**, prefixed `sheriff_`. Nothing is sent to a server.
Warrants name real people, so that is a constraint rather than a shortcut.

**`bindInputs()` is ~1,300 lines and that is not an oversight.** It is 95 genuinely
varied listeners, not repeated boilerplate — there is exactly one instance of the
extractable state→render→autosave shape. Splitting it would scatter one field's
wiring across the file for no reader benefit.

**Two external requests, both optional.** The app is offline-capable, not
dependency-free:

- Google Fonts stylesheet, on every load. Every `font-family` has a system
  fallback, so blocking it costs you the typeface and nothing else.
- Tesseract.js from jsDelivr plus language data from `tessdata.projectnaptha.com`,
  fetched only when OCR is first used. If that fails, OCR is unavailable and the
  rest of the tool is unaffected.

Both hosts are allow-listed in the CSP `<meta>` at the top of `index.html` — that
CSP lives in the HTML, not in `vercel.json`.

## Checking changes

There is no test suite in the repo. The check that matters is **output
equivalence**: generate all four warrant types before and after a change and diff
the results. Anything in the generators, `state` shape, or `bindInputs` should
leave that output byte-identical unless you meant to change it.

Worth doing by hand for any change to `generateSheriff*`, since those strings are
what ends up in the MDT.
