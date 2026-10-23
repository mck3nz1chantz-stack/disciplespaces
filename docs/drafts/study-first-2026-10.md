# DiscipleSpaces — study first

**Status:** A1 through A5 coded locally 2026-10-22. Not deployed.
**Date:** 2026-10-22
**App:** DiscipleSpaces (`ChantzMediaProjects/DiscipleSpaces`), also called DisciplesApp
**Replaces as the next priority:** two-phone share accept. That check stays open. It is not the work to do next.
**Still locked:** `docs/final/bible-reader-scroll-video-plate.md`. This spec does not restyle the scroll video. It does not add a fifth bottom tab. It does not add accounts, streaks, ads, or a notes server.

## The decision

This phone is a Bible study tool for one person. That person may also lead or attend more than one group. The app keeps those studies apart so Wednesday, Friday, and personal reading do not overwrite each other.

A group in this season is a colored study on this phone: a name, a color, a place in the Bible, chapters you marked as studied, a short list of what to read next, your notes, and an optional meeting on the calendar. There is no cap of three. Ten groups are ten studies. Each one gets its own color from a color wheel. Other people do not have to install the app for a study you keep only for yourself.

Live sharing, prayer boards, and check-in are not the work to build next. They stay in the app and keep working for a group that is already connected. This overhaul does not turn them off and does not delete them.

## One evening, as many studies as you have

Three studies is the example. The app allows as many as you create. A tenth group is a tenth chip, a tenth color, and a tenth place in the Bible. The chip row scrolls sideways. The study you are in stays on screen. The header shows its name and color so you never have to guess which of the ten is open.

You have three studies:

| Study | Color | What it is |
| --- | --- | --- |
| My study | Gold | Your own reading. You jump around. The app remembers the chapter and the next thing you meant to open. |
| Wednesday | Red | Daniel. Meets Wednesdays. |
| Friday | Blue | About to start Exodus. Disciple call. |

**Wednesday.** Open the app. Read is already on Daniel 5. A red line frames the Bible. You read, tap a verse, tap Note. That note belongs to Wednesday. You tap **Mark studied**. In the chapter list, Daniel 5 is red. A line under the chapter says **Next · Daniel 6**. You stop.

**Friday.** Tap the blue **Friday** chip on Read. The frame turns blue. Exodus opens where Friday left off. Wednesday is still on Daniel 5 when you go back. Friday notes are not mixed into Wednesday notes.

**Your own reading.** Tap **My study**. Gold frame. You land on the chapter you left, not on Daniel and not on Exodus. If you had lined up Psalm 23 as next, that line is there. You can open it or ignore it.

**The calendar.** Studies shows the three names. Wednesday’s card says the next Wednesday, the place if you set one, and Daniel 6. The month calendar stays behind the calendar icon. Dots use the study color. Personal reading does not need a meeting to exist.

That is the whole product for this overhaul.

## “Versions” means studies, not a third Bible

“Group 1 notes, group 2 notes” is a separate notebook per study. Each study remembers which public-domain text you last used there: King James or World English Bible. Both stay on the phone. Switching studies can switch the text if that study was using the other one.

Licensed translations (NIV, ESV, NASB, and the rest) stay out. They are not something this app can ship. A later slice can add another public-domain text only if you name it.

## Sync and QR — sideline

Live sync has failed in real use. The file you save and open is the path that works. This overhaul does not try to fix the room, and it does not replace the room with a QR.

**Why a check-in QR is not the next feature.** A printed code can open a page on someone else’s phone. It cannot put their name on your phone unless some shared place receives it. That shared place is the same room that already fails. A QR to join the group is the invite link that already exists. A QR to check in is attendance. Both are group-coordination. You asked to do that after the study tool is good.

**What “in the group” means for now.** You can type a study name yourself and keep it only on this phone. People do not need the app for that. A group that is already sharing stays sharing. Join links keep opening. A new study starts local-only, the same way a new group starts today. This spec does not switch existing rooms off.

**When QR is worth a slice.** After Read, notes, color, and the queue are in daily use, and only if you still want a room:

1. A file of one study’s meetings (no notes), which already exists, handed to someone in person.
2. Then, if a room can be shown to work on two phones, a code on the host’s screen for that night’s check-in. Not a permanent membership card. Not a replacement for notes. Notes stay on each phone.

Do not build either in A1–A5.

## What comes off the daily screens

Move these down. Do not delete the records, the buttons’ behavior, or the relay. A person who already uses a group must still reach every tool they use today. See the compatibility rules below.

| Leave the top of the screen | Where it goes |
| --- | --- |
| Home that leads with New group / Join a group | Read opens first. Studies lists every study. **Join a group** stays on Studies as a second button, and `/join?code=` keeps working. |
| Header Online / Offline as the main control | More, and the same control on the group’s sharing section. The saved Online or Offline choice does not change in the update. |
| Room key, Sync, share-a-live-link, sync errors at the top of the study | Collapsed **Group sharing** on that study. Same buttons. If the room was connected, it stays connected and still syncs in the background. |
| Prayer board as a home card and as a peer of Note while reading | Inside the study, below the meeting. Not removed. |
| Coming / Can’t at the top | Stays on the meeting, where it is now. |
| Create-group template choices on the first screen of New study | New study asks for name, color, and optional meeting day first. The existing templates stay available under a “More options” control so an old group’s template is not stripped. |
| Testing ribbon, if it is still on every screen | Remove from the daily shell in A1 only if that ribbon is not load-bearing. Do not remove it by clearing storage. |
| Log to group and Pray from this verse as equal buttons next to Note | Note is first. **Add to this study** is second. Pray from this verse stays in the verse menu. |

## What stays

- Four tabs. Icons plus words. No fifth tab. The calendar stays behind its icon.
- King James and World English Bible, on the phone, switchable.
- Verse notes: one note per exact reference, pencil on the verse, the words of the verse not copied into the note.
- Read search in the open translation.
- Meetings you already have: day, time, repeat, upcoming, past, log a previous date, this week’s passage, one question, place.
- Month calendar, collapsed, now colored by study.
- Save a copy / Open a copy under More. This is the backup. A personal copy must grow to include study color, marks, queue, and each study’s place in the Bible. A group file stays meetings and prayer, and still has no notes.
- The scroll video behind the chapter. Color is a frame around the reader, not a new plate.
- Private notes never go to a server.
- Plain words. Daily screens do not say relay, snapshot, room key, or file-format names.
- No streaks, percents of the whole Bible, badges, or a notification permission screen.

## The four tabs

Order becomes **Read**, **Studies**, **Notes**, **More**.

**Read** is the home. The app opens here, on the study you last used.

Top of Read, always visible unless focus mode is on:

1. A row of study chips. Icon plus the study name. The active chip is filled with that study’s color. The others are outlined. One tap switches. No confirm. The place you left is saved as you leave.
2. The Bible frame uses that same color (a stroke around the reader, and the same color on the chapter control).
3. Book and chapter, translation (KJV or WEB), search, note. Same jobs as now.
4. One line for position: **Left off · Daniel 5** and **Next · Daniel 6**. Next opens that chapter. If the queue is empty, the line says **Add what’s next** and opens the short list.

Focus mode still hides the extra chrome so the chapter can be read. Leaving focus brings the chips back. The color frame can stay in focus mode so you do not forget which study is open. It must not use `overflow: hidden` on the reader article. The video plate rules stay as written.

**Studies** is the organizer, not the front door.

Each study is one card:

- Color dot and name.
- Where you left off. Tap opens Read there.
- What’s next, if you set one.
- Next meeting, if this study has one. Personal study often has none. That is fine.
- A count of notes in this study. Tap opens Notes filtered to it.

Buttons on this screen: **New study** and **Join a group**. Join is the same join screen as today.

Inside one study, the order is:

1. Name, color, left off, next.
2. **Edit studied** and **Edit what’s next**.
3. Calendar icon, collapsed, this study only.
4. Upcoming and Past, using the meeting screens you already have.
5. **Group sharing**, collapsed if you did not open it. Sync, the live link, the group file, prayer, and who’s coming stay on this page and keep today’s behavior. The line does not say sharing is off. A connected group still syncs.

**Notes** lists titles as it does now. A row of the same color chips filters All, My study, Wednesday, Friday. Each note shows its study name in that color. Tap the reference to open Read in that study, on that verse. A note with no study shows under My study.

**More** keeps appearance, help, Save a copy, Open a copy, and Online / Offline.

With many studies, Notes uses the same sideways chip row as Read, plus **All**. Ten studies means ten filters. The active study’s name is on the chip. Color is never the only label.

## Color

Any number of studies. Each stores a hue on the color wheel, from 0 to 359. Ten groups can be ten different hues. You are not limited to red, blue, and gold.

The control is a hue wheel, not six preset swatches. Saturation and lightness stay fixed by the app so the frame stays readable in light and dark. A free paint box that can pick white or pale yellow would disappear on the page. The wheel is how you pick the color. A **Next free color** control jumps to a hue that sits apart from the ones you already use.

My study starts at gold (hue 42). You can move it. Existing groups, in the order they were created, are spaced evenly around the wheel the first time the update runs. The first is red, the second is blue, and a tenth lands on its own hue. You can change any of them afterward.

If you pick a hue within about 18 degrees of another study, the app says which study it is close to and still saves. The name on the chip is what keeps two close colors from becoming a guess.

The study name is always written next to the swatch. On the frame, the chip, the chapter ring, and the calendar dot, the color is support for the name.

On Read, the frame is a 3px stroke in the active color around the reader card, plus the active chip. It does not recolor the verse text, the video, or the page background.

In the chapter list, a chapter you marked studied gets a ring in the active study’s color. The chapter you are reading is filled more strongly. Unmarked chapters stay plain. Opening a chapter does not mark it. Scroll position does not mark it. Only **Mark studied** does.

The month calendar uses a small dot in the study color. When two studies meet the same day, two dots show.

## Mark studied

Stored per study, per book, per chapter. Daniel 5 marked on Wednesday does not mark Daniel 5 on My study.

Ways to change it:

- On the open chapter: **Mark studied** / **Studied**. One button. Tap again to clear.
- In the chapter list: the ring shows the mark. A control on that list edits marks without pretending that a tap-to-open is also a tap-to-mark. Opening stays a single tap. Marking stays the button, or **Edit studied**.
- **Edit studied** is a simple list by book. Checked chapters are studied. Uncheck to clear. This is how you fix a wrong mark or catch up after paper notes.

A meeting’s “passages we covered” is a separate list. It can offer **Mark these studied** after you log Daniel 1–2 on a past Wednesday. It does not mark them by itself.

Marks live on this phone. They go into Save a copy. They do not go on a shared room.

## What’s next

Each study has a short ordered list you edit: the readings you mean to open after this one. Examples: Daniel 6, Daniel 7, Daniel 8. Or, on My study: Psalm 23, then Genesis 12, so jumping around still has a path back.

- The first item is the **Next** line on Read.
- Opening it does not remove it. You remove it, or you mark that chapter studied and the app asks **Take this off what’s next?**
- Reorder by up and down. No drag library.
- Optional one line on the study: **Aim to be at Daniel 12 by Dec 16.** A date you type. No countdown, no guilt, no streak. Clear it anytime.
- Empty queue is allowed. The app does not invent the next chapter.

The queue is private, same as marks. It is in Save a copy. It is not a shared assignment. If you later want the group to see “this week is Daniel 6,” that remains the meeting’s passage, which already exists.

## Notes

- Saving a note while Wednesday is active files it on Wednesday.
- The same verse can have a different note on Friday. The note key gains the study. Same reference on two studies is two notes. Same reference twice inside one study still edits the one note.
- Notes you already have stay. A note tied to a group stays on that study. A note with no group moves under My study.
- Notes still never ride a group room.

## Calendar

No new tab. Studies home shows every study’s meetings, collapsed, dots in study colors. A study page shows only that study. Personal study can have no meetings.

Planning a meeting stays the forms you have: day, time, repeat, passage, question, log a previous date, Open Read. The heading in Read still says **This meeting** or **Tonight’s study** when you opened Read from a meeting. The color is still that study’s color.

## Existing groups stay

People already have groups on their phones. Christian may still have members, meetings, prayer, notes, and a room on his device. The live site updates on its own when a new version is published. That update must not lock him out and must not throw away group information.

A study is the same group record the app already stores. Do not create a second list and copy people into it. Do not delete the old list.

These slices must not:

- Delete or empty spaces, members, sessions, prayer, notes, invite codes, room ids, short codes, device role, or the group key stored on that phone.
- Call anything that wipes the database, site data, or those keys. Refreshing the app cache so the new screen loads is fine. Clearing his groups is not.
- Change the shared-room allow-list by removing meetings, members, prayer, place, passage, or coming marks. Color, chapter marks, the queue, and each study’s private reading place stay off that allow-list. His phone and yours can still exchange the group facts you already share. Your chapter marks do not overwrite his.
- Remove `/join` or stop a `?code=` link from opening the join screen.
- Pause a connected room, flip his header to Offline, or stop background sync for a room that is already connected.
- Deploy a relay change in A1–A5. The worker stays as it is.
- Rewrite a note’s identity in a way that hides it. A note already filed on his group stays on that group. A note with no group shows under My study. Same verse on two studies can be two notes from A5 on. Old notes are not split, merged, or deleted to get there.
- Shrink member limits. A family group that allows ten people still allows ten. A tenth group is a tenth study, not a reason to drop an older one.
- Replace his meetings with an empty “what’s next” queue. The queue starts empty. Upcoming and Past stay.

The v10 upgrade only adds fields and tables. A group row that has no color yet gets a hue. It does not lose its name, members, or sync block. If a field is missing, the screen treats it the way today’s screen treats an older group.

First launch after this ships, on each phone separately:

- Add **My study** beside his groups. Do not turn an existing group into My study.
- Space existing group hues around the wheel. Leave every other field alone.
- Open Read on the last study used, or on My study if he has never picked one. His groups are on the chip row and on Studies.
- Keep Save a copy / Open a copy able to restore the groups he already had, plus the new color, marks, queue, and places.

Before any of A1–A5 is deployed to `disciple-spaces.pages.dev`, check a copy of an existing database: groups, members, meetings, prayer, and a connected room still present after the upgrade, and join still opens. Do not deploy that check from a story. Christian’s phone is the reason.

## Data

A2 added schema v10 (`chapterMarks` only). A3 added schema v11 (`studyQueue` only). Nested fields on a study do not by themselves need a bump. New tables do. The upgrade function adds. It does not drop a store or delete rows. Aim is a nested field on the study, not its own table. The queue and the aim stay off the room snapshot. A group name stays shared.

On each study (the existing Space row):

- `studyRole`: `personal` or `group`. Missing means `group` for every group that already exists. One personal study is added per phone. It is not a conversion of someone else’s group.
- `colorHue`: a number from 0 to 359. Missing gets an assigned hue on upgrade.
- `readingPlace`: translation, book, chapter. Saved when you leave the study or change chapter. The old single “continue” slot seeds My study once. It is not erased from a group’s meetings.

New tables, empty until you use them:

- Chapter marks: study, book, chapter, when you marked it.
- Queue rows: study, order, book, chapter, optional verse range.

Save a copy includes those. Open a copy restores them and does not wipe notes or groups already on the phone.

Creating a group study asks for name, a hue on the wheel, and optional weekday and time. It can create the repeating meeting from that. Existing templates remain under More options. The stored group is the same shape the app already syncs.

## Slices

One slice per chat unless you name more. Each slice should be usable before the next one starts.

### A1 — Switch studies on Read

**Coded locally 2026-10-22. Not deployed.**

Read opens first. Bottom bar is Read, Studies, Notes, More. My study is added beside existing groups. Chips scroll when there are more than fit. One tap swaps the frame color, the chapter, and the translation that study last used. The hue wheel can set or change a study’s color. Notes saved in that sitting file on the active study. Online / Offline moves off the top bar and keeps the value already saved. Group sharing moves down on the study and still works. Join stays reachable. No group rows are deleted.

Done when: leave Wednesday on Daniel 5, open Friday and move to Exodus 2, come back, and Daniel 5 is there in Wednesday’s color. Close the app and reopen. Same place. A phone that already had groups still has those members, meetings, and its room connection. A tenth study can take a tenth hue.

### A2 — Mark studied

**Coded locally 2026-10-22. Not deployed.**

**Mark studied** on the chapter. Rings in the chapter list for this study only. **Edit studied** can check and uncheck chapters. Switching studies swaps which rings you see. Scroll and merely opening a chapter do not mark it.

Done when: mark Daniel 5 on Wednesday, switch to My study, and Daniel 5 is unmarked there. Switch back. The ring is still there. Unmark from Edit studied.

### A3 — What’s next

**Coded locally 2026-10-22. Not deployed.**

A short list per study. Read shows **Next** and opens it. Opening it does not remove it. My study can hold a mixed list (a Psalm, then a chapter somewhere else). Optional aim-by date, one line, no streak. **Rename** is on the study page and on the Studies list for the host and for My study. A guest still cannot rename. Save a copy of the queue is A5, not this slice.

Done when: set Daniel 6 as next on Wednesday, see it on Read, open Friday, and Friday’s next line is Exodus, not Daniel.

### A4 — Studies screen is quiet

**Coded locally 2026-10-22. Not deployed.**

Cards show color, left off, next, next meeting, note count. The note count opens Notes for that study. New study is name, hue wheel, optional day. Calendar dots use each study’s hue. Share, sync, and prayer sit under **Group sharing** and still run. The Notes chip row, two notes on one verse, and the copy round-trip stay in A5.

Done when: you can see every study’s place without a room key at the top of the card, and opening **Group sharing** still shows Sync for a group that was already connected.

### A5 — Notes follow the study

**Coded locally 2026-10-22. Not deployed.**

Notes chips filter by study. A reference opens Read in that study. The same verses can hold a different note on another study. Save a copy and Open a copy round-trip color, marks, queue, places, and notes. A group file still has no notes, marks, or queue.

Done when: a Wednesday note and a Friday note on the same verse both exist, filters hide the other one, and a saved copy opened on a fresh browser profile brings the studies back.

## Out of this overhaul

- Fixing live sync, two-phone accept, and QR check-in. Join stays as it is. Do not rebuild it in these slices, and do not remove it.
- A new prayer or community design. The prayer board that is already stored stays reachable.
- Accounts, email login, and any server that stores notes.
- A fifth tab, a Bible plate restyle, streaks, push or SMS, ads.
- Another licensed translation.
- Discussion threads.
- Deleting the relay, wiping a phone’s groups, or a cleanup that removes sharing code.

## Accept

Say which slice to build. A1 is the one that makes the rest possible. A2 and A3 are the part that replaces sticky notes. A4 and A5 make the list calm. None of them delete a group that is already on a phone.

The tab words are Read, Studies, Notes, More. Colors come from the hue wheel. Three studies in the story above are an example, not a limit.
