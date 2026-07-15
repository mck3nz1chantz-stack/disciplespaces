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
import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  BookOpen,
  CalendarPlus,
  ChevronDown,
  ChevronRight,
  HandHeart,
  Layers,
  Lock,
  Pencil,
  Plus,
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
import { ShareUpdateModal } from "../components/ShareUpdateModal";
import { YourDataBundle } from "../components/YourDataBundle";
import { SpaceConnectionBar } from "../components/SpaceConnectionBar";
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
import type { Member, Session, SpaceKind, Template } from "../types";
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
  const createSession = useAppStore((s) => s.createSession);
  const updateSession = useAppStore((s) => s.updateSession);
  const deleteSession = useAppStore((s) => s.deleteSession);

  const space = liveSpace ?? null;
  const spaceSessions = liveSessions ?? [];
  const templates =
    liveTemplates && liveTemplates.length > 0
      ? liveTemplates
      : storeTemplates;

  const loading = liveSpace === undefined || liveSessions === undefined;
  const notFound = liveSpace === null;

  const [editOpen, setEditOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
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
  const [deleteSessionOpen, setDeleteSessionOpen] = useState(false);

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
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
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickAdding, setQuickAdding] = useState(false);
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

  // Default lens to the space’s active mode when entering a Space
  useEffect(() => {
    if (!space) return;
    setViewMode(normalizeSpaceTemplate(space.spaceTemplate));
    setSessionVisible(SESSION_PAGE_SIZE);
  }, [space?.id]);

  // Quick Start → open create session or invite when routed with state
  useEffect(() => {
    const state = location.state as {
      openCreateSession?: boolean;
      openInvite?: boolean;
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when landing with flag
  }, [space?.id, location.state]);

  // Keep active session in sync with live list
  useEffect(() => {
    if (!activeSession || !liveSessions) return;
    const fresh = liveSessions.find((s) => s.id === activeSession.id);
    if (fresh) setActiveSession(fresh);
  }, [liveSessions, activeSession?.id]);

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

  const visibleSessions = useMemo(
    () => filteredSessions.slice(0, sessionVisible),
    [filteredSessions, sessionVisible],
  );
  const hasMoreSessions = filteredSessions.length > sessionVisible;

  function openEdit() {
    if (!space) return;
    setEditName(space.name);
    setEditDescription(space.description ?? "");
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
    setDraftMembers(space.members.map((m) => ({ ...m })));
    setMembersOpen(true);
  }

  async function handleQuickAdd(e?: FormEvent) {
    e?.preventDefault();
    if (!space || !id) return;
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
   */
  async function openCreateSession() {
    if (!space) return;
    const mode =
      viewMode === "all"
        ? normalizeSpaceTemplate(space.spaceTemplate)
        : viewMode;
    const preferredTemplateId =
      getSpaceTemplateMeta(mode).firstSessionTemplateId ||
      space.defaultSessionTemplateId ||
      templates[0]?.id;
    if (!preferredTemplateId) {
      toast.error("No session templates available yet");
      return;
    }

    setSessionPanelTab("session");
    setLockedSectionKey(PRIVATE_SECTION.notes);
    setSaving(true);
    try {
      const draftValues = buildSessionFormValues({
        mode: "create",
        templates,
        members: space.members,
        meetingDate: format(new Date(), "yyyy-MM-dd"),
        preferredTemplateId,
      });
      // Prefer first template step for lock when guided templates exist
      const tpl = templates.find((t) => t.id === draftValues.templateId);
      if (tpl?.steps[0]?.id) {
        setLockedSectionKey(tpl.steps[0].id);
      }
      const created = await createSession({
        spaceId: space.id,
        date: draftValues.meetingDate,
        templateId: draftValues.templateId,
        attendees: draftValues.attendees,
        responses: draftValues.responses,
        passagesStudied: draftValues.passagesStudied,
        notes: draftValues.notes,
      });
      setActiveSession(created);
      setFormValues(draftValues);
      setIsDraftSession(true);
      setSessionMode("edit");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not start session",
      );
      setActiveSession(null);
      setFormValues(null);
      setIsDraftSession(false);
      setSessionMode(null);
    } finally {
      setSaving(false);
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
    setFormValues(
      buildSessionFormValues({
        mode: "edit",
        templates,
        members: space.members,
        meetingDate: toDateInputValue(s.date),
        templateId: s.templateId,
        attendees: s.attendees,
        responses: s.responses,
        passagesStudied: s.passagesStudied ?? [],
        notes: s.notes ?? s.sharedNotes ?? "",
      }),
    );
    setSessionMode("edit");
  }

  /** URL is the primary source of truth for Bible log context. */
  function openBibleForSpace(sessionId?: string) {
    if (!space) return;
    const params = new URLSearchParams({ space: space.id });
    if (sessionId) params.set("session", sessionId);
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
    setSessionMode(null);
    setActiveSession(null);
    setFormValues(null);
    setSessionPanelTab("session");
    setLockedSectionKey(PRIVATE_SECTION.notes);
    setIsDraftSession(false);
    if (wasDraft && draft) {
      try {
        // Persist unsaved form into draft before emptiness check, if any content
        if (formSnapshot && formOrSessionHasSharedContent(draft, formSnapshot)) {
          await updateSession(draft.id, {
            date: formSnapshot.meetingDate,
            templateId: formSnapshot.templateId,
            attendees: formSnapshot.attendees,
            responses: formSnapshot.responses,
            passagesStudied: formSnapshot.passagesStudied,
            notes: formSnapshot.notes,
          });
          // Kept as a real session — do not delete
          return;
        }
        await discardEmptyDraftIfNeeded(draft, formSnapshot);
      } catch {
        // ignore discard errors
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

  async function handleSaveSession(e: FormEvent) {
    e.preventDefault();
    if (!space || !formValues) return;
    if (!formValues.meetingDate) {
      toast.error("Pick a meeting date");
      return;
    }
    if (!formValues.templateId) {
      toast.error("Choose a template");
      return;
    }

    const template = templates.find((t) => t.id === formValues.templateId);
    if (template) {
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

    setSaving(true);
    try {
      if (activeSession) {
        const updated = await updateSession(activeSession.id, {
          date: formValues.meetingDate,
          templateId: formValues.templateId,
          attendees: formValues.attendees,
          responses: formValues.responses,
          passagesStudied,
          notes: formValues.notes,
        });
        setActiveSession(updated);
        setIsDraftSession(false);
        toast.success(isDraftSession ? "Session saved" : "Session updated");
        setSessionMode("view");
        setFormValues(null);
        setSessionPanelTab("session");
      } else {
        // Fallback if draft creation was skipped
        const created = await createSession({
          spaceId: space.id,
          date: formValues.meetingDate,
          templateId: formValues.templateId,
          attendees: formValues.attendees,
          responses: formValues.responses,
          passagesStudied,
          notes: formValues.notes,
        });
        setActiveSession(created);
        setIsDraftSession(false);
        setFormValues(null);
        setSessionPanelTab("session");
        setSessionMode("view");
        toast.success("Session saved");
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
        <BackLink />
        <Card>
          <p className="text-muted">This space was not found on this device.</p>
          <Button className="mt-4" variant="secondary" onClick={() => navigate("/")}>
            Back to spaces
          </Button>
        </Card>
      </div>
    );
  }

  if (loading || !space) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-muted">Loading space…</p>
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
          ? liveSessionTemplate?.name || "New session"
          : "Edit session"
        : sessionMode === "view"
          ? viewTemplate?.name || "Session"
          : "";

  const maxPeople = maxMembersForSpace(space.spaceKind);
  const peopleCount = space.members.length;
  const canAddPeople = peopleCount < maxPeople;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <BackLink />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            className="!p-2"
            onClick={openEdit}
            aria-label="Edit group"
          >
            <Pencil className="h-5 w-5" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            className="!p-2 text-danger"
            onClick={() => setDeleteOpen(true)}
            aria-label="Delete group"
          >
            <Trash2 className="h-5 w-5" aria-hidden />
          </Button>
        </div>
      </div>

      {/* Title */}
      <div>
        <h2 className="text-2xl leading-tight">{space.name}</h2>
        {space.description ? (
          <p className="text-sm text-muted mt-1 line-clamp-2">
            {space.description}
          </p>
        ) : null}
        <p className="text-sm mt-2 font-medium text-primary tabular-nums">
          {peopleCount === 0
            ? "No one listed yet"
            : `${peopleCount} of ${maxPeople} people`}
          <span className="text-muted font-normal">
            {" "}
            · {spaceKindLabel(space.spaceKind)}
          </span>
        </p>
      </div>

      {/* Zone 1 — Who’s here (people + invite before connect chrome) */}
      <section className="space-y-2.5" aria-label="Who is here">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-primary flex items-center gap-1.5">
            <Users className="h-4 w-4" aria-hidden />
            Who’s here
          </h3>
          <button
            type="button"
            onClick={openMembers}
            className="text-xs font-medium text-primary touch-manipulation tap-target px-2"
          >
            Edit list
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {space.members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={openMembers}
              className="inline-flex max-w-[9.5rem] min-h-11 items-center rounded-full border border-border bg-surface px-3.5 py-2.5 text-sm font-medium text-primary touch-manipulation active:scale-[0.98]"
              title={m.name}
            >
              <span className="truncate">{m.name}</span>
            </button>
          ))}
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
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-primary/30 bg-primary text-white px-3.5 py-2.5 text-sm font-medium touch-manipulation active:scale-[0.98]"
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            Invite
          </button>
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

        <p className="text-xs text-muted">
          Tap a name to edit. Invite so they can open this group on their phone.
        </p>
      </section>

      {/* Zone 2 — Primary worship CTA (sticky in lower thumb zone) */}
      <div className="sticky-thumb-actions -mx-1 px-1 py-1">
        <Button
          fullWidth
          className="!py-4 text-base shadow-md border border-primary/20"
          onClick={() => void openCreateSession()}
          disabled={saving}
        >
          <CalendarPlus className="h-5 w-5" aria-hidden />
          {saving ? "Starting…" : "Start today’s meeting"}
        </Button>
      </div>

      {/* Connection / sync — after meet CTA so worship stays closer to thumbs */}
      <SpaceConnectionBar space={space} />

      {/* Zone 3 — While you meet (large tiles for thumb) */}
      <section className="space-y-2" aria-label="While you meet">
        <h3 className="text-sm font-semibold text-primary">While you meet</h3>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => openBibleForSpace()}
            className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-2 py-3.5 text-center touch-manipulation active:scale-[0.98] hover:border-primary/30"
          >
            <BookOpen className="h-6 w-6 text-primary" aria-hidden />
            <span className="text-xs font-medium text-primary leading-tight">
              Bible
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPrayerBoardOpen(true)}
            className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-2 py-3.5 text-center touch-manipulation active:scale-[0.98] hover:border-primary/30"
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
            className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-2 py-3.5 text-center touch-manipulation active:scale-[0.98] hover:border-primary/30"
          >
            <Lock className="h-6 w-6 text-primary" aria-hidden />
            <span className="text-xs font-medium text-primary leading-tight">
              Just for me
            </span>
          </button>
        </div>
      </section>

      {/* Zone 4 — Past meetings (timeline) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg">Past meetings</h3>
          {filteredSessions.length > 0 && (
            <span className="text-xs text-muted">Newest first</span>
          )}
        </div>

        {spaceSessions.length === 0 ? (
          <Card className="text-center py-8 space-y-3">
            <BookOpen className="h-9 w-9 mx-auto text-muted" aria-hidden />
            <div className="space-y-1">
              <p className="font-medium text-primary">No meetings yet</p>
              <p className="text-sm text-muted max-w-xs mx-auto">
                Tap <strong className="text-text">Start today’s meeting</strong>{" "}
                when you gather.
              </p>
            </div>
          </Card>
        ) : filteredSessions.length === 0 ? (
          <Card className="text-center py-8 space-y-3">
            <Layers className="h-9 w-9 mx-auto text-muted" aria-hidden />
            <div className="space-y-1">
              <p className="font-medium text-primary">Nothing in this filter</p>
              <p className="text-sm text-muted max-w-xs mx-auto">
                Clear the filter under More, or start a new meeting.
              </p>
            </div>
            <Button variant="secondary" onClick={() => void switchMode("all")}>
              Show all meetings
            </Button>
          </Card>
        ) : (
          <>
            <ul className="space-y-2.5">
              {visibleSessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  template={templates.find((t) => t.id === session.templateId)}
                  onOpen={() => openViewSession(session)}
                />
              ))}
            </ul>
            {hasMoreSessions && (
              <Button
                variant="secondary"
                fullWidth
                onClick={() =>
                  setSessionVisible((n) => n + SESSION_PAGE_SIZE)
                }
              >
                Load more
                <span className="text-xs text-muted font-normal">
                  ({filteredSessions.length - sessionVisible} left)
                </span>
              </Button>
            )}
          </>
        )}
      </div>

      {/* Zone 5 — More (collapsed) */}
      <section className="border-t border-border pt-3 space-y-3">
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
              onClick={() => setShareOpen(true)}
            >
              <Share2 className="h-4 w-4" aria-hidden />
              Save or send a group file
            </Button>

            <YourDataBundle
              focusSpaceId={space.id}
              spaceCount={1}
              onBackup={() => setShareOpen(true)}
              onImport={() => setShareOpen(true)}
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
          closeSessionModal();
        }}
        containBody
        tabs={[
          { id: "session", label: "Session" },
          {
            id: "private",
            label: "Private",
            badge: sessionPrivateCount,
          },
        ]}
        activeTab={sessionPanelTab}
        onTabChange={(id) => {
          if (id === "private") {
            openSessionPrivateDrawer();
          } else {
            closeSessionPrivateDrawer();
          }
        }}
      >
        {/*
          Keep both panes mounted so scroll position is preserved when flipping
          Session ↔ Private. Parent has a real height; each pane scrolls itself.
        */}
        <div
          ref={sessionScrollRef}
          className={[
            "absolute inset-0 overflow-y-auto overscroll-contain pb-1 pr-0.5",
            sessionPanelTab === "session"
              ? "z-[1]"
              : "invisible pointer-events-none z-0",
          ].join(" ")}
          aria-hidden={sessionPanelTab !== "session"}
          // Keep mounted so scroll position + section lock survive tab flips
        >
          {sessionMode === "edit" && formValues && activeSession && (
            <SessionForm
              mode={isDraftSession ? "create" : "edit"}
              members={space.members}
              templates={templates}
              values={formValues}
              onChange={setFormValues}
              onSubmit={handleSaveSession}
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
            <p className="text-sm text-muted py-6 text-center">
              {saving ? "Starting session…" : "Loading session…"}
            </p>
          )}
          {sessionMode === "view" && !activeSession && (
            <p className="text-sm text-muted py-6 text-center">
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
        onClose={() => setPrayerBoardOpen(false)}
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
      <ShareUpdateModal
        open={shareOpen}
        spaceId={space.id}
        onClose={() => setShareOpen(false)}
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

function BackLink() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary touch-manipulation tap-target -ml-1 px-1"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      All spaces
    </Link>
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
          ? "border-primary bg-primary text-white"
          : "border-border bg-bg text-primary hover:border-primary/40",
      ].join(" ")}
    >
      {label}
      {count > 0 && (
        <span
          className={[
            "tabular-nums text-[10px] font-medium",
            selected ? "text-white/80" : "text-muted",
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
}: {
  session: Session;
  template?: Template;
  onOpen: () => void;
}) {
  const dateLabel = formatSessionDate(session.date);
  const attendeeCount = session.attendees?.length ?? 0;
  const preview = sessionPreview(session, template);
  const progress = template
    ? countFilledSteps(template, session.responses)
    : null;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left touch-manipulation active:scale-[0.99] transition-transform"
      >
        <Card
          padding="sm"
          className="hover:border-primary/30 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-primary truncate">
                    {template?.name || "Session"}
                  </p>
                  <p className="text-xs text-muted">{dateLabel}</p>
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

              {preview ? (
                <p className="text-sm text-muted line-clamp-2 pt-0.5">
                  {preview}
                </p>
              ) : (
                <p className="text-sm text-muted/70 italic pt-0.5">
                  No notes yet — tap to open
                </p>
              )}
            </div>
          </div>
        </Card>
      </button>
    </li>
  );
}

function formatSessionDate(iso: string): string {
  try {
    return format(parseISO(iso), "EEE, MMM d, yyyy");
  } catch {
    return iso.slice(0, 10);
  }
}

function toDateInputValue(iso: string): string {
  try {
    return format(parseISO(iso), "yyyy-MM-dd");
  } catch {
    return iso.slice(0, 10);
  }
}
