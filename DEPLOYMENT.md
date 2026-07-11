# Deploying DiscipleSpaces to Cloudflare Pages

Static PWA build (`dist/`) with service worker + offline KJV data.

## Prerequisites

- Cloudflare account
- Node 18+
- Project built with `npm run build`

## One-time: create the Pages project

**Option A — Dashboard**

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages**.
2. Choose **Upload assets** (direct upload) or connect a Git repo.
3. Build settings if using Git:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root:** project root

**Option B — Wrangler CLI**

```bash
# Always use npx — no global wrangler install required
npx wrangler login
npx wrangler pages project create disciple-spaces
```

## Deploy a release

```bash
cd ~/Desktop/ChantzMediaProjects/DiscipleSpaces
npm install
npm run build
npx wrangler pages deploy dist --project-name=disciple-spaces
```

Wrangler prints a `*.pages.dev` URL. Open it over HTTPS, wait for the SW to register, then install the PWA (see `INSTALL.md`).

Config reference: `wrangler.toml` (`pages_build_output_dir = "dist"`).

## Headers & SPA routing

Shipped with the build (copied from `public/`):

| File | Purpose |
|------|---------|
| `_headers` | SW revalidation, asset caching, manifest MIME |
| `_redirects` | SPA fallback `/* → /index.html` |

## Custom domain

1. Pages project → **Custom domains** → add domain.
2. Follow DNS instructions (CNAME to `*.pages.dev` or Cloudflare proxy).
3. HTTPS is automatic on Cloudflare.

## Updating after code changes

```bash
npm run build
npx wrangler pages deploy dist --project-name=disciple-spaces
```

Or push to the connected Git branch (if Git integration is enabled).

Clients pick up the new service worker via `registerType: "autoUpdate"`. Users may need to reopen the app once.

## Post-deploy checklist

- [ ] App loads on `https://…pages.dev`
- [ ] Settings shows **Offline ready** after first load
- [ ] **Install** works (or iOS Add to Home Screen)
- [ ] Airplane mode: Spaces + Help still open
- [ ] Bible chapter opens offline after install / first cache
- [ ] Create a Space, refresh, data still present

## Local production check (no Cloudflare)

```bash
npm run build && npm run preview
```

## Related

- `INSTALL.md` — end-user install steps  
- `MIGRATIONS.md` — Dexie schema versions  
- `build-state.json` — project status  
