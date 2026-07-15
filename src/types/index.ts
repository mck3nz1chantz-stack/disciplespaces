// src/types/index.ts
// Domain model for DiscipleSpaces.

/** Space-level structure chosen at create time (changeable later). */
export type SpaceTemplateId =
  | "custom"
  | "guided"
  | "advanced"
  | "freeform";

/**
 * Who the Space is for — affects member capacity.
 * - group: classic small discipleship (1–5)
 * - family: household / extended family (1–10)
 */
export type SpaceKind = "group" | "family";

export interface Member {
  id: string;
  name: string;
  joinedAt: string;
}

export interface Passage {
  /**
   * Stable row id for list editing (optional for legacy rows).
   * Generated on create; preserved across edits so React keys do not remount
   * inputs while typing (critical for mobile keyboard / backspace).
   */
  id?: string;
  book: string;
  startChapter: number;
  startVerse?: number;
  endChapter: number;
  endVerse?: number;
  /** Optional study notes for this passage (manual or Bible-reader log). */
  contextNote?: string;
}

/** One row in a checklist step response. */
export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

/**
 * Value stored per template step id.
 * - text / textarea → string
 * - checklist → ChecklistItem[]
 * - passage-log → reserved (passages live on Session.passagesStudied)
 */
export type StepResponseValue = string | ChecklistItem[];

/** Map of template step id → user response. */
export type SessionResponses = Record<string, StepResponseValue>;

export interface Session {
  id: string;
  spaceId: string;
  date: string; // ISO string (calendar day or full ISO)
  templateId: string;
  attendees: string[]; // array of member ids
  passagesStudied: Passage[];
  /** Answers keyed by TemplateStep.id */
  responses?: SessionResponses;
  /**
   * Free-form notes for every session (prayers, reflections, misc).
   * Available regardless of session template.
   */
  notes?: string;
  /** Legacy / alternate shared notes field (still supported). */
  sharedNotes?: string;
  keyTakeaways?: string;
  actionItems?: string[];
}

/**
 * How shared Space data relates to the optional light relay.
 * Default is always local-only — existing installs stay offline until Connect.
 * Private notes are never part of any sync mode.
 */
export type SpaceSyncMode = "local-only" | "connected";

/** Per-space sync metadata (shared layer only). Stored on the Space row. */
export interface SpaceSyncState {
  /** local-only = this device; connected = opted into Space room relay. */
  mode: SpaceSyncMode;
  /** Server room id when connected. */
  roomId?: string;
  /** Short human join code when connected (e.g. FAITH-7K2). */
  shortCode?: string;
  /** ISO time of last successful pull/push. */
  lastSyncedAt?: string;
  /** Remote revision cursor for incremental sync. */
  remoteRev?: number;
  /** When true, do not auto pull/push (local edits still saved). */
  paused?: boolean;
  /** Last sync error message for confidence UI (cleared on success). */
  lastError?: string;
}

export interface Space {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  members: Member[];
  /**
   * Preferred public-domain edition for this Space (KJV or WEB).
   * No paid/licensed translations.
   */
  preferredBibleVersion: "KJV" | "WEB";
  /**
   * Active living-space mode (lens): Custom, Guided, Advanced, or Freeform.
   * Switch anytime inside the Space — sessions of every mode stay together.
   * Defaults to "custom" for spaces created before modes existed.
   */
  spaceTemplate?: SpaceTemplateId;
  /**
   * Group (max 5) or Family (max 10). Defaults to "group".
   */
  spaceKind?: SpaceKind;
  /**
   * Preferred session template when starting a new session in this space
   * (also used for the auto-created first session).
   */
  defaultSessionTemplateId?: string;
  /**
   * Short human-readable invite code (e.g. ABCD-EFGH).
   * Offline join still uses the full invite package (QR / paste).
   * Connected Spaces prefer shortCode under `sync`.
   */
  inviteCode?: string;
  /**
   * Opt-in shared-layer sync. Missing → treat as local-only (migration fills default).
   * Never includes private notes.
   */
  sync?: SpaceSyncState;
  /** Hydrated at read time from the sessions table; not duplicated in Dexie. */
  sessions: Session[];
}

/** Queued shared mutation for opportunistic push (relay). */
export interface SyncQueueItem {
  id: string;
  spaceId: string;
  /** create | update | delete style op for shared entities. */
  op: string;
  /** JSON-serializable shared payload only — never private notes. */
  payload: unknown;
  createdAt: string;
  status: "pending" | "failed";
  attempts?: number;
  lastError?: string;
}

export interface TemplateStep {
  id: string;
  title: string;
  prompt: string;
  fieldType: "textarea" | "passage-log" | "checklist" | "text";
  required?: boolean;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  steps: TemplateStep[];
}

/**
 * Device-local personal notes — never included in export / invite packages.
 * Multiple timestamped entries per space or session (prayer log, reflections).
 */
export interface PrivateNote {
  id: string;
  spaceId: string;
  /** When set, note belongs to a session; when omitted, space-level note. */
  sessionId?: string;
  /**
   * Optional template step id (or well-known section like "notes" / "passages")
   * for section-scoped private notes.
   */
  sectionKey?: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Shared prayer board (space-facing) — included in Space Update exports.
 * Individual = personal requests / “John prayed for Jeff”.
 * Group = needs the whole space carries together.
 */
export type PrayerBoardScope = "individual" | "group";

/** How the entry is framed on the board. */
export type PrayerBoardKind = "request" | "prayed" | "update";

export type PrayerBoardStatus = "open" | "answered" | "closed";

export interface PrayerBoardEntry {
  id: string;
  spaceId: string;
  /** Optional session where this was logged (still lives on the space board). */
  sessionId?: string;
  scope: PrayerBoardScope;
  kind: PrayerBoardKind;
  /** Member who posted, when known. */
  authorMemberId?: string;
  /** Display name snapshot (survives member rename/remove). */
  authorName: string;
  /**
   * Who/what the prayer is about — e.g. “Jeff” in “John prayed for Jeff”,
   * or “Sam’s surgery” on a request.
   */
  subject?: string;
  content: string;
  status?: PrayerBoardStatus;
  createdAt: string;
  updatedAt?: string;
}

/** Well-known section keys for private notes outside template steps. */
export const PRIVATE_SECTION = {
  notes: "section:notes",
  passages: "section:passages",
  session: "section:session",
} as const;

/** Keys that may appear in a shared export (explicit allow-list). */
export type ExportableEntity = Space | Session | Template | PrayerBoardEntry;

/** Classic small-group cap. */
export const MAX_MEMBERS_GROUP = 5;
/** Family / household cap. */
export const MAX_MEMBERS_FAMILY = 10;
/**
 * Default max members (group). Prefer `maxMembersForSpace(space.spaceKind)`.
 */
export const MAX_MEMBERS = MAX_MEMBERS_GROUP;

export function normalizeSpaceKind(value: unknown): SpaceKind {
  return value === "family" ? "family" : "group";
}

export function maxMembersForSpace(
  kind?: SpaceKind | string | null,
): number {
  return normalizeSpaceKind(kind) === "family"
    ? MAX_MEMBERS_FAMILY
    : MAX_MEMBERS_GROUP;
}

export function spaceKindLabel(kind?: SpaceKind | string | null): string {
  return normalizeSpaceKind(kind) === "family" ? "Family" : "Group";
}
