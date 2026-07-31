# GUI Desk Report — DiscipleSpaces (product)

**Mode:** GuiSuggest → **GuiFix applied (P0+P1)**  
**Target:** https://disciple-spaces.pages.dev/ · `~/Desktop/ChantzMediaProjects/DiscipleSpaces`  
**Live checks:** App 200 · SW `ds-shell-v7` · Relay `/health` ok · `noindex`  
**Agents:** dead-cta · false-green · action-surface · a11y-keyboard · (+ final-polish taste bar)  
**Summary:** P0/P1 GUI fixes landed in source (redeploy for live). Truthful Live badges, single Online control, modal focus, room-key/share, testing strip, gather CTA in hero.  
**Sign-off:** **GUI-CLEARED-WITH-NOTES** (P2 residual; redeploy required for Pages)  

---

## Taste bar (Creative Director)

> **Quiet sanctuary for a phone-sized group** — warm parchment, one clear gather CTA, truthful link state, private notes never confused with shared. Kill list: SaaS dashboard chrome, dual competing status strips, long instructional walls on every card.

---

## Findings

| Sev | ID | Agent | Defect | Evidence | Propose | Status |
|-----|-----|-------|--------|----------|---------|--------|
| **P0** | GUI-FG-101 | false-green | **Dashboard “Live” / hero “Linked” read as healthy even when app is Offline mode or sync is stale** | `getGroupLinkStatus` + `GroupLinkBadge` | Live only Online+connected+!paused+!error | **fixed** |
| **P0** | GUI-AS-101 | action-surface | **Two Online/Offline controls** | Header only; pulse status + Sync | **fixed** |
| **P1** | GUI-DC-101 | dead-cta | **Collapsed room-key chip both expands and copies** | Expand only; Share/Copy in tools | **fixed** |
| **P1** | GUI-AS-102 | action-surface | **Host invite path splits Invite vs room key** | Open room → share sheet / copy key | **fixed** (partial; Invite still QR path) |
| **P1** | GUI-AK-101 | a11y-keyboard | **Modal focus** | Focus in, trap Tab, restore | **fixed** |
| **P1** | GUI-AK-102 | a11y-keyboard | **Modal tabs ARIA/arrows** | aria-controls + arrows | **fixed** |
| **P1** | GUI-VC-101 | visual | **Triple testing chrome** | Ribbon only + Guide link; home card removed | **fixed** |
| **P1** | GUI-IX-101 | interaction | **Sticky Start meeting vs nav** | CTA in hero (in-flow) | **fixed** |
| **P2** | GUI-DC-102 | dead-cta | **All spaces vs Groups** | Back link **All groups** | **fixed** |
| **P2** | GUI-FG-102 | false-green | **Wifi icon on pulse can look “connected to room”** | Pulse uses Cloud; Wifi only in OfflineIndicator (app mode) | **fixed** |
| **P2** | GUI-AS-103 | action-surface | **Guest restore host mis-tap** | Having trouble? + confirm | **fixed** (P1 pass) |
| **P2** | GUI-AK-103 | a11y | **Status color-led** | Labels always with Live/Offline/Fix link chips | **fixed** / keep |
| **P2** | GUI-VC-102 | visual | **Card glass over cross** | Card `bg-surface/98` + blur-md; body scrim stronger | **fixed** |
| **P2** | GUI-IX-102 | interaction | **Toast de-dupe** | `toastCoord` + sonner ids; suppress after manual / quiet on space detail | **fixed** |
| **P2** | GUI-AS-104 | action-surface | **Share room key** | Share + Copy in tools; share on open room | **fixed** (P1 pass) |

---

## What’s already strong (do not break)

| Surface | Why |
|---------|-----|
| Primary CTAs | New group / Join / Start meeting / Sync have real handlers |
| Sync errors | Explicit “nothing deleted” + Fix link |
| Private vs shared | Session \| Private tabs; assertNoPrivateNotes |
| Modal Escape | Dismissible sheets close on Escape |
| Bottom nav | 3 tabs, active state, 44px targets |
| Live deploy | Relay health + Pages 200; SW network-first assets |
| Progressive connection bar | Pulse first, tools expanded — right structure |

---

## Ranked suggestions (implement order)

### P0 — truthfulness & mental model (do first)

1. **Truthful Live / Linked badges**  
   - Live only if: `mode === "online"` && connected && !paused && !lastError  
   - Else: Offline · Needs sync · Fix link · Local only  

2. **One Online control**  
   - Header pill = global Online/Offline  
   - Group pulse: status line only + Sync (no second toggle)  

### P1 — action clarity & a11y

3. **Room key chip = expand only; Copy is explicit**  
4. **Post-Connect share sheet** (key + 1-line how-to)  
5. **Modal focus management** (open focus + restore)  
6. **Reduce testing chrome to one always-on strip**  
7. **Sticky gather CTA vs bottom nav** — pick one primary thumb action  

### P2 — polish that makes it stand out

8. Terminology: Groups everywhere (back link)  
9. Icon language: Link/Cloud vs Wifi  
10. OS Share for room key  
11. Guest host-restore behind disclosure  
12. Stronger card glass over cross photo  
13. Toast de-dupe  

---

## Signature UX ideas (beyond defect fix)

| Idea | Why it stands out |
|------|-------------------|
| **“What changed” strip under Sync** (already toast — also inline for 4s) | Ministry apps rarely show merge truth |
| **Gather mode** — Start meeting dims chrome, full focus session | Feels intentional, not form-app |
| **Prayer pulse on home card** | Open prayers count as pastoral presence |
| **First-time room key ceremony** | Large mono key, confetti-free success | 

---

## Sign-off

**CONDITIONAL** — no broken primary CTAs found; pilot is usable.  
Do **not** claim GUI-CLEARED until **GUI-FG-101** and **GUI-AS-101** are fixed (false healthy + dual Online).

---

## Next

Say **GuiFix** / **PolishShip** to implement P0–P1 in code (recommended order above), or name a single item (e.g. “fix Live badges only”).
