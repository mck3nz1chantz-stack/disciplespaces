import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { format, parseISO, subDays } from "date-fns";
import {
  BookOpen,
  CalendarPlus,
  ChevronDown,
  ChevronRight,
  HandHeart,
  Layers,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Share2,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { MemberEditor } from "../components/MemberEditor";
import { InviteModal } from "../components/InviteModal";
import { YourDataBundle } from "../components/YourDataBundle";
import { SpaceConnectionBar } from "../components/SpaceConnectionBar";
import { GroupShareActions } from "../components/GroupShareActions";
import { PrayerBoard } from "../components/PrayerBoard";
import { PrivateNotesModal } from "../components/PrivateNotesModal";
import { SessionPrivateDrawer } from "../components/SessionPrivateDrawer";
import {
  SessionForm,
  buildSessionFormValues,
  type SessionFormValues,
} from "../components/SessionForm";
import { SessionView } from "../components/SessionView";
import {
  countFilledSteps,
  sessionPreview,
  validateRequiredResponses,
} from "../lib/sessionResponses";
import {
  sessionDisplayTitle,
  sessionTitleSubtitle,
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
import type { ComingMark, Member, Session, SpaceKind, Template, WeekReading } from "../types";
import { formatPassageRef, formatWeekReading, parseWeekPassage } from "../lib/passages";
import { MonthCalendar } from "../components/MonthCalendar";
import {
  maxMembersForSpace,
  normalizeSpaceKind,
  PRIVATE_SECTION,
  spaceKindLabel,
} from "../types";
import { useAppStore } from "../stores/useAppStore";
import {
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
import { GroupLinkBadge } from "../components/GroupLinkBadge";
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
  comingForFace,
  formatMeetingWhen,
  repeatLabel,
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
  const syncSpaceNow = useAppStore((s) => s.syncSpaceNow);
  const createSession = useAppStore((s) => s.createSession);
  const updateSession = useAppStore((s) => s.updateSession);
  const deleteSession = useAppStore((s) => s.deleteSession);
  const claimSpaceHostRole = useAppStore((s) => s.claimSpaceHostRole);
  const { mode: onlineMode } = useOnlineMode();
  const [hostRestoreOpen, setHostRestoreOpen] = useState(false);

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
  const [deleteSessionOpen, setDeleteSessionOpen] = useState(false);

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPlace, setEditPlace] = useState("");
  const [draftSpaceKind, setDraftSpaceKind] = useState<SpaceKind>("group");
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
  const [prayerBoardOpen, setPrayerBoardOpen] = useState(false);
  /** Collapsed power tools: modes, file share, connect/sync */
  const [moreOpen, setMoreOpen] = useState(false);
  /** Bumped by jump chips to expand Group pulse Sharing tools. */
  const [syncExpandSignal, setSyncExpandSignal] = useState(0);
  /** Gather ritual: Meet → Study → Prayer (in-flow under hero). */
  const [gather, setGather] = useState<GatherState>(EMPTY_GATHER);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickAdding, setQuickAdding] = useState(false);
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

  useEffect(() => {
    if (templates.length === 0) void loadTemplates();
  }, [templates.length, loadTemplates]);

  useEffect(() => {
    setSessionVisible(SESSION_PAGE_SIZE);
  }, [id]);

  // Restore gather ritual when re-entering this group (e.g. back from Bible).
  // Gate saves until hydrated so the empty initial state never wipes storage.
  const gatherHydratedRef = useRef(false);
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

  // Quick Start / Next-up → open create, invite, or prayer when routed with state
  useEffect(() => {
    const state = location.state as {
      openCreateSession?: boolean;
      openInvite?: boolean;
      openPrayer?: boolean;
    } | null;
    if (!space || !state) return;
    if (state.openCreateSession) {
      void openCreateSession();
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }
    if (state.openInvite) {
      setInviteOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }
    if (state.openPrayer) {
      setPrayerBoardOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when landing with flag
  }, [space?.id, location.state]);

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

  const passageCount = useMemo(
    () =>
      filteredSessions.reduce(
        (n, s) => n + (s.passagesStudied?.length ?? 0),
        0,
      ),
    [filteredSessions],
  );

  const meetingLists = useMemo(
    () => splitMeetings(filteredSessions),
    [filteredSessions],
  );
  const visiblePast = meetingLists.past.slice(0, sessionVisible);
  const hasMorePast = meetingLists.past.length > sessionVisible;

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
    setDraftSpaceKind(normalizeSpaceKind(space.spaceKind));
    setEditOpen(true);
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
      toast.message("Only the host manages who’s here", {
        description:
          "Ask the host to add or remove people, then tap Sync to refresh.",
      });
      return;
    }
    setDraftMembers(space.members.map((m) => ({ ...m })));
    setMembersOpen(true);
  }

  async function handleQuickAdd(e?: FormEvent) {
    e?.preventDefault();
    if (!space || !id) return;
    if (isSpaceGuest(space.sync)) {
      toast.error("Only the host can add people to this group");
      return;
    }
    const name = quickName.trim();
    if (!name) {
      toast.error("Enter a name");
      return;
    }
    setQuickAdding(true);
    try {
      await addMember(id, name);
      setQuickName("");
      setQuickAddOpen(false);
      toast.success(`${name} added`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add person");
    } finally {
      setQuickAdding(false);
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
        preferredTemplateId: templateId,
        templateId,
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
      setPrayerBoardOpen(true);
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

  function openViewSession(session: Session) {
    setActiveSession(session);
    setIsDraftSession(false);
    setSessionPanelTab("session");
    const tpl = templates.find((t) => t.id === session.templateId);
    setLockedSectionKey(tpl?.steps[0]?.id ?? PRIVATE_SECTION.notes);
    setSessionMode("view");
  }

  function openEditSession(session?: Session | null) {
    const s = session ?? activeSession;
    if (!space || !s) return;
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
    setFormValues(null);
    setSessionPanelTab("session");
    setLockedSectionKey(PRIVATE_SECTION.notes);
    setIsDraftSession(false);
    setLoggingPast(false);

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
        spaceKind: draftSpaceKind,
      });
      toast.success("Space updated");
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
        setHeldLog(null);
        setLoggingPast(false);
        setFormValues(null);
        setActiveSession(wasPast ? null : updated);
        setIsDraftSession(false);
        setSessionMode(wasPast ? null : "view");
        toast.success(
          wasPast
            ? "Past session saved"
            : confirmPrevious
              ? "Previous date saved"
              : isDraftSession
                ? "Session saved"
                : "Session updated",
        );
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
      navigate("/", { replace: true });
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
          items={[{ label: "Groups", to: "/" }, { label: "Not found" }]}
        />
        <Card>
          <p className="text-muted">This group was not found on this device.</p>
          <Button className="mt-4" variant="secondary" onClick={() => navigate("/")}>
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
          items={[{ label: "Groups", to: "/" }, { label: "Loading…" }]}
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
            ? "Log a past session"
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
  const canAddPeople = isHost && peopleCount < maxPeople;
  const latestSession = spaceSessions[0];
  const needsRoomOpen =
    isHost &&
    (spaceSync.mode !== "connected" || !spaceSync.roomId);
  const linkStatus = getGroupLinkStatus(spaceSync, onlineMode);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <NavBreadcrumb
          className="flex-1"
          items={[
            { label: "Groups", to: "/" },
            { label: space.name },
          ]}
        />
        <div className="flex items-center gap-1 shrink-0">
          {isHost && (
            <Button
              variant="ghost"
              className="!p-2"
              onClick={openEdit}
              aria-label="Edit group"
            >
              <Pencil className="h-5 w-5" aria-hidden />
            </Button>
          )}
          <Button
            variant="ghost"
            className="!p-2 text-danger"
            onClick={() => setDeleteOpen(true)}
            aria-label={isGuest ? "Remove group from this device" : "Delete group"}
          >
            <Trash2 className="h-5 w-5" aria-hidden />
          </Button>
        </div>
      </div>

      {/* Hero — sanctuary group surface + primary gather CTA (not sticky vs nav) */}
      <Card
        padding="lg"
        className="border-primary/15 space-y-3"
        aria-label="Group overview"
      >
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
            {spaceKindLabel(space.spaceKind)}
            {isGuest ? " · Guest on this phone" : " · Your group"}
          </p>
          <h2 className="text-2xl sm:text-3xl leading-tight tracking-tight">
            {space.name}
          </h2>
          {space.description ? (
            <p className="text-sm text-muted line-clamp-2">{space.description}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 text-xs items-center">
          <span className="inline-flex items-center rounded-full border border-border bg-bg/80 px-2.5 py-1 font-medium text-primary tabular-nums">
            {peopleCount === 0
              ? "No one listed yet"
              : `${peopleCount} of ${maxPeople} people`}
          </span>
          {spaceSessions.length > 0 && (
            <span className="inline-flex items-center rounded-full border border-border bg-bg/80 px-2.5 py-1 text-muted tabular-nums">
              {spaceSessions.length} meeting
              {spaceSessions.length === 1 ? "" : "s"}
            </span>
          )}
          {typeof prayerBoardCount === "number" && prayerBoardCount > 0 && (
            <button
              type="button"
              onClick={() => setPrayerBoardOpen(true)}
              className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 font-medium text-primary touch-manipulation"
            >
              {prayerBoardCount} prayer
              {prayerBoardCount === 1 ? "" : "s"}
            </button>
          )}
          <GroupLinkBadge
            sync={space.sync}
            onlineMode={onlineMode}
            size="md"
          />
        </div>
      </Card>

      {meetingLists.upcoming[0] && (
        <Card className="border-primary/30 bg-primary/5 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Next meeting
          </p>
          <button
            type="button"
            onClick={() => openViewSession(meetingLists.upcoming[0].session)}
            className="block w-full text-left touch-manipulation"
          >
            <p className="text-base font-medium text-primary">
              {formatMeetingWhen(
                meetingLists.upcoming[0].day,
                meetingLists.upcoming[0].startTime,
              )}
              {repeatLabel(meetingLists.upcoming[0].session)
                ? ` · ${repeatLabel(meetingLists.upcoming[0].session)}`
                : ""}
            </p>
            {space.place ? (
              <p className="text-sm text-primary mt-0.5">{space.place}</p>
            ) : null}
          </button>
          {meetingLists.upcoming[0].session.weekPassage ? (
            <p className="text-sm">
              <Link
                to={(() => {
                  const week = meetingLists.upcoming[0].session.weekPassage!;
                  const params = new URLSearchParams({
                    b: week.bookId,
                    c: String(week.chapter),
                  });
                  if (week.startVerse) {
                    params.set("sv", String(week.startVerse));
                    params.set(
                      "ev",
                      String(week.endVerse ?? week.startVerse),
                    );
                  }
                  return `/bible?${params.toString()}`;
                })()}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                {formatWeekReading(meetingLists.upcoming[0].session.weekPassage)}
              </Link>
            </p>
          ) : null}
          {meetingLists.upcoming[0].session.weekQuestion ? (
            <p className="text-sm text-primary">
              {meetingLists.upcoming[0].session.weekQuestion}
            </p>
          ) : null}
        </Card>
      )}

      <GroupShareActions space={space} isHost={isHost} />

      {/* This group's month */}
      <MonthCalendar groups={[{ id: space.id, name: space.name, sessions: spaceSessions }]} />

      {/* Upcoming, then Past */}
      <div id="group-past" className="space-y-5 scroll-mt-24">
        <section className="space-y-2.5" aria-label="Upcoming">
          <h3 className="text-lg">Upcoming</h3>
          {spaceSessions.length > 0 && filteredSessions.length === 0 ? (
            <Card className="text-center py-6 space-y-3">
              <Layers className="h-9 w-9 mx-auto text-muted" aria-hidden />
              <p className="font-medium text-primary">Nothing in this filter</p>
              <Button variant="secondary" onClick={() => void switchMode("all")}>
                Show all meetings
              </Button>
            </Card>
          ) : meetingLists.upcoming.length === 0 ? (
            <Card className="text-center py-6 space-y-3">
              <p className="text-sm text-muted">No meeting planned</p>
              <Button onClick={() => void openCreateSession()} disabled={saving}>
                <CalendarPlus className="h-5 w-5" aria-hidden />
                Plan a meeting
              </Button>
              <Button
                variant="secondary"
                onClick={() => openLogPrevious()}
                disabled={saving}
              >
                Log a previous date
              </Button>
            </Card>
          ) : (
            <ul className="space-y-2.5">
              {meetingLists.upcoming.map((face, index) => (
                <SessionRow
                  key={`${face.session.id}-up`}
                  session={face.session}
                  whenLabel={formatMeetingWhen(face.day, face.startTime)}
                  repeatNote={repeatLabel(face.session) ?? undefined}
                  template={templates.find((t) => t.id === face.session.templateId)}
                  onOpen={() => openViewSession(face.session)}
                  showWeek
                  place={index === 0 ? space.place : undefined}
                  coming={comingForFace(face)}
                  members={isHost ? space.members : undefined}
                  onMark={
                    isHost
                      ? (memberId, name, mark) => {
                          const current = face.session.coming ?? [];
                          const without = current.filter(
                            (row) => row.memberId !== memberId,
                          );
                          const already = current.find(
                            (row) => row.memberId === memberId,
                          );
                          const coming =
                            already?.mark === mark
                              ? without
                              : [...without, { memberId, name, mark }];
                          void updateSession(face.session.id, { coming });
                        }
                      : undefined
                  }
                />
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2.5" aria-label="Past">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg">Past</h3>
              <Button
                variant="secondary"
                className="!py-2"
                onClick={() => openLogPrevious()}
                disabled={saving}
              >
                Log a previous date
              </Button>
            </div>
            {meetingLists.past.length === 0 ? (
              <p className="text-sm text-muted">
                No past meetings yet. Log a Wednesday you already met.
              </p>
            ) : (
            <ul className="space-y-2.5">
              {visiblePast.map((face) => (
                <SessionRow
                  key={`${face.session.id}-${face.day}-${face.startTime ?? ""}-${face.held ? "h" : "p"}`}
                  session={face.session}
                  whenLabel={formatMeetingWhen(face.day, face.startTime)}
                  template={templates.find((t) => t.id === face.session.templateId)}
                  onOpen={() =>
                    face.held
                      ? openLogPrevious(face.day, face.startTime, {
                          sessionId: face.session.id,
                          day: face.day,
                        })
                      : openViewSession(face.session)
                  }
                  showWeek={!face.held}
                  held={face.held}
                  coming={comingForFace(face)}
                  onConfirmPrevious={
                    face.held
                      ? () =>
                          openLogPrevious(face.day, face.startTime, {
                            sessionId: face.session.id,
                            day: face.day,
                          })
                      : undefined
                  }
                />
              ))}
            </ul>
            )}
            {hasMorePast && (
              <Button
                variant="secondary"
                fullWidth
                onClick={() =>
                  setSessionVisible((n) => n + SESSION_PAGE_SIZE)
                }
              >
                Load more
                <span className="text-xs text-muted font-normal">
                  ({meetingLists.past.length - sessionVisible} left)
                </span>
              </Button>
            )}
          </section>
      </div>


      {/* In-group jump chips — wayfinding without a 4th bottom tab */}
      <nav
        className="-mx-0.5 overflow-x-auto pb-0.5"
        aria-label="Jump in this group"
      >
        <ul className="flex gap-1.5 min-w-min px-0.5">
          {(
            [
              {
                id: "meet",
                label: "Meet",
                onClick: () => {
                  if (gather.active) {
                    goGatherStep("meet");
                    void (async () => {
                      const sid = gather.sessionId;
                      const session =
                        (sid &&
                          spaceSessions.find((s) => s.id === sid)) ||
                        spaceSessions.find(
                          (s) =>
                            s.date.slice(0, 10) ===
                            format(new Date(), "yyyy-MM-dd"),
                        ) ||
                        null;
                      if (session) {
                        openEditSession(session);
                        return;
                      }
                      const created = await openCreateSession();
                      if (created) {
                        setGather((g) =>
                          g.active
                            ? { ...g, sessionId: created.id, step: "meet" }
                            : g,
                        );
                      }
                    })();
                    return;
                  }
                  document
                    .getElementById("group-meet")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                },
              },
              {
                id: "sync",
                label: "Sync",
                onClick: () => {
                  setSyncExpandSignal((n) => n + 1);
                  document
                    .getElementById("group-sync")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                },
              },
              {
                id: "people",
                label: "People",
                onClick: () => {
                  document
                    .getElementById("group-people")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                },
              },
              {
                id: "prayer",
                label: "Prayer",
                onClick: () => {
                  if (gather.active) {
                    goGatherStep("prayer");
                    markGatherDone("prayer");
                  }
                  setPrayerBoardOpen(true);
                },
              },
              {
                id: "past",
                label: "Past",
                onClick: () => {
                  document
                    .getElementById("group-past")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                },
              },
              {
                id: "more",
                label: "More",
                onClick: () => {
                  setMoreOpen(true);
                  window.requestAnimationFrame(() => {
                    document
                      .getElementById("group-more")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  });
                },
              },
            ] as const
          ).map((chip) => (
            <li key={chip.id}>
              <button
                type="button"
                onClick={chip.onClick}
                className={[
                  "inline-flex items-center rounded-full border border-border/90",
                  "bg-surface/95 px-3.5 py-2 text-xs font-semibold text-primary",
                  "touch-manipulation tap-target whitespace-nowrap",
                  "hover:border-primary/35 hover:bg-primary/8 active:scale-[0.98]",
                  "transition-colors",
                ].join(" ")}
              >
                {chip.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Guest recovery when not yet linked */}
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
                Use <strong className="text-text">Group pulse → Re-join</strong>{" "}
                with the host’s key, then Sync anytime.
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

      {/* Group pulse / Sync */}
      <div id="group-sync" className="scroll-mt-24">
        <SpaceConnectionBar
          space={space}
          defaultExpanded={needsRoomOpen || Boolean(spaceSync.lastError)}
          expandSignal={syncExpandSignal}
        />
      </div>

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
      ) : (
        <div className="space-y-2">
          <Button
            fullWidth
            className="!py-4 text-base shadow-md border border-primary/20"
            onClick={() => void beginGather()}
            disabled={saving}
          >
            <CalendarPlus className="h-5 w-5" aria-hidden />
            {saving
              ? "Starting…"
              : latestSession
                ? "Gather tonight"
                : "Gather · first meeting"}
          </Button>
          <p className="text-[11px] text-muted text-center leading-snug">
            One path: Meet · Study · Prayer
          </p>
        </div>
      )}
      {linkStatus.kind === "offline" && (
        <p className="text-[11px] text-amber-800 dark:text-amber-200 text-center">
          App is Offline (header). Meetings still save on this phone.
        </p>
      )}

      {/* While you meet */}
      <section
        id="group-meet"
        className="space-y-2 scroll-mt-24"
        aria-label="While you meet"
      >
        <h3 className="text-sm font-semibold text-primary">While you meet</h3>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => openBibleForSpace()}
            className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-surface/95 px-2 py-3.5 text-center touch-manipulation active:scale-[0.98] hover:border-primary/30"
          >
            <BookOpen className="h-6 w-6 text-primary" aria-hidden />
            <span className="text-xs font-medium text-primary leading-tight">
              {spaceSessions[0] || activeSession ? "Study" : "Bible"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPrayerBoardOpen(true)}
            className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-surface/95 px-2 py-3.5 text-center touch-manipulation active:scale-[0.98] hover:border-primary/30"
          >
            <HandHeart className="h-6 w-6 text-primary" aria-hidden />
            <span className="text-xs font-medium text-primary leading-tight">
              Prayer
              {typeof prayerBoardCount === "number" && prayerBoardCount > 0
                ? ` (${prayerBoardCount})`
                : ""}
            </span>
          </button>
          <button
            type="button"
            onClick={openSpacePrivateNotes}
            className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-surface/95 px-2 py-3.5 text-center touch-manipulation active:scale-[0.98] hover:border-primary/30"
          >
            <Lock className="h-6 w-6 text-primary" aria-hidden />
            <span className="text-xs font-medium text-primary leading-tight">
              Just for me
            </span>
          </button>
        </div>
      </section>

      {/* Who’s here */}
      <section
        id="group-people"
        className="space-y-2.5 scroll-mt-24"
        aria-label="Who is here"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-primary flex items-center gap-1.5">
            <Users className="h-4 w-4" aria-hidden />
            Who’s here
          </h3>
          {isHost ? (
            <button
              type="button"
              onClick={openMembers}
              className="text-xs font-medium text-primary touch-manipulation tap-target px-2"
            >
              Edit list
            </button>
          ) : (
            <span className="text-xs text-muted px-2">Host manages list</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {space.members.map((m) =>
            isHost ? (
              <button
                key={m.id}
                type="button"
                onClick={openMembers}
                className="inline-flex max-w-[9.5rem] min-h-11 items-center rounded-full border border-border bg-surface px-3.5 py-2.5 text-sm font-medium text-primary touch-manipulation active:scale-[0.98]"
                title={m.name}
              >
                <span className="truncate">{m.name}</span>
              </button>
            ) : (
              <span
                key={m.id}
                className="inline-flex max-w-[9.5rem] min-h-11 items-center rounded-full border border-border bg-surface px-3.5 py-2.5 text-sm font-medium text-primary"
                title={m.name}
              >
                <span className="truncate">{m.name}</span>
              </span>
            ),
          )}
          {canAddPeople && (
            <button
              type="button"
              onClick={() => {
                setQuickAddOpen((v) => !v);
                setQuickName("");
              }}
              className="inline-flex min-h-11 items-center gap-1 rounded-full border border-dashed border-primary/40 bg-primary/5 px-3.5 py-2.5 text-sm font-medium text-primary touch-manipulation"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add
            </button>
          )}
          {isHost && !needsRoomOpen && (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="inline-flex min-h-11 items-center gap-1 rounded-full border border-primary/30 bg-primary text-on-primary px-3.5 py-2.5 text-sm font-medium touch-manipulation active:scale-[0.98]"
            >
              <UserPlus className="h-4 w-4" aria-hidden />
              Share the group
            </button>
          )}
        </div>

        {quickAddOpen && canAddPeople && (
          <form
            onSubmit={(e) => void handleQuickAdd(e)}
            className="flex gap-2"
          >
            <input
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 py-3 text-base"
              placeholder="Name"
              maxLength={60}
              autoFocus
              disabled={quickAdding}
              enterKeyHint="done"
              autoComplete="name"
            />
            <Button
              type="submit"
              className="shrink-0"
              disabled={quickAdding || !quickName.trim()}
            >
              {quickAdding ? "…" : "Save"}
            </Button>
          </form>
        )}
      </section>

      {/* Zone 5 — More (collapsed) */}
      <section
        id="group-more"
        className="border-t border-border pt-3 space-y-3 scroll-mt-24"
      >
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-xl px-1 py-2 text-left touch-manipulation tap-target"
          aria-expanded={moreOpen}
        >
          <span className="text-sm font-semibold text-muted">
            More · meeting style, save, invite tools
          </span>
          <ChevronDown
            className={[
              "h-5 w-5 shrink-0 text-muted transition-transform",
              moreOpen ? "rotate-180" : "",
            ].join(" ")}
            aria-hidden
          />
        </button>

        {moreOpen && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-1.5">
                  <Layers className="h-4 w-4" aria-hidden />
                  Meeting style filter
                </h4>
                <button
                  type="button"
                  onClick={openChangeTemplate}
                  className="text-xs text-primary font-medium touch-manipulation"
                >
                  About styles
                </button>
              </div>
              <p className="text-xs text-muted">
                Optional: filter past meetings. New meetings use your group’s
                default style.
              </p>
              <div
                className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5"
                role="tablist"
                aria-label="Filter meetings by style"
              >
                <ModeChip
                  label="All"
                  count={spaceSessions.length}
                  selected={viewMode === "all"}
                  onClick={() => void switchMode("all")}
                />
                {SPACE_TEMPLATES.map((tpl) => (
                  <ModeChip
                    key={tpl.id}
                    label={tpl.shortLabel}
                    count={modeCounts[tpl.id]}
                    selected={viewMode === tpl.id}
                    onClick={() => void switchMode(tpl.id)}
                  />
                ))}
              </div>
              <p className="text-xs text-muted tabular-nums">
                {spaceSessions.length} meeting
                {spaceSessions.length === 1 ? "" : "s"}
                {passageCount > 0
                  ? ` · ${passageCount} passage${passageCount === 1 ? "" : "s"} logged`
                  : ""}
              </p>
            </div>

            <Button
              variant="secondary"
              fullWidth
              onClick={() => navigate("/settings")}
            >
              <Share2 className="h-4 w-4" aria-hidden />
              Save a copy is under More
            </Button>

            <YourDataBundle
              focusSpaceId={space.id}
              spaceCount={1}
              onBackup={() => navigate("/settings")}
              onImport={() => navigate("/settings")}
            />
          </div>
        )}
      </section>

      {/* Edit space */}
      <Modal
        open={editOpen}
        title="Edit space"
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
            />
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
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Space type</legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  {
                    id: "group" as const,
                    label: "Group",
                    hint: `Up to ${maxMembersForSpace("group")}`,
                  },
                  {
                    id: "family" as const,
                    label: "Family",
                    hint: `Up to ${maxMembersForSpace("family")}`,
                  },
                ] as const
              ).map((opt) => {
                const selected = draftSpaceKind === opt.id;
                return (
                  <label
                    key={opt.id}
                    className={[
                      "rounded-xl border px-3 py-3 touch-manipulation cursor-pointer text-center",
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-bg",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="edit-space-kind"
                      className="sr-only"
                      checked={selected}
                      onChange={() => setDraftSpaceKind(opt.id)}
                      disabled={saving}
                    />
                    <span className="font-medium text-primary block text-sm">
                      {opt.label}
                    </span>
                    <span className="text-[11px] text-muted">{opt.hint}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted">
              Family spaces allow a larger household while keeping the same
              sessions and templates. Switching to Group requires{" "}
              {maxMembersForSpace("group")} or fewer members.
            </p>
          </fieldset>
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
            Add or rename people. Max {maxMembersForSpace(space.spaceKind)} for
            this {spaceKindLabel(space.spaceKind).toLowerCase()}.
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
        <div className="relative min-h-[min(68dvh,34rem)] h-full w-full">
          <div
            ref={sessionScrollRef}
            className={[
              "absolute inset-0 overflow-y-auto overscroll-contain pb-1 pr-0.5",
              sessionPanelTab === "session"
                ? "z-[1]"
                : "invisible pointer-events-none z-0",
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
                onEdit={() => openEditSession(activeSession)}
                onDelete={() => setDeleteSessionOpen(true)}
                onClose={() => void closeSessionModal()}
                onOpenBible={() => openBibleForSpace(activeSession.id)}
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
              "absolute inset-0 overflow-y-auto overscroll-contain pb-1 pr-0.5",
              sessionPanelTab === "private"
                ? "z-[1]"
                : "invisible pointer-events-none z-0",
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

      <Modal
        open={prayerBoardOpen}
        title="Prayer board"
        onClose={() => {
          if (gather.active) markGatherDone("prayer");
          setPrayerBoardOpen(false);
        }}
      >
        <div className="space-y-3 -mt-1">
          <p className="text-sm text-muted">
            Live shared board for this space — individual requests and group
            needs. Included when you export a Space Update.
          </p>
          <PrayerBoard spaceId={space.id} members={space.members} />
          <Button
            variant="secondary"
            fullWidth
            onClick={() => setPrayerBoardOpen(false)}
          >
            Done
          </Button>
        </div>
      </Modal>

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
    </div>
  );
}

function ModeChip({
  label,
  count,
  selected,
  onClick,
}: {
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={[
        "shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-semibold touch-manipulation tap-target border transition-colors",
        selected
          ? "border-primary bg-primary text-on-primary"
          : "border-border bg-bg text-primary hover:border-primary/40",
      ].join(" ")}
    >
      {label}
      {count > 0 && (
        <span
          className={[
            "tabular-nums text-[10px] font-medium",
            selected ? "text-on-primary/80" : "text-muted",
          ].join(" ")}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function SessionRow({
  session,
  template,
  onOpen,
  whenLabel,
  repeatNote,
  showWeek = false,
  place,
  coming = [],
  members,
  onMark,
  onConfirmPrevious,
  held = false,
}: {
  session: Session;
  template?: Template;
  onOpen: () => void;
  whenLabel: string;
  repeatNote?: string;
  showWeek?: boolean;
  place?: string;
  coming?: { memberId: string; name: string; mark: ComingMark }[];
  members?: Member[];
  onMark?: (memberId: string, name: string, mark: ComingMark) => void;
  onConfirmPrevious?: () => void;
  held?: boolean;
}) {
  const dateLabel = repeatNote ? `${whenLabel} · ${repeatNote}` : whenLabel;
  const attendeeCount = session.attendees?.length ?? 0;
  const preview = sessionPreview(session, template);
  const progress = template
    ? countFilledSteps(template, session.responses)
    : null;
  const covered = (session.passagesStudied ?? [])
    .map((row) => formatPassageRef(row))
    .filter(Boolean);
  const heading = held ? "Not logged yet" : sessionDisplayTitle(session, template);
  const subtitle = sessionTitleSubtitle(session, template);
  const week = showWeek ? session.weekPassage : undefined;
  const question = showWeek ? session.weekQuestion?.trim() : "";
  const passageHref = week
    ? (() => {
        const params = new URLSearchParams({
          b: week.bookId,
          c: String(week.chapter),
        });
        if (week.startVerse) {
          params.set("sv", String(week.startVerse));
          params.set("ev", String(week.endVerse ?? week.startVerse));
        }
        return `/bible?${params.toString()}`;
      })()
    : null;

  return (
    <li>
      <Card
        padding="sm"
        className="hover:border-primary/30 transition-colors"
      >
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left touch-manipulation active:scale-[0.99] transition-transform"
      >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-primary truncate">
                    {heading}
                  </p>
                  <p className="text-xs text-muted">
                    {dateLabel}
                    {place ? ` · ${place}` : ""}
                    {subtitle ? ` · ${subtitle}` : ""}
                  </p>
                </div>
                <ChevronRight
                  className="h-5 w-5 shrink-0 text-muted mt-0.5"
                  aria-hidden
                />
              </div>

              <p className="text-xs text-muted">
                {attendeeCount === 0
                  ? "No attendees"
                  : `${attendeeCount} attended`}
                {progress && progress.total > 0
                  ? ` · ${progress.filled}/${progress.total} steps noted`
                  : null}
                {(session.passagesStudied?.length ?? 0) > 0
                  ? ` · ${session.passagesStudied.length} passage${session.passagesStudied.length === 1 ? "" : "s"}`
                  : null}
              </p>

              {covered.length > 0 ? (
                <p className="text-sm text-primary pt-0.5">{covered.join(" · ")}</p>
              ) : null}
              {preview ? (
                <p className="text-sm text-muted line-clamp-2 pt-0.5">
                  {preview}
                </p>
              ) : !week && !question ? (
                <p className="text-sm text-muted/70 italic pt-0.5">
                  No notes yet — tap to open
                </p>
              ) : null}
            </div>
          </div>
        </button>
        {week && passageHref && (
          <p className="text-sm pt-1">
            <Link
              to={passageHref}
              className="font-medium text-primary underline-offset-2 hover:underline touch-manipulation"
            >
              {formatWeekReading(week)}
            </Link>
          </p>
        )}
        {question ? (
          <p className="text-sm text-primary pt-0.5">{question}</p>
        ) : null}
        {onConfirmPrevious ? (
          <Button
            type="button"
            variant="secondary"
            className="mt-2"
            fullWidth
            onClick={onConfirmPrevious}
          >
            Confirm previous date
          </Button>
        ) : null}
        {members && members.length > 0 && onMark ? (
          <ul className="space-y-1.5 pt-2">
            {members.map((member) => {
              const mark = coming.find((row) => row.memberId === member.id)?.mark;
              return (
                <li
                  key={member.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-sm text-primary truncate">
                    {member.name}
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => onMark(member.id, member.name, "coming")}
                      className={[
                        "rounded-full px-2.5 py-1 text-xs font-medium touch-manipulation",
                        mark === "coming"
                          ? "bg-primary text-on-primary"
                          : "border border-border text-muted",
                      ].join(" ")}
                      aria-pressed={mark === "coming"}
                    >
                      Coming
                    </button>
                    <button
                      type="button"
                      onClick={() => onMark(member.id, member.name, "cant")}
                      className={[
                        "rounded-full px-2.5 py-1 text-xs font-medium touch-manipulation",
                        mark === "cant"
                          ? "bg-primary text-on-primary"
                          : "border border-border text-muted",
                      ].join(" ")}
                      aria-pressed={mark === "cant"}
                    >
                      Can’t
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : coming.length > 0 ? (
          <p className="text-sm text-muted pt-1">
            {coming
              .map(
                (row) =>
                  `${row.name} · ${row.mark === "cant" ? "Can’t" : "Coming"}`,
              )
              .join(", ")}
          </p>
        ) : null}
      </Card>
    </li>
  );
}

function toDateInputValue(iso: string): string {
  try {
    return format(parseISO(iso), "yyyy-MM-dd");
  } catch {
    return iso.slice(0, 10);
  }
}
