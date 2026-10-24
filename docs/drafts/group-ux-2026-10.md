# DiscipleSpaces — one job on the group page

**Status:** U1 through U4 deployed 2026-10-24. https://disciple-spaces.pages.dev
**Date:** 2026-10-23
**App:** DiscipleSpaces (`ChantzMediaProjects/DiscipleSpaces`)
**Comes after:** study-first A1–A5, reader slices, and the 2026-10-24 current-study calendar. Those stay as they are.
**Do not start** two-phone share, a cross-reference library, or a relay change in these slices.

## The decision

The bottom bar stays **Read**, **Studies**, **Notes**, **More**. Read still opens first. There is no fifth tab.

Inside one study (`/space/:id`), the long scroll becomes four tabs under the name:

| Tab | Job |
| --- | --- |
| Tonight | Open this group and start the night. |
| Meetings | See the month, open a night, plan a day, or log a day. |
| Prayer | This group’s prayers, then switch study or session without leaving the board. |
| Group | People tools, sharing, rename, and the rare controls. |

One tab is on screen. The others are not stacked underneath it.

Words on these screens: Tonight, Meetings, Prayer, Group, Plan this day, Log this night, Open, This session, All open, 2 copies. Do not add relay, snapshot, held, mode, or room key to the nightly path. Group sharing may keep the words it already uses once that section is open.

## What stays

- Four bottom items. Icons plus words.
- Study color chips on Read and Notes. Prayer uses the same chips.
- Session sheet: Session and Private. Private notes never go on a room.
- Complete session keeps that night and advances the next one. Complete study moves the whole book to Past. `src/lib/currentStudy.ts` keeps that meaning.
- Individual and Group on the prayer board.
- Gather tonight. Steps stay meet, study, prayer (`src/lib/gather.ts`).
- Anyone on the phone can remove a person. Hosts still rename people. Cap stays 15.
- Save a copy and Open a copy. No new fields are required for these slices.
- Join at `/join?code=`. A connected room still syncs in the background.
- Bible video plate, as locked in `docs/final/bible-reader-scroll-video-plate.md`.

These slices must not delete a group, a session, a prayer, a note, a member, or a saved date except through a button the person confirmed. They must not bump the database schema. They must not change the relay allow-list.

## Tonight

Default when someone opens a study from the Studies list.

On the screen, in this order:

1. Breadcrumb: Studies, then this study’s name.
2. The four tabs. Tonight is selected.
3. The study name, its color dot, and where reading left off. The left-off line opens Read for this study. Under it, Next, when a queue item exists. **Edit studied** and **Edit what’s next** stay as text controls here, because they belong to reading.
4. One next-meeting card, or the line “No meeting planned” plus **Plan a meeting** (switches to Meetings and opens the plan form).
5. **Gather tonight**, or **Gather · first meeting** when this study has no session yet. The helper line stays “One path: Meet · Study · Prayer”. Personal study with no meeting does not show Gather. It shows the plan line instead.
6. Study, Prayer, and Just for me. Prayer switches to the Prayer tab. It does not open a second board.
7. The people row, once. Names, remove, and Add person. Share the group stays on this row when the host already has a room, as it does now.

The next meeting is the soonest of:

- the upcoming night inside a current study (`groupStudies(...).current[].next`)
- a loose meeting that is not already inside a study (`splitMeetings` on the sessions `groupedSessionIds` skipped)

Use the calendar day and start time already on those rows. Do not invent a second “next” card on Meetings.

Not on Tonight: the month, Completed and Upcoming lists, Past, jump chips, Group sharing, meeting-style filters, Rename, Delete, or Edit details.

## Meetings

1. This study’s month, from `MonthCalendar`, collapsed until opened. Same All, Coming, Done, and Today filters.
2. The day a person taps. See “A day on the calendar” below.
3. Current study blocks (`CurrentStudyList`) and finished studies (`PastStudyList`).
4. Loose meetings that are not in a named study: Today, Upcoming, Past. When every session belongs to a study, this block stays hidden, as it does now.
5. **2 copies** on a night that has two real session rows. The review itself is U4. U1 and U2 only leave room for that label.

Remove the jump chip row in U1. The tabs replace Meet, Sync, People, Prayer, Past, and More.

The separate “Next meeting” card does not render on this tab.

## A day on the calendar

Today, a tap on a day inside a group only prints a label, and that label links back to the same group page. Studies home does the same toward `/space/:id`, without opening the night.

After U2, a day panel has one action:

| What is already stored for that day | Button |
| --- | --- |
| A real session (once, or a completed night, or the living upcoming row whose date is that day) | **Open** |
| A weekday frozen on a repeating plan, and no real session for that date | **Log this night** |
| Nothing | **Plan this day** |

Open calls the existing session view for that day. Plan this day calls `openCreateSession` with that date. Log this night calls the existing past-log path (`openLogPrevious`, or `openAddPastToStudy` when the open current study is the one being logged).

Saved calendar marks (`savedDates`) still draw a dot. If that day already has a real session, the mark is not a second row in the day list. The session is the row. If the mark has a “what we covered” line and the session does not, show that line under the session. The mark stays in storage until the person removes it in U4.

Studies home keeps one calendar for every study. A day with one study opens that study on Meetings with that day already selected. A day with two studies lists both names. Each name opens that study on Meetings with that day selected. Do not add a plan button on the Studies calendar. Planning happens inside the study.

`SaveGroupDates` leaves the open calendar. The day buttons replace that form. Existing saved marks remain visible and removable from the day panel (**Remove mark**). Removing a mark deletes that `savedDates` row only.

## Prayer

The board lives on the Prayer tab. The modal titled “Prayer board” goes away. While you meet, the prayer count, and Gather’s prayer step all select this tab.

Two controls sit above the posts:

1. Study chips, same order and color as Read (`orderedStudies` in `src/lib/study.ts`). One tap opens that study’s Prayer tab. The open study is selected. My study is on the row. The name is always written. Color is not the only label.
2. A session menu:
   - **This session**, the same night Tonight would show.
   - Each completed night in this study, labeled with the weekday, the date, the study name, and the session number when it has one. Example: “Wed, Oct 16 · Exodus · Session 3”.
   - **All open**, every prayer on this group that is not completed.

Choosing a night uses the scope already built for the session sheet (`prayerScope` in `SpaceDetail`). Move that builder to `src/lib/prayerScope.ts` and call it from both places. A past night shows only prayers stored on that session. This session shows last time’s still-open prayers, then new ones for this night. That split stays.

A new prayer saves with the selected session’s id. While **All open** is selected, the form still says which night it will save on (“Saves on Wed, Oct 28”) and uses This session’s id. If this group has no current or upcoming session, the line says “Saves on this group” and the prayer has no session id, which is how a group-level prayer already works.

Switching study or session does not rewrite old prayers and does not mark them completed. Individual and Group stay the second row. The session sheet keeps its own embedded board, scoped to the open session, so a leader who is already inside the night does not have to leave it.

Gather’s prayer step selects Prayer, marks that gather step done, and selects the gather session in the menu once U3 is in.

## Group

One place for the tools that are not the night:

- People row (same component as Tonight), Edit list, and the member editor modal.
- Rename, color, Edit details (name, description, place), Delete.
- Group sharing, collapsed. Same Sync, link, and Online or Offline behavior. A sync error still opens this section.
- More, collapsed. Meeting-style filter and Save a copy stay here. The style filter still filters the Meetings lists. It does not appear on Tonight.

Guest “link with the host’s room key” stays on this tab, including the trouble disclosure. It also stays visible above the tabs when the guest is not linked yet, because that person cannot share until they link. One banner, not a second copy lower on the page.

## Duplicate nights

U4 only. Nothing is merged by itself.

A copy is two session rows in the same group, on the same calendar day, with the same study name (including both names empty). The living repeating row is not a copy of its own future date. A frozen weekday is not a second session. It is hidden from the past list when a real session already exists for that date and study. U4 can offer **Remove weekday mark**, which drops that one date from `heldDates` and leaves the session.

The night shows **2 copies**. The review lists each copy with its date, how many people attended, how many passages, and how many prayers. **Keep** leaves the chosen row. **Remove this copy** uses the existing delete-session action after a confirm. If that copy has prayers, the confirm says how many, and that removing the copy removes those prayers. U4 does not move prayers onto the kept copy.

A saved mark on a day that already has a session offers **Remove mark**. That deletes the `savedDates` row only.

Two studies on the same day are not copies. Both stay.

## How the screen is cut

`SpaceDetail.tsx` stays the owner of session modals, gather, and save handlers. Do not rewrite those handlers. Move the four tab bodies out so the page does not grow by another scroll.

| New file | Holds |
| --- | --- |
| `src/components/group/GroupTabs.tsx` | The tab row. `role="tablist"`. Arrow keys move between tabs. Selected tab uses `aria-selected`. Targets stay at least 44px. |
| `src/components/group/TonightPanel.tsx` | Tonight’s blocks. |
| `src/components/group/MeetingsPanel.tsx` | Calendar, studies, loose meetings. |
| `src/components/group/PrayerPanel.tsx` | Chips, session menu, `PrayerBoard`. |
| `src/components/group/PeopleRow.tsx` | The one people row. |
| `src/lib/prayerScope.ts` | The scope object the board already understands. |
| `src/lib/sessionCopies.ts` | Pure grouping for “2 copies” and hidden weekday marks. |

Tab state:

- Opening a study from Studies with no instruction selects Tonight.
- A calendar day or a prayer chip passes location state: `{ groupTab, day?, sessionId? }`.
- After that state is read, replace the history entry so Back does not reapply it.
- Remember the last tab for this study in `sessionStorage` under `ds-group-tab:<spaceId>` for moves to Read and back. A fresh open from the Studies list still starts on Tonight.

`MonthCalendar` gains an optional day handler. When the handler is set (the group page), the day panel uses the buttons above and does not link to the current page. Studies home does not pass the handler. It links into the study with location state.

## Slices

One slice per chat unless Kenzi names more. Each slice is usable on its own. `npm run typecheck` must pass. Then check the flows in the browser on a group that already has a current study, a loose meeting if one exists, and at least one prayer. Do not deploy.

### U1 — Four tabs

**Deployed 2026-10-24.**

Put Tonight, Meetings, Prayer, and Group on the study page. Move the existing blocks. Do not change how a session is saved. Prayer tab shows the current board for this group, without the new menu yet. Point every prayer button at the tab and remove the prayer modal. Delete the jump chip row.

Done when: opening a study shows Tonight, with one next meeting and Gather, and does not show the month or the past list. Meetings shows the month and the current study. Prayer shows this group’s board. Group shows sharing, still collapsed, and Sync still runs for a room that was already connected. Read, Notes, and the bottom bar are unchanged. A group that already had members, meetings, and prayers still has them.

### U2 — A day does one thing

**Deployed 2026-10-24.**

Day panel actions. Studies home opens Meetings on that day. Hide a frozen weekday when a real session exists for that date and study. Hide a saved mark when a session is already the row for that day. Remove the save-a-date form from the calendar body. **Remove mark** stays on a day that only has a mark, and on a day whose mark was hidden behind a session.

Done when: on Wednesday’s study, tap a future empty day and Plan this day opens the plan form on that date. Tap a completed night and Open shows that session. Tap a day you have not logged and Log this night opens the past-log form. The Studies calendar, with two studies on one day, lists both names and opens the one you tap. No second copy of that night appears as a bare mark.

### U3 — Switch prayers

**Deployed 2026-10-24.**

Study chips and the session menu. Shared `buildPrayerScope`. New posts keep the selected session id. Gather’s prayer step lands on that session.

Done when: file a prayer on Wednesday’s current session, switch to Friday, and Wednesday’s prayer is not on Friday’s board. Switch back to Wednesday, choose the completed night, and see only that night’s prayers. Choose This session and see last time’s open prayers plus anything new. All open lists the open ones and still saves a new prayer on This session. The session sheet still shows the same night’s prayers.

### U4 — Copies

**Deployed 2026-10-24.**

**2 copies**, the review, and confirm-before-remove. Weekday-mark removal. Saved-mark removal when a session exists.

Done when: two session rows on the same study and the same day show as one night with 2 copies. Keep leaves both until Remove this copy is confirmed. A night with one session looks as it did after U2. Cancelling the confirm deletes nothing. Prayers on the removed copy are named in the confirm.

## Check in the browser

Use the local app (`npm run dev`), not a story about it.

- Phone width and a wide phone width. The tab row wraps or scrolls. It does not sit under the bottom bar.
- Tonight, then Meetings, then Prayer, then Group, then back to Tonight. The gather button is still there.
- Open a session, flip Session and Private, close it. The tab you were on is still selected.
- Guest who is not linked still sees the link banner.
- Offline still saves a plan on this phone. Group sharing still explains that.

## Out of these slices

- A fifth bottom tab, or a calendar tab beside Read.
- Accounts, streaks, badges, or notification permission.
- Fixing live sync, two-phone accept, or QR check-in.
- Moving prayers from a removed copy onto the kept copy.
- Auto-deleting sessions, marks, or weekday dates.
- A relay deploy, a schema bump, or a restyle of the Bible plate.
- Rewriting meeting-style names (Custom, Guided, Advanced, Freeform). They stay under Group.

## Accept

Say **U1** to build the tabs. U2 makes the calendar the organizer. U3 is the prayer switch. U4 is the only slice that deletes, and only after a confirm. None of them run unless named.
