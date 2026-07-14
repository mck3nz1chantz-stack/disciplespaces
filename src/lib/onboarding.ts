/** First-run onboarding keys and copy. Offline-safe (localStorage only). */

export const ONBOARDING_DONE_KEY = "ds-onboarding-done-v1";
export const QUICKSTART_DISMISS_KEY = "ds-quickstart-dismiss-v1";
export const FIRST_SPACE_TIP_KEY = "ds-first-space-tip-seen-v1";
/** Marked when the user opens Bible from Quick Start (or we treat as visited). */
export const QUICKSTART_BIBLE_KEY = "ds-quickstart-bible-v1";
export const QUICKSTART_HELP_KEY = "ds-quickstart-help-v1";

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

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: "welcome",
    title: "Welcome to DiscipleSpaces",
    body: "A calm, private place for small-group discipleship. Your notes stay on this device — no accounts, no cloud sync.",
  },
  {
    id: "spaces",
    title: "Spaces & members",
    body: "A Space is a Group (up to 5) or Family (up to 10). Add members by name, then meet over time in one shared container.",
  },
  {
    id: "sessions",
    title: "Sessions & Bible",
    body: "One Space holds every mode — Custom, Guided, Advanced, Freeform. Switch modes anytime; sessions all live together. Open the offline KJV reader and log passages as you meet.",
  },
  {
    id: "share",
    title: "Invite & share carefully",
    body: "Invite with Share (tappable link) or QR — not the short code alone. Add their name so your count updates. Use “Share with history” or a Space Update for past sessions. Share only with people you trust.",
  },
  {
    id: "backup",
    title: "Keep your data safe",
    body: "Spaces stay on this device only. Bookmark https://disciple-spaces.pages.dev, then Settings → Back up Spaces now → download each Space’s file. Store the files somewhere safe. To restore: Settings → Import → open the file.",
  },
];

export const QUICKSTART_ITEMS = [
  {
    id: "space",
    label: "Create or join a Space",
    hint: "Tap to create your group or family home",
  },
  {
    id: "session",
    label: "Start a guided session",
    hint: "Tap to open your Space and log a meeting",
  },
  {
    id: "bible",
    label: "Open the Bible reader",
    hint: "Tap to open KJV and log a passage",
  },
  {
    id: "help",
    label: "Browse Help anytime",
    hint: "Tap for the full offline walkthrough",
  },
] as const;
