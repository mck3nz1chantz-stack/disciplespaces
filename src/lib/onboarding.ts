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

/** P2: three steps only — pilot, meet, backup/same site. */
export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: "welcome",
    title: "You’re testing with us",
    body: "DiscipleSpaces is an early pilot — not a finished public app. Features may change. Use it for real meetings if you like, and report problems with the icon at the top.",
  },
  {
    id: "meet",
    title: "Groups, people, meetings",
    body: "Start a group or join with a code. Add names for headcount. When you gather, tap Start today’s meeting. Bible (KJV or WEB) is free and public domain — open chapters once Online so they save for offline. Prayer and “Just for me” notes are on each group.",
  },
  {
    id: "backup",
    title: "Same site · back up often",
    body: "Always open https://disciple-spaces.pages.dev. After meetings, back up from Settings or the testing guide. Online/Offline and Sync are on each group. Private notes never leave this phone.",
  },
];

/** Quick start: create/join → meet → invite (no “browse Help” required). */
export const QUICKSTART_ITEMS = [
  {
    id: "space",
    label: "Start or join a group",
    hint: "Create one, or join with a code / QR",
  },
  {
    id: "session",
    label: "Start today’s meeting",
    hint: "Open your group when you gather",
  },
  {
    id: "invite",
    label: "Invite someone",
    hint: "Share or show QR so they can join",
  },
] as const;
