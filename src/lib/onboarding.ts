/** First-run onboarding keys and copy. Offline-safe (localStorage only). */

export const ONBOARDING_DONE_KEY = "ds-onboarding-done-v1";
export const QUICKSTART_DISMISS_KEY = "ds-quickstart-dismiss-v1";
export const FIRST_SPACE_TIP_KEY = "ds-first-space-tip-seen-v1";
/** Marked when the user opens Bible from Quick Start (or we treat as visited). */
export const QUICKSTART_BIBLE_KEY = "ds-quickstart-bible-v1";
export const QUICKSTART_HELP_KEY = "ds-quickstart-help-v1";
export const QUICKSTART_INVITE_KEY = "ds-quickstart-invite-v1";

export function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function writeFlag(key: string, value: boolean): void {
  try {
    if (value) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export interface OnboardingSlide {
  id: string;
  title: string;
  body: string;
}

/** Online-first: room key, join-only guests, Account Key + backups. */
export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: "welcome",
    title: "You’re testing with us",
    body: "DiscipleSpaces is an early pilot — not a finished public app. Features may change. Use it for real meetings if you like, and report problems with the icon at the top.",
  },
  {
    id: "meet",
    title: "One room key per group",
    body: "When you create a group, open the room and share the room key. Friends only Join with that key — they never open a second room. Only you (host) edit the title and people list; guests tap Sync to stay current. You can go Offline for a gathering, then Online again to refresh.",
  },
  {
    id: "backup",
    title: "Account Key · back up often",
    body: "Always open https://disciple-spaces.pages.dev. Optional Account Key (Settings): Upload my Spaces on one device, then paste the same key on the other to restore. Group files (DSX1) remain the hard safety net. Private notes stay on-device unless you opt into encrypted backup.",
  },
];

/** Quick start: create/join → meet → invite (no “browse Help” required). */
export const QUICKSTART_ITEMS = [
  {
    id: "space",
    label: "Start or join a group",
    hint: "Create (host) or Join with a room key (guest)",
  },
  {
    id: "session",
    label: "Start today’s meeting",
    hint: "Open your group when you gather",
  },
  {
    id: "invite",
    label: "Share the room key",
    hint: "Host copies the key; guests Join then Sync",
  },
] as const;
