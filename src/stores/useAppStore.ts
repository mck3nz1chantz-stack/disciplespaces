import { create } from "zustand";
import { format } from "date-fns";
import type {
  Member,
  Passage,
  PrayerBoardEntry,
  PrayerBoardKind,
  PrayerBoardScope,
  PrayerBoardStatus,
  PrivateNote,
  Session,
  SessionResponses,
  Space,
  SpaceKind,
  SpaceTemplateId,
  Template,
} from "../types";
import { maxMembersForSpace, normalizeSpaceKind } from "../types";
import {
  createMember,
  db,
  ensureSeedData,
  hydrateSpace,
  hydrateSpaces,
  type SpaceRow,
} from "../lib/db";
import { FIRST_LAUNCH_ACK_KEY } from "../lib/legal";
import {
  buildInvitePayload,
  deriveInviteCode,
  membersForJoin,
  type SpaceInvitePayload,
} from "../lib/invite";
import {
  buildSpaceExport,
  type SpaceExportPayload,
} from "../lib/share";
import {
  defaultSessionTemplateForSpace,
  getSpaceTemplateMeta,
  normalizeSpaceTemplate,
} from "../lib/spaceTemplates";
import { emptyResponses } from "../lib/sessionResponses";

interface SessionInput {
  spaceId: string;
  date?: string;
  templateId: string;
  attendees: string[];
  responses?: SessionResponses;
  passagesStudied?: Passage[];
  notes?: string;
  sharedNotes?: string;
  keyTakeaways?: string;
  actionItems?: string[];
}

interface AppState {
  spaces: Space[];
  sessions: Session[];
  templates: Template[];
  isLoading: boolean;
  error: string | null;
  offlineReady: boolean;
  hasAcknowledgedLegal: boolean;

  setOfflineReady: (ready: boolean) => void;
  acknowledgeLegal: () => void;
  clearError: () => void;

  initialize: () => Promise<void>;
  loadSpaces: () => Promise<void>;
  loadSessionsForSpace: (spaceId: string) => Promise<void>;
  loadTemplates: () => Promise<void>;
  getSpace: (id: string) => Promise<Space | undefined>;
  getSession: (id: string) => Promise<Session | undefined>;

  createSpace: (input: {
    name: string;
    description?: string;
    members: Array<{ name: string } | Member>;
    spaceTemplate?: SpaceTemplateId;
    spaceKind?: SpaceKind;
    /** When true (default), auto-create the first session for the template. */
    createFirstSession?: boolean;
  }) => Promise<Space>;

  updateSpace: (
    id: string,
    patch: {
      name?: string;
      description?: string | null;
      spaceTemplate?: SpaceTemplateId;
      spaceKind?: SpaceKind;
      defaultSessionTemplateId?: string | null;
    },
  ) => Promise<Space>;

  deleteSpace: (id: string) => Promise<void>;

  setSpaceMembers: (spaceId: string, members: Member[]) => Promise<Space>;

  addMember: (spaceId: string, name: string) => Promise<Space>;
  updateMember: (
    spaceId: string,
    memberId: string,
    name: string,
  ) => Promise<Space>;
  removeMember: (spaceId: string, memberId: string) => Promise<Space>;

  createSession: (input: SessionInput) => Promise<Session>;
  updateSession: (
    id: string,
    patch: Partial<
      Pick<
        Session,
        | "date"
        | "templateId"
        | "attendees"
        | "responses"
        | "notes"
        | "sharedNotes"
        | "keyTakeaways"
        | "actionItems"
        | "passagesStudied"
      >
    >,
  ) => Promise<Session>;
  deleteSession: (id: string) => Promise<void>;

  addPassageToSession: (
    sessionId: string,
    passage: Passage,
  ) => Promise<Session>;
  setSessionPassages: (
    sessionId: string,
    passages: Passage[],
  ) => Promise<Session>;

  /** Ensure space has a stable inviteCode; returns hydrated space. */
  ensureInviteCode: (spaceId: string) => Promise<Space>;
  /** Build invite payload for QR / copy (no sessions). */
  createInvitePayload: (spaceId: string) => Promise<SpaceInvitePayload>;
  /**
   * Join from offline invite package.
   * Creates local space with same id; does not import sessions.
   */
  joinFromInvite: (input: {
    payload: SpaceInvitePayload;
    joinerName: string;
  }) => Promise<{ space: Space; alreadyHad: boolean }>;

  buildSpaceExportPayload: (spaceId: string) => Promise<SpaceExportPayload>;
  importSpaceExport: (
    payload: SpaceExportPayload,
  ) => Promise<{
    space: Space;
    addedSessions: number;
    skippedSessions: number;
    addedPrayers: number;
    skippedPrayers: number;
  }>;

  /** Device-local only — never exported. */
  addPrivateNote: (input: {
    spaceId: string;
    sessionId?: string;
    sectionKey?: string;
    content: string;
  }) => Promise<PrivateNote>;
  updatePrivateNote: (
    id: string,
    content: string,
  ) => Promise<PrivateNote>;
  deletePrivateNote: (id: string) => Promise<void>;
  listPrivateNotes: (opts: {
    spaceId: string;
    sessionId?: string;
    sectionKey?: string;
  }) => Promise<PrivateNote[]>;

  /** Shared prayer board — included in Space Update exports. */
  addPrayerBoardEntry: (input: {
    spaceId: string;
    sessionId?: string;
    scope: PrayerBoardScope;
    kind: PrayerBoardKind;
    authorMemberId?: string;
    authorName: string;
    subject?: string;
    content: string;
  }) => Promise<PrayerBoardEntry>;
  updatePrayerBoardEntry: (
    id: string,
    patch: Partial<
      Pick<
        PrayerBoardEntry,
        | "scope"
        | "kind"
        | "authorMemberId"
        | "authorName"
        | "subject"
        | "content"
        | "status"
      >
    >,
  ) => Promise<PrayerBoardEntry>;
  deletePrayerBoardEntry: (id: string) => Promise<void>;
}

function sortSessions(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => b.date.localeCompare(a.date));
}

function toIsoDate(date?: string): string {
  const day = date || format(new Date(), "yyyy-MM-dd");
  return day.includes("T") ? day : new Date(`${day}T12:00:00`).toISOString();
}

function readLegalAck(): boolean {
  try {
    return localStorage.getItem(FIRST_LAUNCH_ACK_KEY) === "1";
  } catch {
    return false;
  }
}

function normalizeMembers(
  input: Array<{ name: string } | Member>,
  maxMembers: number = maxMembersForSpace("group"),
): Member[] {
  const now = new Date().toISOString();
  const result: Member[] = [];
  for (const item of input) {
    if (result.length >= maxMembers) break;
    const name = item.name?.trim();
    if (!name) continue;
    if ("id" in item && item.id) {
      result.push({
        id: item.id,
        name,
        joinedAt:
          "joinedAt" in item && item.joinedAt ? item.joinedAt : now,
      });
    } else {
      result.push(createMember(name, now));
    }
  }
  return result;
}

function toRow(space: Space): SpaceRow {
  const { sessions: _sessions, ...row } = space;
  return row;
}

function sortSpaces(spaces: Space[]): Space[] {
  return [...spaces].sort((a, b) => {
    const aLast = lastActivityIso(a);
    const bLast = lastActivityIso(b);
    return bLast.localeCompare(aLast);
  });
}

/** Latest activity timestamp for dashboard ordering. */
export function lastActivityIso(space: Space): string {
  const sessionDates = space.sessions.map((s) => s.date);
  if (sessionDates.length === 0) return space.createdAt;
  return [space.createdAt, ...sessionDates].sort().at(-1) ?? space.createdAt;
}

function patchSpaceInState(spaces: Space[], updated: Space): Space[] {
  return sortSpaces(
    spaces.map((s) => (s.id === updated.id ? updated : s)),
  );
}

export const useAppStore = create<AppState>((set, get) => ({
  spaces: [],
  sessions: [],
  templates: [],
  isLoading: false,
  error: null,
  offlineReady: false,
  hasAcknowledgedLegal: readLegalAck(),

  setOfflineReady: (ready) => set({ offlineReady: ready }),

  acknowledgeLegal: () => {
    try {
      localStorage.setItem(FIRST_LAUNCH_ACK_KEY, "1");
    } catch {
      // localStorage may be unavailable; still proceed in-session
    }
    set({ hasAcknowledgedLegal: true });
  },

  clearError: () => set({ error: null }),

  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      await ensureSeedData();
      await Promise.all([get().loadSpaces(), get().loadTemplates()]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to initialize app data";
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },

  loadSpaces: async () => {
    try {
      const rows = await db.spaces.orderBy("createdAt").reverse().toArray();
      const spaces = sortSpaces(await hydrateSpaces(rows));
      set({ spaces });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load spaces";
      set({ error: message });
    }
  },

  loadSessionsForSpace: async (spaceId) => {
    try {
      const sessions = await db.sessions
        .where("spaceId")
        .equals(spaceId)
        .toArray();
      set({ sessions: sortSessions(sessions) });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load sessions";
      set({ error: message });
    }
  },

  loadTemplates: async () => {
    try {
      const templates = await db.templates.orderBy("name").toArray();
      set({ templates });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load templates";
      set({ error: message });
    }
  },

  getSpace: async (id) => {
    const cached = get().spaces.find((s) => s.id === id);
    if (cached) return cached;
    const row = await db.spaces.get(id);
    if (!row) return undefined;
    return hydrateSpace(row);
  },

  getSession: async (id) => {
    const cached = get().sessions.find((s) => s.id === id);
    if (cached) return cached;
    return db.sessions.get(id);
  },

  createSpace: async ({
    name,
    description,
    members,
    spaceTemplate,
    spaceKind,
    createFirstSession = true,
  }) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Space name is required");

    const template = normalizeSpaceTemplate(spaceTemplate);
    const kind = normalizeSpaceKind(spaceKind);
    const meta = getSpaceTemplateMeta(template);
    const defaultSessionTemplateId = meta.firstSessionTemplateId;
    const maxMembers = maxMembersForSpace(kind);

    const id = crypto.randomUUID();
    const memberList = normalizeMembers(members, maxMembers);
    const space: Space = {
      id,
      name: trimmed,
      description: description?.trim() || undefined,
      createdAt: new Date().toISOString(),
      members: memberList,
      preferredBibleVersion: "KJV",
      spaceTemplate: template,
      spaceKind: kind,
      defaultSessionTemplateId,
      inviteCode: await deriveInviteCode(id),
      sessions: [],
    };
    await db.spaces.add(toRow(space));

    let sessions: Session[] = [];
    if (createFirstSession) {
      // Ensure starter templates exist (incl. freeform / advanced)
      await ensureSeedData();
      let sessionTpl = await db.templates.get(defaultSessionTemplateId);
      if (!sessionTpl) {
        const all = await db.templates.toArray();
        sessionTpl = all[0];
      }
      if (sessionTpl) {
        const first: Session = {
          id: crypto.randomUUID(),
          spaceId: id,
          date: toIsoDate(),
          templateId: sessionTpl.id,
          attendees: memberList.map((m) => m.id),
          passagesStudied: [],
          responses: emptyResponses(sessionTpl),
          notes: "",
        };
        await db.sessions.add(first);
        sessions = [first];
      }
    }

    const hydrated: Space = { ...space, sessions };
    set((state) => ({
      spaces: sortSpaces([hydrated, ...state.spaces]),
      sessions:
        sessions.length > 0
          ? sortSessions([...sessions, ...state.sessions])
          : state.sessions,
    }));
    return hydrated;
  },

  updateSpace: async (id, patch) => {
    const row = await db.spaces.get(id);
    if (!row) throw new Error("Space not found");

    const nextRow: SpaceRow = {
      ...row,
      name:
        patch.name !== undefined
          ? patch.name.trim() || row.name
          : row.name,
      description:
        patch.description === null
          ? undefined
          : patch.description !== undefined
            ? patch.description.trim() || undefined
            : row.description,
    };

    if (patch.spaceTemplate !== undefined) {
      const tpl = normalizeSpaceTemplate(patch.spaceTemplate);
      nextRow.spaceTemplate = tpl;
      // Keep default session template aligned unless explicitly overridden
      if (patch.defaultSessionTemplateId === undefined) {
        nextRow.defaultSessionTemplateId =
          defaultSessionTemplateForSpace(tpl);
      }
    }

    if (patch.defaultSessionTemplateId !== undefined) {
      nextRow.defaultSessionTemplateId =
        patch.defaultSessionTemplateId === null
          ? undefined
          : patch.defaultSessionTemplateId;
    }

    if (patch.spaceKind !== undefined) {
      const kind = normalizeSpaceKind(patch.spaceKind);
      nextRow.spaceKind = kind;
      const max = maxMembersForSpace(kind);
      if (nextRow.members.length > max) {
        throw new Error(
          `This space has ${nextRow.members.length} members. Remove people before switching to a ${kind === "family" ? "Family" : "Group"} limit of ${max}.`,
        );
      }
    }

    await db.spaces.put(nextRow);
    const updated = await hydrateSpace(nextRow);
    set((state) => ({ spaces: patchSpaceInState(state.spaces, updated) }));
    return updated;
  },

  deleteSpace: async (id) => {
    await db.transaction(
      "rw",
      db.spaces,
      db.sessions,
      db.privateNotes,
      db.prayerBoard,
      async () => {
        await db.sessions.where("spaceId").equals(id).delete();
        await db.privateNotes.where("spaceId").equals(id).delete();
        await db.prayerBoard.where("spaceId").equals(id).delete();
        await db.spaces.delete(id);
      },
    );
    set((state) => ({
      spaces: state.spaces.filter((s) => s.id !== id),
      sessions: state.sessions.filter((s) => s.spaceId !== id),
    }));
  },

  setSpaceMembers: async (spaceId, members) => {
    const row = await db.spaces.get(spaceId);
    if (!row) throw new Error("Space not found");
    const max = maxMembersForSpace(row.spaceKind);

    const nextRow: SpaceRow = {
      ...row,
      members: normalizeMembers(members, max).slice(0, max),
    };
    await db.spaces.put(nextRow);
    const updated = await hydrateSpace(nextRow);
    set((state) => ({ spaces: patchSpaceInState(state.spaces, updated) }));
    return updated;
  },

  addMember: async (spaceId, name) => {
    const row = await db.spaces.get(spaceId);
    if (!row) throw new Error("Space not found");
    const max = maxMembersForSpace(row.spaceKind);
    if (row.members.length >= max) {
      throw new Error(`A space can have at most ${max} members`);
    }
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Member name is required");

    const nextRow: SpaceRow = {
      ...row,
      members: [...row.members, createMember(trimmed)],
    };
    await db.spaces.put(nextRow);
    const updated = await hydrateSpace(nextRow);
    set((state) => ({ spaces: patchSpaceInState(state.spaces, updated) }));
    return updated;
  },

  updateMember: async (spaceId, memberId, name) => {
    const row = await db.spaces.get(spaceId);
    if (!row) throw new Error("Space not found");
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Member name is required");

    const members = row.members.map((m) =>
      m.id === memberId ? { ...m, name: trimmed } : m,
    );
    if (!members.some((m) => m.id === memberId)) {
      throw new Error("Member not found");
    }

    const nextRow: SpaceRow = { ...row, members };
    await db.spaces.put(nextRow);
    const updated = await hydrateSpace(nextRow);
    set((state) => ({ spaces: patchSpaceInState(state.spaces, updated) }));
    return updated;
  },

  removeMember: async (spaceId, memberId) => {
    const row = await db.spaces.get(spaceId);
    if (!row) throw new Error("Space not found");

    const nextRow: SpaceRow = {
      ...row,
      members: row.members.filter((m) => m.id !== memberId),
    };
    await db.spaces.put(nextRow);
    const updated = await hydrateSpace(nextRow);
    set((state) => ({ spaces: patchSpaceInState(state.spaces, updated) }));
    return updated;
  },

  createSession: async ({
    spaceId,
    date,
    templateId,
    attendees,
    responses,
    passagesStudied,
    notes,
    sharedNotes,
    keyTakeaways,
    actionItems,
  }) => {
    const row = await db.spaces.get(spaceId);
    if (!row) throw new Error("Space not found");
    if (!templateId) throw new Error("Choose a template");

    const validAttendees = attendees.filter((id) =>
      row.members.some((m) => m.id === id),
    );

    const session: Session = {
      id: crypto.randomUUID(),
      spaceId,
      date: toIsoDate(date),
      templateId,
      attendees: validAttendees,
      passagesStudied: passagesStudied ?? [],
      responses: responses ?? {},
      notes: notes?.trim() || undefined,
      sharedNotes: sharedNotes?.trim() || undefined,
      keyTakeaways: keyTakeaways?.trim() || undefined,
      actionItems,
    };

    await db.sessions.add(session);

    const sessions = sortSessions(
      await db.sessions.where("spaceId").equals(spaceId).toArray(),
    );
    const updatedSpace = await hydrateSpace(row);
    set((state) => ({
      sessions,
      spaces: patchSpaceInState(state.spaces, updatedSpace),
    }));
    return session;
  },

  updateSession: async (id, patch) => {
    const existing = await db.sessions.get(id);
    if (!existing) throw new Error("Session not found");

    const row = await db.spaces.get(existing.spaceId);
    if (!row) throw new Error("Space not found");

    const date =
      patch.date !== undefined ? toIsoDate(patch.date) : existing.date;

    const attendees = (
      patch.attendees !== undefined ? patch.attendees : existing.attendees
    ).filter((memberId) => row.members.some((m) => m.id === memberId));

    const updated: Session = {
      ...existing,
      ...patch,
      date,
      attendees,
      responses:
        patch.responses !== undefined
          ? patch.responses
          : (existing.responses ?? {}),
      notes:
        patch.notes !== undefined
          ? patch.notes.trim() || undefined
          : existing.notes,
    };

    await db.sessions.put(updated);

    const sessions = sortSessions(
      await db.sessions.where("spaceId").equals(existing.spaceId).toArray(),
    );
    const updatedSpace = await hydrateSpace(row);
    set((state) => ({
      sessions,
      spaces: patchSpaceInState(state.spaces, updatedSpace),
    }));
    return updated;
  },

  deleteSession: async (id) => {
    const existing = await db.sessions.get(id);
    if (!existing) return;

    await db.transaction("rw", db.sessions, db.privateNotes, async () => {
      await db.privateNotes.where("sessionId").equals(id).delete();
      await db.sessions.delete(id);
    });

    const sessions = sortSessions(
      await db.sessions.where("spaceId").equals(existing.spaceId).toArray(),
    );
    const row = await db.spaces.get(existing.spaceId);
    if (row) {
      const updatedSpace = await hydrateSpace(row);
      set((state) => ({
        sessions,
        spaces: patchSpaceInState(state.spaces, updatedSpace),
      }));
    } else {
      set({ sessions });
    }
  },

  addPassageToSession: async (sessionId, passage) => {
    const existing = await db.sessions.get(sessionId);
    if (!existing) throw new Error("Session not found");
    const passagesStudied = [
      ...(existing.passagesStudied ?? []),
      passage,
    ];
    return get().updateSession(sessionId, { passagesStudied });
  },

  setSessionPassages: async (sessionId, passages) => {
    return get().updateSession(sessionId, { passagesStudied: passages });
  },

  ensureInviteCode: async (spaceId) => {
    const row = await db.spaces.get(spaceId);
    if (!row) throw new Error("Space not found");
    if (row.inviteCode) {
      return hydrateSpace(row);
    }
    const inviteCode = await deriveInviteCode(spaceId);
    const nextRow: SpaceRow = { ...row, inviteCode };
    await db.spaces.put(nextRow);
    const updated = await hydrateSpace(nextRow);
    set((state) => ({ spaces: patchSpaceInState(state.spaces, updated) }));
    return updated;
  },

  createInvitePayload: async (spaceId) => {
    const space = await get().ensureInviteCode(spaceId);
    return buildInvitePayload(space, space.inviteCode!);
  },

  joinFromInvite: async ({ payload, joinerName }) => {
    const existing = await db.spaces.get(payload.spaceId);
    if (existing) {
      // Already have this space — optionally add joiner if not present
      const name = joinerName.trim();
      const max = maxMembersForSpace(existing.spaceKind);
      if (
        name &&
        !existing.members.some(
          (m) => m.name.toLowerCase() === name.toLowerCase(),
        ) &&
        existing.members.length < max
      ) {
        const nextRow: SpaceRow = {
          ...existing,
          members: [
            ...existing.members,
            createMember(name),
          ],
          inviteCode: existing.inviteCode || payload.code,
        };
        await db.spaces.put(nextRow);
        const updated = await hydrateSpace(nextRow);
        set((state) => ({
          spaces: patchSpaceInState(state.spaces, updated),
        }));
        return { space: updated, alreadyHad: true };
      }
      const space = await hydrateSpace(existing);
      return { space, alreadyHad: true };
    }

    const kind = normalizeSpaceKind(payload.spaceKind);
    const template = normalizeSpaceTemplate(payload.spaceTemplate);
    const members = membersForJoin(
      payload.members,
      joinerName,
      maxMembersForSpace(kind),
    );
    const space: Space = {
      id: payload.spaceId,
      name: payload.name,
      description: payload.description,
      createdAt: new Date().toISOString(),
      members,
      preferredBibleVersion: "KJV",
      spaceTemplate: template,
      spaceKind: kind,
      defaultSessionTemplateId: defaultSessionTemplateForSpace(template),
      inviteCode: payload.code,
      sessions: [],
    };
    await db.spaces.add(toRow(space));
    set((state) => ({
      spaces: sortSpaces([space, ...state.spaces]),
    }));
    return { space, alreadyHad: false };
  },

  buildSpaceExportPayload: async (spaceId) => {
    const row = await db.spaces.get(spaceId);
    if (!row) throw new Error("Space not found");
    const space = await hydrateSpace(row);
    const sessions = await db.sessions
      .where("spaceId")
      .equals(spaceId)
      .toArray();
    const prayerBoard = await db.prayerBoard
      .where("spaceId")
      .equals(spaceId)
      .toArray();
    return buildSpaceExport(space, sessions, prayerBoard);
  },

  importSpaceExport: async (payload) => {
    const existing = await db.spaces.get(payload.space.id);
    let spaceRow: SpaceRow;

    if (!existing) {
      const importedTemplate = normalizeSpaceTemplate(
        payload.space.spaceTemplate,
      );
      const importedKind = normalizeSpaceKind(payload.space.spaceKind);
      const max = maxMembersForSpace(importedKind);
      spaceRow = {
        id: payload.space.id,
        name: payload.space.name,
        description: payload.space.description,
        createdAt: payload.space.createdAt || new Date().toISOString(),
        members: normalizeMembers(payload.space.members ?? [], max),
        preferredBibleVersion: "KJV",
        spaceTemplate: importedTemplate,
        spaceKind: importedKind,
        defaultSessionTemplateId:
          payload.space.defaultSessionTemplateId ||
          defaultSessionTemplateForSpace(importedTemplate),
        inviteCode:
          payload.space.inviteCode ||
          (await deriveInviteCode(payload.space.id)),
      };
      await db.spaces.add(spaceRow);
    } else {
      // Keep local private data; refresh name/description/members carefully
      const kind = normalizeSpaceKind(
        existing.spaceKind || payload.space.spaceKind,
      );
      spaceRow = {
        ...existing,
        name: payload.space.name || existing.name,
        description: payload.space.description ?? existing.description,
        inviteCode: existing.inviteCode || payload.space.inviteCode,
        spaceTemplate:
          existing.spaceTemplate ||
          normalizeSpaceTemplate(payload.space.spaceTemplate),
        spaceKind: kind,
        defaultSessionTemplateId:
          existing.defaultSessionTemplateId ||
          payload.space.defaultSessionTemplateId ||
          defaultSessionTemplateForSpace(
            existing.spaceTemplate || payload.space.spaceTemplate,
          ),
        // Prefer union of members by name (cap by space kind)
        members: mergeMembers(
          existing.members,
          payload.space.members ?? [],
          maxMembersForSpace(kind),
        ),
      };
      await db.spaces.put(spaceRow);
    }

    let addedSessions = 0;
    let skippedSessions = 0;
    let addedPrayers = 0;
    let skippedPrayers = 0;

    await db.transaction("rw", db.sessions, db.prayerBoard, async () => {
      for (const session of payload.sessions) {
        if (session.spaceId !== payload.space.id) continue;
        const has = await db.sessions.get(session.id);
        if (has) {
          skippedSessions += 1;
          continue;
        }
        await db.sessions.add({
          ...session,
          spaceId: payload.space.id,
          passagesStudied: session.passagesStudied ?? [],
          attendees: session.attendees ?? [],
        });
        addedSessions += 1;
      }

      for (const entry of payload.prayerBoard ?? []) {
        if (entry.spaceId && entry.spaceId !== payload.space.id) continue;
        const has = await db.prayerBoard.get(entry.id);
        if (has) {
          skippedPrayers += 1;
          continue;
        }
        const normalized = normalizePrayerBoardEntry(entry, payload.space.id);
        if (!normalized) {
          skippedPrayers += 1;
          continue;
        }
        await db.prayerBoard.add(normalized);
        addedPrayers += 1;
      }
    });

    const space = await hydrateSpace(spaceRow);
    const sessions = sortSessions(
      await db.sessions.where("spaceId").equals(space.id).toArray(),
    );
    set((state) => ({
      spaces: patchSpaceInState(
        state.spaces.some((s) => s.id === space.id)
          ? state.spaces
          : [space, ...state.spaces],
        space,
      ),
      sessions:
        state.sessions.length === 0 ||
        state.sessions.every((s) => s.spaceId === space.id)
          ? sessions
          : state.sessions,
    }));

    // Reload spaces list fully for correct ordering
    await get().loadSpaces();

    return {
      space,
      addedSessions,
      skippedSessions,
      addedPrayers,
      skippedPrayers,
    };
  },

  addPrivateNote: async ({ spaceId, sessionId, sectionKey, content }) => {
    const trimmed = content.trim();
    if (!trimmed) throw new Error("Write a private note first");
    const row = await db.spaces.get(spaceId);
    if (!row) throw new Error("Space not found");
    if (sessionId) {
      const session = await db.sessions.get(sessionId);
      if (!session || session.spaceId !== spaceId) {
        throw new Error("Session not found in this space");
      }
    }

    const now = new Date().toISOString();
    const note: PrivateNote = {
      id: crypto.randomUUID(),
      spaceId,
      sessionId: sessionId || undefined,
      sectionKey: sectionKey?.trim() || undefined,
      content: trimmed,
      createdAt: now,
      updatedAt: now,
    };
    await db.privateNotes.add(note);
    return note;
  },

  updatePrivateNote: async (id, content) => {
    const existing = await db.privateNotes.get(id);
    if (!existing) throw new Error("Private note not found");
    const trimmed = content.trim();
    if (!trimmed) throw new Error("Private note cannot be empty");
    const note: PrivateNote = {
      ...existing,
      content: trimmed,
      updatedAt: new Date().toISOString(),
    };
    await db.privateNotes.put(note);
    return note;
  },

  deletePrivateNote: async (id) => {
    await db.privateNotes.delete(id);
  },

  listPrivateNotes: async ({ spaceId, sessionId, sectionKey }) => {
    let list = await db.privateNotes.where("spaceId").equals(spaceId).toArray();
    if (sessionId !== undefined) {
      list = list.filter((n) => n.sessionId === sessionId);
    }
    if (sectionKey !== undefined) {
      list = list.filter((n) => n.sectionKey === sectionKey);
    }
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  addPrayerBoardEntry: async ({
    spaceId,
    sessionId,
    scope,
    kind,
    authorMemberId,
    authorName,
    subject,
    content,
  }) => {
    const row = await db.spaces.get(spaceId);
    if (!row) throw new Error("Space not found");
    const name = authorName.trim();
    if (!name) throw new Error("Who is posting this prayer?");
    const body = content.trim();
    if (!body) throw new Error("Add a short prayer note");
    if (sessionId) {
      const session = await db.sessions.get(sessionId);
      if (!session || session.spaceId !== spaceId) {
        throw new Error("Session not found in this space");
      }
    }

    const now = new Date().toISOString();
    const entry: PrayerBoardEntry = {
      id: crypto.randomUUID(),
      spaceId,
      sessionId: sessionId || undefined,
      scope: scope === "group" ? "group" : "individual",
      kind:
        kind === "prayed" ? "prayed" : kind === "update" ? "update" : "request",
      authorMemberId: authorMemberId || undefined,
      authorName: name,
      subject: subject?.trim() || undefined,
      content: body,
      status: "open",
      createdAt: now,
      updatedAt: now,
    };
    await db.prayerBoard.add(entry);
    return entry;
  },

  updatePrayerBoardEntry: async (id, patch) => {
    const existing = await db.prayerBoard.get(id);
    if (!existing) throw new Error("Prayer board entry not found");

    const next: PrayerBoardEntry = {
      ...existing,
      scope:
        patch.scope !== undefined
          ? patch.scope === "group"
            ? "group"
            : "individual"
          : existing.scope,
      kind:
        patch.kind !== undefined
          ? patch.kind === "prayed"
            ? "prayed"
            : patch.kind === "update"
              ? "update"
              : "request"
          : existing.kind,
      authorMemberId:
        patch.authorMemberId !== undefined
          ? patch.authorMemberId || undefined
          : existing.authorMemberId,
      authorName:
        patch.authorName !== undefined
          ? patch.authorName.trim() || existing.authorName
          : existing.authorName,
      subject:
        patch.subject !== undefined
          ? patch.subject.trim() || undefined
          : existing.subject,
      content:
        patch.content !== undefined
          ? patch.content.trim() || existing.content
          : existing.content,
      status:
        patch.status !== undefined
          ? normalizePrayerStatus(patch.status)
          : existing.status,
      updatedAt: new Date().toISOString(),
    };
    if (!next.content.trim()) throw new Error("Prayer note cannot be empty");
    await db.prayerBoard.put(next);
    return next;
  },

  deletePrayerBoardEntry: async (id) => {
    await db.prayerBoard.delete(id);
  },
}));

function normalizePrayerStatus(
  value: unknown,
): PrayerBoardStatus | undefined {
  if (value === "open" || value === "answered" || value === "closed") {
    return value;
  }
  return undefined;
}

function normalizePrayerBoardEntry(
  raw: Partial<PrayerBoardEntry> & { id?: string },
  spaceId: string,
): PrayerBoardEntry | null {
  if (!raw.id) return null;
  const authorName = (raw.authorName ?? "").trim();
  const content = (raw.content ?? "").trim();
  if (!authorName || !content) return null;
  const createdAt =
    typeof raw.createdAt === "string" && raw.createdAt
      ? raw.createdAt
      : new Date().toISOString();
  return {
    id: raw.id,
    spaceId,
    sessionId: raw.sessionId || undefined,
    scope: raw.scope === "group" ? "group" : "individual",
    kind:
      raw.kind === "prayed"
        ? "prayed"
        : raw.kind === "update"
          ? "update"
          : "request",
    authorMemberId: raw.authorMemberId || undefined,
    authorName,
    subject: raw.subject?.trim() || undefined,
    content,
    status: normalizePrayerStatus(raw.status) ?? "open",
    createdAt,
    updatedAt: raw.updatedAt || createdAt,
  };
}

function mergeMembers(
  local: Member[],
  incoming: Member[],
  maxMembers: number = maxMembersForSpace("group"),
): Member[] {
  const out = [...local];
  const names = new Set(local.map((m) => m.name.toLowerCase()));
  for (const m of incoming) {
    if (out.length >= maxMembers) break;
    const key = m.name.trim().toLowerCase();
    if (!key || names.has(key)) continue;
    names.add(key);
    out.push({
      id: m.id || crypto.randomUUID(),
      name: m.name.trim(),
      joinedAt: m.joinedAt || new Date().toISOString(),
    });
  }
  return out;
}
