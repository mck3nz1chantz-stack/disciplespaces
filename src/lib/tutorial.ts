/**
 * In-app tutorial content for DiscipleSpaces.
 * Keep copy calm and short — mirrored in TUTORIAL.md for maintainers.
 * Updated: living modes, scroll-locked Session/Private tabs, prayer board,
 * Family, appearance, Quick Start.
 */

export interface TutorialSection {
  id: string;
  title: string;
  summary: string;
  body: string[];
}

export const TUTORIAL_INTRO =
  "DiscipleSpaces is a living home for Group or Family discipleship on this device. One Space holds every study mode, a shared prayer board, and private notes that never leave your phone. This guide works fully offline.";

export const TUTORIAL_SECTIONS: TutorialSection[] = [
  {
    id: "spaces",
    title: "What is a Space?",
    summary: "One container for people, modes, sessions, and prayer.",
    body: [
      "A Space is your group’s or family’s home: name, members, prayer board, private notes, and every session over time.",
      "Create a Space as Group (up to 5 people) or Family (up to 10). Capacity is the only difference — modes and sessions work the same way.",
      "You never need a new Space for each template. Custom, Guided, Advanced, and Freeform all live inside the same Space.",
      "Data stays on this device unless you export a Space Update or send an invite package.",
    ],
  },
  {
    id: "modes",
    title: "Living modes (Custom → Freeform)",
    summary: "Switch modes inside one Space; history stays together.",
    body: [
      "On a Space, use the Mode strip: All · Custom · Guided · Advanced · Freeform.",
      "Each mode filters sessions so you can see what you’ve done in that path — e.g. Freeform one week, Advanced Journey the next.",
      "Start New Session uses the active mode’s default template. You can still choose another session type in the form when the draft allows it.",
      "Tap All to see the full timeline. Past sessions always stay in the Space.",
    ],
  },
  {
    id: "members",
    title: "Members & capacity",
    summary: "Names only — no accounts.",
    body: [
      "Add people by display name under Manage Members. No email or password is required.",
      "Group spaces hold up to 5; Family spaces hold up to 10. Change type later in Edit space (switch to Group only if you have 5 or fewer members).",
      "When someone joins via invite, they add their name on their device so they appear on the list.",
    ],
  },
  {
    id: "sessions",
    title: "Running a session",
    summary: "Start a meeting, fill shared steps, save when you’re ready.",
    body: [
      "Open a Space → pick a Mode → Start New Session. A draft meeting starts right away so you can use both Session and Private while you go.",
      "On the Session tab: date, who attended, shared notes, passages, template steps (e.g. Welcome, Purpose, Pray), and the prayer board.",
      "Shared answers and shared notes can travel with a Space Update export.",
      "Save when you’re done. Empty drafts you abandon (nothing written, no private notes) are cleaned up automatically.",
    ],
  },
  {
    id: "private-notes",
    title: "Private notes (Session ↔ Private tabs)",
    summary: "Scroll-locked personal notes that keep pace with the meeting.",
    body: [
      "Every session modal has two tabs: Session and Private. Flip them anytime without losing your place on the page.",
      "Private is scroll-locked to the section you’re on in Session. Fill Welcome & check-in → switch to Private (shows Welcome) → back to Session (still at Welcome) → move to Purpose → Private now shows Purpose.",
      "Example: Session Recap “I feel distant from God this week”; Private Recap “I relapsed.” Shared stays exportable; private never leaves this device.",
      "You can also tap Private next to a step to jump the lock to that step. Space-level Private notes (on the Space page) are for reminders across meetings, not one session.",
    ],
  },
  {
    id: "prayer-board",
    title: "Prayer board (shared)",
    summary: "Individual and group prayers the Space can carry together.",
    body: [
      "Open Prayer board from the Space page, or use it inside a session.",
      "Tabs: Individual (e.g. “John prayed for Jeff”, “Sam requests prayers for…”) and Group (needs the whole Space holds together).",
      "Post types: Request, I prayed, or Update. Mark Answered when God moves — timestamps help you witness later.",
      "The prayer board is shared and included in Space Updates. Use Private notes for anything that must stay only on your device.",
    ],
  },
  {
    id: "bible",
    title: "Bible reader & logging passages",
    summary: "Offline KJV; attach Scripture to a session.",
    body: [
      "Open Bible from the bottom nav, or Open Bible (KJV) from a Space so logging knows which group.",
      "Browse books and chapters, search, or jump with a reference like John 3:16.",
      "Tap verses to select a range → Log passage → choose Space and session. Passages also appear when you edit a session.",
      "Scripture text is the public domain King James Version (KJV).",
    ],
  },
  {
    id: "quick-start",
    title: "Quick Start checklist",
    summary: "Tap each step to jump into the app.",
    body: [
      "On Home, Quick Start is a short path for new users. Each row is tappable.",
      "Create a Space opens the create form; Start a session opens your Space; Bible and Help open those screens.",
      "Dismiss anytime — this Help guide stays under the header ? icon or Settings.",
    ],
  },
  {
    id: "appearance",
    title: "Light & dark appearance",
    summary: "Easier on the eyes, day or night.",
    body: [
      "Tap the sun / moon / monitor icon in the header to cycle Light → Dark → System.",
      "Or open Settings → Appearance and choose Light, Dark, or System (match your device).",
      "Your choice is saved on this device only and works offline.",
    ],
  },
  {
    id: "invite",
    title: "Inviting others (code + QR)",
    summary: "Link, QR, history, and member counts.",
    body: [
      "On a Space, tap Invite. Prefer Share invite (includes a tappable link) or QR — the short code alone cannot join offline.",
      "Add their name when inviting so your Attendees count updates on your phone. After they join, they can send an “I’m in” confirmation (DSM1.) for the same purpose.",
      "Quick invite (DS1.) is join-only. Turn on Share with history or send a Space Update (DSX1.) so they import past sessions and the prayer board.",
      "Each device keeps its own copy — there is no automatic cloud sync.",
    ],
  },
  {
    id: "export",
    title: "Backup & Space Updates",
    summary: "Your safety net between devices.",
    body: [
      "1. Bookmark https://disciple-spaces.pages.dev — not one-off preview links.",
      "2. Settings → Back up Spaces now → Download each Space’s file (starts with DSX1.).",
      "3. Keep those files in Files, email, or Drive.",
      "4. To restore: Settings → Export / Import → Import → open the file.",
      "Imports add missing sessions and prayer board entries; matching IDs already on the device are skipped. Private notes are never included. Cloudflare hosts the app only — it cannot recover lost Spaces.",
    ],
  },
  {
    id: "privacy",
    title: "Privacy & data notes",
    summary: "Local-first, no cloud accounts.",
    body: [
      "Private notes (session Private tab or Space-level Private notes) stay on this device — never in invites or Space Update exports.",
      "Shared session content and the prayer board leave the device only when you export a Space Update.",
      "There are no server accounts or automatic sync. You control every share.",
      "This is a discipleship tool, not a legally protected confidential space. Share only with people you trust.",
    ],
  },
];
