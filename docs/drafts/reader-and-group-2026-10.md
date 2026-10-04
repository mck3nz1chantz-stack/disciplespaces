# Reader and group — what to build next

**Status:** spec for the next chat. Do not start until that chat is told to implement a named slice.
**Date:** 2026-10-04
**Research:** deep-research run, status Partial. Claims below are the ones that survived a source check. Gaps in the research are named at the end.

## What people already do

U.S. adults who have read some of the Bible do not share one method. About a third read a little each day, a third open a passage someone else suggested, and a third look something up when they need it (Lifeway, 2025). Fewer than one in three Protestant churchgoers read every day. About three in five read at least a few times a week (Lifeway, 2026). On Bible Gateway in 2025, the most-read verses sat inside familiar passages, especially Psalms, not only single memory verses.

YouVersion’s 2025 totals are large (57 million plan completions; billions of highlights, notes, and bookmarks). The public report does not say how many of those are written notes. Notes, highlights, friends, and plans past 28 days require a signed-in account. The app can open without one.

Plans with Friends put a group on one plan and one start date. Only the host invites. Each day has a Talk It Over thread. A plan day is at least one Bible reference, plus optional text. It is not a required discussion-question form.

Church group tools (Planning Center, Subsplash, Tithely/Breeze, Realm) schedule a date and time, repeat weekly (and often daily, every two weeks, or monthly), store a place, and let a leader mark who came. Some copy a church-wide event onto group calendars. Those products sit next to a member database. This app does not.

Store-review summaries from 2026 say people are tired of Verse of the Day pushes, streaks, ads, and sync that drops notes. A Scripture App Builder bug in 2025 blocked plan setup when the user said no to notifications.

## What this app already does

- This phone is the copy you can always open. A group shares only after the host opens a room. Private notes never go on the room.
- Bottom bar: Groups, Read, Notes, More. Header: app name and Online / Offline.
- Verse notes: one note per exact reference, pencil on the verse, Notes tab. No account.
- Read search in the open translation. Go to verse.
- Meetings: day, optional time, weekly, Upcoming and Past, soonest meeting on Groups home.
- Session templates, passages logged on a meeting, prayer board, Save a copy / Open a copy.
- Two-phone share accept is still open. Do not call sharing done without that test.

## Gaps that match the research

1. **A little each day is easy to lose.** A saved reading place exists, but the next open is not the obvious front door. People who read a few times a week need “continue here,” not a streak.
2. **A passage someone else suggested is buried.** The host can log passages inside a meeting form. The group screen does not show this week’s passage before the meeting, and a tap does not open Read there.
3. **Talking it over is a long form.** Templates help a prepared leader. A newcomer needs one question on the upcoming meeting, not four steps.
4. **Place and “who’s coming” are missing.** Church tools treat place, time, and attendance as the week’s basics. This app has time and weekly. It has no place, and attendance is inside the meeting editor.
5. **Repeat is weekly only.** Leaders also meet every two weeks or once a month. Still one row. Do not add daily, weekday-only, or a church-wide calendar.
6. **The group screen still leads with share trouble.** A new person should see the next meeting, the place, and the passage before room-key tools.
7. **Do not copy the complaints.** No streaks, no notification wall, no ads, no account to keep a note.

## Slices

Do them in order. One slice per chat unless the operator names more.

### R1 — Continue reading

On Read, if a place is saved, the first screen is that chapter, with one line: “Continue in {book} {chapter}.” A button, **Start at the beginning**, goes to Genesis 1 or the translation’s first chapter. No streak, no percent, no reminder permission.

On Groups home, under the next meeting (or in its place when no meeting is planned), one line: “Continue in {book} {chapter}.” Tap opens Read there.

Done when: close the app in John 3, reopen Read, and John 3 is showing. Groups home shows the same line. No new tab.

Coded 2026-10-04. Read opens the saved chapter with “Continue in {book} {chapter}.” and **Start at the beginning**. Groups home shows that line under the next meeting, or in that spot when none is planned.

### R2 — This week’s passage and one question

On an upcoming meeting, the host can set one passage (book, chapter, optional verse range) and one short question. The group screen shows both on that Upcoming row, in plain language (“John 3:16–18” and the question). Tap the passage to open Read at that place in the current translation.

The passage and question are part of the shared meeting. They go out with the room when the group is linked and the header is Online. They stay in Save a copy / Open a copy. They are not private notes.

A meeting with no passage still opens. Existing meetings do not gain a fake passage.

Done when: the host sets John 3:16–18 and a question, Upcoming shows both, and the passage opens in Read.

Coded 2026-10-04. The meeting form has “This week’s passage” and “One question.” Upcoming shows both. The passage link opens Read. Empty meetings stay empty. Fields are on the shared meeting (room snapshot and Save a copy).

### R3 — Where, and who’s coming

Optional place on the group: one short line (“Room 2”, “Our house”). Show it with the next meeting on the group and on the Groups home card.

On the upcoming meeting, each person listed in the group can be marked **Coming** or **Can’t**. The host edits this list. Names already on the group are the only names. No visitor book, no headcount mode, no email.

Coming / Can’t is shared meeting data. Past meetings keep the marks they had. Changing next week’s list does not rewrite Past.

Done when: the home card shows the place, and marking someone Can’t leaves them Can’t after the meeting moves to Past.

Coded 2026-10-04. Place is one optional line on the group, shown with the next meeting and on the Groups home card. Coming / Can’t is on the upcoming meeting for people already listed. A weekly roll copies those marks onto that past date and leaves them there.

### R4 — Every two weeks, or once a month

Same rule as weekly: one row, next date under Upcoming, passed dates under Past with the time they used. The host picks one: once, every week, every two weeks, or once a month (same day-of-month, or the last day when the month is short).

Do not add daily or Monday–Friday repeats.

Done when: every two weeks from a past Wednesday shows that Wednesday under Past and the Wednesday two weeks out under Upcoming.

Coded 2026-10-04. Repeat is once, every week, every two weeks, or once a month. Still one row. A short month uses the last day, then the next month returns to the original day.

### R5 — Group screen order

First screen of a group, top to bottom:

1. Group name.
2. Next meeting: day and time, place if set, passage and question if set.
3. One share sentence, plus the share action when it is the host’s turn.
4. Upcoming, then Past.
5. Prayer, people, and the rest.

Room key, sync errors, and file tools stay available. They are not the first thing on the page.

Done when: a new group with one planned meeting shows the meeting before the room key.

Coded 2026-10-04. The group screen leads with the name, the next meeting (day, time, place, passage, question), then one share sentence. Upcoming and Past follow. The room key stays further down.

## Out of this pass

- Accounts, email login, or a notes server.
- Push or SMS reminders. A declined notification must never block reading.
- Streaks, badges, verse-of-the-day pushes, ads.
- A church-wide calendar, RSVP links, or a member database.
- Discussion threads and likes.
- A fifth bottom tab.
- Putting private notes on the group room.
- Calling two-phone sync done without a live test.
- Restyling the Bible video plate (`docs/final/bible-reader-scroll-video-plate.md`).

## Research limits

The run was Partial. It did not measure how often readers keep notes outside a Bible app. YouVersion’s highlight/note/bookmark total is not split by type. No source counted how many churches use these calendar features. Complaint themes come from a 2026 review summary, not the raw store reviews. Church Center’s group page was not verified as a weekly hub. Do not treat those excluded claims as requirements.
