# GrokBuild handoff — DiscipleSpaces (new chat)

Copy everything below the line into a **new chat**.

---

## Activate

You are continuing **DiscipleSpaces** (ChantzMedia first-party product).  
Workspace: `/Users/kenzi/Desktop/ChantzMediaProjects/DiscipleSpaces`  
Launcher (read-only unless permission given): `/Users/kenzi/Desktop/ChantzMediaLauncher`

Read first:

1. `HANDOFF_STATE.json` (this project)
2. `HANDOFF_PROMPT.md` (this file)
3. `docs/drafts/gui-report.md` (GUI pass status)
4. Optional: `build-state.json`, `DEPLOYMENT.md`

**Do not re-litigate** architecture below. Implement the **next slice** (navigation) unless user redirects.

---

## Project snapshot

| | |
|--|--|
| **App** | Mobile-first PWA — small-group discipleship (1–5 / family 1–10) |
| **Stack** | Vite 6 · React 18 · TS strict · Tailwind 4 · Dexie · Zustand · RR · sonner · lucide |
| **Privacy** | Private notes **never** leave device; shared layer opt-in Space room relay |
| **Bible** | Public-domain KJV + WEB only |
| **Live app** | https://disciple-spaces.pages.dev |
| **Relay** | https://disciple-spaces-relay.mck3nz1-chantz.workers.dev |
| **Git** | `main` · last shipped commit often `8d9dda5` (verify with `git status` / `git log -1`) |
| **Repo** | https://github.com/mck3nz1chantz-stack/disciplespaces.git |

### Commands

```bash
cd /Users/kenzi/Desktop/ChantzMediaProjects/DiscipleSpaces
npm run dev          # http://localhost:5173
npm run build
npm run deploy       # Pages (needs APPROVED — deploy)
npm run relay:deploy # Worker (needs deploy approval)
```

---

## Locked decisions (do not reopen)

1. **Local-first** default; Connect/Sync is opt-in per Space.  
2. **Host** opens room / reissues key; **guest** Joins + Sync only (claim host is recovery + confirm).  
3. **Online/Offline** = **header only**; group pulse = status + Sync (no second toggle).  
4. **Live badge** = truthful via `getGroupLinkStatus` / `GroupLinkBadge` — not merely `connected && roomId`.  
5. **Private notes** excluded from snapshots; client + Worker `assertNoPrivateNotes`.  
6. **LWW** sessions/prayers by `updatedAt` + tombstones; host-authoritative **members** on server push.  
7. **Room key rotate** unbinds old short-code indexes on Worker.  
8. **Canonical bookmark** `https://disciple-spaces.pages.dev` (IndexedDB is per-origin).  
9. **Testing** = one ribbon under header (not triple chrome).  
10. **Gather CTA** lives in Space hero (not sticky fighting bottom nav).  
11. Taste bar: *quiet sanctuary phone group* — no SaaS dual status strips, no gold ink on light parchment for chrome controls.

---

## What this session already shipped

### Sync / relay
- Auto-sync **re-queue** after in-flight (`src/lib/sync/autoSync.ts`)
- Relay: short-code **unbind** on rotate; **host roster authority**; host reclaim
- Client: `membersUpdatedAt`, replace-shared roster rules
- **What-changed** after sync (`syncSummary.ts`); toasts use it
- **Toast de-dupe** (`toastCoord.ts`) manual vs foreground

### GUI P0–P2 (product)
- Progressive `SpaceConnectionBar` (pulse + Sharing tools)
- Space hero + truthful link badges
- Modal focus trap + tab ARIA/arrows
- Card glass `bg-surface/98`; stronger body scrim
- Theme/feedback header contrast fix (check if uncommitted: `ThemeToggle.tsx`, `FeedbackLauncher.tsx`)

### Deploy / hub
- Pages + relay deployed; GitHub push of polish commit
- AppHub registry Open → live Pages URL
- GuiAudit launcher CLI: smoke clean (operator Console optional spot-check)

---

## NEXT SLICE — Navigation wayfinding (recommended changes)

**User asked for UI/UX that aids navigation; implement these in order unless they reprioritize.**

### P0 (do first)

| # | Change | Detail | Files (likely) |
|---|--------|--------|----------------|
| N1 | **Groups tab active on Space** | On `/space/*`, bottom nav **Groups** should show active (parent route), not none | `Layout.tsx` NavLink `className` / `isActive` |
| N2 | **Breadcrumb / context title** | Space: `Groups › {name}` (Groups tappable). Bible with context: `Groups › {space} › Bible`. Reduces “wrong group?” | `Layout.tsx` or page headers; `SpaceDetail`, `Bible` |

### P1

| # | Change | Detail | Files (likely) |
|---|--------|--------|----------------|
| N3 | **In-group jump chips** | Under hero: Meet · Sync · People · Prayer · Past · More — scroll-to or open panels | `SpaceDetail.tsx` |
| N4 | **Bible group context** | Banner: studying for which group + **Change** → space/session picker; align Study tile vs Bible tab | `Bible.tsx`, bible context helpers |
| N5 | **Join/Create routes** | `/join`, `/new` (or `?join=1`) full-page; deep links restore place; after join → that space | `App.tsx`, `JoinSpaceModal`, `Dashboard` |

### P2

| # | Change | Detail |
|---|--------|--------|
| N6 | Home **Next up** strip | Last group · Continue Bible · open prayers chip |
| N7 | Settings **TOC** / section anchors | Appearance · Groups · Backup · Account Key · Install · About |
| N8 | Session modal **Done** / Back to session | Clearer exit than X-only when on Private tab |

### Signature (optional later)

- **Gather path**: one control → Start meeting → Study → Prayer step indicator (ritual, not scavenger hunt)

### Nav principles (keep)

- Groups is home; one primary per screen  
- Don’t invent a 4th bottom tab without evidence  
- UI copy: **Groups** not “spaces” where user-facing  
- Deep links restore a **place**, not a modal flash only  

---

## Key files

| Area | Path |
|------|------|
| Routes / shell | `src/App.tsx`, `src/components/Layout.tsx` |
| Groups home | `src/pages/Dashboard.tsx` |
| Group detail | `src/pages/SpaceDetail.tsx` |
| Sync UI | `src/components/SpaceConnectionBar.tsx` |
| Link truth | `src/lib/sync/linkStatus.ts`, `GroupLinkBadge.tsx` |
| Sync core | `src/stores/useAppStore.ts` (`syncSpaceNow`, connect/join) |
| Relay | `space-relay/src/index.ts` |
| Config | `src/lib/sync/config.ts` (default relay + canonical origin) |
| Toasts | `src/lib/sync/toastCoord.ts`, `syncSummary.ts` |
| Theme | `src/components/ThemeToggle.tsx`, `src/lib/theme.ts` |
| Bible plate | `docs/final/bible-reader-scroll-video-plate.md`, `BibleReaderVideoBg.tsx` |
| GUI notes | `docs/drafts/gui-report.md` |

---

## Deploy / approval gates

| Action | Need |
|--------|------|
| `git push` | User: push approval / “git push” |
| Pages deploy | `APPROVED — deploy` / “approved - deploy” |
| Relay deploy | Same deploy approval |
| Launcher edits | Permission phrase / standing grant only for high-confidence bounded |

Default relay URL is in code — no secret `.env` required for production shape.

---

## Pre-flight checklist for new agent

```bash
cd /Users/kenzi/Desktop/ChantzMediaProjects/DiscipleSpaces
git status -sb
git log -1 --oneline
# If ThemeToggle/FeedbackLauncher dirty → commit before nav work or include in same PR
npm run dev
```

Smoke after nav P0:

1. Open a group → bottom **Groups** looks active  
2. Breadcrumb/back: Groups › name works  
3. Online still only in header; Live badge still truthful  
4. Private notes still local-only  

---

## Exact next instruction

**Begin navigation slice N1 + N2 (P0):**

1. Make bottom-nav **Groups** active for `/` and `/space/:id`.  
2. Add breadcrumb/context wayfinding on Space detail (and Bible when group context exists).  
3. Keep existing sync/privacy/online rules intact.  
4. Typecheck; offer deploy only if user asks.

If user says “full nav P0+P1”, also do N3–N5 after N1–N2.

---

*Handoff generated for context window switch — DiscipleSpaces session ending with nav recommendations specified, not yet implemented.*
