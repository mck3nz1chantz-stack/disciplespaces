/**
 * Privacy & legal copy for DiscipleSpaces.
 * Private notes never leave the device.
 * Shared Space data stays local by default; optional light relay is opt-in per Space.
 */

export const APP_NAME = "DiscipleSpaces";

/** Shown everywhere — product is not a finished public launch. */
export const TESTING_PHASE_BADGE = "Testing";

export const TESTING_PHASE_HEADLINE =
  "Early testing — not a finished product";

export const TESTING_PHASE_SHORT =
  "DiscipleSpaces is in active testing. Features may change. Please back up your groups often and tell us if something confuses you.";

export const TESTING_PHASE_BODY =
  "You are helping try a new small-group worship tool still in development. It is not a polished public app yet. Things may break, look rough, or change between updates. Use it for real meetings if you want — but treat backups as required, not optional.";

/** Practical steps for friends/family joining the pilot. */
export const TESTING_GUIDE_STEPS = [
  {
    title: "Use one website only",
    detail:
      "Always open https://disciple-spaces.pages.dev (or the link your host sent). A different link can look empty — your groups live in this browser, on that address.",
  },
  {
    title: "Back up often",
    detail:
      "After meetings: Settings → Your Spaces & data → Back up, or on a group open More → save a group file. Store the file in Files, email, or Drive. Private notes are never in backups.",
  },
  {
    title: "Online / Offline toggle",
    detail:
      "Header or on each group: Online = may refresh connected groups when you have network. Offline = stay on this phone only (good during a meeting if you don’t want sync).",
  },
  {
    title: "Sync (connected groups)",
    detail:
      "If the host used Connect for easy invite: tap Sync now on the group when Online. You’ll see “Group updated” when it works. Private notes never sync.",
  },
  {
    title: "Invite simply",
    detail:
      "Host: Invite → their name → Share or show QR. Connected groups can use a short code. Guest: Join a group → code or scan. Headcount updates when you add their name.",
  },
  {
    title: "Report problems from the app",
    detail:
      "Tap the report icon (speech bubble) in the top bar, or Settings / the testing guide → Report a problem. That sends a short note plus optional device info to the builders — never your private notes. Clearing browser data or switching phones can still wipe local groups unless you restored a backup.",
  },
] as const;

/** Product mission — free forever; donations only much later if ever. */
export const APP_MISSION = `DiscipleSpaces is free to use. It will never be a paid app or subscription product. We only use free, public-domain Scripture (no translations that require registration, licenses, or fees). If we ever accept donations long after a real public launch, they would support local church or ministry needs — not unlock features.`;

export const LEGAL_DISCLAIMER = `TESTING / DEVELOPMENT: DiscipleSpaces is an early pilot, not a finished public product. Features may change or break. ${APP_MISSION} DiscipleSpaces keeps your data on this device by default. Personal (private) notes never leave your device and are never uploaded or synced. Shared Space content (sessions, members, prayer board) can be exported by you as a file, or optionally connected to a light Space room so the group can join with a short code — only after you choose Connect. Scripture is limited to public-domain text (King James Version and World English Bible). DiscipleSpaces is a discipleship tool, not a substitute for pastoral care, counseling, or professional advice. Back up often — the builders cannot recover a wiped phone for you.`;

export const PRIVACY_SUMMARY =
  "Testing phase. Free forever · public-domain Bible only. Private notes stay on this device. Back up often.";

/** Canonical production URL users should bookmark (stable IndexedDB origin). */
export const PRODUCTION_URL = "https://disciple-spaces.pages.dev";

/**
 * In-app data confidence copy.
 * Preview / pages.dev is fine until full product domain deployment.
 */
export const DATA_CONFIDENCE_HEADLINE = "Your data, with confidence";

export const DATA_CONFIDENCE_BODY =
  "Spaces live on this phone first. App updates keep them when you use the same site address. Clearing browser data, a new phone, or a different preview link can look empty — so back up the Spaces you care about. Private notes are never in backups or cloud join.";

/** @deprecated use DATA_CONFIDENCE_HEADLINE */
export const BACKUP_HEADLINE = DATA_CONFIDENCE_HEADLINE;
/** @deprecated use DATA_CONFIDENCE_BODY */
export const BACKUP_BODY = DATA_CONFIDENCE_BODY;

export const PRIVATE_NOTES_PILL =
  "Private notes: this device only · never synced";

export const RELAY_COMING_NOTE =
  "Preview builds stay fully on-device until the Space room service is attached. Back up and offline invites (QR / package) work today. When easy join is live on this site, Connect will light up here — your existing Spaces stay put.";

export const RELAY_CONNECT_CONSENT = `Connect “{name}” for easy invite?

Shared sessions, members, and prayer board can sync when online.
Private notes never leave this device.
You can Unlink anytime — data stays on this phone.

Continue?`;

/** Confidence steps (Advanced section + Help). */
export const DATA_CONFIDENCE_STEPS = [
  {
    title: "Bookmark the real site",
    detail: `Always open ${PRODUCTION_URL} (or your church’s product domain when live). Preview links are separate storage.`,
  },
  {
    title: "Back up each Space",
    detail:
      "Your Spaces & data → Back up → download the file (shared data only; starts with DSX1.).",
  },
  {
    title: "Store the files safely",
    detail: "Keep them in Files, email to yourself, iCloud Drive, or AirDrop.",
  },
  {
    title: "Restore anytime",
    detail:
      "Restore / Import → open your DSX1. file. Private notes are never in that file.",
  },
  {
    title: "Optional: Connect for easy invite",
    detail:
      "When enabled on this build, Connect uploads shared Space data only so friends join with a short code. Unlink anytime.",
  },
] as const;

/** @deprecated use DATA_CONFIDENCE_STEPS */
export const BACKUP_STEPS = DATA_CONFIDENCE_STEPS;

export const RESTORE_NOTE =
  "Import adds missing sessions; sessions already on the device are skipped. Private notes are never included in exports or Space rooms. Cloudflare hosts the app shell — it cannot recover a wiped phone unless you Connect a Space or keep your own backup files.";

export const KJV_NOTICE =
  "Bible text: King James Version (public domain).";

export const WEB_NOTICE =
  "Bible text: World English Bible (WEB, public domain). Modern English · free · no registration.";

export const BIBLE_EDITIONS_NOTICE =
  "Scripture editions in this app: public-domain KJV and WEB only. No paid or registration-required translations.";

/** How offline Scripture works for testers. */
export const BIBLE_OFFLINE_TIP =
  "Bible books save on this phone after you open them while Online. Open the chapters you need once with network; they stay available offline. Switch KJV/WEB in the Bible tab — each edition caches separately.";

/** Shown on invite / join flows — not a legally confidential channel. */
export const INVITE_PRIVACY_NOTE =
  "DiscipleSpaces is a personal small-group study tool on each device. It is not a legally protected confidential space. Share invites only with people you trust.";

export const INVITE_HISTORY_NOTE =
  "A simple invite gets them into the group. Past shared meetings come with Connect + Sync, or when you send a group file (under Other ways).";

export const INVITE_SYNC_NOTE =
  "Add their name so your headcount is right. Share so they open the same group on their phone. Notes marked “Just for me” never leave this device.";

/** One-liner for Invite happy path. */
export const INVITE_SIMPLE_HINT =
  "Add their name for your headcount, then Share or show the QR. They join on their phone.";

export const OFFLINE_BANNER_HINT =
  "Working offline · Spaces on this phone still work. Connected Spaces catch up when you’re back online.";

export const FIRST_LAUNCH_ACK_KEY = "ds-legal-ack-v1";
