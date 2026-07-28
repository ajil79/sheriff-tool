# Sheriff Tool — Claude Code Guide

## What this is
Single-file offline-capable web app (`index.html`) for Sheriff warrant paperwork. No build step, no framework, no bundler — vanilla HTML/CSS/JS.

## Running locally
```bash
npm run dev        # serves at http://localhost:3000 (just wraps `npx serve .`)
```
Or just open `index.html` directly in a browser — no server needed.
There is nothing to install: `package.json` declares no dependencies.

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
- `debouncedRenderPreview()` — rebuilds the preview from `state`; called on every input event. There is no undebounced `renderPreview()`.
- `generateSheriffArrest()` / `...Warrant()` / `...Court()` / `...DebtWarrant()` — the four warrant builders; pure string assembly over `state`
- `renderAll()` — pushes `state` back into the fields, after a draft/autosave load
- `state` / `INITIAL_STATE` — single source of truth; the DOM is rendered from it, never read as truth
- `toast(msg, type)` — bottom toast (`ok` / `warn` / `err`)
- `escapeHtml(str)` — XSS-safe string insertion; required for any user text going into `innerHTML`
- `norm(v)` — trim + null-safe coerce to `""`; most comparisons go through it
- OCR via Tesseract.js (loaded from jsDelivr CDN on demand; degrades cleanly offline)

## Domain rules come from source documents
Sentence lengths, debt tiers and Action Notice wording quote two handbooks and are
cited inline where they appear — Sheriff Warrant Handbook v1.0 (rev 06/07/2026)
and the 2026 *Out and About* handbook. Check the citation before changing a value
that looks arbitrary.

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
- To push changes: `git add index.html && git commit -m "..." && git push origin main`
