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
  applyRemoteTombstonesLocally,
  buildSharedSnapshotWithTombstones,
  createRoom as relayCreateRoom,
  defaultSpaceSync,
  deleteRoom as relayDeleteRoom,
  HOST_ONLY_ROSTER_MESSAGE,
  HOST_ONLY_TITLE_MESSAGE,
  isSpaceGuest,
  isSpaceRelayConfigured,
  joinRoom as relayJoinRoom,
  normalizeSpaceSync,
  nowUpdatedAt,
  pickLwwEntity,
  bindGroupKeyHash as relayBindGroupKeyHash,
  previewRoom as relayPreviewRoom,
  pullRoom as relayPullRoom,
  pushRoom as relayPushRoom,
  recordTombstone,
  registerConnectedSpaceSyncRunner,
  registerSpaceRoom as relayRegisterSpaceRoom,
  resolveJoinCredentials,
  rotateJoinCode as relayRotateJoinCode,
  scheduleConnectedSpaceSync,
  SpaceRelayConflictError,
  SpaceRelayNotConfiguredError,
} from "../lib/sync";
import { scheduleAccountVaultUpload } from "../lib/keys/vaultAuto";
import {
  clearPendingGroupKeySecret,
  generateGroupKey,
  getGroupKeyMeta,
  getStoredGroupKey,
  persistGroupKey,
  setPendingGroupKeySecret,
  type GroupKeyMeta,
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
import { isOnlineModeEnabled } from "../lib/onlineMode";

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
  }) => Promise<{
    space: Space;
    alreadyHad: boolean;
    /** Shared sessions present after join (from room snapshot). */
    sessionCount: number;
    /** Newly added sessions this join imported. */
    addedSessions: number;
  }>;
  /**
   * Repair path: re-link THIS local Space to the host’s current room key.
   * Never deletes meetings, people, prayer, or private notes.
   * Soft-unlinks stale room metadata, joins with the new key (merge), then syncs.
   * Rejects keys that belong to a different spaceId (avoids silent merge into wrong group).
   */
  relinkSpaceWithRoomKey: (input: {
    spaceId: string;
    shortCode: string;
    displayName: string;
  }) => Promise<{
    space: Space;
    sessionCount: number;
    addedSessions: number;
    roomName: string;
  }>;
  /**
   * Host: issue a new room key (join code) for this group.
   * Same room + members + history stay; old code stops working.
   * Already-linked devices keep working via room id; friends re-Join only if
   * they lost the link. Optionally rotates Group Key material on this device.
   */
  reissueRoomKey: (
    spaceId: string,
    opts?: { rotateGroupKey?: boolean },
  ) => Promise<{ space: Space; shortCode: string; groupKeySecret?: string }>;
  /** Low-level patch of sync metadata (local only). */
  patchSpaceSync: (
    spaceId: string,
    sync: Partial<SpaceSyncState>,
  ) => Promise<Space>;

  /**
   * Ensure this Space has a Group Key on this device.
   * Does not wipe data. Returns secret only when newly created.
   * Host only.
   */
  ensureSpaceGroupKey: (
    spaceId: string,
  ) => Promise<{ meta: GroupKeyMeta; secret: string | null }>;

  /**
   * Host-only: regenerate Group Key immediately (no member votes).
   * Rotates short join code when the room is connected.
   */
  regenerateGroupKeyNow: (spaceId: string) => Promise<{
    completed: boolean;
    newSecret: string;
    fingerprint: string;
    space: Space;
  }>;

  /**
   * @deprecated Use regenerateGroupKeyNow. Kept for stuck pending-rotation cleanup.
   */
  proposeGroupKeyRotation: (
    spaceId: string,
    actor?: { memberId: string; memberName: string },
  ) => Promise<{
    completed: boolean;
    newSecret?: string;
    fingerprint?: string;
    space: Space;
  }>;

  /** Clears a leftover pending rotation (host). */
  cancelGroupKeyRotation: (spaceId: string) => Promise<Space>;
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
        const stamp = nowUpdatedAt();
        const first: Session = {
          id: crypto.randomUUID(),
          spaceId: id,
          date: toIsoDate(),
          templateId: sessionTpl.id,
          attendees: memberList.map((m) => m.id),
          passagesStudied: [],
          responses: emptyResponses(sessionTpl),
          notes: "",
          updatedAt: stamp,
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
    if (isSpaceRelayConfigured() && isOnlineModeEnabled()) {
      try {
        hydrated = await get().connectSpaceToRelay(id);
      } catch {
        // Local group still works; host can open the room from the group card
      }
    }

    // Account Key vault is personal home for Spaces (encrypted)
    scheduleAccountVaultUpload();

    return hydrated;
  },

  updateSpace: async (id, patch) => {
    const row = await db.spaces.get(id);
    if (!row) throw new Error("Space not found");

    // Guests must not rename host groups or change roster capacity type
    if (isSpaceGuest(row.sync)) {
      const triesName =
        patch.name !== undefined &&
        patch.name.trim() !== "" &&
        patch.name.trim() !== row.name;
      const triesDescription =
        patch.description !== undefined &&
        (patch.description === null
          ? Boolean(row.description)
          : (patch.description.trim() || undefined) !== row.description);
      const triesKind =
        patch.spaceKind !== undefined &&
        normalizeSpaceKind(patch.spaceKind) !==
          normalizeSpaceKind(row.spaceKind);
      if (triesName || triesDescription || triesKind) {
        throw new Error(HOST_ONLY_TITLE_MESSAGE);
      }
    }

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
    notifySharedDataChanged(id);
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
    scheduleAccountVaultUpload();
  },

  setSpaceMembers: async (spaceId, members) => {
    const row = await db.spaces.get(spaceId);
    if (!row) throw new Error("Space not found");
    if (isSpaceGuest(row.sync)) {
      throw new Error(HOST_ONLY_ROSTER_MESSAGE);
    }
    const max = maxMembersForSpace(row.spaceKind);

    const nextRow: SpaceRow = {
      ...row,
      members: normalizeMembers(members, max).slice(0, max),
    };
    await db.spaces.put(nextRow);
    const updated = await hydrateSpace(nextRow);
    set((state) => ({ spaces: patchSpaceInState(state.spaces, updated) }));
    notifySharedDataChanged(spaceId);
    return updated;
  },

  addMember: async (spaceId, name) => {
    const row = await db.spaces.get(spaceId);
    if (!row) throw new Error("Space not found");
    if (isSpaceGuest(row.sync)) {
      throw new Error(HOST_ONLY_ROSTER_MESSAGE);
    }
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
    notifySharedDataChanged(spaceId);
    return updated;
  },

  updateMember: async (spaceId, memberId, name) => {
    const row = await db.spaces.get(spaceId);
    if (!row) throw new Error("Space not found");
    if (isSpaceGuest(row.sync)) {
      throw new Error(HOST_ONLY_ROSTER_MESSAGE);
    }
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
    notifySharedDataChanged(spaceId);
    return updated;
  },

  removeMember: async (spaceId, memberId) => {
    const row = await db.spaces.get(spaceId);
    if (!row) throw new Error("Space not found");
    if (isSpaceGuest(row.sync)) {
      throw new Error(HOST_ONLY_ROSTER_MESSAGE);
    }

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
    notifySharedDataChanged(spaceId);
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

    const stamp = nowUpdatedAt();
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
      updatedAt: stamp,
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
    notifySharedDataChanged(spaceId);
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
      updatedAt: nowUpdatedAt(),
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
    notifySharedDataChanged(existing.spaceId);
    return updated;
  },

  deleteSession: async (id) => {
    const existing = await db.sessions.get(id);
    if (!existing) return;

    const deletedAt = nowUpdatedAt();
    await recordTombstone(existing.spaceId, "session", id, deletedAt);

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
    notifySharedDataChanged(existing.spaceId);
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

    // Skip re-adding entities covered by a local tombstone (unless remote is newer)
    const localTombs = await db.sharedTombstones
      .where("spaceId")
      .equals(payload.space.id)
      .toArray();
    const sessionTomb = new Map(
      localTombs
        .filter((t) => t.kind === "session")
        .map((t) => [t.id, t.deletedAt] as const),
    );
    const prayerTomb = new Map(
      localTombs
        .filter((t) => t.kind === "prayer")
        .map((t) => [t.id, t.deletedAt] as const),
    );

    await db.transaction(
      "rw",
      db.sessions,
      db.prayerBoard,
      db.sharedTombstones,
      async () => {
      for (const session of payload.sessions) {
        if (session.spaceId !== payload.space.id) continue;
        const delAt = sessionTomb.get(session.id);
        if (delAt) {
          const liveMs = session.updatedAt
            ? Date.parse(session.updatedAt)
            : 0;
          const delMs = Date.parse(delAt) || 0;
          if (!(Number.isFinite(liveMs) && liveMs > delMs)) {
            skippedSessions += 1;
            continue;
          }
          // Resurrect: drop tombstone
          await db.sharedTombstones.delete(`session:${session.id}`);
          sessionTomb.delete(session.id);
        }
        const has = await db.sessions.get(session.id);
        if (has) {
          if (mergeStrategy === "replace-shared") {
            // LWW by updatedAt — never touch privateNotes table
            const winner = pickLwwEntity(has, {
              ...session,
              id: has.id,
              spaceId: payload.space.id,
              passagesStudied: session.passagesStudied ?? has.passagesStudied ?? [],
              attendees: session.attendees ?? has.attendees ?? [],
            });
            await db.sessions.put({
              ...winner,
              id: has.id,
              spaceId: payload.space.id,
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
          updatedAt: session.updatedAt || session.date || nowUpdatedAt(),
        });
        addedSessions += 1;
      }

      for (const entry of payload.prayerBoard ?? []) {
        if (entry.spaceId && entry.spaceId !== payload.space.id) continue;
        const delAt = prayerTomb.get(entry.id);
        if (delAt) {
          const liveMs = entry.updatedAt ? Date.parse(entry.updatedAt) : 0;
          const delMs = Date.parse(delAt) || 0;
          if (!(Number.isFinite(liveMs) && liveMs > delMs)) {
            skippedPrayers += 1;
            continue;
          }
          await db.sharedTombstones.delete(`prayer:${entry.id}`);
          prayerTomb.delete(entry.id);
        }
        const has = await db.prayerBoard.get(entry.id);
        const normalized = normalizePrayerBoardEntry(entry, payload.space.id);
        if (!normalized) {
          skippedPrayers += 1;
          continue;
        }
        if (has) {
          if (mergeStrategy === "replace-shared") {
            const winner = pickLwwEntity(has, {
              ...normalized,
              id: has.id,
              spaceId: payload.space.id,
            });
            await db.prayerBoard.put({
              ...winner,
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
    },
    );

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
    const snapshot = await buildSharedSnapshotWithTombstones(
      space,
      sessions,
      prayerBoard,
    );
    // Server reuses room for this spaceId unless forceNew — prevents orphan rooms.
    // Reuse path also merges this snapshot so past sessions land for guests.
    const result = await relayCreateRoom({
      snapshot,
      displayName: space.members[0]?.name,
      forceNew,
    });
    void relayRegisterSpaceRoom({
      spaceId,
      roomId: result.roomId,
    });
    await get().patchSpaceSync(spaceId, {
      mode: "connected",
      roomId: result.roomId,
      shortCode: result.shortCode,
      remoteRev: result.rev,
      lastSyncedAt: new Date().toISOString(),
      paused: false,
      lastError: undefined,
      deviceRole: "host",
    });
    // Always pull+push once so host local history is on the room before invites.
    // Critical when Open room was tapped after meetings were added offline.
    try {
      return await get().syncSpaceNow(spaceId);
    } catch {
      // Linked with the snapshot from create/reuse; Sync can retry later
      const rowAfter = await db.spaces.get(spaceId);
      if (!rowAfter) throw new Error("Space not found");
      return hydrateSpace(rowAfter);
    }
  },

  syncSpaceNow: async (spaceId) => {
    if (!isSpaceRelayConfigured()) {
      throw new SpaceRelayNotConfiguredError();
    }
    const row = await db.spaces.get(spaceId);
    if (!row) throw new Error("Space not found");
    let sync = normalizeSpaceSync(row.sync);
    if (sync.mode !== "connected" || !sync.roomId) {
      throw new Error(
        "This group is not linked to a room yet. Host: Open group room. Guest: Join with the host’s room key.",
      );
    }

    const applyPulledSnapshot = async (
      snap: {
        spaceId: string;
        name: string;
        description?: string;
        createdAt: string;
        members: Member[];
        inviteCode?: string;
        spaceTemplate?: SpaceTemplateId;
        spaceKind?: SpaceKind;
        defaultSessionTemplateId?: string;
        sessions: Session[];
        prayerBoard: PrayerBoardEntry[];
        tombstones?: {
          sessions?: Array<{ id: string; deletedAt: string }>;
          prayerBoard?: Array<{ id: string; deletedAt: string }>;
        };
        exportedAt: string;
      },
      roomId: string,
      rev: number,
      shortCode?: string,
    ) => {
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
      // Propagate shared deletes (private notes on deleted sessions stay local)
      await applyRemoteTombstonesLocally(spaceId, {
        sessions: snap.tombstones?.sessions ?? [],
        prayerBoard: snap.tombstones?.prayerBoard ?? [],
      });
      await get().patchSpaceSync(spaceId, {
        mode: "connected",
        roomId,
        shortCode: shortCode ?? sync.shortCode,
        remoteRev: rev,
      });
      // Refresh live lists after tombstone deletes
      await get().loadSpaces();
      await get().loadSessionsForSpace(spaceId);
    };

    const runPullPush = async (roomId: string, shortCode?: string) => {
      const MAX_ATTEMPTS = 4;
      let attempt = 0;
      let liveRoomId = roomId;
      let liveShort = shortCode;

      while (attempt < MAX_ATTEMPTS) {
        attempt += 1;
        const pulled = await relayPullRoom({
          roomId: liveRoomId,
          sinceRev: sync.remoteRev,
        });
        if (!("unchanged" in pulled)) {
          await applyPulledSnapshot(
            pulled.snapshot,
            liveRoomId,
            pulled.rev,
            liveShort,
          );
          sync = {
            ...sync,
            remoteRev: pulled.rev,
            roomId: liveRoomId,
            shortCode: liveShort ?? sync.shortCode,
          };
        }

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
        const snapshot = await buildSharedSnapshotWithTombstones(
          hydrated,
          sessions,
          prayerBoard,
        );
        liveRoomId = normalizeSpaceSync(fresh.sync).roomId || liveRoomId;
        const baseRev = normalizeSpaceSync(fresh.sync).remoteRev;

        try {
          const push = await relayPushRoom({
            roomId: liveRoomId,
            snapshot,
            baseRev,
            mergeShared: true,
          });

          void relayRegisterSpaceRoom({ spaceId, roomId: liveRoomId });

          // Personal vault is home for Spaces under Account Key
          scheduleAccountVaultUpload();

          return get().patchSpaceSync(spaceId, {
            mode: "connected",
            roomId: liveRoomId,
            shortCode:
              liveShort ??
              normalizeSpaceSync(fresh.sync).shortCode ??
              sync.shortCode,
            remoteRev: push.rev,
            lastSyncedAt: new Date().toISOString(),
            lastError: undefined,
          });
        } catch (pushErr) {
          if (
            pushErr instanceof SpaceRelayConflictError &&
            attempt < MAX_ATTEMPTS
          ) {
            // Server advanced — apply their snapshot and retry push
            if (pushErr.snapshot) {
              await applyPulledSnapshot(
                pushErr.snapshot,
                liveRoomId,
                pushErr.rev,
                liveShort,
              );
            } else {
              await get().patchSpaceSync(spaceId, {
                remoteRev: pushErr.rev,
              });
            }
            sync = {
              ...sync,
              remoteRev: pushErr.rev,
              roomId: liveRoomId,
            };
            continue;
          }
          throw pushErr;
        }
      }
      throw new Error(
        "Could not finish sync after several tries. Stay Online and tap Sync now again.",
      );
    };

    /** Re-attach to the live room when local roomId is dead but we still have a key. */
    const healStaleRoom = async (): Promise<boolean> => {
      const role = sync.deviceRole === "guest" ? "guest" : "host";
      const code = sync.shortCode?.trim();

      if (code) {
        const displayName =
          row.members[0]?.name?.trim() ||
          (role === "host" ? "Host" : "Member");
        try {
          const rejoined = await get().joinSpaceViaRelay({
            shortCode: code,
            displayName,
          });
          sync = normalizeSpaceSync(rejoined.space.sync);
          return Boolean(sync.roomId);
        } catch {
          // fall through to host open-room
        }
      }

      if (role === "host") {
        try {
          const reopened = await get().connectSpaceToRelay(spaceId);
          sync = normalizeSpaceSync(reopened.sync);
          return Boolean(sync.roomId);
        } catch {
          return false;
        }
      }
      return false;
    };

    try {
      return await runPullPush(sync.roomId, sync.shortCode);
    } catch (err) {
      if (err instanceof SpaceRelayConflictError) {
        const friendly = err.message;
        await get().patchSpaceSync(spaceId, { lastError: friendly });
        throw err;
      }
      const message = err instanceof Error ? err.message : "Sync failed";
      const looksStale =
        /404|not found|couldn.?t reach|network|failed/i.test(message);

      if (looksStale) {
        const healed = await healStaleRoom();
        if (healed && sync.roomId) {
          try {
            return await runPullPush(sync.roomId, sync.shortCode);
          } catch (err2) {
            const message2 =
              err2 instanceof Error ? err2.message : "Sync failed";
            await get().patchSpaceSync(spaceId, { lastError: message2 });
            throw err2;
          }
        }
      }

      const friendly =
        /404|not found/i.test(message)
          ? "Room link is out of date. Host: open the group and share the current room key. Guest: Join a group again with that key (you keep local notes)."
          : message;
      await get().patchSpaceSync(spaceId, { lastError: friendly });
      throw new Error(friendly);
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

  relinkSpaceWithRoomKey: async ({ spaceId, shortCode, displayName }) => {
    if (!isSpaceRelayConfigured()) {
      throw new SpaceRelayNotConfiguredError();
    }
    const name = displayName.trim();
    if (!name) throw new Error("Choose or enter your name for the member list");
    const row = await db.spaces.get(spaceId);
    if (!row) throw new Error("Space not found");

    // Resolve room key vs Group Key (never send wrong key type silently)
    const creds = await resolveJoinCredentials(shortCode);

    // Confirm this key points at the same group (spaceId) before touching link metadata
    let roomName = row.name;
    try {
      const preview = await relayPreviewRoom(creds);
      roomName = preview.name || roomName;
      if (preview.spaceId && preview.spaceId !== spaceId) {
        throw new Error(
          `That key is for “${preview.name || "another group"}”, not this Space. Your people and meetings stay here. Use Home → Join a group if you meant a different group.`,
        );
      }
    } catch (err) {
      if (
        err instanceof Error &&
        (/not this Space|another group|Account Key|Group Key|Couldn.?t join|Couldn.?t recognize|personal backup/i.test(
          err.message,
        ))
      ) {
        throw err;
      }
      // Older relay / network: continue; join will validate the code
    }

    // Soft unlink only — never delete remote room, never touch local rows
    const prior = normalizeSpaceSync(row.sync);
    if (prior.mode === "connected" || prior.roomId || prior.lastError) {
      await get().unlinkSpaceFromRelay(spaceId, { deleteRemote: false });
    }

    const joined = await get().joinSpaceViaRelay({
      shortCode,
      displayName: name,
    });

    if (joined.space.id !== spaceId) {
      // Should not happen after spaceId check; keep both Spaces if it does
      throw new Error(
        `Linked group “${joined.space.name}” is a different Space than this one. Your original group is still on this phone with all its data.`,
      );
    }

    // Push/pull once so local history and room meet
    let space = joined.space;
    try {
      space = await get().syncSpaceNow(spaceId);
    } catch {
      // Already linked; user can Sync again
      space = joined.space;
    }

    scheduleAccountVaultUpload();

    return {
      space,
      sessionCount: joined.sessionCount,
      addedSessions: joined.addedSessions,
      roomName,
    };
  },

  joinSpaceViaRelay: async ({ shortCode, displayName }) => {
    if (!isSpaceRelayConfigured()) {
      throw new SpaceRelayNotConfiguredError();
    }
    const name = displayName.trim();
    if (!name) throw new Error("Enter your name to join");
    const creds = await resolveJoinCredentials(shortCode);
    const result = await relayJoinRoom({
      shortCode: creds.shortCode,
      groupKeyHash: creds.groupKeyHash,
      displayName: name,
    });
    const snap = result.snapshot;
    const prior = await db.spaces.get(snap.spaceId);
    const had = Boolean(prior);
    // Keep host if this phone already owned the group; otherwise guest
    const priorRole = prior
      ? normalizeSpaceSync(prior.sync).deviceRole
      : undefined;
    const deviceRole = priorRole === "host" ? "host" : "guest";

    const imported = await get().importSpaceExport(
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

    await applyRemoteTombstonesLocally(snap.spaceId, {
      sessions: snap.tombstones?.sessions ?? [],
      prayerBoard: snap.tombstones?.prayerBoard ?? [],
    });

    // Ensure joiner is on the member list (local)
    let row = await db.spaces.get(snap.spaceId);
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
        row = await db.spaces.get(snap.spaceId);
      }
    }

    let space = await get().patchSpaceSync(snap.spaceId, {
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

    // Immediately push merged local snapshot so host sees you without waiting
    try {
      const fresh = await db.spaces.get(snap.spaceId);
      if (fresh) {
        const hydrated = await hydrateSpace(fresh);
        const sessions = await db.sessions
          .where("spaceId")
          .equals(snap.spaceId)
          .toArray();
        const prayerBoard = await db.prayerBoard
          .where("spaceId")
          .equals(snap.spaceId)
          .toArray();
        const snapshot = await buildSharedSnapshotWithTombstones(
          hydrated,
          sessions,
          prayerBoard,
        );
        const push = await relayPushRoom({
          roomId: result.roomId,
          snapshot,
          baseRev: result.rev,
          mergeShared: true,
        });
        space = await get().patchSpaceSync(snap.spaceId, {
          remoteRev: push.rev,
          lastSyncedAt: new Date().toISOString(),
          lastError: undefined,
        });
      }
    } catch {
      // Join already succeeded; guest can Sync later
    }

    const sessionCount = Array.isArray(snap.sessions) ? snap.sessions.length : 0;
    return {
      space,
      alreadyHad: had,
      sessionCount,
      addedSessions: imported.addedSessions,
    };
  },

  reissueRoomKey: async (spaceId, opts) => {
    if (!isSpaceRelayConfigured()) {
      throw new SpaceRelayNotConfiguredError();
    }
    const row = await db.spaces.get(spaceId);
    if (!row) throw new Error("Space not found");
    const sync = normalizeSpaceSync(row.sync);
    if (sync.deviceRole === "guest") {
      throw new Error(
        "Only the host can issue a new room key. Ask them to open the group and use New room key.",
      );
    }

    // Ensure room exists and is linked
    let linkedSync = sync;
    if (linkedSync.mode !== "connected" || !linkedSync.roomId) {
      const opened = await get().connectSpaceToRelay(spaceId);
      linkedSync = normalizeSpaceSync(opened.sync);
    }
    if (!linkedSync.roomId) {
      throw new Error("Could not open the group room to issue a new key.");
    }

    let groupKeySecret: string | undefined;
    let groupKeyHash: string | undefined;
    if (opts?.rotateGroupKey) {
      const { secret, meta: gen } = await generateGroupKey();
      const meta = await persistGroupKey(spaceId, secret, gen);
      groupKeySecret = secret;
      groupKeyHash = meta.verifier;
      await get().patchSpaceSync(spaceId, {
        groupKeyFingerprint: meta.fingerprint,
        groupKeyId: meta.keyId,
        groupKeyRotatedAt: new Date().toISOString(),
        groupKeyRotation: undefined,
      });
    } else {
      const existing = getStoredGroupKey(spaceId);
      if (existing) {
        groupKeyHash = await sha256Hex(existing);
      }
    }

    // Mint new short code; same roomId → members list + history stay on server
    const rotated = await relayRotateJoinCode({
      roomId: linkedSync.roomId,
      groupKeyHash,
    });

    // Push current local members/sessions so the room is the source of truth
    const fresh = await db.spaces.get(spaceId);
    if (!fresh) throw new Error("Space not found");
    const hydrated = await hydrateSpace(fresh);
    const sessions = await db.sessions.where("spaceId").equals(spaceId).toArray();
    const prayerBoard = await db.prayerBoard
      .where("spaceId")
      .equals(spaceId)
      .toArray();
    const snapshot = await buildSharedSnapshotWithTombstones(
      hydrated,
      sessions,
      prayerBoard,
    );
    const push = await relayPushRoom({
      roomId: linkedSync.roomId,
      snapshot,
      baseRev: rotated.rev,
      mergeShared: true,
    });

    const space = await get().patchSpaceSync(spaceId, {
      mode: "connected",
      roomId: linkedSync.roomId,
      shortCode: rotated.shortCode,
      remoteRev: push.rev,
      lastSyncedAt: new Date().toISOString(),
      lastError: undefined,
      paused: false,
      deviceRole: "host",
    });

    return {
      space,
      shortCode: rotated.shortCode,
      groupKeySecret,
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
    // Private notes never go to the room — only optional Account Key vault
    scheduleAccountVaultUpload();
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
    scheduleAccountVaultUpload();
    return note;
  },

  deletePrivateNote: async (id) => {
    await db.privateNotes.delete(id);
    scheduleAccountVaultUpload();
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
    notifySharedDataChanged(spaceId);
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
    notifySharedDataChanged(existing.spaceId);
    return next;
  },

  deletePrayerBoardEntry: async (id) => {
    const existing = await db.prayerBoard.get(id);
    if (existing) {
      await recordTombstone(
        existing.spaceId,
        "prayer",
        id,
        nowUpdatedAt(),
      );
    }
    await db.prayerBoard.delete(id);
    if (existing) notifySharedDataChanged(existing.spaceId);
  },

  ensureSpaceGroupKey: async (spaceId) => {
    const row = await db.spaces.get(spaceId);
    if (!row) throw new Error("Space not found");
    if (isSpaceGuest(row.sync)) {
      throw new Error(
        "Only the host can create or view the Group Key on this device.",
      );
    }
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
      // Ensure relay can resolve trusted re-link by Group Key
      if (sync.mode === "connected" && sync.roomId) {
        void relayBindGroupKeyHash({
          roomId: sync.roomId,
          groupKeyHash: existingMeta.verifier,
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
      groupKeyRotation: undefined,
    });
    const syncAfter = normalizeSpaceSync(
      (await db.spaces.get(spaceId))?.sync,
    );
    if (syncAfter.mode === "connected" && syncAfter.roomId) {
      void relayBindGroupKeyHash({
        roomId: syncAfter.roomId,
        groupKeyHash: meta.verifier,
      });
    }
    return { meta, secret };
  },

  regenerateGroupKeyNow: async (spaceId) => {
    const row = await db.spaces.get(spaceId);
    if (!row) throw new Error("Space not found");
    if (isSpaceGuest(row.sync)) {
      throw new Error(
        "Only the host can regenerate the Group Key. Guests re-Join with the new room key after the host shares it.",
      );
    }
    // Drop any legacy multi-member pending vote
    clearPendingGroupKeySecret(spaceId);
    const { secret, meta: gen } = await generateGroupKey();
    const proposedKeyHash = await sha256Hex(secret);
    setPendingGroupKeySecret(spaceId, secret);
    return completeGroupKeyRotationLocal(
      get,
      spaceId,
      secret,
      gen.fingerprint,
      proposedKeyHash,
    );
  },

  /** Host-only immediate regen (no votes). */
  proposeGroupKeyRotation: async (spaceId) => {
    return get().regenerateGroupKeyNow(spaceId);
  },

  cancelGroupKeyRotation: async (spaceId) => {
    const row = await db.spaces.get(spaceId);
    if (!row) throw new Error("Space not found");
    if (isSpaceGuest(row.sync)) {
      throw new Error("Only the host can manage Group Key rotation.");
    }
    clearPendingGroupKeySecret(spaceId);
    return get().patchSpaceSync(spaceId, {
      groupKeyRotation: undefined,
    });
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

/**
 * After shared-layer local writes: debounced room sync (if connected) +
 * Account Key vault upload (personal Spaces home).
 */
function notifySharedDataChanged(spaceId: string): void {
  scheduleConnectedSpaceSync(spaceId);
  scheduleAccountVaultUpload();
}

// Wire auto-sync runner once the store exists (avoids import cycles)
registerConnectedSpaceSyncRunner((spaceId) =>
  useAppStore.getState().syncSpaceNow(spaceId),
);

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
