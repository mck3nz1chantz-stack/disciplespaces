import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { format, parseISO, subDays } from "date-fns";
import { ChevronDown, Layers, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { AddPersonForm } from "../components/AddPersonForm";
import { Modal } from "../components/Modal";
import { MemberEditor } from "../components/MemberEditor";
import { InviteModal } from "../components/InviteModal";
import { EditStudied } from "../components/EditStudied";
import { EditWhatsNext } from "../components/EditWhatsNext";
import { offerMarkTheseStudied } from "../components/markStudiedOffer";
import { isPersonalStudy } from "../lib/study";
import {
  landingDay,
  landingHasIntent,
  readGroupTab,
  tabFromLanding,
  writeGroupTab,
  type GroupLanding,
  type GroupTab,
} from "../lib/groupTab";
import { pickNextNight } from "../lib/nextNight";
import { buildPrayerScope } from "../lib/prayerScope";
import { db } from "../lib/db";
import { PrivateNotesModal } from "../components/PrivateNotesModal";
import { SessionPrivateDrawer } from "../components/SessionPrivateDrawer";
import {
  SessionForm,
  buildSessionFormValues,
  type SessionFormValues,
} from "../components/SessionForm";
import { SessionView } from "../components/SessionView";
import { validateRequiredResponses } from "../lib/sessionResponses";
import {
  sessionDisplayTitle,
  suggestTitleFromPassages,
} from "../lib/sessionTitle";
import {
  SPACE_TEMPLATES,
  countSessionsByMode,
  getSpaceTemplateMeta,
  normalizeSpaceTemplate,
  sessionMatchesMode,
  type SpaceTemplateId,
} from "../lib/spaceTemplates";
import {
  normalizeSectionKey,
  SECTION_GENERAL,
} from "../lib/sessionSections";
import type {
  Member,
  Passage,
  Session,
  WeekReading,
} from "../types";
import { formatWeekReading, parseWeekPassage } from "../lib/passages";
import { GroupTabs } from "../components/group/GroupTabs";
import { GroupPanel } from "../components/group/GroupPanel";
import { MeetingsPanel } from "../components/group/MeetingsPanel";
import { PeopleRow } from "../components/group/PeopleRow";
import { PrayerPanel } from "../components/group/PrayerPanel";
import { TonightPanel } from "../components/group/TonightPanel";
import {
  groupedSessionIds,
  groupStudies,
  isNamedPlan,
  studyKey,
  studyLabel,
} from "../lib/currentStudy";
import {
  maxMembersForSpace,
  PRIVATE_SECTION,
  spaceKindLabel,
} from "../types";
import { useAppStore } from "../stores/useAppStore";
import {
  useLivePrayerBoard,
  useLivePrayerBoardCount,
  useLivePrivateNoteCount,
  useLiveSessions,
  useLiveSpace,
  useLiveTemplates,
} from "../hooks/useLiveDb";
import { useSessionSectionSpy } from "../hooks/useSessionSectionSpy";
import {
  getGroupLinkStatus,
  isSpaceGuest,
  isSpaceHost,
  normalizeSpaceSync,
} from "../lib/sync";
import { GatherRitualBar } from "../components/GatherRitualBar";
import { NavBreadcrumb } from "../components/NavBreadcrumb";
import {
  clearGather,
  EMPTY_GATHER,
  loadGather,
  nextGatherStep,
  saveGather,
  type GatherState,
  type GatherStepId,
} from "../lib/gather";
import { useOnlineMode } from "../hooks/useOnlineMode";
import {
  calendarDay,
  heldCoveredByRealSession,
  localTodayKey,
  nextRepeatDay,
  previousSessionDay,
  repeatOf,
  meetingScheduleChanged,
  rollSession,
  splitMeetings,
} from "../lib/meetingCalendar";
import { useRoomLiveSync } from "../hooks/useRoomLiveSync";

/** Session list lens: one mode, or all modes in this Space. */
type SessionViewMode = SpaceTemplateId | "all";

type SessionModalMode = "create" | "view" | "edit" | null;

const SESSION_PAGE_SIZE = 20;

export function SpaceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Dexie live queries — timeline updates without manual reload
  const liveSpace = useLiveSpace(id);
  const liveSessions = useLiveSessions(id);
  const liveTemplates = useLiveTemplates();
  const storeTemplates = useAppStore((s) => s.templates);
  const loadTemplates = useAppStore((s) => s.loadTemplates);
  const updateSpace = useAppStore((s) => s.updateSpace);
  const deleteSpace = useAppStore((s) => s.deleteSpace);
  const setSpaceMembers = useAppStore((s) => s.setSpaceMembers);
  const addMember = useAppStore((s) => s.addMember);
  const removeMember = useAppStore((s) => s.removeMember);
  const syncSpaceNow = useAppStore((s) => s.syncSpaceNow);
  const createSession = useAppStore((s) => s.createSession);
  const updateSession = useAppStore((s) => s.updateSession);
  const updatePrayerBoardEntry = useAppStore((s) => s.updatePrayerBoardEntry);
  const deleteSession = useAppStore((s) => s.deleteSession);
  const deletePrayerBoardEntry = useAppStore((s) => s.deletePrayerBoardEntry);
  const claimSpaceHostRole = useAppStore((s) => s.claimSpaceHostRole);
  const setActiveStudy = useAppStore((s) => s.setActiveStudy);
  const { mode: onlineMode } = useOnlineMode();
  const [hostRestoreOpen, setHostRestoreOpen] = useState(false);
  const [sharingOpen, setSharingOpen] = useState(false);
  const [editStudiedOpen, setEditStudiedOpen] = useState(false);
  const [whatsNextOpen, setWhatsNextOpen] = useState(false);

  const space = liveSpace ?? null;
  const spaceSessions = liveSessions ?? [];
  const templates =
    liveTemplates && liveTemplates.length > 0
      ? liveTemplates
      : storeTemplates;

  // Phase 6: WebSocket + poll while this group is open
  useRoomLiveSync(space?.id);

  const loading = liveSpace === undefined || liveSessions === undefined;
  const notFound = liveSpace === null;

  const [editOpen, setEditOpen] = useState(false);
  const [renamingTitle, setRenamingTitle] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const [templateChangeOpen, setTemplateChangeOpen] = useState(false);
  const [draftSpaceTemplate, setDraftSpaceTemplate] =
    useState<SpaceTemplateId>("custom");
  /** Which mode lens is active for the session list (All = full history). */
  const [viewMode, setViewMode] = useState<SessionViewMode>("all");

  const [sessionMode, setSessionMode] = useState<SessionModalMode>(null);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  /** Day the open session window is about. Past rows keep their own day. */
  const [openedDay, setOpenedDay] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<SessionFormValues | null>(null);
  /**
   * True when this meeting was auto-created so Private notes work mid-flow.
   * Empty drafts are discarded on cancel/close.
   */
  const [isDraftSession, setIsDraftSession] = useState(false);
  /** Held date this draft is replacing, so Past does not list it twice. */
  const [heldLog, setHeldLog] = useState<{ sessionId: string; day: string } | null>(
    null,
  );
  /** Short past-session screen: date, passages, recap. */
  const [loggingPast, setLoggingPast] = useState(false);
  /** When set, the past form files the night into this current study. */
  const [studyRetro, setStudyRetro] = useState<{
    name: string;
    key: string;
  } | null>(null);
  const [studyDoneFocus, setStudyDoneFocus] = useState<string | null>(null);
  const [deleteSessionOpen, setDeleteSessionOpen] = useState(false);

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPlace, setEditPlace] = useState("");
  const [draftMembers, setDraftMembers] = useState<Member[]>([]);
  const [saving, setSaving] = useState(false);
  const [sessionVisible, setSessionVisible] = useState(SESSION_PAGE_SIZE);

  /** Space-level private notes modal (not session drawer). */
  const [privateNotesOpen, setPrivateNotesOpen] = useState(false);
  /** Session modal: Session | Private tab. */
  const [sessionPanelTab, setSessionPanelTab] = useState<"session" | "private">(
    "session",
  );
  /**
   * Scroll/focus-locked section shared by Session ↔ Private
   * (e.g. Welcome step id, or PRIVATE_SECTION.notes).
   */
  const [lockedSectionKey, setLockedSectionKey] = useState<string>(
    PRIVATE_SECTION.notes,
  );
  const [groupTab, setGroupTab] = useState<GroupTab>(() => {
    const state = location.state as GroupLanding | null;
    if (!id) return "tonight";
    return tabFromLanding(state, id);
  });
  const [focusDay, setFocusDay] = useState<string | null>(() =>
    landingDay(location.state as GroupLanding | null),
  );
  const [prayerFocusId, setPrayerFocusId] = useState<string | null>(null);
  /** Collapsed power tools: modes, file share, connect/sync */
  const [moreOpen, setMoreOpen] = useState(false);
  /** Gather ritual: Meet → Study → Prayer (in-flow under hero). */
  const [gather, setGather] = useState<GatherState>(EMPTY_GATHER);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [claimingHost, setClaimingHost] = useState(false);
  const sessionScrollRef = useRef<HTMLDivElement>(null);

  const onLockedSectionChange = useCallback((key: string) => {
    setLockedSectionKey(normalizeSectionKey(key));
  }, []);

  useSessionSectionSpy(
    sessionScrollRef,
    sessionMode !== null && sessionPanelTab === "session",
    onLockedSectionChange,
  );

  const sessionPrivateCount = useLivePrivateNoteCount(
    space?.id,
    activeSession?.id,
  );
  const prayerBoardCount = useLivePrayerBoardCount(space?.id);
  const prayerEntries = useLivePrayerBoard(space?.id, "all");

  useEffect(() => {
    if (templates.length === 0) void loadTemplates();
  }, [templates.length, loadTemplates]);

  useEffect(() => {
    setSessionVisible(SESSION_PAGE_SIZE);
  }, [id]);

  // Restore gather ritual when re-entering this group (e.g. back from Bible).
  // Gate saves until hydrated so the empty initial state never wipes storage.
  const gatherHydratedRef = useRef(false);
  const groupVisit = useRef<string | null>(null);
  const landingToken = useRef<string | null>(null);
  useEffect(() => {
    if (!id) {
      gatherHydratedRef.current = false;
      setGather(EMPTY_GATHER);
      return;
    }
    setGather(loadGather(id));
    gatherHydratedRef.current = true;
  }, [id]);

  useEffect(() => {
    if (!id || !gatherHydratedRef.current) return;
    saveGather(id, gather);
  }, [id, gather]);

  // Default lens to the space’s active mode when entering a Space
  useEffect(() => {
    if (!space) return;
    setViewMode(normalizeSpaceTemplate(space.spaceTemplate));
    setSessionVisible(SESSION_PAGE_SIZE);
  }, [space?.id]);

  useEffect(() => {
    if (!id) return;
    if (groupVisit.current === id) return;
    groupVisit.current = id;
    const state = location.state as GroupLanding | null;
    if (landingHasIntent(state)) return;
    setGroupTab(readGroupTab(id));
    // Landing state is read only when the open study changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Quick Start and study links pass a one-shot tab or action.
  useEffect(() => {
    if (!id) return;
    const state = location.state as GroupLanding | null;
    if (!landingHasIntent(state)) return;
    const token = `${id}:${location.key}`;
    if (landingToken.current === token) return;
    landingToken.current = token;
    const tab = tabFromLanding(state, id);
    setGroupTab(tab);
    writeGroupTab(id, tab);
    setFocusDay(landingDay(state));
    if (state?.openRename) startRename();
    if (state?.openCreateSession) void openCreateSession();
    if (state?.openInvite) setInviteOpen(true);
    navigate(location.pathname, { replace: true, state: {} });
    // Handlers are function declarations. The token blocks a second run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, location.key, location.state, location.pathname, navigate]);

  // Keep active session in sync with live list
  useEffect(() => {
    if (!activeSession || !liveSessions) return;
    const fresh = liveSessions.find((s) => s.id === activeSession.id);
    if (fresh) setActiveSession(fresh);
  }, [liveSessions, activeSession?.id]);

  // Opening a connected group: soft pull+push so shared meetings are current
  useEffect(() => {
    if (!space?.id || onlineMode !== "online") return;
    const sync = normalizeSpaceSync(space.sync);
    if (sync.mode !== "connected" || !sync.roomId || sync.paused) return;
    const t = window.setTimeout(() => {
      void syncSpaceNow(space.id).catch(() => {
        // lastError on Space; bar shows status
      });
    }, 600);
    return () => window.clearTimeout(t);
    // Only when entering this group (or reconnecting Online)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space?.id, onlineMode]);

  useEffect(() => {
    if (space?.sync?.lastError) setSharingOpen(true);
  }, [space?.id, space?.sync?.lastError]);

  const modeCounts = useMemo(
    () => countSessionsByMode(spaceSessions),
    [spaceSessions],
  );

  const filteredSessions = useMemo(() => {
    if (viewMode === "all") return spaceSessions;
    return spaceSessions.filter((s) =>
      sessionMatchesMode(s.templateId, viewMode),
    );
  }, [spaceSessions, viewMode]);

  const todayKey = localTodayKey();
  const passageCount = useMemo(
    () =>
      filteredSessions.reduce(
        (n, s) => n + (s.passagesStudied?.length ?? 0),
        0,
      ),
    [filteredSessions],
  );

  const studies = useMemo(
    () => groupStudies(filteredSessions, todayKey),
    [filteredSessions, todayKey],
  );
  const looseSessions = useMemo(
    () =>
      filteredSessions.filter(
        (session) => !groupedSessionIds(filteredSessions, todayKey).has(session.id),
      ),
    [filteredSessions, todayKey],
  );
  const meetingLists = useMemo(
    () => splitMeetings(looseSessions),
    [looseSessions],
  );
  const occurrenceDays = useMemo(() => {
    const days = new Set<string>();
    for (const raw of spaceSessions) {
      const session = rollSession(raw);
      const day = calendarDay(session.date);
      if (day) days.add(day);
      for (const held of raw.heldDates ?? []) {
        const heldDay = calendarDay(held.date);
        if (heldDay) days.add(heldDay);
      }
    }
    return [...days];
  }, [spaceSessions]);
  const prayerScope = useMemo(
    () =>
      buildPrayerScope({
        session: activeSession,
        openedDay,
        sessions: spaceSessions,
        today: todayKey,
      }),
    [openedDay, activeSession, todayKey, spaceSessions],
  );
  const todayMeetings = meetingLists.upcoming.filter(
    (face) => face.day === todayKey,
  );
  const laterMeetings = meetingLists.upcoming.filter(
    (face) => face.day !== todayKey,
  );
  const pastMeetings = meetingLists.past.filter(
    (face) => !heldCoveredByRealSession(face, spaceSessions),
  );
  const visiblePast = pastMeetings.slice(0, sessionVisible);
  const hasMorePast = pastMeetings.length > sessionVisible;
  const nextNight = useMemo(
    () =>
      pickNextNight(
        studies.current.flatMap((study) => (study.next ? [study.next] : [])),
        meetingLists.upcoming,
      ),
    [studies, meetingLists],
  );

  function selectGroupTab(tab: GroupTab) {
    setGroupTab(tab);
    if (id) writeGroupTab(id, tab);
  }

  function planMeeting() {
    selectGroupTab("meetings");
    void openCreateSession();
  }

  function planThisDay(day: string) {
    selectGroupTab("meetings");
    void openCreateSession({ meetingDate: day });
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const session of spaceSessions) {
        const next = rollSession(session);
        if (!meetingScheduleChanged(session, next)) continue;
        if (cancelled) return;
        try {
          await updateSession(session.id, {
            date: next.date,
            startTime: next.startTime ?? "",
            weekly: Boolean(next.weekly),
            heldDates: next.heldDates ?? [],
            coming: next.coming,
          });
        } catch {
          // The list still shows the next date from the projection.
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spaceSessions, updateSession]);

  function startRename() {
    if (!space) return;
    setRenamingTitle(true);
  }

  function openEdit() {
    if (!space) return;
    if (isSpaceGuest(space.sync)) {
      toast.message("Only the host can edit the group title", {
        description: "Tap Sync to pull the latest name and people from the host.",
      });
      return;
    }
    setEditName(space.name);
    setEditDescription(space.description ?? "");
    setEditPlace(space.place ?? "");
    setEditOpen(true);
  }

  async function saveInlineName(name: string) {
    if (!space) return;
    if (name === space.name) {
      setRenamingTitle(false);
      return;
    }
    await updateSpace(space.id, { name });
    toast.success("Name saved");
    setRenamingTitle(false);
    window.requestAnimationFrame(() => {
      document.getElementById("group-rename-button")?.focus();
    });
  }

  function openSpacePrivateNotes() {
    setPrivateNotesOpen(true);
  }

  /** Open Private tab; optionally lock to a section (step Private button). */
  function openSessionPrivateDrawer(sectionKey?: string) {
    if (sectionKey !== undefined) {
      setLockedSectionKey(normalizeSectionKey(sectionKey));
    }
    setSessionPanelTab("private");
  }

  function closeSessionPrivateDrawer() {
    setSessionPanelTab("session");
  }

  function openMembers() {
    if (!space) return;
    if (isSpaceGuest(space.sync)) {
      toast.message("Only the host renames people", {
        description: "Tap × on a name to remove someone from this phone.",
      });
      return;
    }
    setDraftMembers(space.members.map((m) => ({ ...m })));
    setMembersOpen(true);
  }

  function openAddPerson() {
    setQuickAddOpen(true);
    window.requestAnimationFrame(() => {
      document.getElementById("group-add-person")?.scrollIntoView({
        block: "center",
      });
    });
  }

  async function saveAddedPerson(name: string) {
    if (!space || !id) return;
    if (
      space.members.some((m) => m.name.toLowerCase() === name.toLowerCase())
    ) {
      toast.message(`${name} is already on the list`);
      setQuickAddOpen(false);
      return;
    }
    await addMember(id, name);
    toast.success(`${name} added`);
    setQuickAddOpen(false);
  }

  async function removeWeekdayMark(sessionId: string, day: string) {
    const session = spaceSessions.find((row) => row.id === sessionId);
    if (!session) {
      toast.error("Could not find that meeting");
      return;
    }
    try {
      const nextHeld = (session.heldDates ?? []).filter(
        (row) => calendarDay(row.date) !== day,
      );
      await updateSession(session.id, { heldDates: nextHeld });
      toast.success("Weekday mark removed");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not remove the weekday mark",
      );
    }
  }

  async function removeCopy(session: Session) {
    const prayers = await db.prayerBoard
      .where("spaceId")
      .equals(session.spaceId)
      .toArray();
    for (const entry of prayers) {
      if (entry.sessionId !== session.id) continue;
      await deletePrayerBoardEntry(entry.id);
    }
    await deleteSession(session.id);
    toast.success("Copy removed");
  }

  async function removeGroupDate(date: string) {
    if (!space) return;
    await updateSpace(space.id, {
      savedDates: (space.savedDates ?? []).filter((row) => row.date !== date),
    });
    toast.success("Date removed");
  }

  async function removePerson(memberId: string) {
    if (!space || !id) return;
    const member = space.members.find((m) => m.id === memberId);
    try {
      await removeMember(id, memberId);
      toast.success(`${member?.name ?? "Person"} removed`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not remove person",
      );
    }
  }

  /**
   * Start a meeting as a live draft in IndexedDB so Session + Private tabs
   * share one sessionId immediately (e.g. public recap + private relapse note).
   * @returns created session when successful (for gather path).
   */
  async function openCreateSession(opts?: {
    meetingDate?: string;
    startTime?: string;
    heldFrom?: { sessionId: string; day: string } | null;
    loggingPast?: boolean;
    templateId?: string;
    title?: string;
  }): Promise<Session | null> {
    if (!space) return null;
    const mode =
      viewMode === "all"
        ? normalizeSpaceTemplate(space.spaceTemplate)
        : viewMode;

    // Ensure starter templates exist (can be empty briefly after restore)
    let templateList = templates;
    if (templateList.length === 0) {
      await loadTemplates();
      templateList = useAppStore.getState().templates;
    }

    const preferredTemplateId =
      getSpaceTemplateMeta(mode).firstSessionTemplateId ||
      space.defaultSessionTemplateId ||
      templateList[0]?.id;
    const templateId =
      (preferredTemplateId &&
      templateList.some((t) => t.id === preferredTemplateId)
        ? preferredTemplateId
        : undefined) ||
      preferredTemplateId ||
      templateList[0]?.id;
    if (!templateId) {
      toast.error("No session templates available yet");
      return null;
    }

    // Open the sheet immediately so the bottom CTA never feels “stuck”
    setSessionPanelTab("session");
    setLockedSectionKey(PRIVATE_SECTION.notes);
    setActiveSession(null);
    setFormValues(null);
    setHeldLog(opts?.heldFrom ?? null);
    setLoggingPast(Boolean(opts?.loggingPast));
    if (!opts?.loggingPast) setStudyRetro(null);
    setOpenedDay(opts?.meetingDate ?? format(new Date(), "yyyy-MM-dd"));
    setIsDraftSession(true);
    setSessionMode("edit");
    setSaving(true);
    try {
      const draftValues = buildSessionFormValues({
        mode: "create",
        templates: templateList,
        members: space.members,
        meetingDate: opts?.meetingDate ?? format(new Date(), "yyyy-MM-dd"),
        startTime: opts?.startTime ?? "",
        weekly: false,
        preferredTemplateId: opts?.templateId || templateId,
        templateId: opts?.templateId || templateId,
        title: opts?.title,
      });
      const createTemplateId = draftValues.templateId || templateId;
      const tpl = templateList.find((t) => t.id === createTemplateId);
      if (tpl?.steps[0]?.id) {
        setLockedSectionKey(tpl.steps[0].id);
      }
      const created = await createSession({
        spaceId: space.id,
        date: draftValues.meetingDate,
        startTime: draftValues.startTime,
        weekly: draftValues.weekly,
        templateId: createTemplateId,
        attendees: draftValues.attendees,
        responses: draftValues.responses,
        passagesStudied: draftValues.passagesStudied,
        notes: draftValues.notes,
      });
      setActiveSession(created);
      setFormValues({
        ...draftValues,
        templateId: createTemplateId,
      });
      return created;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not start session",
      );
      setActiveSession(null);
      setFormValues(null);
      setIsDraftSession(false);
      setSessionMode(null);
      return null;
    } finally {
      setSaving(false);
    }
  }

  function markGatherDone(step: GatherStepId) {
    setGather((g) => {
      if (!g.active) return g;
      return { ...g, done: { ...g.done, [step]: true } };
    });
  }

  function endGather() {
    if (id) clearGather(id);
    setGather(EMPTY_GATHER);
  }

  function goGatherStep(step: GatherStepId) {
    setGather((g) => (g.active ? { ...g, step } : g));
  }

  function advanceGather() {
    setGather((g) => {
      if (!g.active) return g;
      const next = nextGatherStep(g.step);
      if (!next) return g;
      return {
        ...g,
        step: next,
        done: { ...g.done, [g.step]: true },
      };
    });
  }

  /**
   * One hero control: start (or resume) the Meet → Study → Prayer ritual.
   */
  async function beginGather() {
    if (!space) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const todaySession =
      spaceSessions.find((s) => s.date.slice(0, 10) === today) ?? null;

    setGather({
      active: true,
      step: "meet",
      sessionId: todaySession?.id ?? null,
      done: todaySession ? { meet: true } : {},
    });

    if (todaySession) {
      openEditSession(todaySession);
      return;
    }
    const created = await openCreateSession();
    if (created) {
      setGather((g) => ({
        ...g,
        active: true,
        step: "meet",
        sessionId: created.id,
      }));
    }
  }

  async function runGatherPrimary() {
    if (!space || !gather.active) return;

    if (gather.step === "meet") {
      const sid = gather.sessionId;
      const session =
        (sid && spaceSessions.find((s) => s.id === sid)) ||
        (sid && activeSession?.id === sid ? activeSession : null) ||
        spaceSessions.find(
          (s) => s.date.slice(0, 10) === format(new Date(), "yyyy-MM-dd"),
        ) ||
        null;
      if (session) {
        setGather((g) => ({ ...g, sessionId: session.id }));
        openEditSession(session);
        return;
      }
      const created = await openCreateSession();
      if (created) {
        setGather((g) => ({
          ...g,
          sessionId: created.id,
        }));
      }
      return;
    }

    if (gather.step === "study") {
      markGatherDone("study");
      openBibleForSpace(gather.sessionId ?? undefined);
      return;
    }

    if (gather.step === "prayer") {
      markGatherDone("prayer");
      if (gather.sessionId) setPrayerFocusId(gather.sessionId);
      selectGroupTab("prayer");
    }
  }

  function openChangeTemplate() {
    if (!space) return;
    setDraftSpaceTemplate(normalizeSpaceTemplate(space.spaceTemplate));
    setTemplateChangeOpen(true);
  }

  /**
   * Switch living-space mode: flips defaults for new sessions and the
   * session list lens. All past sessions remain in the Space.
   */
  async function switchMode(mode: SessionViewMode) {
    if (!space) return;
    setViewMode(mode);
    setSessionVisible(SESSION_PAGE_SIZE);
    if (mode === "all") return;

    if (normalizeSpaceTemplate(space.spaceTemplate) === mode) return;

    try {
      await updateSpace(space.id, { spaceTemplate: mode });
      const meta = getSpaceTemplateMeta(mode);
      toast.success(`${meta.name} mode`, {
        description: `New sessions default to ${meta.firstSessionLabel}. Past sessions stay in this Space — switch modes to review them.`,
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not switch mode",
      );
    }
  }

  async function removeViewedPassage(passage: Passage, index: number) {
    if (!activeSession || saving) return;
    const current = activeSession.passagesStudied ?? [];
    const next = current.filter((row, i) =>
      passage.id ? row.id !== passage.id : i !== index,
    );
    if (next.length === current.length) return;
    const prevSuggest = suggestTitleFromPassages(current);
    const nextSuggest = suggestTitleFromPassages(next);
    const title = activeSession.title?.trim() ?? "";
    const patch: { passagesStudied: Passage[]; title?: string } = {
      passagesStudied: next,
    };
    if (!title || title === prevSuggest) {
      patch.title = nextSuggest;
    }
    setSaving(true);
    try {
      const updated = await updateSession(activeSession.id, patch);
      setActiveSession(updated);
      toast.success("Passage removed");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not remove passage",
      );
    } finally {
      setSaving(false);
    }
  }

  function openViewSession(session: Session, day?: string) {
    setOpenedDay(day ?? calendarDay(session.date));
    setActiveSession(session);
    setIsDraftSession(false);
    setSessionPanelTab("session");
    const tpl = templates.find((t) => t.id === session.templateId);
    setLockedSectionKey(tpl?.steps[0]?.id ?? PRIVATE_SECTION.notes);
    setSessionMode("view");
  }

  function openEditSession(session?: Session | null, day?: string) {
    const s = session ?? activeSession;
    if (!space || !s) return;
    setOpenedDay(day ?? openedDay ?? calendarDay(s.date));
    setActiveSession(s);
    setIsDraftSession(false);
    setSessionPanelTab("session");
    const tpl = templates.find((t) => t.id === s.templateId);
    setLockedSectionKey(tpl?.steps[0]?.id ?? PRIVATE_SECTION.notes);
    const planned = rollSession(s);
    setFormValues(
      buildSessionFormValues({
        mode: "edit",
        templates,
        members: space.members,
        meetingDate: toDateInputValue(planned.date),
        startTime: planned.startTime ?? "",
        weekly: Boolean(planned.weekly),
        repeat: repeatOf(planned),
        templateId: s.templateId,
        title: s.title ?? "",
        attendees: s.attendees,
        responses: s.responses,
        passagesStudied: s.passagesStudied ?? [],
        notes: s.notes ?? s.sharedNotes ?? "",
        weekPassageText: s.weekPassage ? formatWeekReading(s.weekPassage) : "",
        weekQuestion: s.weekQuestion ?? "",
      }),
    );
    setSessionMode("edit");
  }

  /**
   * URL is the primary source of truth for Bible log context.
   * Prefer an explicit session; otherwise attach the latest meeting so
   * logging is one-tap in the reader (session-first study).
   */
  function openBibleForSpace(sessionId?: string) {
    if (!space) return;
    const params = new URLSearchParams({ space: space.id });
    const resolvedSession =
      sessionId ??
      gather.sessionId ??
      activeSession?.id ??
      spaceSessions[0]?.id ??
      undefined;
    if (resolvedSession) params.set("session", resolvedSession);
    if (gather.active) {
      markGatherDone("study");
      setGather((g) =>
        g.active
          ? {
              ...g,
              sessionId: resolvedSession ?? g.sessionId,
              step: g.step === "meet" ? "study" : g.step,
            }
          : g,
      );
    }
    navigate(`/bible?${params.toString()}`);
  }

  /** Keep this meeting’s date, then open Read so logged verses stay on it. */
  async function openBibleFromForm() {
    if (!activeSession) return;
    if (formValues) {
      setSaving(true);
      try {
        await updateSession(activeSession.id, {
          date: formValues.meetingDate,
          startTime: formValues.startTime,
          weekly: loggingPast ? false : formValues.repeat === "week",
          repeat:
            loggingPast || formValues.repeat === "once"
              ? undefined
              : formValues.repeat,
          repeatDay:
            !loggingPast && formValues.repeat === "month"
              ? Number(formValues.meetingDate.slice(8, 10))
              : undefined,
          title: formValues.title.trim(),
          attendees: formValues.attendees,
          responses: formValues.responses,
          passagesStudied: formValues.passagesStudied,
          notes: formValues.notes,
        });
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not open Read",
        );
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    openBibleForSpace(activeSession.id);
  }

  function formOrSessionHasSharedContent(
    session: Session,
    form: SessionFormValues | null,
  ): boolean {
    if (form) {
      if (form.notes?.trim()) return true;
      if (form.passagesStudied.length > 0) return true;
      if (
        Object.values(form.responses ?? {}).some((v) => {
          if (typeof v === "string") return v.trim().length > 0;
          if (Array.isArray(v)) return v.some((i) => i.text?.trim());
          return false;
        })
      ) {
        return true;
      }
    }
    if (session.notes?.trim() || session.sharedNotes?.trim()) return true;
    if ((session.passagesStudied?.length ?? 0) > 0) return true;
    return Object.values(session.responses ?? {}).some((v) => {
      if (typeof v === "string") return v.trim().length > 0;
      if (Array.isArray(v)) return v.some((i) => i.text?.trim());
      return false;
    });
  }

  async function discardEmptyDraftIfNeeded(
    session: Session,
    form: SessionFormValues | null,
  ) {
    const hasShared = formOrSessionHasSharedContent(session, form);
    const privateCount = (
      await useAppStore
        .getState()
        .listPrivateNotes({ spaceId: session.spaceId, sessionId: session.id })
    ).length;
    if (!hasShared && privateCount === 0) {
      await deleteSession(session.id);
    }
  }

  async function closeSessionModal() {
    if (saving) return;
    const draft = activeSession;
    const wasDraft = isDraftSession;
    const formSnapshot = formValues;
    const closedSessionId = draft?.id ?? null;
    setSessionMode(null);
    setActiveSession(null);
    setOpenedDay(null);
    setFormValues(null);
    setSessionPanelTab("session");
    setLockedSectionKey(PRIVATE_SECTION.notes);
    setIsDraftSession(false);
    setLoggingPast(false);
    setStudyRetro(null);

    let keptSessionId: string | null = null;
    if (wasDraft && draft) {
      try {
        // Persist unsaved form into draft before emptiness check, if any content
        if (formSnapshot && formOrSessionHasSharedContent(draft, formSnapshot)) {
          await updateSession(draft.id, {
            date: formSnapshot.meetingDate,
            startTime: formSnapshot.startTime,
            weekly: formSnapshot.repeat === "week",
            repeat: formSnapshot.repeat === "once" ? undefined : formSnapshot.repeat,
            repeatDay:
              formSnapshot.repeat === "month"
                ? Number(formSnapshot.meetingDate.slice(8, 10))
                : undefined,
            templateId: formSnapshot.templateId,
            attendees: formSnapshot.attendees,
            responses: formSnapshot.responses,
            passagesStudied: formSnapshot.passagesStudied,
            notes: formSnapshot.notes,
          });
          keptSessionId = draft.id;
        } else {
          await discardEmptyDraftIfNeeded(draft, formSnapshot);
        }
      } catch {
        // ignore discard errors
      }
    } else if (closedSessionId) {
      keptSessionId = closedSessionId;
    }

    // Gather ritual: leaving Meet marks step done and nudges to Study
    if (gather.active && keptSessionId) {
      setGather((g) => {
        if (!g.active) return g;
        const next =
          g.step === "meet" ? nextGatherStep("meet") ?? "study" : g.step;
        return {
          ...g,
          sessionId: keptSessionId,
          done: { ...g.done, meet: true },
          step: g.step === "meet" ? next : g.step,
        };
      });
      if (gather.step === "meet") {
        toast.message("Meeting ready", {
          description: "Next: Study together in the Bible.",
          duration: 4200,
        });
      }
    }
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!space || !editName.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      await updateSpace(space.id, {
        name: editName,
        description: editDescription,
        place: editPlace,
      });
      toast.success("Name saved");
      setEditOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update space");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMembers(e: FormEvent) {
    e.preventDefault();
    if (!space) return;
    setSaving(true);
    try {
      await setSpaceMembers(space.id, draftMembers);
      toast.success("People updated");
      setMembersOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not update members",
      );
    } finally {
      setSaving(false);
    }
  }

  function previousDayForLog(): { day: string; startTime: string } {
    const face = meetingLists.upcoming[0];
    const today = format(new Date(), "yyyy-MM-dd");
    if (face && repeatOf(face.session) !== "once") {
      const kind = repeatOf(face.session);
      const step = kind === "biweek" ? 14 : kind === "month" ? 28 : 7;
      const prev = format(subDays(parseISO(face.day), step), "yyyy-MM-dd");
      if (prev < today) {
        return { day: prev, startTime: face.startTime ?? "" };
      }
    }
    return { day: format(subDays(new Date(), 7), "yyyy-MM-dd"), startTime: "" };
  }

  function openAddPastToStudy(study: { name: string; key: string; next: Session | null }) {
    setStudyRetro({ name: study.name, key: study.key });
    setStudyDoneFocus(null);
    void openCreateSession({
      meetingDate: todayKey,
      startTime: study.next?.startTime ?? "",
      loggingPast: true,
      templateId: study.next?.templateId,
      title: study.name,
    });
  }

  function openLogPrevious(
    day?: string,
    startTime?: string,
    heldFrom?: { sessionId: string; day: string },
  ) {
    const suggested = previousDayForLog();
    void openCreateSession({
      meetingDate: day ?? suggested.day,
      startTime: startTime ?? (day ? "" : suggested.startTime),
      heldFrom: heldFrom ?? null,
      loggingPast: true,
    });
  }

  function logThisNight(
    day?: string,
    startTime?: string,
    held?: { sessionId: string; day: string },
  ) {
    if (!day) {
      openLogPrevious();
      return;
    }
    const source = held
      ? spaceSessions.find((session) => session.id === held.sessionId)
      : undefined;
    const key = source ? studyKey(source) : "";
    const study = key
      ? studies.current.find((item) => item.key === key)
      : undefined;
    if (study) {
      setStudyRetro({ name: study.name, key: study.key });
      setStudyDoneFocus(null);
      void openCreateSession({
        meetingDate: day,
        startTime: startTime ?? study.next?.startTime ?? "",
        heldFrom: held ?? null,
        loggingPast: true,
        templateId: study.next?.templateId ?? source?.templateId,
        title: study.name,
      });
      return;
    }
    openLogPrevious(day, startTime, held);
  }

  async function completeStudySession(session: Session) {
    if (!space || saving) return;
    const name = studyLabel(session);
    if (!name) {
      toast.error("Name the study first, such as Exodus");
      return;
    }
    const sessionDay = calendarDay(session.date);
    const occurred = sessionDay && sessionDay <= todayKey ? sessionDay : todayKey;
    const number =
      session.sessionNumber ??
      spaceSessions.filter(
        (row) => studyKey(row) === studyKey(session) && row.meetingDone,
      ).length +
        1;
    setSaving(true);
    try {
      const repeats = repeatOf(session) !== "once";
      let lookbackId = session.id;
      if (repeats) {
        const snapshot = await createSession({
          spaceId: space.id,
          date: occurred,
          startTime: session.startTime,
          weekly: false,
          templateId: session.templateId,
          title: name,
          studyName: name,
          sessionNumber: number,
          meetingDone: true,
          attendees: session.attendees,
          responses: session.responses,
          passagesStudied: session.passagesStudied ?? [],
          notes: session.notes,
          weekPassage: session.weekPassage,
          weekQuestion: session.weekQuestion,
        });
        lookbackId = snapshot.id;
        await updateSession(session.id, {
          date: nextRepeatDay(occurred, repeatOf(session)),
          title: name,
          studyName: name,
          sessionNumber: number + 1,
          meetingDone: false,
          attendees: [],
          passagesStudied: [],
          responses: {},
          notes: "",
          weekPassage: undefined,
          weekQuestion: "",
          coming: [],
        });
      } else {
        await updateSession(session.id, {
          date: occurred,
          title: name,
          studyName: name,
          sessionNumber: number,
          meetingDone: true,
        });
        await createSession({
          spaceId: space.id,
          date: nextRepeatDay(occurred, "week"),
          startTime: session.startTime,
          weekly: false,
          templateId: session.templateId,
          title: name,
          studyName: name,
          sessionNumber: number + 1,
          attendees: [],
        });
      }
      const prev = previousSessionDay(occurred, occurrenceDays);
      for (const entry of prayerEntries ?? []) {
        const day = calendarDay(entry.createdAt);
        const mine =
          entry.sessionId === session.id ||
          (!entry.sessionId &&
            Boolean(day) &&
            day <= occurred &&
            (!prev || day > prev));
        if (!mine) continue;
        await updatePrayerBoardEntry(entry.id, {
          sessionId: lookbackId,
          status: entry.status === "answered" ? "answered" : "closed",
        });
      }
      toast.success(`${name} session ${number} completed. Session ${number + 1} is next.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not complete the session");
    } finally {
      setSaving(false);
    }
  }

  async function finishStudy(name: string, key: string) {
    if (!space || saving) return;
    const rows = spaceSessions.filter((session) => studyKey(session) === key);
    setSaving(true);
    try {
      for (const row of rows) {
        await updateSession(row.id, {
          studyName: studyLabel(row) || name,
          studyDone: true,
          meetingDone: true,
        });
      }
      toast.success(`${name} is a past study`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not finish the study");
    } finally {
      setSaving(false);
    }
  }

  async function dropHeldDay(sessionId: string, day: string) {
    const session = spaceSessions.find((row) => row.id === sessionId);
    if (!session?.heldDates?.some((row) => row.date === day)) return;
    await updateSession(sessionId, {
      heldDates: session.heldDates.filter((row) => row.date !== day),
    });
  }

  async function handleSaveSession(e: FormEvent, confirmPrevious = false) {
    e.preventDefault();
    if (!space || !formValues) return;
    if (!formValues.meetingDate) {
      toast.error("Pick a meeting date");
      return;
    }
    const today = format(new Date(), "yyyy-MM-dd");
    const dateIsPast = formValues.meetingDate < today;
    const seriesRepeats = Boolean(
      activeSession &&
        !isDraftSession &&
        repeatOf(rollSession(activeSession)) !== "once",
    );
    if (dateIsPast && seriesRepeats && !confirmPrevious) {
      toast.message("That date already passed", {
        description:
          "Confirm previous date to keep this study in Past. The weekly plan stays on the next meeting.",
      });
      return;
    }
    if (!formValues.templateId) {
      toast.error("Choose a template");
      return;
    }

    const template = templates.find((t) => t.id === formValues.templateId);
    if (template && !loggingPast) {
      const missing = validateRequiredResponses(
        template,
        formValues.responses,
      );
      if (missing) {
        toast.error(`Please complete: ${missing}`);
        return;
      }
    }

    // Clamp transient empty chapter drafts (0 while typing) before persist
    const passagesStudied = formValues.passagesStudied.map((p) => ({
      ...p,
      id: p.id || crypto.randomUUID(),
      startChapter: p.startChapter >= 1 ? p.startChapter : 1,
      endChapter: p.endChapter >= 1 ? p.endChapter : 1,
      startVerse:
        p.startVerse != null && p.startVerse >= 1 ? p.startVerse : undefined,
      endVerse:
        p.endVerse != null && p.endVerse >= 1 ? p.endVerse : undefined,
      book: p.book.trim(),
    }));
    const invalidPassage = passagesStudied.find(
      (p) => !p.book || p.endChapter < p.startChapter,
    );
    if (invalidPassage) {
      toast.error("Fix passage book/range before saving");
      return;
    }

    const weekText = formValues.weekPassageText.trim();
    let weekPassage: WeekReading | null = null;
    if (weekText) {
      weekPassage = await parseWeekPassage(weekText);
      if (!weekPassage) {
        toast.error("Use a passage like John 3:16–18");
        return;
      }
    }
    const weekQuestion = formValues.weekQuestion.trim();

    // Prefer typed title; if blank, store passage suggestion so Past meetings stays clear
    const titleToSave =
      formValues.title.trim() ||
      suggestTitleFromPassages(passagesStudied) ||
      undefined;

    if (
      loggingPast &&
      !formValues.title.trim() &&
      formValues.passagesStudied.every((row) => !row.book.trim())
    ) {
      toast.error("Add the passages or a short recap");
      return;
    }
    if (studyRetro && formValues.meetingDate > today) {
      toast.error("A completed session is today or a day that already happened");
      return;
    }
    const wasPast = loggingPast;
    const forceOnce =
      loggingPast ||
      confirmPrevious ||
      (dateIsPast && !seriesRepeats && formValues.repeat !== "once");
    const repeat = forceOnce ? "once" : formValues.repeat;
    const keepSeries = confirmPrevious && seriesRepeats;

    setSaving(true);
    try {
      let savedId: string | null = null;
      if (activeSession && keepSeries) {
        const created = await createSession({
          spaceId: space.id,
          date: formValues.meetingDate,
          startTime: formValues.startTime,
          weekly: false,
          templateId: formValues.templateId,
          title: titleToSave,
          attendees: formValues.attendees,
          responses: formValues.responses,
          passagesStudied,
          notes: formValues.notes,
          weekPassage: weekPassage ?? undefined,
          weekQuestion: weekQuestion || undefined,
        });
        await dropHeldDay(activeSession.id, formValues.meetingDate);
        setActiveSession(wasPast ? null : created);
        setIsDraftSession(false);
        setHeldLog(null);
        setLoggingPast(false);
        setFormValues(null);
        setSessionPanelTab("session");
        setSessionMode(wasPast ? null : "view");
        toast.success(wasPast ? "Past session saved" : "Previous date saved");
        if (wasPast || confirmPrevious) {
          void offerMarkTheseStudied(space.id, passagesStudied);
        }
        savedId = wasPast ? null : created.id;
      } else if (activeSession) {
        const updated = await updateSession(activeSession.id, {
          date: formValues.meetingDate,
          startTime: formValues.startTime,
          weekly: repeat === "week",
          repeat: repeat === "once" ? undefined : repeat,
          repeatDay:
            repeat === "month"
              ? Number(formValues.meetingDate.slice(8, 10))
              : undefined,
          templateId: formValues.templateId,
          title: titleToSave ?? "",
          attendees: formValues.attendees,
          responses: formValues.responses,
          passagesStudied,
          notes: formValues.notes,
          weekPassage: weekPassage ?? undefined,
          weekQuestion: weekQuestion || undefined,
        });
        if (heldLog && formValues.meetingDate === heldLog.day) {
          await dropHeldDay(heldLog.sessionId, heldLog.day);
        }
        let retroNote = "";
        if (studyRetro && wasPast) {
          const number =
            spaceSessions.filter(
              (row) =>
                studyKey(row) === studyRetro.key &&
                row.meetingDone &&
                row.id !== updated.id,
            ).length + 1;
          await updateSession(updated.id, {
            studyName: studyRetro.name,
            meetingDone: true,
            sessionNumber: number,
            title: titleToSave || studyRetro.name,
            weekly: false,
            repeat: undefined,
          });
          const open = spaceSessions.find(
            (row) =>
              studyKey(row) === studyRetro.key &&
              !row.meetingDone &&
              row.id !== updated.id,
          );
          if (open && (open.sessionNumber ?? 0) <= number) {
            await updateSession(open.id, {
              studyName: studyRetro.name,
              sessionNumber: number + 1,
            });
          }
          setStudyDoneFocus(studyRetro.key);
          retroNote = `${studyRetro.name} session ${number} added under Completed`;
        }
        setHeldLog(null);
        setLoggingPast(false);
        setStudyRetro(null);
        setFormValues(null);
        setActiveSession(wasPast ? null : updated);
        setIsDraftSession(false);
        setSessionMode(wasPast ? null : "view");
        toast.success(
          retroNote
            ? retroNote
            : wasPast
            ? "Past session saved"
            : confirmPrevious
              ? "Previous date saved"
              : isDraftSession
                ? "Session saved"
                : "Session updated",
        );
        if (wasPast || confirmPrevious) {
          void offerMarkTheseStudied(space.id, passagesStudied);
        }
        setSessionPanelTab("session");
        savedId = wasPast ? null : updated.id;
      } else {
        // Fallback if draft creation was skipped
        const created = await createSession({
          spaceId: space.id,
          date: formValues.meetingDate,
          startTime: formValues.startTime,
          weekly: repeat === "week",
          repeat: repeat === "once" ? undefined : repeat,
          repeatDay:
            repeat === "month"
              ? Number(formValues.meetingDate.slice(8, 10))
              : undefined,
          templateId: formValues.templateId,
          title: titleToSave,
          attendees: formValues.attendees,
          responses: formValues.responses,
          passagesStudied,
          notes: formValues.notes,
          weekPassage: weekPassage ?? undefined,
          weekQuestion: weekQuestion || undefined,
        });
        setActiveSession(created);
        setIsDraftSession(false);
        setFormValues(null);
        setSessionPanelTab("session");
        setSessionMode("view");
        toast.success("Session saved");
        savedId = created.id;
      }
      if (savedId && gather.active) {
        setGather((g) =>
          g.active
            ? {
                ...g,
                sessionId: savedId,
                done: { ...g.done, meet: true },
              }
            : g,
        );
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save session",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSession() {
    if (!activeSession) return;
    setSaving(true);
    try {
      await deleteSession(activeSession.id);
      toast.success("Session deleted");
      setDeleteSessionOpen(false);
      closeSessionModal();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not delete session",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSpace() {
    if (!space) return;
    setSaving(true);
    try {
      await deleteSpace(space.id);
      toast.success("Space deleted");
      navigate("/studies", { replace: true });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not delete space",
      );
      setSaving(false);
    }
  }

  async function handleChangeSpaceTemplate() {
    if (!space) return;
    setSaving(true);
    try {
      await switchMode(draftSpaceTemplate);
      setTemplateChangeOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (notFound) {
    return (
      <div className="space-y-4">
        <NavBreadcrumb
          items={[{ label: "Studies", to: "/studies" }, { label: "Not found" }]}
        />
        <Card>
          <p className="text-muted">This group was not found on this device.</p>
          <Button className="mt-4" variant="secondary" onClick={() => navigate("/studies")}>
            Back to groups
          </Button>
        </Card>
      </div>
    );
  }

  if (loading || !space) {
    return (
      <div className="space-y-4">
        <NavBreadcrumb
          items={[{ label: "Studies", to: "/studies" }, { label: "Loading…" }]}
        />
        <p className="text-sm text-muted">Loading group…</p>
      </div>
    );
  }

  const viewTemplate = activeSession
    ? templates.find((t) => t.id === activeSession.templateId)
    : undefined;
  /** Prefer form template while editing so Private sections match the live form. */
  const liveSessionTemplate =
    formValues != null
      ? templates.find((t) => t.id === formValues.templateId) ?? viewTemplate
      : viewTemplate;

  const sessionModalTitle =
    sessionMode === "create"
      ? "Start new session"
      : sessionMode === "edit"
        ? isDraftSession
          ? loggingPast
            ? studyRetro
              ? `Add to ${studyRetro.name}`
              : "Log a past session"
            : formValues?.title?.trim() ||
            liveSessionTemplate?.name ||
            "New session"
          : formValues?.title?.trim()
            ? `Edit · ${formValues.title.trim()}`
            : "Edit session"
        : sessionMode === "view" && activeSession
          ? sessionDisplayTitle(activeSession, viewTemplate)
          : sessionMode === "view"
            ? "Session"
            : "";

  const maxPeople = maxMembersForSpace(space.spaceKind);
  const peopleCount = space.members.length;
  const isHost = isSpaceHost(space.sync);
  const isGuest = isSpaceGuest(space.sync);
  const spaceSync = normalizeSpaceSync(space.sync);
  const guestLinked =
    isGuest &&
    spaceSync.mode === "connected" &&
    Boolean(spaceSync.roomId);
  const canAddPeople = peopleCount < maxPeople;
  const latestSession = spaceSessions[0];
  const needsRoomOpen =
    isHost &&
    (spaceSync.mode !== "connected" || !spaceSync.roomId);
  const linkStatus = getGroupLinkStatus(spaceSync, onlineMode);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <NavBreadcrumb
          items={[
            { label: "Studies", to: "/studies" },
            { label: space.name },
          ]}
        />
      </div>

      {isGuest && !guestLinked && (
        <section
          className="rounded-2xl border-2 border-primary/40 bg-primary/10 px-3 py-3.5 space-y-2.5 shadow-sm"
          aria-label="Link this group"
        >
          <div className="flex items-start gap-2.5">
            <RefreshCw
              className="h-5 w-5 shrink-0 text-primary mt-0.5"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-primary leading-tight">
                Link with host’s room key
              </p>
              <p className="text-xs text-muted mt-0.5 leading-relaxed">
                Open the Group tab, then Group sharing, and re-join with the
                host’s key. Then Sync anytime.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-border/80 bg-bg/70">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left touch-manipulation"
              aria-expanded={hostRestoreOpen}
              onClick={() => setHostRestoreOpen((v) => !v)}
            >
              <span className="text-xs font-semibold text-muted">
                Having trouble?
              </span>
              <ChevronDown
                className={[
                  "h-4 w-4 text-muted transition-transform",
                  hostRestoreOpen ? "rotate-180" : "",
                ].join(" ")}
                aria-hidden
              />
            </button>
            {hostRestoreOpen && (
              <div className="px-3 pb-3 space-y-2 border-t border-border/60 pt-2">
                <p className="text-[11px] text-muted leading-relaxed">
                  Only if <em>you</em> created this group or restored your own
                  backup on this phone.
                </p>
                <Button
                  fullWidth
                  variant="secondary"
                  className="!py-2.5 text-sm"
                  disabled={claimingHost}
                  onClick={() => {
                    if (!space) return;
                    if (
                      !window.confirm(
                        "Restore host controls on this phone?\n\nOnly continue if you created this group or restored your backup. Guests should Join with the host’s room key instead.",
                      )
                    ) {
                      return;
                    }
                    setClaimingHost(true);
                    void claimSpaceHostRole(space.id)
                      .then(() => {
                        toast.success("Host controls restored on this phone", {
                          description:
                            "You can edit the list, invite, and Open group room.",
                          duration: 8000,
                        });
                      })
                      .catch((err) =>
                        toast.error(
                          err instanceof Error
                            ? err.message
                            : "Could not restore host role",
                        ),
                      )
                      .finally(() => setClaimingHost(false));
                  }}
                >
                  {claimingHost
                    ? "Restoring…"
                    : "I created this group — restore host"}
                </Button>
              </div>
            )}
          </div>
        </section>
      )}

      <GroupTabs tab={groupTab} onChange={selectGroupTab} />

      {gather.active ? (
        <GatherRitualBar
          gather={gather}
          sessionHint={
            gather.sessionId
              ? (() => {
                  const s =
                    spaceSessions.find((x) => x.id === gather.sessionId) ??
                    (activeSession?.id === gather.sessionId
                      ? activeSession
                      : null);
                  if (!s) return null;
                  const tpl = templates.find((t) => t.id === s.templateId);
                  return sessionDisplayTitle(s, tpl);
                })()
              : null
          }
          busy={saving}
          onSelectStep={goGatherStep}
          onPrimary={() => void runGatherPrimary()}
          onAdvance={advanceGather}
          onEnd={endGather}
        />
      ) : null}

      {groupTab === "tonight" && (
        <TonightPanel
          space={space}
          isGuest={isGuest}
          nextNight={nextNight}
          showGather={!(isPersonalStudy(space) && !nextNight)}
          gatherActive={gather.active}
          saving={saving}
          hasSession={Boolean(latestSession || activeSession)}
          prayerCount={
            typeof prayerBoardCount === "number" ? prayerBoardCount : undefined
          }
          people={
            <PeopleRow
              members={space.members}
              canAdd={canAddPeople}
              onAdd={openAddPerson}
              onRemove={(memberId) => void removePerson(memberId)}
              onShare={
                isHost && !needsRoomOpen
                  ? () => setInviteOpen(true)
                  : undefined
              }
              adding={
                quickAddOpen && canAddPeople ? (
                  <AddPersonForm
                    onCancel={() => setQuickAddOpen(false)}
                    onSave={async (name) => {
                      try {
                        await saveAddedPerson(name);
                      } catch (err) {
                        toast.error(
                          err instanceof Error
                            ? err.message
                            : "Could not add person",
                        );
                        throw err;
                      }
                    }}
                  />
                ) : null
              }
            />
          }
          onOpenRead={() => setActiveStudy(space.id)}
          onEditStudied={() => setEditStudiedOpen(true)}
          onEditWhatsNext={() => setWhatsNextOpen(true)}
          onOpenNight={() => {
            if (!nextNight) return;
            openViewSession(nextNight.session, nextNight.day);
          }}
          onPlan={planMeeting}
          onGather={() => void beginGather()}
          onStudy={() => openBibleForSpace()}
          onPrayer={() => selectGroupTab("prayer")}
          onPrivate={openSpacePrivateNotes}
          showOfflineNote={linkStatus.kind === "offline"}
          sharingError={Boolean(spaceSync.lastError)}
          onOpenSharing={() => {
            setSharingOpen(true);
            selectGroupTab("group");
          }}
        />
      )}

      {groupTab === "meetings" && (
        <MeetingsPanel
          spaceId={space.id}
          spaceName={space.name}
          colorHue={space.colorHue}
          sessions={spaceSessions}
          savedDates={space.savedDates ?? []}
          onRemoveDate={removeGroupDate}
          focusDay={focusDay}
          studies={studies}
          saving={saving}
          onOpenSession={(session, day) => openViewSession(session, day)}
          onCompleteSession={(session) => void completeStudySession(session)}
          onAddPast={openAddPastToStudy}
          onFinishStudy={(study) => void finishStudy(study.name, study.key)}
          focusDoneKey={studyDoneFocus}
          showLoose={
            looseSessions.length > 0 ||
            (studies.current.length === 0 && studies.past.length === 0)
          }
          todayMeetings={todayMeetings}
          laterMeetings={laterMeetings}
          visiblePast={visiblePast}
          pastCount={pastMeetings.length}
          hiddenPastCount={
            hasMorePast ? meetingLists.past.length - sessionVisible : 0
          }
          onLoadMore={() => setSessionVisible((n) => n + SESSION_PAGE_SIZE)}
          filteredEmpty={
            spaceSessions.length > 0 && filteredSessions.length === 0
          }
          noMeetings={laterMeetings.length === 0 && todayMeetings.length === 0}
          onShowAll={() => void switchMode("all")}
          onPlan={() => void openCreateSession()}
          onPlanDay={planThisDay}
          onLogPrevious={logThisNight}
          templates={templates}
          place={space.place}
          isHost={isHost}
          members={space.members}
          onMark={(session, memberId, name, mark) => {
            const current = session.coming ?? [];
            const without = current.filter((row) => row.memberId !== memberId);
            const already = current.find((row) => row.memberId === memberId);
            const coming =
              already?.mark === mark
                ? without
                : [...without, { memberId, name, mark }];
            void updateSession(session.id, { coming });
          }}
          onRemoveHeld={removeWeekdayMark}
          onRemoveCopy={removeCopy}
        />
      )}

      {groupTab === "prayer" && (
        <PrayerPanel
          spaceId={space.id}
          members={space.members}
          focusSessionId={prayerFocusId}
        />
      )}

      {groupTab === "group" && (
        <GroupPanel
          space={space}
          isGuest={isGuest}
          isHost={isHost}
          allowDelete={!isPersonalStudy(space)}
          onlineMode={onlineMode}
          sharingOpen={sharingOpen}
          onToggleSharing={() => setSharingOpen((open) => !open)}
          moreOpen={moreOpen}
          onToggleMore={() => setMoreOpen((open) => !open)}
          viewMode={viewMode}
          onSwitchMode={(mode) => void switchMode(mode)}
          modeCounts={modeCounts}
          sessionCount={spaceSessions.length}
          passageCount={passageCount}
          renaming={renamingTitle}
          onStartRename={startRename}
          onSaveName={async (name) => {
            try {
              await saveInlineName(name);
            } catch (err) {
              toast.error(
                err instanceof Error ? err.message : "Could not update space",
              );
              throw err;
            }
          }}
          onCancelRename={() => {
            setRenamingTitle(false);
            window.requestAnimationFrame(() => {
              document.getElementById("group-rename-button")?.focus();
            });
          }}
          onEditDetails={openEdit}
          onAboutStyles={openChangeTemplate}
          onDelete={() => setDeleteOpen(true)}
          sharingStartsOpen={needsRoomOpen || Boolean(spaceSync.lastError)}
          people={
            <PeopleRow
              members={space.members}
              canAdd={canAddPeople}
              onAdd={openAddPerson}
              onRemove={(memberId) => void removePerson(memberId)}
              onEdit={isHost ? openMembers : undefined}
              onShare={
                isHost && !needsRoomOpen
                  ? () => setInviteOpen(true)
                  : undefined
              }
              adding={
                quickAddOpen && canAddPeople ? (
                  <AddPersonForm
                    onCancel={() => setQuickAddOpen(false)}
                    onSave={async (name) => {
                      try {
                        await saveAddedPerson(name);
                      } catch (err) {
                        toast.error(
                          err instanceof Error
                            ? err.message
                            : "Could not add person",
                        );
                        throw err;
                      }
                    }}
                  />
                ) : null
              }
            />
          }
          onBackup={() => navigate("/settings")}
        />
      )}

      {/* Edit space */}
      <Modal
        open={editOpen}
        title="Rename"
        onClose={() => !saving && setEditOpen(false)}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Name</span>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
              maxLength={80}
              required
              autoFocus
              placeholder="Wednesday Bible Study"
            />
            <span className="block text-xs text-muted">
              For example, Wednesday Bible Study or Friday Discipleship.
            </span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Description (optional)</span>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base min-h-[72px] resize-y"
              maxLength={280}
              placeholder="What is this group about?"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Place (optional)</span>
            <input
              value={editPlace}
              onChange={(e) => setEditPlace(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
              maxLength={60}
              placeholder="Room 2"
            />
          </label>
          <div className="rounded-xl border border-border bg-surface-muted/40 px-3 py-3 space-y-2">
            <p className="text-sm font-medium">
              Active mode: {getSpaceTemplateMeta(space.spaceTemplate).name}
            </p>
            <p className="text-xs text-muted">
              Modes live inside this Space. Switch Custom / Guided / Advanced /
              Freeform from the Mode strip — all session history stays here.
            </p>
            <Button
              type="button"
              variant="secondary"
              className="!py-2.5"
              onClick={() => {
                setEditOpen(false);
                openChangeTemplate();
              }}
            >
              <Layers className="h-4 w-4" aria-hidden />
              Switch mode
            </Button>
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => setEditOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" fullWidth disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Switch living-space mode (detail) */}
      <Modal
        open={templateChangeOpen}
        title="Space modes"
        onClose={() => !saving && setTemplateChangeOpen(false)}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted -mt-1">
            This is one living Space. Modes are lenses — not separate Spaces.
            Switch freely; every session (Custom, Guided, Advanced, Freeform)
            stays in this container for your{" "}
            {spaceKindLabel(space.spaceKind).toLowerCase()}.
          </p>
          <ul className="space-y-2">
            {SPACE_TEMPLATES.map((tpl) => {
              const selected = draftSpaceTemplate === tpl.id;
              const count = modeCounts[tpl.id];
              return (
                <li key={tpl.id}>
                  <label
                    className={[
                      "flex items-start gap-3 rounded-xl border px-3 py-3 touch-manipulation cursor-pointer",
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-bg",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="change-space-template"
                      checked={selected}
                      onChange={() => setDraftSpaceTemplate(tpl.id)}
                      className="mt-1 h-4 w-4 accent-primary"
                      disabled={saving}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-primary block">
                        {tpl.name}
                        {count > 0 ? (
                          <span className="ml-1.5 text-xs font-normal text-muted tabular-nums">
                            · {count} session{count === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-xs text-muted block mt-0.5">
                        {tpl.description}
                      </span>
                      <span className="text-[11px] text-primary/80 block mt-1">
                        New sessions: {tpl.firstSessionLabel}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => setTemplateChangeOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              fullWidth
              disabled={saving}
              onClick={() => void handleChangeSpaceTemplate()}
            >
              {saving ? "Saving…" : "Switch mode"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Who’s here — full list editor */}
      <Modal
        open={membersOpen}
        title="Who’s here"
        onClose={() => !saving && setMembersOpen(false)}
      >
        <form onSubmit={handleSaveMembers} className="space-y-4">
          <p className="text-sm text-muted -mt-1">
            Add or rename people. A study holds up to {maxMembersForSpace()} people.
          </p>
          <MemberEditor
            members={draftMembers}
            onChange={setDraftMembers}
            showJoinedDates
            disabled={saving}
            maxMembers={maxMembersForSpace(space.spaceKind)}
            kindLabel={spaceKindLabel(space.spaceKind)}
          />
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => setMembersOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" fullWidth disabled={saving}>
              {saving ? "Saving…" : "Save people"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Session create / edit / view — Session | Private tabs + slide-over */}
      <Modal
        open={sessionMode !== null}
        title={sessionModalTitle}
        onClose={() => {
          if (sessionPanelTab === "private") {
            closeSessionPrivateDrawer();
            return;
          }
          void closeSessionModal();
        }}
        containBody
        nestedScroll
        tabs={
          loggingPast
            ? undefined
            : [
                { id: "session", label: "Session" },
                {
                  id: "private",
                  label: "Private",
                  badge: sessionPrivateCount,
                },
              ]
        }
        activeTab={sessionPanelTab}
        onTabChange={(id) => {
          if (id === "private") {
            openSessionPrivateDrawer();
          } else {
            closeSessionPrivateDrawer();
          }
        }}
        footer={
          sessionPanelTab === "private" ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={closeSessionPrivateDrawer}
              >
                Back to session
              </Button>
              <Button
                type="button"
                fullWidth
                onClick={() => void closeSessionModal()}
              >
                Done
              </Button>
            </div>
          ) : sessionMode === "view" ? (
            <Button
              type="button"
              fullWidth
              onClick={() => void closeSessionModal()}
            >
              Done
            </Button>
          ) : null
        }
      >
        {/*
          Keep both panes mounted so scroll position is preserved when flipping
          Session ↔ Private. Wrapper must have a real height — absolute panes
          contribute 0 to parent flow height (see Modal containBody).
        */}
        <div className="relative h-full min-h-0 w-full">
          <div
            ref={sessionScrollRef}
            className={[
              "absolute inset-0 overscroll-contain pb-1 pr-0.5 touch-pan-y",
              sessionPanelTab === "session"
                ? "z-[1] overflow-y-auto"
                : "invisible pointer-events-none z-0 overflow-hidden",
            ].join(" ")}
            aria-hidden={sessionPanelTab !== "session"}
          >
            {sessionMode === "edit" && formValues && activeSession && (
              <SessionForm
                mode={isDraftSession ? "create" : "edit"}
                members={space.members}
                templates={templates}
                values={formValues}
                onChange={setFormValues}
                variant={loggingPast ? "past" : "full"}
                onSubmit={(event) => void handleSaveSession(event, loggingPast)}
                onConfirmPrevious={() => {
                  void handleSaveSession(
                    { preventDefault() {} } as FormEvent,
                    true,
                  );
                }}
                onCancel={
                  isDraftSession
                    ? () => void closeSessionModal()
                    : () => {
                        setFormValues(null);
                        setSessionMode("view");
                        setSessionPanelTab("session");
                      }
                }
                saving={saving}
                lockTemplate={!isDraftSession}
                onManageMembers={() => {
                  void closeSessionModal();
                  openMembers();
                }}
                spaceId={space.id}
                sessionId={activeSession.id}
                prayerScope={prayerScope}
                pastHint={
                  studyRetro
                    ? `This night stays in ${studyRetro.name} under Completed. The upcoming session stays next.`
                    : undefined
                }
                onOpenBible={() => void openBibleFromForm()}
                onOpenPrivateNotes={(sectionKey) =>
                  openSessionPrivateDrawer(sectionKey)
                }
                privateNoteCount={sessionPrivateCount}
              />
            )}

            {sessionMode === "view" && activeSession && (
              <SessionView
                session={activeSession}
                template={viewTemplate}
                members={space.members}
                spaceId={space.id}
                prayerScope={prayerScope}
                onEdit={() => openEditSession(activeSession)}
                onCompleteSession={
                  activeSession &&
                  isNamedPlan(activeSession) &&
                  !activeSession.meetingDone &&
                  !activeSession.studyDone
                    ? () => void completeStudySession(activeSession)
                    : undefined
                }
                onDelete={() => setDeleteSessionOpen(true)}
                onClose={() => void closeSessionModal()}
                onOpenBible={() => openBibleForSpace(activeSession.id)}
                onRemovePassage={(passage, index) =>
                  void removeViewedPassage(passage, index)
                }
                removingPassage={saving}
                onOpenPrivateNotes={(sectionKey) =>
                  openSessionPrivateDrawer(sectionKey)
                }
                privateNoteCount={sessionPrivateCount}
              />
            )}

            {sessionMode === "edit" && (!formValues || !activeSession) && (
              <p className="text-sm text-muted py-8 text-center">
                {saving ? "Starting session…" : "Loading session…"}
              </p>
            )}
            {sessionMode === "view" && !activeSession && (
              <p className="text-sm text-muted py-8 text-center">
                Session not found.
              </p>
            )}
          </div>

          <div
            className={[
              "absolute inset-0 overscroll-contain pb-1 pr-0.5 touch-pan-y",
              sessionPanelTab === "private"
                ? "z-[1] overflow-y-auto"
                : "invisible pointer-events-none z-0 overflow-hidden",
            ].join(" ")}
            aria-hidden={sessionPanelTab !== "private"}
          >
            <SessionPrivateDrawer
              open={sessionMode !== null}
              onClose={closeSessionPrivateDrawer}
              spaceId={space.id}
              sessionId={activeSession?.id}
              template={liveSessionTemplate}
              lockedSectionKey={lockedSectionKey || SECTION_GENERAL}
              needsSave={!activeSession}
            />
          </div>
        </div>
      </Modal>

      <PrivateNotesModal
        open={privateNotesOpen}
        onClose={() => setPrivateNotesOpen(false)}
        spaceId={space.id}
        title="Private space notes"
        description='Space-level private log — e.g. "Prayed for John today." Timestamps help you check back and witness answers. Never exported.'
      />

      {/* Delete session confirm */}
      <Modal
        open={deleteSessionOpen}
        title="Delete this session?"
        onClose={() => !saving && setDeleteSessionOpen(false)}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            This removes the session and its notes from this device. This cannot
            be undone.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => setDeleteSessionOpen(false)}
              disabled={saving}
            >
              Keep session
            </Button>
            <Button
              type="button"
              variant="danger"
              fullWidth
              onClick={() => void handleDeleteSession()}
              disabled={saving}
            >
              {saving ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>

      <InviteModal
        open={inviteOpen}
        spaceId={space.id}
        onClose={() => setInviteOpen(false)}
      />
      {/* Delete space */}
      <Modal
        open={deleteOpen}
        title="Delete this space?"
        onClose={() => !saving && setDeleteOpen(false)}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            This permanently removes{" "}
            <strong className="text-text">{space.name}</strong>, its sessions,
            and related private notes on this device. This cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => setDeleteOpen(false)}
              disabled={saving}
            >
              Keep space
            </Button>
            <Button
              type="button"
              variant="danger"
              fullWidth
              onClick={() => void handleDeleteSpace()}
              disabled={saving}
            >
              {saving ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>

      <EditStudied
        open={editStudiedOpen}
        onClose={() => setEditStudiedOpen(false)}
        spaceId={space.id}
        studyName={space.name}
        initialBookId={space.readingPlace?.bookId}
      />
      <EditWhatsNext
        open={whatsNextOpen}
        onClose={() => setWhatsNextOpen(false)}
        spaceId={space.id}
        studyName={space.name}
        initialBookId={space.readingPlace?.bookId}
        aim={space.studyAim}
      />
    </div>
  );
}

function toDateInputValue(iso: string): string {
  try {
    return format(parseISO(iso), "yyyy-MM-dd");
  } catch {
    return iso.slice(0, 10);
  }
}
