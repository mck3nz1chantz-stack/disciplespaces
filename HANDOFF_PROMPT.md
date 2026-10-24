# Handoff — DiscipleSpaces reader and group

Copy everything below the line into a new chat.

---

You are continuing **DiscipleSpaces** (operator may say DisciplesApp). Same product.

**Code:** `/Users/kenzi/ChantzMedia/ChantzMediaProjects/DiscipleSpaces`  
**Do not use** `~/Desktop/ChantzMediaProjects/DiscipleSpaces`.  
**Launcher:** read-only unless the operator gives permission. No app code under the launcher.  
**Live site:** https://disciple-spaces.pages.dev  
**Dev:** `cd` the code path and `npm run dev` (Vite, often http://127.0.0.1:5173/).

Read first: `HANDOFF_STATE.json`, this file, `docs/drafts/study-first-2026-10.md`. Older drafts (`reader-and-group-2026-10.md`, `refinement-2026-10.md`) describe what is already built.

## This chat’s job

A1 through A5 are coded locally and are not deployed. Do not deploy unless Kenzi asks. Do not resume two-phone share.

B1, B2, and B3 are deployed with study-first A1–A5. Commit `72b302d`. Site: https://disciple-spaces.pages.dev. Preview: https://7b90519d.disciple-spaces.pages.dev. Relay was not redeployed. Do not rebuild these slices. Do not add a cross-reference library unless Kenzi names that slice.

R1–R5 are already in the tree. Do not start another reader-and-group slice. Do not rescaffold. Do not add a fifth bottom tab.

Two-phone share stays unaccepted. It is sidelined until the study tool is in daily use. Do not call sharing done without a live test on two phones. Do not make that test the next build.

## Locked

- This phone is the copy you can always open. A group shares only after the host opens a room. Private notes never go on the room.
- Bottom bar: **Read**, **Studies**, **Notes**, **More**. Read opens first. The header is the app name and the active study. Online / Offline is on More and inside Group sharing.
- **More → Save a copy** writes every group, its meetings, notes, color, place, aim, marks, and what’s-next queue into one file. **Open a copy** restores them. A note already on the phone is kept. A group file has no notes, marks, or queue.
- Join link is `https://disciple-spaces.pages.dev/join?code=ABCD-EF`.
- Verse notes: one note per study per exact reference. The scripture key is `version|bookId|chapter|start|end`. The study is `spaceId`. Notes chips filter by study. A reference opens Read in that study.
- Read search: current translation, collapsed results, **Go to verse**.
- Meetings already have a day, an optional time, weekly, Upcoming, and Past. Groups home shows the soonest meeting. Leave that behavior in place.
- Bible video plate stays as locked in `docs/final/bible-reader-scroll-video-plate.md`.
- Plain words. No “relay”, “DSP1”, or “snapshot” in the interface.
- No streaks, percents, badges, or a screen that asks for notification permission.

## Still open

Two-phone share accept. Spec limits are in `docs/drafts/reader-and-group-2026-10.md`.

## Next spec

`docs/drafts/group-ux-2026-10.md` is the group-page tidy. U1 through U4, the phone Read scroll fix, and past-session passage removal are live from commit 8cf9e55. Live: https://disciple-spaces.pages.dev. Deployment: https://c2cfec43.disciple-spaces.pages.dev. Relay was not redeployed.
