/**
 * In-app tutorial content for DiscipleSpaces.
 * Keep copy calm and short — mirrored in TUTORIAL.md for maintainers.
 * Updated: host-only roster/title, guest Sync, room keys, Account Key vault.
 */

export interface TutorialSection {
  id: string;
  title: string;
  summary: string;
  body: string[];
}

export const TUTORIAL_INTRO =
  "DiscipleSpaces is a living home for Group or Family discipleship. One Space holds study modes, a shared prayer board, and private notes that stay on your phone. Hosts manage the people list and group title; guests Sync to stay current. This guide works offline.";

export const TUTORIAL_SECTIONS: TutorialSection[] = [
  {
    id: "spaces",
    title: "What is a Space?",
    summary: "One container for people, modes, sessions, and prayer.",
    body: [
      "A Space is your group’s or family’s home: name, people list, prayer board, private notes, and every session over time.",
      "Create a Space as Group (up to 5 people) or Family (up to 10). Capacity is the only difference — modes and sessions work the same way.",
      "You never need a new Space for each template. Custom, Guided, Advanced, and Freeform all live inside the same Space.",
      "Shared data can travel with a room key + Sync, a group file (DSX1.), or your Account Key cloud backup. Private “Just for me” notes stay on this device unless you opt into encrypted personal backup.",
    ],
  },
  {
    id: "host-guest",
    title: "Host vs guest",
    summary: "Who can edit the group — and who Syncs.",
    body: [
      "Host = you created the group on this phone (or restored it as host). Guests Join with the host’s room key.",
      "Only the host can rename the group, change Group/Family type, add or remove people, and Invite. Guests see a read-only people list.",
      "Guests get a clear Sync button at the top of the group (and again near Start meeting) to pull the latest people, meetings, and prayer board from the host’s room.",
      "After the host changes people or meetings, the host should Sync too — then guests Sync so everyone matches.",
    ],
  },
  {
    id: "modes",
    title: "Living modes (Custom → Freeform)",
    summary: "Switch modes inside one Space; history stays together.",
    body: [
      "On a Space, use the Mode strip: All · Custom · Guided · Advanced · Freeform.",
      "Each mode filters sessions so you can see what you’ve done in that path — e.g. Freeform one week, Advanced Journey the next.",
      "Start today’s meeting uses the active mode’s default template. You can still choose another session type in the form when the draft allows it.",
      "Tap All to see the full timeline. Past sessions always stay in the Space.",
    ],
  },
  {
    id: "members",
    title: "People list (host only)",
    summary: "Names only — host adds and removes.",
    body: [
      "The host adds people by display name (Add, Edit list, or when inviting). No email or password is required.",
      "Only the host can add, rename, or remove people. Guests cannot edit the list — they Sync to see host updates.",
      "Group spaces hold up to 5; Family spaces hold up to 10. Hosts change type in Edit space (switch to Group only if you have 5 or fewer people).",
      "When someone Joins with the room key, they pick their name if already on the list, or enter a name the room can add for join. Ongoing roster changes still belong to the host.",
    ],
  },
  {
    id: "room-sync",
    title: "Room key & Sync",
    summary: "Link phones, then pull the latest shared data.",
    body: [
      "Host: turn Online on, open the group, Open group room. You’ll see a room key (like ABCD-EF). Share that key — it is an invite code, not an error.",
      "Guests: Join a group → paste the room key → choose your name → join once. Never open a second room for the same group.",
      "After you’re linked, tap Sync (guests see a big Sync card on the group page). Both host and guests should Sync when Online so meetings and people stay aligned.",
      "Host can use New room key (keep members) or Regenerate Group Key anytime — no member votes. Same people and history stay; share the new key only with people who should remain. Already-linked phones can keep Syncing.",
    ],
  },
  {
    id: "sessions",
    title: "Running a session",
    summary: "Start a meeting, fill shared steps, save when you’re ready.",
    body: [
      "Open a Space → Start today’s meeting. A draft starts right away so you can use both Session and Private while you go.",
      "On the Session tab: date, who attended, shared notes, passages, template steps (e.g. Welcome, Purpose, Pray), and the prayer board.",
      "Shared answers sync through the room when you Sync, or travel in a group file (DSX1.).",
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
      "Example: Session Recap “I feel distant from God this week”; Private Recap “I relapsed.” Shared stays with the group; private never goes to the group room.",
      "You can also tap Private next to a step to jump the lock to that step. Space-level Just for me notes are for reminders across meetings, not one session.",
    ],
  },
  {
    id: "prayer-board",
    title: "Prayer board (shared)",
    summary: "Individual and group prayers the Space can carry together.",
    body: [
      "Open Prayer from the Space page, or use it inside a session.",
      "Tabs: Individual (e.g. “John prayed for Jeff”, “Sam requests prayers for…”) and Group (needs the whole Space holds together).",
      "Post types: Request, I prayed, or Update. Mark Answered when God moves — timestamps help you witness later.",
      "The prayer board is shared — it moves with Sync and group files. Use Just for me for anything that must stay only on your device.",
    ],
  },
  {
    id: "bible",
    title: "Bible reader & logging passages",
    summary: "Offline KJV / WEB; attach Scripture to a session.",
    body: [
      "Open Bible from the bottom nav, or from a Space so logging knows which group.",
      "Browse books and chapters, search, or jump with a reference like John 3:16.",
      "Tap verses to select a range → Log passage → choose Space and session. Passages also appear when you edit a session.",
      "Scripture text is public domain King James Version (KJV) and World English Bible (WEB).",
    ],
  },
  {
    id: "quick-start",
    title: "Quick Start checklist",
    summary: "Tap each step to jump into the app.",
    body: [
      "On Home, Quick Start is a short path for new users. Each row is tappable.",
      "Start or join a group → Start today’s meeting → Share the room key with friends.",
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
    title: "Inviting others (host)",
    summary: "Room key, Invite, QR, and group files.",
    body: [
      "Host: after Open group room, copy the room key and send it. Friends Join a group with that key — easiest path when Online.",
      "On a Space, host can also tap Invite for QR / share message. Add their name when inviting so your people list is ready (host only).",
      "Offline or extra history: send a group file (DSX1.) from Share / Save group file so they import past sessions and the prayer board.",
      "Guests do not Invite or edit the people list. After they join, they tap Sync to stay current.",
    ],
  },
  {
    id: "account-key",
    title: "Account Key (phone + desktop)",
    summary: "Optional key to move your Spaces without email.",
    body: [
      "Settings → Account Key → Create Account Key. Save it somewhere safe — we cannot reset it for you.",
      "On the device that has your Spaces: Upload my Spaces (encrypted cloud backup for that key). File backup (Download personal backup / DSP1.) still works offline.",
      "On the other device: I already have a key → paste the same key → Link & restore Spaces. Or Restore Spaces from cloud anytime while Online.",
      "Account Key is not a group login. Friends still Join with the room key. Linking a key never deletes Spaces already on that phone.",
    ],
  },
  {
    id: "export",
    title: "Backup & group files",
    summary: "Your safety net between devices.",
    body: [
      "1. Bookmark https://disciple-spaces.pages.dev — not one-off preview links.",
      "2. Settings → Your Spaces & data → back up each Space (files start with DSX1.) or use Account Key → Upload my Spaces.",
      "3. Keep group files in Files, email, or Drive.",
      "4. To restore a file: Settings → Export / Import → paste or open the file. Personal multi-space files start with DSP1.",
      "Imports add missing sessions and prayer board entries; matching IDs already on the device are skipped. Private notes are never in DSX1. group files. Cloudflare hosts the app — it cannot recover a wiped phone without your key vault or backup files.",
    ],
  },
  {
    id: "privacy",
    title: "Privacy & data notes",
    summary: "Local-first private notes; shared room is opt-in.",
    body: [
      "Private notes (session Private tab or Just for me) stay on this device — never in the group room or DSX1. exports.",
      "Shared sessions, people list, and prayer board leave the device when you use Sync, Invite/room key, or export a group file.",
      "There are no email/password accounts. Optional Account Key encrypts personal cloud backup; group rooms use a room key the host shares.",
      "This is a discipleship tool, not a legally protected confidential space. Share only with people you trust.",
    ],
  },
];
