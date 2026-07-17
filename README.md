# DiscipleSpaces

Mobile-first PWA for small-group discipleship (1–5 people).  
**Mission:** Free forever — never a paid app or paywalled Bible. Optional donations (if ever) would be long after a real launch and would support local church/ministry, not unlock features.  
**Privacy:** Personal notes never leave the device. Shared content is exportable / optional Space room.  
**Bible:** Public-domain **KJV** and **WEB** only (no registration-required translations).

## Stack

- Vite + React 18 + TypeScript (strict)
- Tailwind CSS 4
- Dexie.js (IndexedDB)
- PWA (`public/manifest.webmanifest` + `public/sw.js`)
- Zustand, React Router, date-fns, lucide-react, sonner

## Commands

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview  # production build + service worker
```

## Phases

- **Phase 0** — Foundations: project config, data model, Dexie seed templates, routing shell, mobile layout, PWA app shell, legal disclaimer.
- **Phase 1** — Spaces & Members: Space CRUD, 1–5 member management, Space detail with session timeline, basic session create (date / template / attendees).
- **Phase 2** — Sessions & Templates: template-driven session form (steps + responses), view / edit / delete sessions, improved timeline.
- **Phase 3** — Bible Reader Foundations: offline public-domain KJV reader (books/chapters/search), PWA-cached under `public/data/bible/`.
- **Phase 4** — Bible Integration & Passage Logging: ranked search, Space-contextual Bible, log passages into sessions.
- **Phase 5** — Sharing, Invites & Polish: offline invite codes + QR, join flow, Space Update export/import.
- **Final polish** — In-app Help & tutorial (`/help`), header help icon, `TUTORIAL.md`.
- **Onboarding + PWA** — First-launch welcome, quick-start checklist, install guidance (`INSTALL.md`).

## Install as an app (PWA)

See **[INSTALL.md](./INSTALL.md)** for iOS, Android, and desktop steps.

```bash
npm run build && npm run preview   # then install from the browser
```

In the app: **Settings → Install DiscipleSpaces** (when the browser supports a prompt).

## Deploy (Cloudflare Pages)

See **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

```bash
npm run deploy   # build + wrangler pages deploy dist
```

Dexie schema notes: **[MIGRATIONS.md](./MIGRATIONS.md)**.

## Privacy boundaries

| Data | Storage | Leaves device? |
|------|---------|----------------|
| Spaces, sessions, prayer board | IndexedDB | File backup (DSX1) and/or **opt-in** Space room when Connect is used |
| Private notes | IndexedDB (`privateNotes`) | **Never** by default; optional encrypted personal backup (`DSP1.`) with Account Key |
| Bible (KJV) | Local / cached | Public domain text only |
| Account Key / Group Key | localStorage (optional) | You hold the secret; server may store Group Key **hash** only after rotate |

Default mode is **local-only** — no keys required. See **Your Spaces & data**, **Account Key**, and `docs/final/keys-product-spec.md`.

## Launcher (read-only)

Source of truth: `/Users/kenzi/Desktop/ChantzMediaLauncher`

Do not modify the launcher unless you say: `I give permission to modify ChantzMediaLauncher`

## Build state

See `build-state.json` for phase, compliance notes, and GrokLaw status.
