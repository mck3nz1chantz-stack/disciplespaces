# DiscipleSpaces — Sync reliability + UX polish spec

**Status:** S0 complete — waiting operator accept  
**Date:** 2026-08-27  
**App:** DiscipleSpaces (DisciplesApp)  
**Workspace:** `/Users/kenzi/ChantzMedia/ChantzMediaProjects/DiscipleSpaces`  
**Git at spec time:** `main` · `2208c6c` · working tree clean  

**This session is spec-only.** Implementation starts after operator accept (or “implement S1”).

---

## Operator ask (locked intent)

1. **Sync still broken in the field** — not another toast-only pass.
2. **UX/UI makeover** — more polished, same product, no rescaffold.
3. Spec first.

---

## Executive finding

The **relay and merge code already intend** live shared-layer sync (create/reuse room, LWW replace-shared pull, auto-sync re-queue, host roster authority). Field reports still describe **ZIP as the only path that works**. That gap is mostly **join/share UX + stale/empty room snapshots + file-import add-only**, not a missing protocol.

Do **not** claim sync is done until a two-phone accept test on canonical Pages passes.

---

## Product vs bug (decisions)

| Behavior | Current code | Field | **Spec decision** |
|----------|--------------|-------|-------------------|
| New member Join should receive **sessions already on the room** | Snapshot includes `sessions[]`; `connectSpaceToRelay` syncs after open; reuse merges host snapshot. `build-state.json` still says `newMembersGetPastSessions: false` — **docs lag code**. | BUG-003: invite worked, past sessions did not land | **A — ship what the room has.** Joiners get the current shared snapshot (meetings + prayer + members). Not a second “history dump” product. Host must have **Open room / Sync after meetings** so the room is not empty. Copy must say that. |
| Host never Connected, or Connected once then added meetings Offline | Room snapshot can stay empty; auto-sync no-ops when Offline / paused / not connected | Same symptom as BUG-003 | **Must-fix S1:** after Online + connected, auto-push local sessions; Open room always push current local history (already attempted — verify + surface failure). |
| Live Sync should update roster + latest shared rows without ZIP | `syncSpaceNow` pull+push + 409 retry | BUG-002 ZIP workaround | **Must-fix S1** — two-device test is the gate. |
| Fault codes `PPH4-QJ`, `yad-35` | Room keys look like `ABCD-EF`. `readError` now wraps 4-2 strings; Worker 404 uses `INVALID_JOIN_HELP`. Users likely pasted **offline invite short code** or **saw the key as an error**. | BUG-004/005 | **S2 copy + classify.** Never show a bare short code as a fault. Distinguish “that is the invite code, not an error.” |
| ZIP restore drops sessions / extra groups | Zip picker takes **one best file**; `importSpaceExport` default **add-only** skips existing session IDs; DSP1 vs DSX1 | BUG-009 | **S4:** restore all DSP1 spaces; same-space restore uses replace-shared LWW; explain what landed. |
| SMS invite does not open Join | Connected share: code + homepage URL, **no** `/join?code=`. Offline: `#invite=` huge DS1 token (SMS truncates; some clients drop hashes). `/join?code=` already parsed. | BUG-002 | **S2 P0:** share `https://disciple-spaces.pages.dev/join?code=ABCD-EF` |

**Operator can override A:** if past meetings must stay host-only, restore the docs flag and **strip sessions from join snapshot** (explicit). Default recommendation is **A**.

---

## Sync diagnosis (code)

### Intended happy path

1. Header **Online**.
2. Host: group → **Open group room** (`connectSpaceToRelay`) → Worker `POST /rooms` (reuse by `spaceId` unless `forceNew`).
3. Host share **room key** (`ABCD-EF`), not Group Key / Account Key / DS1 package.
4. Guest: **Join a group** → `resolveJoinCredentials` → `POST /rooms/join` → `importSpaceExport(..., replace-shared)` → immediate push of merged snapshot.
5. Later writes: `scheduleConnectedSpaceSync` (~1.8s) if Online + connected + !paused.
6. Live: `GET /rooms/:id/live` WebSocket; foreground poll fallback.

### What already exists (do not rebuild)

| Piece | Path |
|-------|------|
| Pull/push + 409 retry | `useAppStore.syncSpaceNow` |
| Re-queue in-flight | `src/lib/sync/autoSync.ts` |
| LWW sessions/prayers | `merge.ts` + Worker `mergeSharedSnapshots` |
| Host roster on replace-shared | `importSpaceExport` |
| Private notes excluded | `sharedSnapshot.ts` + Worker `assertNoPrivateNotes` |
| Guest cannot Connect | `connectSpaceToRelay` |
| Stale room heal | `healStaleRoom` (re-join shortCode / host reopen) |
| Fault-code wrapping | `client.ts` `readError` |
| Key classifier | `inviteKey.ts` |

### Remaining failure modes (ranked)

| # | Failure | Evidence | Slice |
|---|---------|----------|-------|
| F1 | Guest uses **offline DS1 / 8-char invite code** as room key → 404 / “fault” | `looksLikeRoomShortCode` matches both; Worker lookup is **relay** shortCode only; `deriveInviteCode` is a different 8-char label | S2 |
| F2 | Share/SMS has **no join deep link**; hash packages truncated | `formatInviteShareText` connected branch; `shareOrCopyRoomKey` text is homepage only; `#invite=` huge | S2 |
| F3 | Room snapshot **empty** when guests join (host opened room before meetings, never Sync’d while Online) | `createRoom` reuse now merge-pushes; first Connect still needs later auto-sync. Join guest push errors **swallowed** (`joinSpaceViaRelay` catch) | S1 |
| F4 | Guest **silent push fail** after Join — host never sees them; guest thinks they joined | `joinSpaceViaRelay` try/catch around `relayPushRoom` | S1 |
| F5 | **Header Offline** or paused — users still tap Sync; ZIP becomes the path | `autoSync` no-ops; pulse has Sync but Online is header-only (locked) | S1 copy + disable/explain |
| F6 | File restore **add-only** + zip **single best entry** | `importSpaceExport` default; `extractBackupTextFromZip` | S4 |
| F7 | Two origins / SW / guest-after-restore | debug-report; IndexedDB per origin | S1 checklist, not new protocol |
| F8 | Rotate key without guest re-Join | old shortCode 404; heal uses stored `shortCode` | S1 copy after rotate |

**Killed / low:** “Relay never stores sessions” — false (`SharedSpaceSnapshot.sessions`). “Need accounts” — out of scope. “Device secret unused on Worker” — leftover, not field P0.

### Hypotheses still needing live proof (implementation chat)

Two profiles vs `https://disciple-spaces.pages.dev` (or localhost + deployed Worker):

1. Host Online → Open room → add a meeting → wait 2s → guest Join with **current** room key → guest sees that meeting.
2. Both already joined → host edits attendees → guest Sync / wait auto-sync.
3. Guest paste **offline invite code** while room is open → human error, not blank fail.
4. SMS/share → tap URL → `/join` with code prefilled.

Until (1) and (2) pass on **Pages**, S1 is not done.

---

## UX / polish (audit, not a rescaffold)

**Taste bar (keep):** quiet sanctuary phone group — warm parchment, one gather CTA, truthful link state, private ≠ shared. Kill: SaaS dual status, gold chrome on light parchment, instructional walls.

Nav P0–P2 and GUI P0–P1 are **shipped**. Polish is craft + joining mental model.

### Surfaces

| Surface | State | Polish notes |
|---------|--------|----------------|
| Shell | Sticky header + testing ribbon + 3-tab nav | Header is crowded (title, Online, feedback, theme, help). Testing copy still says “not a polished public app” — operator now wants polish; **narrow ribbon**, don’t delete testing honesty. |
| Groups home | Cards + Next-up + checklist | Checklist still dominates empty/new. Hierarchy: last group / continue Bible should win. |
| Group detail | Hero + gather + chips + connection bar | Strong structure; **Sharing tools** still jargon-heavy (room key vs file vs Group Key). |
| Join `/join` | Page **plus** modal | Double chrome. Prefer in-page form, modal optional for QR. |
| Settings | TOC exists | Restore vs Join vs Account Key still three recovery stories — one “Get data on this phone” map. |
| Bible | Locked plate | **Do not restyle** sticky/seek. Reader chrome only if contrast fails. |
| Toasts | De-duped, layout-stable | Keep. |

### Polish backlog (max 8 P0)

| ID | Sev | Surface | Problem | Proposed |
|----|-----|---------|---------|----------|
| P0-1 | P0 | Join + share | Two invite systems (DS1 package vs room key) without a single “right now” path | One primary: **room key + short `/join?code=` link** when connected. Offline package secondary (“no internet”). |
| P0-2 | P0 | Connection bar | Status + tools still read as admin console | Pulse: one sentence (“Linked · last sync 2 min ago”) + Sync. Tools: Share invite / Fix / Save file — labels a host would say. |
| P0-3 | P0 | Join page | Modal-on-page | In-page join: code, who are you, submit. |
| P0-4 | P0 | Home | Checklist + cards compete | Empty: two actions (New group / Join). After one group: list first; checklist collapsed. |
| P0-5 | P1 | Header | Five controls + dual titles | Keep Online in header; compress help/feedback into one overflow or Settings. Wordmark only (drop “ChantzMedia” subtitle on mobile). |
| P0-6 | P1 | Type/space | Cards + serif titles + muted body uneven | One title size on group cards; 8px rhythm; primary CTA contrast on parchment. |
| P0-7 | P1 | Dark | Accent gold on dark chrome | Buttons stay primary-green; gold only for rare highlight (not borders). |
| P0-8 | P1 | Motion | Button `hover:-translate-y` on iOS | Keep press scale; drop hover translate on coarse pointer (`@media (hover:hover)`). |

**Later:** Settings recovery map illustration; session modal Done (nav P2 residual if still X-only); code-split 800KB chunk (perf, not polish).

**Do not polish:** Bible plate geometry; Live badge formula; privacy copy that private notes never leave.

---

## Slice plan

| Slice | Name | Goal | Depends |
|-------|------|------|---------|
| **S0** | Spec lock | This document | — |
| **S1** | Sync reliability | Two devices share members + latest sessions **without ZIP** | S0 accept |
| **S2** | Join/invite codes + SMS | Fault codes gone; tappable `/join?code=` | can start after S1 diagnose, ship with S1 |
| **S3** | History policy | Align `build-state` + Help copy with decision A (room snapshot = truth) | S0 |
| **S4** | ZIP/DSP1 restore | BUG-009: all spaces in personal backup; same-space LWW | parallel after S1 green |
| **S5** | PolishShip P0-1…P0-4 | Visual/join craft; **no protocol rewrite** | S1 two-device green |

S2 may land in the same PR as S1 if share URL is required to *test* join.

---

## S1 work list (when implementing)

1. Reproduce F3/F4 on localhost (two Chromium profiles) against live Worker.
2. **Do not swallow** guest post-join push — toast + `lastError` + retry.
3. After any shared session write, if connected+Online, guarantee `scheduleConnectedSpaceSync` (verify store mutations call it).
4. Open room: if post-create `syncSpaceNow` fails, keep `lastError` visible (already partly there).
5. Sync button when header Offline: disable + “Turn Online in the header to share.”
6. Host rotate: guest UI “Ask for the new room key” when 404, not generic network.
7. Accept test below; then Pages deploy only with approval.

**Out of S1:** Worker device-secret check; custom domain; stripping private notes (already).

---

## S2 work list

1. `shareOrCopyRoomKey` + `formatInviteShareText` connected:  
   `https://disciple-spaces.pages.dev/join?code={shortCode}` (query, not hash).
2. Join input: if paste looks like room key **and** 404, say “This is not the live room key. Host: Open group room, share the key on the group card.”
3. Offline DS1 path labeled **“Join without internet (full invite)”**.
4. Preview `sessionCount` on confirm: “This room has N meetings” (API already has `sessionCount`).

---

## S3 work list

1. Set `inviteBehavior.newMembersGetPastSessions` to **true** meaning “whatever is on the room.”
2. Help/tutorial: new members do **not** get meetings the host never Synced; ZIP/DSP1 still for offline catch-up.
3. Do **not** add a “send all history” extra API unless (A) two-device still empty after S1.

---

## S4 work list

1. DSP1 zip/text: import **every** space in the package (not first only).
2. Restoring a space that already exists: `replace-shared` for sessions/prayers (same as relay), keep private notes local.
3. Zip with several DSX1 files: restore all or list picker — do not silently pick one.
4. Toast: “Restored N groups, M meetings.”

---

## Accept criteria

### Sync (S1) — must all pass

- [ ] Host Connect → guest Join with **current room key** → both see same members + **latest shared session** without ZIP (two browsers).
- [ ] Host adds a meeting while both Online+linked → guest sees it after auto-sync (≤ ~5s) or one Sync tap.
- [ ] Guest Join push failure is visible and retryable (not silent).
- [ ] Header Offline: auto-sync does not run; copy explains; **data not deleted**.
- [ ] Private notes absent from relay snapshot (assert + spot-check network).
- [ ] Wrong/expired code: sentence-length help, not a bare `ABCD-EF` “fault.”

### Invite (S2)

- [ ] Share/SMS contains tappable `/join?code=` that prefills Join.
- [ ] Canonical origin only in share text.

### History (S3)

- [ ] Help + `build-state.json` match decision A.
- [ ] Empty room explained: “Host hasn’t Synced meetings yet.”

### Restore (S4)

- [ ] Personal backup with two groups restores both.
- [ ] Re-import of same group updates session bodies (LWW), does not skip all “already there.”

### Polish (S5)

- [ ] Taste bar held; no new bottom tab.
- [ ] Join is a page, not a modal stacked on a page.
- [ ] Mobile ~390 and desktop; keyboard/focus not regressed.
- [ ] Bible plate still sticky-seek per locked recipe.

---

## Out of scope unless operator adds

- Rescaffold / new design system from zero  
- Paid accounts / non–PD Bible  
- Custom domain  
- Main-chunk code-split (optional leftover)  
- Worker device-secret validation (optional leftover)  
- Sending meetings that were **never** on the room without host Sync (that is ZIP/DSP1)

---

## Verification

```bash
cd /Users/kenzi/ChantzMedia/ChantzMediaProjects/DiscipleSpaces
npm run dev    # two browser profiles
npm run build
```

Relay health: `https://disciple-spaces-relay.mck3nz1-chantz.workers.dev`  
No deploy without `APPROVED — deploy`.

---

## Sign-off

| | |
|--|--|
| Operator | **accepted 2026-08-27** |
| Spec complete | **yes (S0)** |
| Implementation | **S1+S2+S3 in progress / landing** |
| Recommended first implement | **S1 + S2 together** |

### Suggested replies

- `accept spec` — next chat implements S1+S2  
- `history stay host-only` — override decision A  
- `polish only` — skip S1 (not recommended; field sync still open)  
