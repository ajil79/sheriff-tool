# Sheriff Tool — Claude Code Guide

## What this is
Single-file offline-capable web app (`index.html`) for Sheriff warrant paperwork. No build step, no framework, no bundler — vanilla HTML/CSS/JS.

## Running locally
```bash
npm install
npm run dev        # serves at http://localhost:3000
```
Or just open `index.html` directly in a browser — no server needed.

## Architecture
Everything lives in `index.html`:
- **CSS** — all styles inline in `<style>`, dark/light mode via CSS variables + `body.light-mode` class
- **HTML** — tabbed layout (`.tool-nav` + `.tool-page` sections)
- **JS** — all inline in `<script>` at bottom of body

## Tab/page sections
| Nav label | `data-tool-page` | What it does |
|-----------|-----------------|--------------|
| Sheriff Logs | `sherifflogs` | Log and track active warrants |
| Debt Tool | `debt` | Debt enforcement warrant helper |
| Report Tool | `report` | Warrant report builder |

## Report types
| Value | Label |
|-------|-------|
| `sheriff_arrest` | Sheriff Warrant for Arrest |
| `sheriff_warrant` | Sheriff Warrant for Questioning |
| `sheriff_debt` | Sheriff Debt Enforcement Warrant |

## Key globals / patterns
- `renderPreview()` — rebuilds the live preview from form state
- `debouncedRenderPreview()` — debounced wrapper, called on every input event
- `toast(msg, type)` — bottom toast (`ok` / `warn` / `err`)
- `escapeHtml(str)` — XSS-safe string insertion
- OCR via Tesseract.js (loaded from jsDelivr CDN on demand)

## Data persistence
All data is `localStorage` only — nothing sent to any server.
Key prefix: `sheriff_`
Keys: `sheriff_report_autosave`, `sheriff_report_drafts`, `sheriff_report_presets`, `sheriff_report_last_preset`

## Deployment
- **Vercel**: push to `main` on GitHub (`ajil79/sheriff-tool`) → auto-deploys to `sheriff-tool.vercel.app`
- `vercel.json` configured with security headers

## Editing tips for Claude Code
- The file is large — use `grep` to locate sections by ID or comment headers like `// ═══`
- CSS variables are in `:root` at the top of `<style>` — change colours there
- To push changes: `git add index.html && git commit -m "..." && git push origin main`
