# DiscipleSpaces — beginner study

**Status:** Spec only. Do not code a slice until Kenzi names it in a later chat.
**Date:** 2026-10-22
**Research:** `docs/drafts/beginner-study-research-2026-10.md`. That note is partial. This spec uses what those re-opened pages support, plus the three questions Kenzi already asked where the pages agree a small slice is worth it.
**Already on the phone:** Study-first A1–A5, coded locally 2026-10-22, not deployed. This spec does not rebuild them.

## What stays true

A study is the group row that is already there, plus My study. Read, Studies, Notes, and More stay the only tabs. Read opens first. King James and World English Bible only. Private notes stay on the phone. Save a copy and Open a copy stay the backup. A group file and the room still do not carry notes, marks, the queue, color, or place. No streaks, percents of the Bible, badges, or a screen that asks for notification permission. No fifth tab. The Bible plate stays as written in `docs/final/bible-reader-scroll-video-plate.md`.

The guides add three limits this spec keeps:

- A reference is how you get there and how you come back. It is a book, a chapter, and a verse. It is not a commentary on the verse.
- Another verse is opened in its own chapter, after the first passage has been read. A ready-made library of links is something mentors use. It is a larger decision than these slices.
- A saved verse is a reference you can open again, with the paragraph around it. A count is a count. It is not a score.

## What Kenzi asked, after the research

| Question | What the pages support | Slice |
| --- | --- | --- |
| A reference a beginner can trust, such as John 3:16 | Say what the reference is, open that place, come back by the same reference | B1 |
| Tie one verse to another | One reference the learner adds, opened in that same study. An automatic list is a later decision | B3 |
| Saved verses inside one study, and a total across studies | Use the verse notes the phone already has. All is the total. Each study chip is that study. No second collection | B2 |

One notebook per group is already how this phone works. The guides do not discuss it. This spec does not merge studies and does not add another notebook.

Sticky notes are not in the guides. Mark studied and What’s next already cover the job Kenzi named. This spec does not rebuild them.

The weekly passage, the one question, and the meeting day are already on the study. Bible Study Fellowship’s “one passage for the week” is that habit. This spec does not rebuild the meeting.

## Slices

One slice per later chat. Each one is usable on its own.

### B1 — Say what the reference means

**Coded locally. Not deployed.**

Typing a reference already opens that chapter. This slice adds the sentence that tells a beginner what they typed, and it selects a simple span when they type one.

When a reference lands:

- `John 3:16` shows **John, chapter 3, verse 16.** Verse 16 is selected. The rest of the chapter stays on the page.
- `John 3` shows **John, chapter 3.**
- `John 3:16-18`, `John 3:16–18`, and `John 3:16 to 18` show **John, chapter 3, verses 16 through 18.** Those verses are selected. The chapter stays open around them.

The same sentence shows under that note’s title, so coming back still says what the reference means. The title stays `John 3:16` or `John 3:16–18`, as it does now.

Book names stay the names the app already accepts, including the short forms it already matches. A reference it cannot read keeps today’s result. It does not grow a lecture.

**Done when:** type John 3:16 and land on that verse with the plain sentence. Type John 3:16 to 18 and see verses 16 through 18 selected, with the chapter still around them. Open the note later and the same sentence is there. No paragraph explains what the verse teaches.

**Leaves out:** a commentary, Greek or Hebrew, a comma list (`16, 18`), a semicolon, “ff,” a letter on part of a verse, a chapter span such as John 3–4, a new table of contents, a song of the books, a warning about 1 John, a beginner mode, and a race to find the verse.

### B2 — Saved verses are the notes you already have

**Coded locally. Not deployed.**

A second list is not justified. A verse note is the saved verse. Notes already filters All, My study, and each group. All is the total. A study chip is that study.

Two gaps:

- Saving a verse today requires words in the box. A saved verse can be the reference alone. **Save this verse** files it on the active study even when the box is empty. Words the person writes stay the note. Saving again does not erase those words.
- Notes does not say how many of the rows are references. Above the list, one line names the filter and the count of verse notes in it: **8 saved verses** on All, or **3 saved verses** on Wednesday. Free notes with no reference stay in the list and are not part of that count. The Studies card keeps its note count. That count and this one are allowed to differ.

Tap the reference and Read opens in that study, on that chapter, with the verse selected. The paragraph around it stays. Opening it does not mark the chapter studied and does not remove What’s next.

The number is a count of references on this phone. It never becomes a percent, a streak, a “due” date, or a comparison with last week.

**Done when:** save John 3:16 on Wednesday with an empty box, see it under Wednesday and in All, see the two counts, switch to Friday and not see it there, then tap it and land in Wednesday on John 3 with verse 16 selected.

**Leaves out:** a new store, memory cards, a review schedule, a partner check-in, old-before-new sorting, copying the verse text into the note, streaks, scores, badges, and a fifth tab.

### B3 — Another verse, typed on the note

**Coded locally. Not deployed.**

On a verse note, one optional line: **Another verse.** The person types one reference the app can read. It is stored on that note. It uses the same translation as the note.

The line shows the reference they typed. Tap opens that chapter in the same study and selects the verse. It does not switch study, write a mark, or take anything off What’s next. The words on the screen are that they added it. It is not presented as a margin printed in the Bible.

One link. Typing a new one replaces it. Clear removes it. A link to the same verse is refused. The other verse does not gain a link back.

The link is part of the note, so it stays on the phone. Save a copy includes it. Open a copy still leaves a note that is already on the phone as it is. A group file and the room do not include it.

**Done when:** on a Wednesday note for John 3:16, add John 1:1, leave and come back, and the link is still there. Tap it and Wednesday opens John 1 with verse 1 selected. Friday’s note on John 3:16 has no such link. Clear removes it.

**Leaves out:** a cross-reference library, the Treasury of Scripture Knowledge, Blue Letter Bible, a web lookup, more than one link, a reverse link, an explanation of how the two verses relate, and any wording that calls the link Scripture’s own margin.

B3 does not require B1. If B1 is already in, the plain sentence can sit under the linked reference too. If B1 is not in, the typed reference is enough.

## Data

B1 adds no stored field.

B2 adds no store. An empty verse note is a change in the save rule. The scripture key stays `version|bookId|chapter|start|end`. The study stays `spaceId`. The same verse on two studies stays two notes. A free note with no verse still needs words.

B3 adds one optional field on the note, the other verse, in the same shape as the note’s own verse. A nested field does not by itself bump the database version. A new table would. Do not add a table for this. Do not drop a store.

## Out until Kenzi names them

Accounts, email login, streaks, licensed Bibles, notes on a server, a fifth tab, two-phone sync, a new prayer design, an automatic cross-reference library, commentary, a manuscript printer, word-marking on the text, a memory schedule, and a partner-review mode.

An automatic list is not rejected by the guides. Precept, the National Bible Bee, and the essay on proof-texting tell people to use margins and apps, then to test the link in context. Shipping that list is a different slice, with a named public source and a person who checks the fit. It is not B1, B2, or B3.

## Questions the guides leave to Kenzi

1. Should a typed “John” ever mention 1 John, 2 John, and 3 John, or is the Gospel always right?
2. Is an empty **Save this verse** the saved verse he wants, or must a saved verse always have a sentence?
3. If a later chat adds a ready-made cross-reference list, which public list, and who decides a suggested verse still fits?
4. Do his mentors want a review rhythm at all? These slices only make the list easy to open. They do not schedule it.

## Accept

Say B1, B2, or B3. B1 is the sentence on the reference. B2 is the list and the count, using notes that already exist. B3 is one hand-typed link on a note. None of them deploys the site or touches the relay.
