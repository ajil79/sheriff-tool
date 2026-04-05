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
