# Sheriff Tool v3

Sheriff Warrants, Debt Enforcement & Logs — single-file web app.

## Deploy to Vercel

### Option A — Vercel CLI (fastest)
```bash
npm i -g vercel
vercel
```
Follow the prompts. First deploy creates the project; subsequent deploys use `vercel --prod`.

### Option B — Vercel Dashboard (drag & drop)
1. Go to [vercel.com/new](https://vercel.com/new)
2. Drag this entire folder onto the import area
3. Click **Deploy** — no build settings needed

### Option C — GitHub
1. Push this folder to a GitHub repo
2. Import the repo in the Vercel dashboard
3. Framework preset: **Other** — leave all build settings blank
4. Deploy

## Local preview
```bash
npm run dev
# or just open index.html directly in your browser
```

## Files
| File | Purpose |
|------|---------|
| `index.html` | The entire app — self-contained, no external dependencies at runtime |
| `vercel.json` | Vercel routing + security headers config |
| `package.json` | Project metadata + local dev script |

## Code tour — start here if you're reviewing

Everything is inline in `index.html`: styles in `<style>`, markup, then all the
JS in one `<script>` at the bottom. That's deliberate — the tool has to run by
double-clicking the file and keep working with no network, so there's no build
step, no bundler and no runtime dependencies.

**Read the block comment at the top of `<script>` first.** It's the map: what the
app does, the data model, the section layout, and two things that look like dead
code but aren't. Sections are marked with `// ====` banners you can grep for.

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

Two things that will save you time:

- **Magic numbers usually aren't.** Sentence lengths, debt tier boundaries and
  Action Notice wording quote the Sheriff Warrant Handbook v1.0 and the 2026
  *Out and About* handbook, cited inline at each use. Worth checking the citation
  before flagging a value as arbitrary.
- **All data is `localStorage`**, prefixed `sheriff_`. Nothing goes to a server —
  warrants name real people, so that's a constraint rather than a shortcut.

No test suite. Behaviour is checked by generating each of the four warrant types
and diffing the output against a known-good capture — worth doing if you change
anything in the generators.
