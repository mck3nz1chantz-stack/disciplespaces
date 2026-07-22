# Debug Desk Report — DiscipleSpaces

**Mode:** fix (audit + bounded P0/P1)  
**Matched:** vite-react, react-runtime, js-ts, css-web (web PWA)  
**Date:** 2026-07-22  
**Summary:** “Bricked” most likely = PWA shell/asset mismatch, uncaught render crash, or host locked into guest role after file restore via Join — not a wiped database by default.

## Findings

| Sev | ID | Specialist | Issue | Evidence | Repro / verify | Status |
|-----|-----|------------|-------|----------|----------------|--------|
| P0 | DBG-SW-001 | vite-react | Hashed `/assets/*` used stale-while-revalidate → old JS can pair with new HTML after deploy → white screen | `public/sw.js` SWR for assets; no controllerchange reload | Install PWA → deploy new build → open app (esp. flaky network) | **fixed** network-first assets + SW v4 + reload on activate |
| P0 | DBG-RX-001 | react-runtime | No ErrorBoundary → any render throw = full white “brick” | `App.tsx` / `main.tsx` bare tree | Force throw in a page | **fixed** `ErrorBoundary` with Reload + Full refresh |
| P1 | DBG-JS-001 | js-ts | Restoring DSX1 via **Join + name** marks `deviceRole: guest` → cannot Connect / edit roster; guest banner says “join host key” forever | `joinFromExport` guest path; SpaceDetail guest UI | Import DSX1 through Join with name | **fixed** “restore as host” checkbox + claim host CTA |
| P1 | DBG-JS-002 | js-ts | Zip restore only accepted `.txt` (prior fix) | `ShareUpdateModal` accept | Drop `.zip` backup | **fixed** earlier session (`importFile` + fflate) |
| P1 | DBG-RX-002 | react-runtime | Initialize failure only showed red text, no retry | `Dashboard` error card | Fail Dexie open (quota) | **fixed** Try again + recovery copy |
| P2 | DBG-JS-003 | js-ts | Large single JS chunk (~800KB) | Vite build warning | Lighthouse / cold start | open — not brick |
| P2 | DBG-SW-002 | vite-react | Offline after SHELL_CACHE bump needs network once | activate deletes old caches | Airplane mode mid-update | residual — expected |

## “Bricked” interpretation (Christian)

Most plausible explanations (in order):

1. **White screen after update** — service worker served mismatched shell/assets.  
2. **Group “dead” after restore** — imported via Join as guest; host controls locked.  
3. **Empty list** — different origin/URL than before (IndexedDB is per-origin), or site data cleared without backup.  
4. **Zip restore failed** — treated as binary / wrong accept (fixed).

Not a Dexie wipe by migrations: upgrades are additive (v1–v8); file import never enables relay wipe.

## Actions taken (this pass)

- `public/sw.js` → `ds-shell-v4`, network-first `/assets/*`, activate notifies clients  
- `main.tsx` → ErrorBoundary + one-shot reload on SW controllerchange  
- `ErrorBoundary.tsx` → soft reload + unregister SW / clear caches  
- `joinFromExport({ asHost })` + Join checkbox “restore as host”  
- `claimSpaceHostRole` + SpaceDetail guest recovery button  
- Dashboard initialize error → Try again  
- (prior) Zip unwrap import path  

## Residual / next

- Deploy production so Christian gets SW v4 + host recovery UI  
- Ask Christian: white screen vs empty groups vs Guest badge + locked Connect  
- If empty on correct origin: Restore Zip/txt; if Guest: “I created this group — restore host”  
- Optional later: code-split main chunk; Settings “Repair app shell” button without crash  

## Christian recovery checklist

1. Open **https://disciple-spaces.pages.dev** (same bookmark always).  
2. If white screen: hard refresh / clear site cache (only if backup exists) → ErrorBoundary “Full refresh”.  
3. If group shows **Guest** and cannot invite/Connect: open group → **I created this group — restore host**.  
4. If list empty: Settings → Restore → Zip or DSX1./DSP1. text.  
5. Prefer Settings → Restore for own backups (stays host); use Join for true guest invites.
