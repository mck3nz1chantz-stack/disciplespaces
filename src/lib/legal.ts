/**
 * Privacy & legal copy for DiscipleSpaces.
 * Personal notes never leave the device; shared content is manual export only.
 */

export const APP_NAME = "DiscipleSpaces";

export const LEGAL_DISCLAIMER = `DiscipleSpaces stores your data on this device only. Personal notes never leave your device and are never uploaded or synced to a server. Shared content can be exported manually by you when you choose. Scripture text used in this app is the public domain King James Version (KJV). DiscipleSpaces is a discipleship tool, not a substitute for pastoral care, counseling, or professional advice.`;

export const PRIVACY_SUMMARY =
  "Personal notes stay on this device. Shared content exports only when you trigger them. No accounts. No cloud sync.";

/** Canonical production URL users should bookmark (stable IndexedDB origin). */
export const PRODUCTION_URL = "https://disciple-spaces.pages.dev";

/**
 * In-app data confidence copy. Spaces live only in this browser’s IndexedDB —
 * not on Cloudflare servers. Keep wording short and actionable.
 */
export const BACKUP_HEADLINE =
  "Keep your Spaces safe — data stays on this device";

export const BACKUP_BODY =
  "Nothing is uploaded to the cloud. App updates keep your Spaces when you use the same site address. Clearing browser data, a new phone, or a different preview link can look empty — so back up the files you care about.";

/** Four confidence steps shown in Settings, Help, and home. */
export const BACKUP_STEPS = [
  {
    title: "Bookmark the real site",
    detail: `Always open ${PRODUCTION_URL} (not a one-off preview link).`,
  },
  {
    title: "Back up each Space",
    detail:
      "Settings → Back up Spaces now → Download each Space’s file (starts with DSX1.).",
  },
  {
    title: "Store the files safely",
    detail: "Keep them in Files, email to yourself, iCloud Drive, or AirDrop.",
  },
  {
    title: "Restore anytime",
    detail:
      "Settings → Import previous data (or Home → Import) → paste or open your DSX1. file.",
  },
] as const;

export const RESTORE_NOTE =
  "Import adds missing sessions; sessions already on the device are skipped. Private notes are never included in exports. Cloudflare hosts the app only — it cannot recover lost Spaces for you.";

export const KJV_NOTICE =
  "Bible text: King James Version (public domain).";

/** Shown on invite / join flows — not a legally confidential channel. */
export const INVITE_PRIVACY_NOTE =
  "DiscipleSpaces is a personal small-group study tool on each device. It is not a legally protected confidential space. Share invite packages only with people you trust.";

export const INVITE_HISTORY_NOTE =
  "Quick invite (QR / DS1.) is for joining only — past sessions stay on the host device. Use “Share with history” or a Space Update (DSX1.) so new members import discussions and notes.";

export const INVITE_SYNC_NOTE =
  "DiscipleSpaces is offline-first: each phone keeps its own copy. Adding someone’s name when you invite, or pasting their “I’m in” confirmation, keeps your member count accurate.";

export const FIRST_LAUNCH_ACK_KEY = "ds-legal-ack-v1";
