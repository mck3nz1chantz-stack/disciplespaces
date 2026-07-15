import Dexie, { type EntityTable } from "dexie";
import type {
  PrayerBoardEntry,
  PrivateNote,
  Session,
  Space,
  SyncQueueItem,
  Template,
} from "../types";
import { SCHEMA_MIGRATIONS } from "./db/schema";
import { defaultSpaceSync } from "./sync/defaults";

/**
 * Space row as stored in IndexedDB.
 * `sessions` live in the sessions table and are joined at read time.
 */
export type SpaceRow = Omit<Space, "sessions">;

export class DiscipleSpacesDB extends Dexie {
  spaces!: EntityTable<SpaceRow, "id">;
  sessions!: EntityTable<Session, "id">;
  templates!: EntityTable<Template, "id">;
  privateNotes!: EntityTable<PrivateNote, "id">;
  prayerBoard!: EntityTable<PrayerBoardEntry, "id">;
  syncQueue!: EntityTable<SyncQueueItem, "id">;

  constructor() {
    super("discipleSpaces");

    // Apply ordered schema migrations (see src/lib/db/schema.ts + MIGRATIONS.md)
    for (const migration of SCHEMA_MIGRATIONS) {
      const v = this.version(migration.version).stores(migration.stores);
      if (migration.upgrade) {
        v.upgrade(migration.upgrade);
      }
    }
  }
}

export const db = new DiscipleSpacesDB();

const STARTER_TEMPLATES: Template[] = [
  {
    id: "tpl-discipleship-start",
    name: "Discipleship Start",
    description:
      "A gentle first meeting: get to know each other, set expectations, and open Scripture together.",
    steps: [
      {
        id: "ds-welcome",
        title: "Welcome & check-in",
        prompt: "How is everyone arriving today?",
        fieldType: "textarea",
      },
      {
        id: "ds-purpose",
        title: "Purpose of this space",
        prompt: "What do we hope God will do in this group?",
        fieldType: "textarea",
      },
      {
        id: "ds-scripture",
        title: "Scripture",
        prompt: "Read a short passage and share one takeaway.",
        fieldType: "passage-log",
        required: true,
      },
      {
        id: "ds-prayer",
        title: "Prayer",
        prompt: "Pray for one another and for this season of discipleship.",
        fieldType: "textarea",
      },
    ],
  },
  {
    id: "tpl-weekly-study",
    name: "Weekly Study",
    description:
      "A repeatable weekly rhythm: recap, study, application, and prayer.",
    steps: [
      {
        id: "ws-recap",
        title: "Recap last week",
        prompt: "How did last week’s application go?",
        fieldType: "textarea",
      },
      {
        id: "ws-read",
        title: "Read & observe",
        prompt: "What stands out in today’s passage?",
        fieldType: "passage-log",
        required: true,
      },
      {
        id: "ws-interpret",
        title: "Interpret",
        prompt: "What does this mean in context?",
        fieldType: "textarea",
      },
      {
        id: "ws-apply",
        title: "Apply",
        prompt: "What is one concrete step this week?",
        fieldType: "checklist",
      },
      {
        id: "ws-pray",
        title: "Pray",
        prompt: "Close in prayer for application and needs.",
        fieldType: "textarea",
      },
    ],
  },
  {
    id: "tpl-book-study",
    name: "Book Study",
    description:
      "Walk through a book of the Bible or a Christian book chapter by chapter.",
    steps: [
      {
        id: "bs-context",
        title: "Context",
        prompt: "Where are we in the book? Any background needed?",
        fieldType: "textarea",
      },
      {
        id: "bs-summary",
        title: "Chapter / section summary",
        prompt: "What is the main idea of this section?",
        fieldType: "textarea",
        required: true,
      },
      {
        id: "bs-questions",
        title: "Discussion questions",
        prompt: "What questions or tensions does the text raise?",
        fieldType: "textarea",
      },
      {
        id: "bs-response",
        title: "Personal response",
        prompt: "How might this reshape how we live or believe?",
        fieldType: "textarea",
      },
      {
        id: "bs-next",
        title: "Next reading",
        prompt: "Confirm the next chapter or pages before next time.",
        fieldType: "text",
      },
    ],
  },
  {
    id: "tpl-freeform",
    name: "Freeform",
    description:
      "Lightweight session: notes, prayers, and manual passage logging — no guided steps.",
    steps: [],
  },
  {
    id: "tpl-advanced-journey",
    name: "Advanced Journey",
    description:
      "Deeper discipleship meeting: spiritual check-in, Scripture, observation, interpretation, application, and accountability.",
    steps: [
      {
        id: "aj-checkin",
        title: "Spiritual check-in",
        prompt: "Where have you seen God at work since last time? Any struggles?",
        fieldType: "textarea",
      },
      {
        id: "aj-scripture",
        title: "Scripture deep dive",
        prompt: "Log the passage(s) you will sit with today.",
        fieldType: "passage-log",
        required: true,
      },
      {
        id: "aj-observe",
        title: "Observe",
        prompt: "What does the text say? Key words, structure, tone?",
        fieldType: "textarea",
      },
      {
        id: "aj-interpret",
        title: "Interpret",
        prompt: "What does this mean in context? How does it point to Christ?",
        fieldType: "textarea",
      },
      {
        id: "aj-apply",
        title: "Apply",
        prompt: "Concrete commitments for this week.",
        fieldType: "checklist",
      },
      {
        id: "aj-account",
        title: "Accountability",
        prompt: "What will you ask each other to check on next time?",
        fieldType: "textarea",
      },
      {
        id: "aj-pray",
        title: "Prayer",
        prompt: "Pray the text and one another’s needs.",
        fieldType: "textarea",
      },
    ],
  },
];

let seedPromise: Promise<void> | null = null;

/**
 * Seed starter session templates. Safe to call repeatedly.
 * Upserts by id so new templates (Freeform, Advanced Journey) appear on existing installs.
 */
export function ensureSeedData(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      for (const tpl of STARTER_TEMPLATES) {
        const existing = await db.templates.get(tpl.id);
        if (!existing) {
          await db.templates.add(tpl);
        }
      }
    })();
  }
  return seedPromise;
}

/** Expose starter list for tests / defaults (read-only). */
export function getStarterTemplates(): Template[] {
  return STARTER_TEMPLATES.map((t) => ({
    ...t,
    steps: t.steps.map((s) => ({ ...s })),
  }));
}

/** Create a Member with ISO joinedAt. */
export function createMember(
  name: string,
  joinedAt = new Date().toISOString(),
): import("../types").Member {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    joinedAt,
  };
}

/** Attach sessions for a space row (sessions table is source of truth). */
export async function hydrateSpace(row: SpaceRow): Promise<Space> {
  const sessions = await db.sessions.where("spaceId").equals(row.id).toArray();
  sessions.sort((a, b) => b.date.localeCompare(a.date));
  return {
    ...row,
    sync: row.sync ?? defaultSpaceSync(),
    sessions,
  };
}

/** Ensure every space row has sync metadata (idempotent; safe on every launch). */
export async function ensureSpaceSyncDefaults(): Promise<void> {
  await db.spaces.toCollection().modify((raw: SpaceRow) => {
    if (!raw.sync || (raw.sync.mode !== "local-only" && raw.sync.mode !== "connected")) {
      raw.sync = defaultSpaceSync();
    }
  });
}

export async function hydrateSpaces(rows: SpaceRow[]): Promise<Space[]> {
  return Promise.all(rows.map(hydrateSpace));
}
