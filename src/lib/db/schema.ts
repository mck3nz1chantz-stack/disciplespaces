/**
 * Dexie schema versions for DiscipleSpaces.
 *
 * HOW TO ADD A MIGRATION
 * ----------------------
 * 1. Increment CURRENT_SCHEMA_VERSION.
 * 2. Append a new entry to SCHEMA_MIGRATIONS with stores + optional upgrade().
 * 3. Document the change in MIGRATIONS.md.
 * 4. Never reorder or remove past versions — Dexie applies them in order.
 *
 * Store strings follow Dexie syntax: primary key first, then indexes.
 * Nested object fields (e.g. members, responses) are not indexed.
 */

import type { Transaction } from "dexie";

export const CURRENT_SCHEMA_VERSION = 7;

export interface SchemaMigration {
  /** Dexie version number (monotonic). */
  version: number;
  /** Dexie .stores() map. */
  stores: Record<string, string | null>;
  /** Optional data upgrade for this version bump. */
  upgrade?: (tx: Transaction) => Promise<void> | void;
  /** Human note for MIGRATIONS.md / reviewers. */
  notes: string;
}

/** Ordered migrations (v1 → CURRENT). */
export const SCHEMA_MIGRATIONS: SchemaMigration[] = [
  {
    version: 1,
    notes: "Phase 0 foundations: spaces, sessions, templates, privateNotes",
    stores: {
      spaces: "id, name, createdAt, updatedAt",
      sessions: "id, spaceId, meetingDate, status, createdAt, updatedAt",
      templates: "id, name, isStarter, createdAt",
      privateNotes: "id, spaceId, sessionId, createdAt, updatedAt",
    },
  },
  {
    version: 2,
    notes:
      "Phase 1 model: Member objects, session attendees/passagesStudied, template steps",
    stores: {
      spaces: "id, name, createdAt",
      sessions: "id, spaceId, date, templateId",
      templates: "id, name",
      privateNotes: "id, spaceId, sessionId, createdAt",
    },
    upgrade: async (tx) => {
      await tx
        .table("spaces")
        .toCollection()
        .modify((raw: Record<string, unknown>) => {
          const members = (raw.members as unknown[]) ?? [];
          if (members.length === 0 || typeof members[0] === "string") {
            const base = new Date().toISOString();
            raw.members = (members as string[]).map((name) => ({
              id: crypto.randomUUID(),
              name: String(name).trim(),
              joinedAt: base,
            }));
          } else {
            raw.members = (members as Array<Record<string, unknown>>).map(
              (m) => {
                const joined = m.joinedAt;
                const joinedAt =
                  typeof joined === "string"
                    ? joined
                    : new Date(
                        typeof joined === "number" ? joined : Date.now(),
                      ).toISOString();
                return {
                  id: String(m.id || crypto.randomUUID()),
                  name: String(m.name ?? ""),
                  joinedAt,
                };
              },
            );
          }
          raw.preferredBibleVersion = "KJV";
          if (typeof raw.createdAt === "number") {
            raw.createdAt = new Date(raw.createdAt as number).toISOString();
          }
          delete raw.updatedAt;
          delete raw.sessions;
        });

      await tx
        .table("sessions")
        .toCollection()
        .modify((raw: Record<string, unknown>) => {
          if (!raw.date) {
            raw.date =
              (raw.meetingDate as string) ||
              (typeof raw.createdAt === "number"
                ? new Date(raw.createdAt as number).toISOString()
                : new Date().toISOString());
          }
          if (!raw.templateId) raw.templateId = "";
          if (!Array.isArray(raw.attendees)) {
            raw.attendees = Array.isArray(raw.attendeeIds)
              ? raw.attendeeIds
              : [];
          }
          if (!Array.isArray(raw.passagesStudied)) {
            raw.passagesStudied = Array.isArray(raw.passages)
              ? raw.passages
              : [];
          }
          delete raw.meetingDate;
          delete raw.attendeeIds;
          delete raw.passages;
          delete raw.title;
          delete raw.status;
          delete raw.createdAt;
          delete raw.updatedAt;
        });

      await tx
        .table("templates")
        .toCollection()
        .modify((raw: Record<string, unknown>) => {
          if (!Array.isArray(raw.steps)) {
            const sections =
              (raw.sections as Array<Record<string, unknown>>) ?? [];
            raw.steps = sections.map((s) => ({
              id: String(s.id ?? crypto.randomUUID()),
              title: String(s.title ?? "Step"),
              prompt: String(s.prompt ?? ""),
              fieldType: "textarea" as const,
              required: false,
            }));
          }
          delete raw.sections;
          delete raw.isStarter;
          delete raw.createdAt;
        });

      await tx
        .table("privateNotes")
        .toCollection()
        .modify((raw: Record<string, unknown>) => {
          if (typeof raw.createdAt === "number") {
            raw.createdAt = new Date(raw.createdAt as number).toISOString();
          }
          delete raw.updatedAt;
        });
    },
  },
  {
    version: 3,
    notes: "Phase 5: inviteCode index on spaces",
    stores: {
      spaces: "id, name, createdAt, inviteCode",
      sessions: "id, spaceId, date, templateId",
      templates: "id, name",
      privateNotes: "id, spaceId, sessionId, createdAt",
    },
  },
  {
    version: 4,
    notes:
      "Space templates (spaceTemplate, defaultSessionTemplateId) + session notes default",
    stores: {
      spaces: "id, name, createdAt, inviteCode, spaceTemplate",
      sessions: "id, spaceId, date, templateId",
      templates: "id, name",
      privateNotes: "id, spaceId, sessionId, createdAt",
    },
    upgrade: async (tx) => {
      await tx
        .table("spaces")
        .toCollection()
        .modify((raw: Record<string, unknown>) => {
          if (!raw.spaceTemplate) {
            raw.spaceTemplate = "custom";
          }
          if (!raw.defaultSessionTemplateId) {
            // Match Custom → Weekly Study default
            raw.defaultSessionTemplateId = "tpl-weekly-study";
          }
        });
      await tx
        .table("sessions")
        .toCollection()
        .modify((raw: Record<string, unknown>) => {
          if (raw.notes === undefined) {
            // Prefer legacy sharedNotes as notes seed when present
            raw.notes =
              typeof raw.sharedNotes === "string" ? raw.sharedNotes : "";
          }
        });
    },
  },
  {
    version: 5,
    notes:
      "Space kind (group | family) for member capacity; privateNotes keep sectionKey/updatedAt as unindexed fields",
    stores: {
      spaces: "id, name, createdAt, inviteCode, spaceTemplate, spaceKind",
      sessions: "id, spaceId, date, templateId",
      templates: "id, name",
      privateNotes: "id, spaceId, sessionId, createdAt",
    },
    upgrade: async (tx) => {
      await tx
        .table("spaces")
        .toCollection()
        .modify((raw: Record<string, unknown>) => {
          if (raw.spaceKind !== "family" && raw.spaceKind !== "group") {
            raw.spaceKind = "group";
          }
        });
    },
  },
  {
    version: 6,
    notes:
      "Shared prayer board entries (individual + group scopes; exportable with Space Updates)",
    stores: {
      spaces: "id, name, createdAt, inviteCode, spaceTemplate, spaceKind",
      sessions: "id, spaceId, date, templateId",
      templates: "id, name",
      privateNotes: "id, spaceId, sessionId, createdAt",
      prayerBoard: "id, spaceId, sessionId, scope, kind, createdAt",
    },
  },
  {
    version: 7,
    notes:
      "Space sync metadata (local-only default) + syncQueue for opportunistic shared-layer push; privateNotes unchanged / never queued",
    stores: {
      spaces: "id, name, createdAt, inviteCode, spaceTemplate, spaceKind",
      sessions: "id, spaceId, date, templateId",
      templates: "id, name",
      privateNotes: "id, spaceId, sessionId, createdAt",
      prayerBoard: "id, spaceId, sessionId, scope, kind, createdAt",
      syncQueue: "id, spaceId, status, createdAt",
    },
    upgrade: async (tx) => {
      await tx
        .table("spaces")
        .toCollection()
        .modify((raw: Record<string, unknown>) => {
          const existing = raw.sync as Record<string, unknown> | undefined;
          if (!existing || typeof existing !== "object") {
            raw.sync = { mode: "local-only" };
            return;
          }
          if (existing.mode !== "connected" && existing.mode !== "local-only") {
            raw.sync = { ...existing, mode: "local-only" };
          }
        });
    },
  },
];
