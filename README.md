# DiscipleSpaces

Mobile-first PWA for small-group discipleship (1–5 people).  
**Privacy:** Personal notes never leave the device. Shared content is manually exportable. Bible text is public domain KJV only.

## Stack

- Vite + React 18 + TypeScript (strict)
- Tailwind CSS 4
- Dexie.js (IndexedDB)
- vite-plugin-pwa
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
| Spaces, sessions, templates | IndexedDB | Only via **manual** export (Space Update) |
| Private notes | IndexedDB (`privateNotes`) | **Never** |
| Bible (KJV) | Local / cached | Public domain text only |

## Launcher (read-only)

Source of truth: `/Users/kenzi/Desktop/ChantzMediaLauncher`

Do not modify the launcher unless you say: `I give permission to modify ChantzMediaLauncher`

## Build state

See `build-state.json` for phase, compliance notes, and GrokLaw status.
