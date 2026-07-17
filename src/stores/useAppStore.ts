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
  SpaceSyncState,
  SpaceTemplateId,
  Template,
} from "../types";
import { maxMembersForSpace, normalizeSpaceKind } from "../types";
import {
  createMember,
  db,
  ensureSeedData,
  ensureSpaceSyncDefaults,
  hydrateSpace,
  hydrateSpaces,
  type SpaceRow,
} from "../lib/db";
import { FIRST_LAUNCH_ACK_KEY } from "../lib/legal";
import {
  buildSharedSnapshot,
  createRoom as relayCreateRoom,
  defaultSpaceSync,
  deleteRoom as relayDeleteRoom,
  isSpaceRelayConfigured,
  joinRoom as relayJoinRoom,
  normalizeSpaceSync,
  pullRoom as relayPullRoom,
  pushRoom as relayPushRoom,
  registerSpaceRoom as relayRegisterSpaceRoom,
  rotateJoinCode as relayRotateJoinCode,
  SpaceRelayNotConfiguredError,
} from "../lib/sync";
import {
  clearPendingGroupKeySecret,
  createRotationProposal,
  generateGroupKey,
  getGroupKeyMeta,
  getPendingGroupKeySecret,
  getStoredGroupKey,
  persistGroupKey,
  setPendingGroupKeySecret,
  allMembersApproved,
  type GroupKeyMeta,
  type GroupKeyRotationProposal,
} from "../lib/keys/groupKey";
import { sha256Hex } from "../lib/keys/crypto";
import {
  buildInvitePayload,
  deriveInviteCode,
  membersForJoin,
  type MemberJoinPayload,
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
import { suggestTitleFromPassages } from "../lib/sessionTitle";

interface SessionInput {
  spaceId: string;
  date?: string;
  templateId: string;
  /** Optional meeting title (e.g. primary passage / lesson name). */
  title?: string;
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
        | "title"
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
   * Returns the joiner Member so the UI can offer a join confirmation for the host.
   */
  joinFromInvite: (input: {
    payload: SpaceInvitePayload;
    joinerName: string;
  }) => Promise<{
    space: Space;
    alreadyHad: boolean;
    joiner: Member | null;
  }>;

  /**
   * Join / seed from a Space Update (history). Optionally add joiner to members.
   */
  joinFromExport: (input: {
    payload: SpaceExportPayload;
    joinerName?: string;
  }) => Promise<{
    space: Space;
    alreadyHad: boolean;
    joiner: Member | null;
    addedSessions: number;
    skippedSessions: number;
    addedPrayers: number;
    skippedPrayers: number;
  }>;

  /**
   * Host applies a joiner's "I'm in" receipt so local member list / count updates.
   */
  applyMemberJoin: (
    payload: MemberJoinPayload,
  ) => Promise<{ space: Space; added: boolean }>;

  buildSpaceExportPayload: (spaceId: string) => Promise<SpaceExportPayload>;
  /**
   * Import shared Space data.
   * - add-only (default): file / offline packages — never overwrite local sessions.
   * - replace-shared: relay pull — update existing shared sessions/prayers from remote.
   */
  importSpaceExport: (
    payload: SpaceExportPayload,
    opts?: { mergeStrategy?: "add-only" | "replace-shared" },
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

  /**
   * Opt-in: connect this Space to the light relay (shared data only).
   * Requires VITE_SPACE_RELAY_URL. Local data is never wiped.
   * Default reuses the server room for this Space id (no double rooms).
   * forceNew: only after host confirms starting a brand-new join code.
   */
  connectSpaceToRelay: (
    spaceId: string,
    opts?: { forceNew?: boolean },
  ) => Promise<Space>;
  /** Pull + push shared snapshot for a connected Space. */
  syncSpaceNow: (spaceId: string) => Promise<Space>;
  /** Pause or resume automatic network sync (local edits still save). */
  setSpaceSyncPaused: (spaceId: string, paused: boolean) => Promise<Space>;
  /**
   * Unlink from remote room; keeps all local data; mode → local-only.
   * Optionally tries to delete the remote room.
   */
  unlinkSpaceFromRelay: (
    spaceId: string,
    opts?: { deleteRemote?: boolean },
  ) => Promise<Space>;
  /** Join via short code when relay is configured. */
  joinSpaceViaRelay: (input: {
    shortCode: string;
    displayName: string;
  }) => Promise<{ space: Space; alreadyHad: boolean }>;
  /** Low-level patch of sync metadata (local only). */
  patchSpaceSync: (
    spaceId: string,
    sync: Partial<SpaceSyncState>,
  ) => Promise<Space>;

  /**
   * Ensure this Space has a Group Key on this device.
   * Does not wipe data. Returns secret only when newly created.
   */
  ensureSpaceGroupKey: (
    spaceId: string,
  ) => Promise<{ meta: GroupKeyMeta; secret: string | null }>;

  /**
   * Any member may propose Group Key regenerate.
   * Solo member completes immediately (unanimous of 1).
   */
  proposeGroupKeyRotation: (
    spaceId: string,
    actor: { memberId: string; memberName: string },
  ) => Promise<{
    completed: boolean;
    newSecret?: string;
    fingerprint?: string;
    space: Space;
  }>;

  /** Record approval; completes when all members have approved. */
  approveGroupKeyRotation: (
    spaceId: string,
    actor: { memberId: string; memberName: string; onBehalf?: boolean },
  ) => Promise<{
    completed: boolean;
    newSecret?: string;
    fingerprint?: string;
    space: Space;
  }>;

  cancelGroupKeyRotation: (spaceId: string) => Promise<Space>;

  /**
   * When all members have approved, the proposing device (holds pending secret)
   * finalizes: persists new Group Key + rotates join code if connected.
   */
  finalizeGroupKeyRotation: (spaceId: string) => Promise<{
    completed: boolean;
    newSecret?: string;
    fingerprint?: string;
    space: Space;
  }>;
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
      await ensureSpaceSyncDefaults();
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
      sync: defaultSpaceSync("host"),
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

    let hydrated: Space = { ...space, sessions };
    set((state) => ({
      spaces: sortSpaces([hydrated, ...state.spaces]),
      sessions:
        sessions.length > 0
          ? sortSessions([...sessions, ...state.sessions])
          : state.sessions,
    }));

    /**
     * Online-first: open the shared room as soon as the host creates a group
     * (when relay is configured and app Online mode is on). Guests never do this —
     * they only Join with the room key. Failure leaves a local Space; host can open later.
     */
    if (isSpaceRelayConfigured()) {
      try {
        const { isOnlineModeEnabled } = await import("../lib/onlineMode");
        if (isOnlineModeEnabled()) {
          hydrated = await get().connectSpaceToRelay(id);
        }
      } catch {
        // Local group still works; host can open the room from the group card
      }
    }

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
    // Drop removed member from any pending unanimous rotation requirement
    const sync = normalizeSpaceSync(nextRow.sync);
    if (sync.groupKeyRotation?.status === "pending") {
      const rot = sync.groupKeyRotation;
      nextRow.sync = {
        ...sync,
        groupKeyRotation: {
          ...rot,
          requiredMemberIds: rot.requiredMemberIds.filter(
            (id) => id !== memberId,
          ),
          approvals: rot.approvals.filter((a) => a.memberId !== memberId),
        },
      };
    }
    await db.spaces.put(nextRow);
    const updated = await hydrateSpace(nextRow);
    set((state) => ({ spaces: patchSpaceInState(state.spaces, updated) }));
    return updated;
  },

  createSession: async ({
    spaceId,
    date,
    templateId,
    title,
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
      title: title?.trim() || undefined,
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
      title:
        patch.title !== undefined
          ? patch.title.trim() || undefined
          : existing.title,
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
    // If the meeting has no custom title yet, seed from primary passage
    // so Past meetings stays scannable after Bible logging.
    const patch: {
      passagesStudied: typeof passagesStudied;
      title?: string;
    } = { passagesStudied };
    if (!existing.title?.trim()) {
      const suggested = suggestTitleFromPassages(passagesStudied);
      if (suggested) patch.title = suggested;
    }
    return get().updateSession(sessionId, patch);
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
        const joiner = createMember(name);
        const nextRow: SpaceRow = {
          ...existing,
          members: [...existing.members, joiner],
          inviteCode: existing.inviteCode || payload.code,
        };
        await db.spaces.put(nextRow);
        const updated = await hydrateSpace(nextRow);
        set((state) => ({
          spaces: patchSpaceInState(state.spaces, updated),
        }));
        return { space: updated, alreadyHad: true, joiner };
      }
      const space = await hydrateSpace(existing);
      const existingJoiner =
        space.members.find(
          (m) => m.name.toLowerCase() === name.toLowerCase(),
        ) ?? null;
      return { space, alreadyHad: true, joiner: existingJoiner };
    }

    const kind = normalizeSpaceKind(payload.spaceKind);
    const template = normalizeSpaceTemplate(payload.spaceTemplate);
    const members = membersForJoin(
      payload.members,
      joinerName,
      maxMembersForSpace(kind),
    );
    const joinKey = joinerName.trim().toLowerCase();
    const joiner =
      members.find((m) => m.name.toLowerCase() === joinKey) ??
      members[members.length - 1] ??
      null;
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
      // Joined via invite on this phone → guest (host Connects; they Join)
      sync: defaultSpaceSync("guest"),
      sessions: [],
    };
    await db.spaces.add(toRow(space));
    set((state) => ({
      spaces: sortSpaces([space, ...state.spaces]),
    }));
    return { space, alreadyHad: false, joiner };
  },

  joinFromExport: async ({ payload, joinerName }) => {
    const had = Boolean(await db.spaces.get(payload.space.id));
    const result = await get().importSpaceExport(payload);

    let joiner: Member | null = null;
    const name = joinerName?.trim();
    // Joining with a name = guest path. Bare file restore (no name) stays host
    // so a host can restore their own backup and Connect again.
    if (name && !had) {
      await get().patchSpaceSync(payload.space.id, { deviceRole: "guest" });
    }
    if (name) {
      const row = await db.spaces.get(payload.space.id);
      if (row) {
        const max = maxMembersForSpace(row.spaceKind);
        const existing = row.members.find(
          (m) => m.name.toLowerCase() === name.toLowerCase(),
        );
        if (existing) {
          joiner = existing;
        } else if (row.members.length < max) {
          joiner = createMember(name);
          const nextRow: SpaceRow = {
            ...row,
            members: [...row.members, joiner],
            sync: name && !had
              ? { ...normalizeSpaceSync(row.sync), deviceRole: "guest" }
              : row.sync,
          };
          await db.spaces.put(nextRow);
          const updated = await hydrateSpace(nextRow);
          set((state) => ({
            spaces: patchSpaceInState(state.spaces, updated),
          }));
          return {
            space: updated,
            alreadyHad: had,
            joiner,
            addedSessions: result.addedSessions,
            skippedSessions: result.skippedSessions,
            addedPrayers: result.addedPrayers,
            skippedPrayers: result.skippedPrayers,
          };
        }
      }
    }

    const spaceAfter =
      name && !had
        ? (await get().getSpace(payload.space.id)) ?? result.space
        : result.space;

    return {
      space: spaceAfter,
      alreadyHad: had,
      joiner,
      addedSessions: result.addedSessions,
      skippedSessions: result.skippedSessions,
      addedPrayers: result.addedPrayers,
      skippedPrayers: result.skippedPrayers,
    };
  },

  applyMemberJoin: async (payload) => {
    const row = await db.spaces.get(payload.spaceId);
    if (!row) {
      throw new Error(
        "This join confirmation is for a space that is not on this device. Open DiscipleSpaces on the host phone that created the invite.",
      );
    }
    if (
      payload.code &&
      row.inviteCode &&
      payload.code.replace(/-/g, "").toUpperCase() !==
        row.inviteCode.replace(/-/g, "").toUpperCase()
    ) {
      throw new Error(
        "Invite code on this confirmation does not match this space. Double-check you opened the right Space.",
      );
    }

    const name = payload.member.name.trim();
    if (!name) throw new Error("Join confirmation is missing a name");

    const max = maxMembersForSpace(row.spaceKind);
    if (
      row.members.some((m) => m.name.toLowerCase() === name.toLowerCase())
    ) {
      const space = await hydrateSpace(row);
      return { space, added: false };
    }
    if (row.members.length >= max) {
      throw new Error(
        `This space already has ${max} members. Remove someone before adding ${name}.`,
      );
    }

    const member: Member = {
      id: payload.member.id || crypto.randomUUID(),
      name,
      joinedAt: payload.joinedAt || new Date().toISOString(),
    };
    const nextRow: SpaceRow = {
      ...row,
      members: [...row.members, member],
      inviteCode: row.inviteCode || payload.code,
    };
    await db.spaces.put(nextRow);
    const space = await hydrateSpace(nextRow);
    set((state) => ({
      spaces: patchSpaceInState(state.spaces, space),
    }));
    return { space, added: true };
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

  importSpaceExport: async (payload, opts) => {
    const mergeStrategy = opts?.mergeStrategy ?? "add-only";
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
        // File import never enables relay — stays local-only (private notes never in file)
        sync: defaultSpaceSync(),
      };
      await db.spaces.add(spaceRow);
    } else {
      // Keep local private data + existing sync mode; refresh shared fields carefully
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
        sync: normalizeSpaceSync(existing.sync),
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
          if (mergeStrategy === "replace-shared") {
            // Relay pull: remote shared fields win; never touch privateNotes table
            await db.sessions.put({
              ...has,
              ...session,
              id: has.id,
              spaceId: payload.space.id,
              passagesStudied: session.passagesStudied ?? [],
              attendees: session.attendees ?? [],
            });
            addedSessions += 1;
          } else {
            skippedSessions += 1;
          }
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
        const normalized = normalizePrayerBoardEntry(entry, payload.space.id);
        if (!normalized) {
          skippedPrayers += 1;
          continue;
        }
        if (has) {
          if (mergeStrategy === "replace-shared") {
            await db.prayerBoard.put({
              ...has,
              ...normalized,
              id: has.id,
              spaceId: payload.space.id,
            });
            addedPrayers += 1;
          } else {
            skippedPrayers += 1;
          }
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

  patchSpaceSync: async (spaceId, syncPatch) => {
    const row = await db.spaces.get(spaceId);
    if (!row) throw new Error("Space not found");
    const merged: SpaceSyncState = {
      ...normalizeSpaceSync(row.sync),
      ...syncPatch,
    };
    // Explicit clear for rotation complete/cancel (undefined alone may not wipe Dexie)
    if (
      Object.prototype.hasOwnProperty.call(syncPatch, "groupKeyRotation") &&
      syncPatch.groupKeyRotation == null
    ) {
      delete merged.groupKeyRotation;
    }
    const nextSync = normalizeSpaceSync(merged);
    if (
      Object.prototype.hasOwnProperty.call(syncPatch, "groupKeyRotation") &&
      syncPatch.groupKeyRotation == null
    ) {
      delete nextSync.groupKeyRotation;
    }
    const nextRow: SpaceRow = { ...row, sync: nextSync };
    await db.spaces.put(nextRow);
    const updated = await hydrateSpace(nextRow);
    set((state) => ({ spaces: patchSpaceInState(state.spaces, updated) }));
    return updated;
  },

  connectSpaceToRelay: async (spaceId, opts) => {
    if (!isSpaceRelayConfigured()) {
      throw new SpaceRelayNotConfiguredError();
    }
    const row = await db.spaces.get(spaceId);
    if (!row) throw new Error("Space not found");
    const existingSync = normalizeSpaceSync(row.sync);
    const forceNew = opts?.forceNew === true;

    // Guests never open a new room (avoids two rooms for one group)
    if (existingSync.deviceRole === "guest") {
      if (existingSync.mode === "connected" && existingSync.roomId) {
        return get().syncSpaceNow(spaceId);
      }
      throw new Error(
        "Only the host can Connect this group. Ask them to Connect and share the join code, then use Join a group on this phone.",
      );
    }

    // Already connected — prefer Sync (same room). Do not mint a second room.
    if (
      !forceNew &&
      existingSync.mode === "connected" &&
      existingSync.roomId
    ) {
      try {
        return await get().syncSpaceNow(spaceId);
      } catch (err) {
        // Room missing → open-or-reuse by spaceId (server will reattach if registered)
        const msg = err instanceof Error ? err.message : "";
        if (!/404|not found/i.test(msg)) throw err;
      }
    }

    const space = await hydrateSpace(row);
    const sessions = await db.sessions.where("spaceId").equals(spaceId).toArray();
    const prayerBoard = await db.prayerBoard
      .where("spaceId")
      .equals(spaceId)
      .toArray();
    const snapshot = buildSharedSnapshot(space, sessions, prayerBoard);
    // Server reuses room for this spaceId unless forceNew — prevents orphan rooms
    const result = await relayCreateRoom({
      snapshot,
      displayName: space.members[0]?.name,
      forceNew,
    });
    void relayRegisterSpaceRoom({
      spaceId,
      roomId: result.roomId,
    });
    return get().patchSpaceSync(spaceId, {
      mode: "connected",
      roomId: result.roomId,
      shortCode: result.shortCode,
      remoteRev: result.rev,
      lastSyncedAt: new Date().toISOString(),
      paused: false,
      lastError: undefined,
      deviceRole: "host",
    });
  },

  syncSpaceNow: async (spaceId) => {
    if (!isSpaceRelayConfigured()) {
      throw new SpaceRelayNotConfiguredError();
    }
    const row = await db.spaces.get(spaceId);
    if (!row) throw new Error("Space not found");
    const sync = normalizeSpaceSync(row.sync);
    if (sync.mode !== "connected" || !sync.roomId) {
      throw new Error("Connect this Space first to sync over the network.");
    }

    try {
      // Pull remote first; replace shared session/prayer fields when rev is newer
      const pulled = await relayPullRoom({
        roomId: sync.roomId,
        sinceRev: sync.remoteRev,
      });
      if (!("unchanged" in pulled)) {
        const snap = pulled.snapshot;
        // Apply remote shared data (never touches privateNotes)
        await get().importSpaceExport(
          {
            v: 1,
            kind: "ds-export",
            exportedAt: snap.exportedAt,
            space: {
              id: snap.spaceId,
              name: snap.name,
              description: snap.description,
              createdAt: snap.createdAt,
              members: snap.members,
              preferredBibleVersion: "KJV",
              inviteCode: snap.inviteCode,
              spaceTemplate: snap.spaceTemplate,
              spaceKind: snap.spaceKind,
              defaultSessionTemplateId: snap.defaultSessionTemplateId,
            },
            sessions: snap.sessions,
            prayerBoard: snap.prayerBoard,
          },
          { mergeStrategy: "replace-shared" },
        );
        // Re-apply connected sync after import (import preserves existing sync)
        await get().patchSpaceSync(spaceId, {
          mode: "connected",
          roomId: sync.roomId,
          shortCode: sync.shortCode,
          remoteRev: pulled.rev,
        });
      }

      // Push local shared snapshot
      const fresh = await db.spaces.get(spaceId);
      if (!fresh) throw new Error("Space not found");
      const hydrated = await hydrateSpace(fresh);
      const sessions = await db.sessions
        .where("spaceId")
        .equals(spaceId)
        .toArray();
      const prayerBoard = await db.prayerBoard
        .where("spaceId")
        .equals(spaceId)
        .toArray();
      const snapshot = buildSharedSnapshot(hydrated, sessions, prayerBoard);
      const push = await relayPushRoom({
        roomId: sync.roomId,
        snapshot,
        baseRev: normalizeSpaceSync(fresh.sync).remoteRev,
      });

      // Backfill spaceId → roomId so future Connect reuses this room
      void relayRegisterSpaceRoom({ spaceId, roomId: sync.roomId });

      return get().patchSpaceSync(spaceId, {
        mode: "connected",
        roomId: sync.roomId,
        shortCode: sync.shortCode ?? normalizeSpaceSync(fresh.sync).shortCode,
        remoteRev: push.rev,
        lastSyncedAt: new Date().toISOString(),
        lastError: undefined,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Sync failed";
      await get().patchSpaceSync(spaceId, { lastError: message });
      throw err;
    }
  },

  setSpaceSyncPaused: async (spaceId, paused) => {
    return get().patchSpaceSync(spaceId, { paused });
  },

  unlinkSpaceFromRelay: async (spaceId, opts) => {
    const row = await db.spaces.get(spaceId);
    if (!row) throw new Error("Space not found");
    const sync = normalizeSpaceSync(row.sync);
    if (opts?.deleteRemote && sync.roomId && isSpaceRelayConfigured()) {
      try {
        await relayDeleteRoom(sync.roomId);
      } catch {
        // Keep local unlink even if remote delete fails
      }
    }
    const nextRow: SpaceRow = {
      ...row,
      sync: {
        mode: "local-only",
        lastSyncedAt: sync.lastSyncedAt,
        // Keep host/guest so a guest cannot Connect after Unlink
        deviceRole: sync.deviceRole === "guest" ? "guest" : "host",
      },
    };
    await db.spaces.put(nextRow);
    const updated = await hydrateSpace(nextRow);
    set((state) => ({ spaces: patchSpaceInState(state.spaces, updated) }));
    return updated;
  },

  joinSpaceViaRelay: async ({ shortCode, displayName }) => {
    if (!isSpaceRelayConfigured()) {
      throw new SpaceRelayNotConfiguredError();
    }
    const name = displayName.trim();
    if (!name) throw new Error("Enter your name to join");
    const result = await relayJoinRoom({ shortCode, displayName: name });
    const snap = result.snapshot;
    const prior = await db.spaces.get(snap.spaceId);
    const had = Boolean(prior);
    // Keep host if this phone already owned the group; otherwise guest
    const priorRole = prior
      ? normalizeSpaceSync(prior.sync).deviceRole
      : undefined;
    const deviceRole = priorRole === "host" ? "host" : "guest";

    await get().importSpaceExport(
      {
        v: 1,
        kind: "ds-export",
        exportedAt: snap.exportedAt,
        space: {
          id: snap.spaceId,
          name: snap.name,
          description: snap.description,
          createdAt: snap.createdAt,
          members: snap.members,
          preferredBibleVersion: "KJV",
          inviteCode: snap.inviteCode,
          spaceTemplate: snap.spaceTemplate,
          spaceKind: snap.spaceKind,
          defaultSessionTemplateId: snap.defaultSessionTemplateId,
        },
        sessions: snap.sessions,
        prayerBoard: snap.prayerBoard,
      },
      { mergeStrategy: "replace-shared" },
    );

    // Ensure joiner is on the member list
    const row = await db.spaces.get(snap.spaceId);
    if (row) {
      const max = maxMembersForSpace(row.spaceKind);
      if (
        !row.members.some((m) => m.name.toLowerCase() === name.toLowerCase()) &&
        row.members.length < max
      ) {
        const joiner = createMember(name);
        await db.spaces.put({
          ...row,
          members: [...row.members, joiner],
        });
      }
    }

    const space = await get().patchSpaceSync(snap.spaceId, {
      mode: "connected",
      roomId: result.roomId,
      shortCode: result.shortCode,
      remoteRev: result.rev,
      lastSyncedAt: new Date().toISOString(),
      paused: false,
      lastError: undefined,
      deviceRole,
    });

    void relayRegisterSpaceRoom({
      spaceId: snap.spaceId,
      roomId: result.roomId,
    });

    return { space, alreadyHad: had };
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

  ensureSpaceGroupKey: async (spaceId) => {
    const row = await db.spaces.get(spaceId);
    if (!row) throw new Error("Space not found");
    const existingMeta = getGroupKeyMeta(spaceId);
    const existingSecret = getStoredGroupKey(spaceId);
    if (existingMeta && existingSecret) {
      const sync = normalizeSpaceSync(row.sync);
      if (sync.groupKeyFingerprint !== existingMeta.fingerprint) {
        await get().patchSpaceSync(spaceId, {
          groupKeyFingerprint: existingMeta.fingerprint,
          groupKeyId: existingMeta.keyId,
        });
      }
      return { meta: existingMeta, secret: null };
    }
    const { secret, meta: gen } = await generateGroupKey();
    const meta = await persistGroupKey(spaceId, secret, gen);
    await get().patchSpaceSync(spaceId, {
      groupKeyFingerprint: meta.fingerprint,
      groupKeyId: meta.keyId,
      groupKeyRotatedAt: meta.createdAt,
    });
    return { meta, secret };
  },

  proposeGroupKeyRotation: async (spaceId, actor) => {
    const row = await db.spaces.get(spaceId);
    if (!row) throw new Error("Space not found");
    if (row.members.length === 0) {
      throw new Error("Add members before rotating the Group Key");
    }
    const sync = normalizeSpaceSync(row.sync);
    if (sync.groupKeyRotation?.status === "pending") {
      throw new Error(
        "A Group Key rotation is already waiting for approvals. Finish or cancel it first.",
      );
    }
    if (!row.members.some((m) => m.id === actor.memberId)) {
      throw new Error("Only current members may propose a Group Key change");
    }

    const { secret, meta: gen } = await generateGroupKey();
    const proposedKeyHash = await sha256Hex(secret);
    setPendingGroupKeySecret(spaceId, secret);

    const proposal = createRotationProposal({
      spaceId,
      proposedKeyHash,
      proposedFingerprint: gen.fingerprint,
      proposedByMemberId: actor.memberId,
      proposedByName: actor.memberName,
      requiredMemberIds: row.members.map((m) => m.id),
    });

    // Solo member = unanimous of one → complete immediately
    if (proposal.requiredMemberIds.length === 1) {
      return completeGroupKeyRotationLocal(
        get,
        spaceId,
        secret,
        gen.fingerprint,
        proposedKeyHash,
      );
    }

    const space = await get().patchSpaceSync(spaceId, {
      groupKeyRotation: {
        id: proposal.id,
        proposedKeyHash: proposal.proposedKeyHash,
        proposedFingerprint: proposal.proposedFingerprint,
        proposedByMemberId: proposal.proposedByMemberId,
        proposedByName: proposal.proposedByName,
        proposedAt: proposal.proposedAt,
        requiredMemberIds: proposal.requiredMemberIds,
        approvals: proposal.approvals,
        status: "pending",
      },
    });
    return { completed: false, space };
  },

  approveGroupKeyRotation: async (spaceId, actor) => {
    const row = await db.spaces.get(spaceId);
    if (!row) throw new Error("Space not found");
    const sync = normalizeSpaceSync(row.sync);
    const rot = sync.groupKeyRotation;
    if (!rot || rot.status !== "pending") {
      throw new Error("No Group Key rotation is waiting for approval");
    }
    if (!rot.requiredMemberIds.includes(actor.memberId)) {
      throw new Error("This person is not on the current member list");
    }
    if (rot.approvals.some((a) => a.memberId === actor.memberId)) {
      // Already approved — maybe complete if everyone else done
      if (allMembersApproved(rot as GroupKeyRotationProposal)) {
        const secret = getPendingGroupKeySecret(spaceId);
        if (!secret) {
          throw new Error(
            "New Group Key is not on this device. Ask the proposer to finish on their phone, or cancel and re-propose.",
          );
        }
        return completeGroupKeyRotationLocal(
          get,
          spaceId,
          secret,
          rot.proposedFingerprint,
          rot.proposedKeyHash,
        );
      }
      return {
        completed: false,
        space: await hydrateSpace(row),
      };
    }

    const nextRot = {
      ...rot,
      approvals: [
        ...rot.approvals,
        {
          memberId: actor.memberId,
          name: actor.memberName,
          at: new Date().toISOString(),
          onBehalf: actor.onBehalf === true,
        },
      ],
    };

    const spaceMid = await get().patchSpaceSync(spaceId, {
      groupKeyRotation: nextRot,
    });

    if (!allMembersApproved(nextRot as GroupKeyRotationProposal)) {
      return { completed: false, space: spaceMid };
    }

    const secret = getPendingGroupKeySecret(spaceId);
    if (!secret) {
      // Approvals complete; proposer device must finalize with pending secret
      return {
        completed: false,
        space: spaceMid,
      };
    }
    return completeGroupKeyRotationLocal(
      get,
      spaceId,
      secret,
      rot.proposedFingerprint,
      rot.proposedKeyHash,
    );
  },

  cancelGroupKeyRotation: async (spaceId) => {
    clearPendingGroupKeySecret(spaceId);
    return get().patchSpaceSync(spaceId, {
      groupKeyRotation: undefined,
    });
  },

  finalizeGroupKeyRotation: async (spaceId) => {
    const row = await db.spaces.get(spaceId);
    if (!row) throw new Error("Space not found");
    const sync = normalizeSpaceSync(row.sync);
    const rot = sync.groupKeyRotation;
    if (!rot || rot.status !== "pending") {
      throw new Error("No Group Key rotation in progress");
    }
    if (!allMembersApproved(rot as GroupKeyRotationProposal)) {
      throw new Error("Not all members have approved yet");
    }
    const secret = getPendingGroupKeySecret(spaceId);
    if (!secret) {
      throw new Error(
        "This phone does not hold the new Group Key. Finish on the device that tapped Regenerate, then share the new key with members.",
      );
    }
    return completeGroupKeyRotationLocal(
      get,
      spaceId,
      secret,
      rot.proposedFingerprint,
      rot.proposedKeyHash,
    );
  },
}));

async function completeGroupKeyRotationLocal(
  get: () => AppState,
  spaceId: string,
  secret: string,
  fingerprint: string,
  _proposedKeyHash: string,
): Promise<{
  completed: boolean;
  newSecret: string;
  fingerprint: string;
  space: Space;
}> {
  const meta = await persistGroupKey(spaceId, secret, {
    fingerprint,
    createdAt: new Date().toISOString(),
  });
  clearPendingGroupKeySecret(spaceId);

  const row = await db.spaces.get(spaceId);
  const sync = normalizeSpaceSync(row?.sync);
  let shortCode = sync.shortCode;
  let remoteRev = sync.remoteRev;

  if (
    isSpaceRelayConfigured() &&
    sync.mode === "connected" &&
    sync.roomId
  ) {
    try {
      const rotated = await relayRotateJoinCode({
        roomId: sync.roomId,
        groupKeyHash: meta.verifier,
      });
      shortCode = rotated.shortCode;
      remoteRev = rotated.rev;
    } catch {
      // Local key still rotates; join code may stay until next Connect
    }
  }

  const space = await get().patchSpaceSync(spaceId, {
    groupKeyFingerprint: meta.fingerprint,
    groupKeyId: meta.keyId,
    groupKeyRotatedAt: new Date().toISOString(),
    groupKeyRotation: undefined,
    shortCode,
    remoteRev,
    lastError: undefined,
  });

  return {
    completed: true,
    newSecret: secret,
    fingerprint: meta.fingerprint,
    space,
  };
}

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
