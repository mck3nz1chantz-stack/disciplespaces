# DiscipleSpaces — regular-use refinement

**Status:** spec for operator accept. No code until “implement S1” (or a named slice).
**Date:** 2026-10-04
**App:** DiscipleSpaces (`ChantzMediaProjects/DiscipleSpaces`)
**Earlier spec:** `docs/drafts/sync-and-polish-spec.md` (2026-08-27) still holds for relay failure modes. This document adds the personal-study home and the plain-language shell. It does not reopen locked privacy or Bible-plate rules.

## Who it is for

Two equal uses, one app:

1. **You, alone.** Read, mark a passage, write a note. Open the app and see titles. Tap a title to read the note. Close it and the list is quiet again.
2. **A church group or family.** Share meetings and prayer when someone chooses to. A guest joins with one link. People who rarely use phones still find Read, Notes, Groups, and Save a copy.

Private notes stay on this phone. They never ride the group room.

## Sync — keep the model, fix the path

**Do not replace sync with accounts, email login, or a second cloud database.**

Accounts add passwords, “which email,” and a server that holds people’s notes. That fights the privacy rule and is harder for older users. The current shape is the right one:

- This phone is the copy you can always open (Dexie / IndexedDB).
- A group shares only after the host taps to open a room (Worker relay, last-write-wins on meetings and prayer).
- A file you save and later open is the backup when the room fails, the phone is replaced, or there is no internet.

Field bugs (live room empty, SMS invite with no link, ZIP restore dropping meetings) are path and copy problems. The August spec names them F1–F8. This refinement does not invent a new protocol.

What “more reliable” means in the product:

| Promise | How |
|---------|-----|
| You can tell if the group is sharing | One line: Linked, last shared, or Not sharing. A failed share stays on screen until it succeeds or you dismiss it. |
| A text message opens Join | Share `https://disciple-spaces.pages.dev/join?code=ABCD-EF`. The code is filled in. |
| A new person sees the meetings already on the room | Decision A from the August spec: the room snapshot is the shared history. The host must have shared after those meetings. |
| Offline does not pretend to share | Header Online is the only switch. Sync stays quiet until Online, and the button says why. |
| The file still works | Export and import stay. Labels below. |

Accept gate stays a two-phone test on the live site: host shares a meeting, guest sees it without a ZIP.

## Save a copy / open a copy

Keep export and import. Move the words people see:

| Today (jargon) | On screen |
|----------------|-----------|
| DSP1 / personal backup / ZIP | **Save a copy** |
| Restore / import | **Open a copy** |
| Room key | **Group link** (the short code is inside the link) |
| Offline DS1 package | **Join with no internet** (second choice, not the main button) |

Rules that stay:

- A personal copy includes private notes.
- A group room never includes private notes.
- Opening a copy of a group you already have updates shared meetings and prayer, and leaves notes already on this phone.
- A ZIP with more than one group restores each group (August S4). The result says how many groups and meetings came back.

These actions live under **More**, in a section named **Your copy**, not only inside a group’s sharing tools.

## Home for reading and notes

Today a private note is tied to a group and opened from a modal or a meeting drawer. That is the wrong front door for daily study.

**Notes** becomes its own tab.

- List is titles only. A title is the first line you type, or “Note” plus the date if you leave it blank.
- Tap the row (or the chevron) to open the full note. Tap again to close. One note open at a time.
- New note is one button at the top: large, labeled **New note**, with a pencil icon.
- A note tied to a verse shows the reference as its title (John 3:16, or John 3:16–18). Tap the title to open Read at that verse. The words you wrote open and close under it.
- A note with no verse uses the first line you type, or “Note” plus the date.
- Edit and delete sit inside the open note, not as a row of icons on every closed title.
- A note can sit with no group. Existing notes that belong to a group still show that group’s name in small type.
- Search is a single field: “Find a note.” It matches title, reference, and body. It appears after the list has more than a handful of notes, so an empty start stays empty.

Personal reading does not require creating a group.

## Notes on a verse

Same idea as the YouVersion Bible app: the note belongs to the verse, and you can see that from the chapter and from the note list.

While reading, tap a verse to select it. Tap a second verse to select the range between them. A short bar appears under the selection with two actions:

- **Note** — write or edit the note for this exact reference.
- **Log to group** — the existing group action. It stays secondary to Note when you are reading alone.

Save stores the reference on the note: translation (KJV or WEB), book, chapter, start verse, end verse. The words of the verse are not copied into the note. The reader already has them.

In the chapter, a verse that has a note shows a small pencil on the verse number. Tap the pencil to open that note. Tap the verse text to select, as today. One note per exact reference (same translation, book, chapter, and verse range). Saving again edits that note. A different range is a different note.

The note is on this phone only. It does not go to the group room. **Save a copy** includes it. **Open a copy** brings it back. Opening Read from the note uses the translation stored on the note.

The Bible page does not become the note library. The Notes tab lists verse notes and free notes together, newest first. A filter chip **On a verse** shows only the verse notes when you want that.

Highlights, public comments, and sharing a note to a group are out of this pass.

## Find a verse by words

Search stays inside Read. It uses only the translation already selected (KJV or WEB). Switching translation searches that text, not the other one.

The box accepts a phrase or a reference. **John 3:16** still jumps straight to that verse. A phrase such as **principalities of the air** searches the Bible.

Small words are ignored: of, the, and, in, and the same list already in `src/lib/bible.ts`. The meaningful words here are **principalities** and **air**.

A verse is shown when:

- the full phrase is in that verse, or
- every meaningful word is in that verse, or
- at least one meaningful word is in that verse and the verse is still a strong match.

Order is fixed: exact phrase first, then verses with all the meaningful words, then verses with some of them. The King James text does not contain the exact line “principalities of the air.” Ephesians 2:2 has “prince of the power of the air.” Ephesians 6:12 has “principalities.” Both may appear. The label on the row says **Phrase**, **All words**, or **Some words** so the match is obvious. No score numbers.

**Whole Bible** is the default for a search. **This book** remains the second choice.

Results are a quiet list, not a wall of verse text:

- Each row is the reference only (Ephesians 2:2), plus the match label.
- Tap the row to expand that one verse. The matching words are marked. One row open at a time.
- **Go to verse** closes search and opens that chapter in Read, with the verse selected. The reader scrolls to it.
- **Log to group** stays on the expanded row, after Go to verse.

Show up to 50 verses, and say so when more exist (“Showing 50”). Fewer than two letters does not search. An empty result says nothing matched in this translation and suggests checking the other translation.

This uses the search already in `searchVerses`. It does not add a second engine, an online search, or a concordance of Greek and Hebrew.

## Shell people can find

Bottom bar, four items, icon plus word. Minimum tap size 44px. Words win over icon-only.

| Tab | Icon | Opens |
|-----|------|--------|
| Read | open book | Bible (plate stays as locked in `docs/final/bible-reader-scroll-video-plate.md`) |
| Notes | pencil on a page | Collapsible note list |
| Groups | two people | Group list, then a group |
| More | three lines or a gear | Save a copy, Open a copy, theme, install, help |

Header keeps **Online / Offline** and the app name. Help, feedback, and theme move to More so the top bar is not five controls.

Group screen, in order:

1. Group name and the next meeting.
2. One sentence of share status, plus **Share now** when it is the host’s turn.
3. Meetings.
4. Prayer.
5. **Share the group** (link) only after the room is open. File tools point at More → Your copy.

Empty Groups: two buttons, **New group** and **Join a group**. No checklist above the list once a group exists. The checklist can live collapsed under More → Help.

Join is one page: your name, the code (often already filled), **Join**. No second modal on top of that page.

Language rules: short sentences, no “relay,” “snapshot,” “LWW,” or “DSP1” in the interface. Error text says what to do next (“Ask the host for a new group link”).

## Slices

| Slice | Ship | Done when |
|-------|------|-----------|
| **S1 Notes** | Notes tab with collapsible titles, a free note with no group, and a note saved on a verse from Read (pencil on that verse, one note per reference) | Shipped 2026-10-04 |
| **S1b Verse search** | Read search: reference jump, keyword list for the open translation, tap to expand one verse, **Go to verse** | Shipped 2026-10-04 |
| **S2 Find it** | Four-tab bar with icons and words; More holds theme, help, install; group page order above | Shipped 2026-10-04 |
| **S3 Share** | August S1+S2: visible failures, `/join?code=`, room history, Offline explains itself | Coded 2026-10-04. Two-phone accept on the live site is still open. |
| **S4 Your copy** | Save a copy / Open a copy labels; multi-group ZIP; same-group update keeps local notes | Coded 2026-10-04. Save a copy writes every group and notes into one file. Open a copy restores each group and says the counts. |

S1, S1b, and S2 are shipped. S3 is still required before calling group sharing fixed. S4 can follow, because export format already exists. The Save a copy and Open a copy labels are on More; multi-group file behavior stays S4.

## Out of this pass

- User accounts or a notes server.
- Restyling the Bible video plate.
- Putting private notes on the group relay.
- A fifth hub or a new app.
- Paywall or a second Bible translation set.
