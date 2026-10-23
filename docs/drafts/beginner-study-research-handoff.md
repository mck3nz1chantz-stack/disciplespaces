# Handoff — DiscipleSpaces beginner study research

Copy everything below the line into a new chat. That chat researches and writes a spec. It does not implement.

---

You are continuing **DiscipleSpaces** (operator may say DisciplesApp). Same product. Kenzi Chantz (ChantzMedia) is the operator.

**Code:** `/Users/kenzi/ChantzMedia/ChantzMediaProjects/DiscipleSpaces`
**Do not use** `~/Desktop/ChantzMediaProjects/DiscipleSpaces`.
**Launcher:** read-only unless Kenzi gives permission. No app code under the launcher.
**Live site:** https://disciple-spaces.pages.dev (do not deploy).
**Relay:** https://disciple-spaces-relay.mck3nz1-chantz.workers.dev (do not redeploy).
**Dev:** from the code path, `npm run dev`. Vite is often http://127.0.0.1:5173/. Typecheck with `./node_modules/.bin/tsc -p tsconfig.app.json --noEmit` from that folder.
**IndexedDB:** Dexie database `discipleSpaces`, schema v11. Do not wipe it. Do not call `indexedDB.deleteDatabase`.

Read first: `HANDOFF_STATE.json`, `HANDOFF_PROMPT.md`, `docs/drafts/study-first-2026-10.md`, and this file.

## This chat’s job

Research, then spec. Do not write app code. Do not deploy. Do not push. Do not resume two-phone share.

1. Run **/deep-research** with the query in the Research section below before drafting features.
2. Write the findings as a short cited note in `docs/drafts/`. Separate what published mentors and study guides actually say from what is only a guess.
3. Then draft a spec, `docs/drafts/beginner-study-2026-10.md`, in plain language, with small slices Kenzi can name one at a time. Do not code a slice until he names it in a later chat.
4. Where the research cannot answer a question only Kenzi’s own mentors can answer, list that question for him. Do not invent their opinions.

## What Kenzi wants looked at

He wants the app to help a beginner learn without a pile of sticky notes. He asked, as open questions, not as approved features:

- Scripture references a beginner can trust (what John 3:16 means, and how to get there).
- A way to tie one verse to another verse.
- A way to see saved verses inside one study, and a total across every study on the phone.

The research decides whether those belong, how small they should be, and what else mentors say keeps study coherent. Do not treat this list as the spec.

## Already on the phone (do not rebuild)

Study-first A1–A5 are coded locally on 2026-10-22. They are not deployed and not pushed.

- A study is the existing group row, plus My study (`study-personal`). Any number of studies. Each has a hue, a reading place, chapter marks, a what’s-next queue, and an optional aim. Missing `studyRole` means group.
- Tabs are only **Read**, **Studies**, **Notes**, **More**. Read opens first. No fifth tab.
- One tap switches study, color, chapter, and the translation that study last used (KJV or WEB only).
- **Mark studied** is manual. Opening or scrolling a chapter does not mark it. Marks are per study.
- **What’s next** is a private ordered list. Opening Next does not remove it. Empty queue does not invent the next chapter.
- Verse notes: the scripture key is `version|bookId|chapter|start|end`. The study is `spaceId`. The same verse on two studies is two notes. Notes chips filter All, My study, and each group. A reference opens Read in that study. A note with no study shows under My study.
- **Save a copy** / **Open a copy** round-trip groups, meetings, notes, color, place, aim, marks, and queue. A group file and the room do not include notes, marks, queue, color, or place.
- Meetings already have a day, an optional time, weekly / biweekly / monthly, Upcoming, and Past. A week can have one passage and one question. The month calendar stays collapsed behind an icon. Dots use the study hue.
- Join stays: `https://disciple-spaces.pages.dev/join?code=ABCD-EF`.

## Locked

- Do not delete or disconnect groups already on a phone. Christian may still have group data.
- Private notes never go on the room or a notes server. No accounts. No email login.
- KJV and WEB only. No licensed translation.
- No streaks, percents of the Bible, badges, or a notification-permission screen.
- No fifth tab. No Bible plate restyle. The video plate stays as written in `docs/final/bible-reader-scroll-video-plate.md`. Do not put `overflow: hidden` on the reader article when the video plate is on.
- Plain words in the interface. Do not say relay, snapshot, LWW, or DSP1.
- Schema adds only. Do not drop a store. Nested fields do not by themselves bump the schema. A new table does, and the new version must repeat every previous store.
- Two-phone live sync is not accepted and is not this chat’s work.

## Research

Run `/deep-research` with this query:

What do disciple-makers, Bible study leaders, and beginner Bible-study guides say a learner needs in order to stay oriented and organized, without a complicated system? Cover four questions. (1) How should a beginner meet a scripture reference such as John 3:16, including what the reference means and how they return to it later? (2) Do mentors want the learner to tie one verse to another verse themselves, or do they want an automatic cross-reference list, and what goes wrong with each? (3) How should a learner review verses they saved, both inside one group study and across all of their studies, without streaks, scores, or guilt? (4) Which paper habits (one notebook per group, sticky notes, a verse list, a weekly passage) are the ones mentors are trying to keep, and which app behaviors make that more chaotic? Use published guides, church training, and study-method writing. Mark claims the sources do not support. End with questions only a local mentor can answer.

Write the cited report under `docs/drafts/`. Then write the spec from what the sources support, plus Kenzi’s three questions where the sources agree they are worth a small slice.

## Spec shape, after the research

Plain language. One slice per later chat. Each slice must say what it will not build.

Hypotheses the research may keep, shrink, or drop:

- Saved verses might be the verse notes the phone already has, shown as a list per study and as one total. A second collection is justified only if notes cannot do that job.
- Tying a verse to a verse might be one reference the learner adds on a note, opened in that same study. An automatic cross-reference library is a different and larger decision.
- A beginner reference might be: type John 3:16, land on that verse, and see the reference on the note. It is not a commentary.

Out until Kenzi names them: accounts, streaks, licensed Bibles, notes on a server, a fifth tab, two-phone sync, and a new prayer design.

## Done when this chat ends

Kenzi has a cited research note and a spec with named slices. No app code was changed. No deploy. He can say which slice to build in the following chat.
