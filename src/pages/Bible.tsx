import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  BookMarked,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Focus,
  HandHeart,
  Library,
  Lock,
  Maximize2,
  Search,
  WifiOff,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { BibleReaderVideoBg } from "../components/BibleReaderVideoBg";
import { Modal } from "../components/Modal";
import {
  LogPassageModal,
  type PassageDraft,
} from "../components/LogPassageModal";
import { BibleLogContextBanner } from "../components/BibleLogContextBanner";
import { NavBreadcrumb } from "../components/NavBreadcrumb";
import { StudyGuideChip } from "../components/StudyGuideChip";
import { SessionPassageTrail } from "../components/SessionPassageTrail";
import {
  PrayFromVerseModal,
  type PrayFromVerseDraft,
} from "../components/PrayFromVerseModal";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import {
  formatReadingPositionLabel,
  formatReference,
  getBooks,
  getChapter,
  groupBooksByTestament,
  loadReadingPosition,
  loadReadingVersion,
  normalizeBibleVersion,
  parseReference,
  saveReadingPosition,
  saveReadingVersion,
  searchVerses,
  splitHighlight,
  bibleVersionMeta,
  BIBLE_VERSIONS,
  type BibleBookMeta,
  type BibleVersionId,
  type ChapterData,
  type SearchHit,
} from "../lib/bible";
import {
  clampFontScale,
  loadReaderFocus,
  loadReaderFontScale,
  READER_FONT_MULTIPLIERS,
  saveReaderFocus,
  saveReaderFontScale,
  type ReaderFontScale,
} from "../lib/readerPrefs";
import { formatPassageRef, passageFromSelection } from "../lib/passages";
import { useAppStore } from "../stores/useAppStore";
import { useBibleStore } from "../stores/useBibleStore";
import { sessionDisplayTitle } from "../lib/sessionTitle";
import { PRIVATE_SECTION, type Passage, type Session } from "../types";

type Panel = "read" | "search";

export function Bible() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const spaces = useAppStore((s) => s.spaces);
  const sessions = useAppStore((s) => s.sessions);
  const templates = useAppStore((s) => s.templates);
  const initialize = useAppStore((s) => s.initialize);
  const loadSessionsForSpace = useAppStore((s) => s.loadSessionsForSpace);
  const loadTemplates = useAppStore((s) => s.loadTemplates);
  const addPassageToSession = useAppStore((s) => s.addPassageToSession);
  const addPrivateNote = useAppStore((s) => s.addPrivateNote);
  const logContext = useBibleStore((s) => s.logContext);
  const setLogContext = useBibleStore((s) => s.setLogContext);
  const clearLogContext = useBibleStore((s) => s.clearLogContext);

  const [bibleVersion, setBibleVersion] = useState<BibleVersionId>(() =>
    loadReadingVersion(),
  );
  const [books, setBooks] = useState<BibleBookMeta[]>([]);
  const [bookId, setBookId] = useState("john");
  const [chapter, setChapter] = useState(1);
  const [chapterData, setChapterData] = useState<ChapterData | null>(null);
  const [loadingIndex, setLoadingIndex] = useState(true);
  const [loadingChapter, setLoadingChapter] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const versionMeta = bibleVersionMeta(bibleVersion);

  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);
  const [spacePickerOpen, setSpacePickerOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("read");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchScope, setSearchScope] = useState<"book" | "all">("book");
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchAbort = useRef<AbortController | null>(null);

  const [highlightVerse, setHighlightVerse] = useState<number | null>(null);
  /** Inclusive verse range selection within the current chapter. */
  const [selectStart, setSelectStart] = useState<number | null>(null);
  const [selectEnd, setSelectEnd] = useState<number | null>(null);

  const [logOpen, setLogOpen] = useState(false);
  const [logDraft, setLogDraft] = useState<PassageDraft | null>(null);
  /** Hide secondary chrome so the chapter surface can breathe (persisted). */
  const [focusMode, setFocusMode] = useState(() => loadReaderFocus());
  const [fontScale, setFontScale] = useState<ReaderFontScale>(() =>
    loadReaderFontScale(),
  );
  const [privateNoteDraft, setPrivateNoteDraft] = useState("");
  const [showPrivateNote, setShowPrivateNote] = useState(false);
  const [logging, setLogging] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  /** One-shot “picking up where you left off” when no session context. */
  const [showContinueHint, setShowContinueHint] = useState(false);
  const continueLabelRef = useRef<string | null>(null);
  const [prayOpen, setPrayOpen] = useState(false);
  const [prayDraft, setPrayDraft] = useState<PrayFromVerseDraft | null>(null);
  /** Soft prose reveal after chapter handoff (Phase D). */
  const [proseReveal, setProseReveal] = useState(true);
  const [chapterGate, setChapterGate] = useState<{
    bookName: string;
    chapter: number;
  } | null>(null);
  const [pulseVerse, setPulseVerse] = useState<number | null>(null);

  const prefersReducedMotion = usePrefersReducedMotion();

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  const readerTopRef = useRef<HTMLDivElement>(null);
  /** Applied after chapter load so trail jumps keep their range selection. */
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(
    null,
  );
  /** Skip chapter gate on the very first load of this mount. */
  const isFirstChapterLoadRef = useRef(true);
  const chapterGateTimerRef = useRef<number | null>(null);

  const currentBook = useMemo(
    () => books.find((b) => b.id === bookId),
    [books, bookId],
  );

  const { ot, nt } = useMemo(() => groupBooksByTestament(books), [books]);

  const selectionRange = useMemo(() => {
    if (selectStart == null) return null;
    const a = selectStart;
    const b = selectEnd ?? selectStart;
    return { start: Math.min(a, b), end: Math.max(a, b) };
  }, [selectStart, selectEnd]);

  const activeSession = useMemo(() => {
    if (!logContext.sessionId) return null;
    return (
      sessions.find((s) => s.id === logContext.sessionId) ??
      spaces
        .flatMap((s) => s.sessions ?? [])
        .find((s) => s.id === logContext.sessionId) ??
      null
    );
  }, [logContext.sessionId, sessions, spaces]);

  const sessionHint = useMemo(() => {
    if (!logContext.sessionId) return null;
    if (!activeSession) return "Tonight’s session";
    const day = activeSession.date.slice(0, 10);
    const tpl = templates.find((t) => t.id === activeSession.templateId);
    const label = sessionDisplayTitle(activeSession, tpl);
    return `${day} · ${label}`;
  }, [logContext.sessionId, activeSession, templates]);

  const sessionTemplate = useMemo(() => {
    if (!activeSession) return null;
    return templates.find((t) => t.id === activeSession.templateId) ?? null;
  }, [activeSession, templates]);

  const sessionTitle = useMemo(() => {
    if (!activeSession) return null;
    return sessionDisplayTitle(activeSession, sessionTemplate);
  }, [activeSession, sessionTemplate]);

  const sessionPassages = useMemo(
    () => activeSession?.passagesStudied ?? [],
    [activeSession],
  );

  /** Verses in the open chapter already logged to tonight’s session. */
  const loggedVersesInChapter = useMemo(() => {
    const set = new Set<number>();
    if (!currentBook || sessionPassages.length === 0) return set;
    const bookName = currentBook.name.toLowerCase();
    for (const p of sessionPassages) {
      if (p.book.toLowerCase() !== bookName) continue;
      if (p.startChapter > chapter || p.endChapter < chapter) continue;
      if (p.startChapter === p.endChapter && p.startChapter === chapter) {
        const a = p.startVerse ?? 1;
        const b = p.endVerse ?? a;
        for (let v = Math.min(a, b); v <= Math.max(a, b); v++) set.add(v);
        continue;
      }
      // Multi-chapter: mark all verses on the open chapter edges conservatively
      if (p.startChapter === chapter) {
        const a = p.startVerse ?? 1;
        for (let v = a; v <= 200; v++) set.add(v);
      } else if (p.endChapter === chapter) {
        const b = p.endVerse ?? 1;
        for (let v = 1; v <= b; v++) set.add(v);
      } else {
        for (let v = 1; v <= 200; v++) set.add(v);
      }
    }
    return set;
  }, [currentBook, chapter, sessionPassages]);

  const linkedSpace = useMemo(
    () => spaces.find((s) => s.id === logContext.spaceId) ?? null,
    [spaces, logContext.spaceId],
  );

  /** Space + session pre-selected → one-tap log without modal. */
  const canOneTapLog = Boolean(logContext.spaceId && logContext.sessionId);

  const fontMultiplier = READER_FONT_MULTIPLIERS[fontScale];

  // Online status
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Ensure spaces + templates are available for session guide / log context
  useEffect(() => {
    void initialize();
    void loadTemplates();
  }, [initialize, loadTemplates]);

  // Persist focus + dim app chrome (header / nav / testing ribbon)
  useEffect(() => {
    saveReaderFocus(focusMode);
    if (focusMode) {
      document.documentElement.dataset.readerFocus = "true";
    } else {
      delete document.documentElement.dataset.readerFocus;
    }
    return () => {
      delete document.documentElement.dataset.readerFocus;
    };
  }, [focusMode]);

  useEffect(() => {
    saveReaderFontScale(fontScale);
  }, [fontScale]);

  /**
   * URL is the primary source of truth for log context.
   * Derive store from ?space= / ?session= whenever params or spaces change.
   * Clear aggressively when the param is missing or the space is unknown.
   */
  useEffect(() => {
    const spaceParam = searchParams.get("space");
    const sessionParam = searchParams.get("session");

    if (!spaceParam) {
      clearLogContext();
      return;
    }

    const space = spaces.find((s) => s.id === spaceParam);
    if (space) {
      setLogContext({
        spaceId: space.id,
        spaceName: space.name,
        sessionId: sessionParam,
      });
      return;
    }

    // Spaces not loaded yet — keep id from URL so first paint can catch up
    // without flashing a different space. Only set name once lookup succeeds.
    if (spaces.length === 0) {
      setLogContext({
        spaceId: spaceParam,
        spaceName: null,
        sessionId: sessionParam,
      });
      return;
    }

    // Invalid space id in URL — clear
    clearLogContext();
  }, [searchParams, spaces, setLogContext, clearLogContext]);

  // Load sessions for the linked space so one-tap log + titles resolve
  useEffect(() => {
    if (!logContext.spaceId) return;
    void loadSessionsForSpace(logContext.spaceId);
  }, [logContext.spaceId, loadSessionsForSpace]);

  // Clear context when leaving the Bible reader
  useEffect(() => {
    return () => {
      clearLogContext();
      delete document.documentElement.dataset.readerFocus;
    };
  }, [clearLogContext]);

  // Load index + restore position (per version)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingIndex(true);
      setError(null);
      try {
        const list = await getBooks(bibleVersion);
        if (cancelled) return;
        setBooks(list);
        const saved = loadReadingPosition();
        if (saved && list.some((b) => b.id === saved.bookId)) {
          const meta = list.find((b) => b.id === saved.bookId)!;
          setBookId(saved.bookId);
          setChapter(
            Math.min(Math.max(1, saved.chapter), meta.chapterCount),
          );
          continueLabelRef.current = formatReadingPositionLabel({
            ...saved,
            bookName: saved.bookName ?? meta.name,
          });
          // Show continue hint when browsing freely (no study session attached)
          if (!searchParams.get("session")) {
            setShowContinueHint(true);
          }
        } else if (list.some((b) => b.id === "john")) {
          setBookId("john");
          setChapter(1);
        } else if (list[0]) {
          setBookId(list[0].id);
          setChapter(1);
        }
      } catch {
        if (!cancelled) {
          setError(
            "Could not load the Bible. If you are offline, open the app once online so Scripture can be cached.",
          );
        }
      } finally {
        if (!cancelled) setLoadingIndex(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bibleVersion]);

  // Load chapter when book/chapter/version changes (+ soft handoff)
  useEffect(() => {
    if (!bookId || loadingIndex) return;
    let cancelled = false;
    setSelectStart(null);
    setSelectEnd(null);

    const skipMotion = prefersReducedMotion || isFirstChapterLoadRef.current;
    if (!skipMotion) {
      setProseReveal(false);
      const meta = books.find((b) => b.id === bookId);
      setChapterGate({
        bookName: meta?.name ?? "Chapter",
        chapter,
      });
    }

    (async () => {
      setLoadingChapter(true);
      setError(null);
      try {
        const data = await getChapter(bookId, chapter, bibleVersion);
        if (cancelled) return;
        setChapterData(data);
        saveReadingPosition({
          bookId,
          chapter,
          bookName: data.book.name,
        });
        const pending = pendingSelectionRef.current;
        if (pending) {
          pendingSelectionRef.current = null;
          setSelectStart(pending.start);
          setSelectEnd(pending.end);
        }

        // Soft reveal after paint
        if (!skipMotion) {
          if (chapterGateTimerRef.current != null) {
            window.clearTimeout(chapterGateTimerRef.current);
          }
          chapterGateTimerRef.current = window.setTimeout(() => {
            if (cancelled) return;
            setProseReveal(true);
            setChapterGate(null);
          }, 280);
        } else {
          setProseReveal(true);
          setChapterGate(null);
        }
        isFirstChapterLoadRef.current = false;
      } catch {
        if (!cancelled) {
          setError("Could not load this chapter.");
          setChapterData(null);
          pendingSelectionRef.current = null;
          setProseReveal(true);
          setChapterGate(null);
        }
      } finally {
        if (!cancelled) setLoadingChapter(false);
      }
    })();
    return () => {
      cancelled = true;
      if (chapterGateTimerRef.current != null) {
        window.clearTimeout(chapterGateTimerRef.current);
        chapterGateTimerRef.current = null;
      }
    };
  }, [bookId, chapter, loadingIndex, bibleVersion, books, prefersReducedMotion]);

  function handleVersionChange(next: BibleVersionId) {
    const v = normalizeBibleVersion(next);
    setBibleVersion(v);
    saveReadingVersion(v);
    setSearchResults([]);
  }

  // Scroll to highlighted verse + optional soft pulse
  useEffect(() => {
    if (highlightVerse == null || loadingChapter || !proseReveal) return;
    const el = document.getElementById(`v-${highlightVerse}`);
    if (el) {
      el.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "center",
      });
      if (!prefersReducedMotion) {
        setPulseVerse(highlightVerse);
        const pulseT = window.setTimeout(() => setPulseVerse(null), 1200);
        const clearT = window.setTimeout(() => setHighlightVerse(null), 2500);
        return () => {
          window.clearTimeout(pulseT);
          window.clearTimeout(clearT);
        };
      }
      const t = window.setTimeout(() => setHighlightVerse(null), 2500);
      return () => window.clearTimeout(t);
    }
  }, [
    highlightVerse,
    loadingChapter,
    chapterData,
    proseReveal,
    prefersReducedMotion,
  ]);

  const goTo = useCallback(
    (
      nextBookId: string,
      nextChapter: number,
      verse?: number,
      opts?: { enterFocus?: boolean },
    ) => {
      setBookId(nextBookId);
      setChapter(nextChapter);
      setPanel("read");
      setBookPickerOpen(false);
      setChapterPickerOpen(false);
      setSelectStart(null);
      setSelectEnd(null);
      if (verse) setHighlightVerse(verse);
      if (opts?.enterFocus) {
        setFocusMode(true);
      }
      readerTopRef.current?.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
      });
    },
    [prefersReducedMotion],
  );

  function selectBook(id: string) {
    const meta = books.find((b) => b.id === id);
    setBookId(id);
    setChapter(1);
    setBookPickerOpen(false);
    if (meta) {
      saveReadingPosition({ bookId: id, chapter: 1, bookName: meta.name });
    }
  }

  function setFocus(on: boolean) {
    setFocusMode(on);
    if (on) setPanel("read");
  }

  function bumpFont(delta: -1 | 1) {
    setFontScale((prev) => clampFontScale(prev + delta));
  }

  function buildPassageDraft(opts?: {
    startVerse?: number;
    endVerse?: number;
  }): PassageDraft | null {
    if (!currentBook) return null;
    let startV = opts?.startVerse;
    let endV = opts?.endVerse;
    if (startV == null && selectionRange) {
      startV = selectionRange.start;
      endV = selectionRange.end;
    }
    if (startV == null) {
      startV = 1;
      endV = 1;
    }
    if (endV == null) endV = startV;
    return {
      bookName: currentBook.name,
      startChapter: chapter,
      startVerse: startV,
      endChapter: chapter,
      endVerse: endV,
    };
  }

  /** Next/prev chapter: jump to top of page so reading + video plate restart cleanly. */
  const scrollBibleToTop = useCallback(() => {
    const behavior: ScrollBehavior = prefersReducedMotion ? "auto" : "smooth";
    try {
      window.scrollTo({ top: 0, left: 0, behavior });
    } catch {
      window.scrollTo(0, 0);
    }
    // Also align the Bible page anchor (covers nested focus / sticky chrome)
    readerTopRef.current?.scrollIntoView({ behavior, block: "start" });
  }, [prefersReducedMotion]);

  function prevChapter() {
    if (!currentBook) return;
    if (chapter > 1) {
      setChapter(chapter - 1);
      scrollBibleToTop();
      return;
    }
    const idx = books.findIndex((b) => b.id === bookId);
    if (idx > 0) {
      const prev = books[idx - 1];
      setBookId(prev.id);
      setChapter(prev.chapterCount);
      scrollBibleToTop();
    }
  }

  function nextChapter() {
    if (!currentBook) return;
    if (chapter < currentBook.chapterCount) {
      setChapter(chapter + 1);
      scrollBibleToTop();
      return;
    }
    const idx = books.findIndex((b) => b.id === bookId);
    if (idx >= 0 && idx < books.length - 1) {
      const next = books[idx + 1];
      setBookId(next.id);
      setChapter(1);
      scrollBibleToTop();
    }
  }

  const canPrev =
    !!currentBook &&
    (chapter > 1 || books.findIndex((b) => b.id === bookId) > 0);
  const canNext =
    !!currentBook &&
    (chapter < currentBook.chapterCount ||
      books.findIndex((b) => b.id === bookId) < books.length - 1);

  function handleVerseTap(verseNum: number) {
    if (selectStart == null || (selectStart != null && selectEnd != null)) {
      // Start fresh selection
      setSelectStart(verseNum);
      setSelectEnd(null);
      return;
    }
    // Extend selection
    setSelectEnd(verseNum);
  }

  /** Jump to a passage logged tonight (session trail). */
  async function jumpToPassage(passage: Passage) {
    setPanel("read");
    const ref = formatPassageRef(passage);
    const startV = passage.startVerse;
    const endV = passage.endVerse ?? passage.startVerse;
    if (startV != null && endV != null) {
      pendingSelectionRef.current = {
        start: Math.min(startV, endV),
        end: Math.max(startV, endV),
      };
    } else {
      pendingSelectionRef.current = null;
    }

    // Prefer local book list match for speed / offline
    const bookName = passage.book.trim().toLowerCase();
    const local = books.find(
      (b) =>
        b.name.toLowerCase() === bookName ||
        b.abbrev.toLowerCase() === bookName ||
        b.id === bookName.replace(/\s+/g, "-"),
    );
    if (local) {
      // Same chapter: apply selection immediately (no reload race)
      if (local.id === bookId && passage.startChapter === chapter && startV != null) {
        setSelectStart(Math.min(startV, endV ?? startV));
        setSelectEnd(Math.max(startV, endV ?? startV));
        setHighlightVerse(startV);
        document.getElementById(`v-${startV}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        pendingSelectionRef.current = null;
        return;
      }
      goTo(local.id, passage.startChapter, startV ?? undefined);
      return;
    }
    const parsed = await parseReference(ref);
    if (parsed) {
      goTo(parsed.bookId, parsed.chapter, parsed.verse);
      return;
    }
    pendingSelectionRef.current = null;
    toast.error("Could not open that passage");
  }

  function openPrayFromSelection() {
    if (!currentBook) return;
    if (!logContext.spaceId) {
      toast.error("Choose a space to add prayer");
      setSpacePickerOpen(true);
      return;
    }
    const draft = buildPassageDraft();
    if (!draft) return;
    const passage = passageFromSelection(draft);
    const ref = formatPassageRef(passage);
    let excerpt: string | undefined;
    if (chapterData && selectionRange) {
      excerpt = chapterData.verses
        .filter(
          (v) =>
            v.verse >= selectionRange.start && v.verse <= selectionRange.end,
        )
        .map((v) => v.text)
        .join(" ");
      if (excerpt.length > 280) excerpt = `${excerpt.slice(0, 277)}…`;
    }
    setPrayDraft({ reference: ref, excerpt });
    setPrayOpen(true);
  }

  function clearSelection() {
    setSelectStart(null);
    setSelectEnd(null);
    setPrivateNoteDraft("");
    setShowPrivateNote(false);
  }

  function openLogModal(opts?: {
    startVerse?: number;
    endVerse?: number;
  }) {
    if (!currentBook) return;
    if (spaces.length === 0) {
      toast.error("Create a space first to log passages");
      navigate("/");
      return;
    }

    const draft = buildPassageDraft(opts);
    if (!draft) return;
    setLogDraft(draft);
    setLogOpen(true);
  }

  function handleLogged(session: Session) {
    clearSelection();
    toast.success("Passage logged", {
      description: canOneTapLog
        ? `Saved to ${sessionTitle ?? "tonight’s session"}.`
        : "Saved to the session’s passages studied list.",
      action: {
        label: "View space",
        onClick: () => navigate(`/space/${session.spaceId}`),
      },
    });
  }

  /** One-tap when session is pre-selected; otherwise open the full modal. */
  async function handleLogPassage(opts?: {
    startVerse?: number;
    endVerse?: number;
  }) {
    if (!currentBook) return;
    if (spaces.length === 0) {
      toast.error("Create a space first to log passages");
      navigate("/");
      return;
    }

    const draft = buildPassageDraft(opts);
    if (!draft) return;

    if (!canOneTapLog || !logContext.sessionId || !logContext.spaceId) {
      setLogDraft(draft);
      setLogOpen(true);
      return;
    }

    setLogging(true);
    try {
      const passage = passageFromSelection({
        ...draft,
        contextNote: privateNoteDraft.trim() || undefined,
      });
      const updated = await addPassageToSession(
        logContext.sessionId,
        passage,
      );

      if (privateNoteDraft.trim()) {
        await addPrivateNote({
          spaceId: logContext.spaceId,
          sessionId: logContext.sessionId,
          sectionKey: PRIVATE_SECTION.passages,
          content: `${formatPassageRef(passage)} — ${privateNoteDraft.trim()}`,
        });
      }

      handleLogged(updated);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not log passage",
      );
    } finally {
      setLogging(false);
    }
  }

  /** Device-only reflection tied to the selection (optional session). */
  async function handleSavePrivateNoteOnly() {
    const text = privateNoteDraft.trim();
    if (!text) {
      toast.error("Write a short reflection first");
      return;
    }
    if (!logContext.spaceId) {
      toast.error("Choose a space to keep private notes with");
      setSpacePickerOpen(true);
      return;
    }
    if (!currentBook) return;

    setSavingNote(true);
    try {
      const draft = buildPassageDraft();
      const ref =
        draft != null
          ? formatPassageRef(passageFromSelection(draft))
          : `${currentBook.name} ${chapter}`;
      await addPrivateNote({
        spaceId: logContext.spaceId,
        sessionId: logContext.sessionId ?? undefined,
        sectionKey: PRIVATE_SECTION.passages,
        content: `${ref} — ${text}`,
      });
      setPrivateNoteDraft("");
      setShowPrivateNote(false);
      toast.success("Private note saved", {
        description: "Stays on this device only — never shared in exports.",
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save private note",
      );
    } finally {
      setSavingNote(false);
    }
  }

  async function handleSearch(e?: FormEvent) {
    e?.preventDefault();
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchError("Enter at least 2 characters");
      setSearchResults([]);
      return;
    }

    const looksLikeRef =
      q.length < 40 &&
      /[A-Za-z]/.test(q) &&
      /\d/.test(q) &&
      !/\b(the|and|love|faith|hope|god|lord)\b/i.test(q);
    if (looksLikeRef) {
      const ref = await parseReference(q);
      if (ref) {
        goTo(ref.bookId, ref.chapter, ref.verse);
        setSearchResults([]);
        setSearchError(null);
        return;
      }
    }

    searchAbort.current?.abort();
    const ac = new AbortController();
    searchAbort.current = ac;
    setSearching(true);
    setSearchError(null);
    try {
      const results = await searchVerses(q, {
        version: bibleVersion,
        bookId: searchScope === "book" ? bookId : undefined,
        preferBookId: searchScope === "all" ? bookId : undefined,
        limit: 60,
        signal: ac.signal,
      });
      if (ac.signal.aborted) return;
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError("No verses found");
      }
    } catch {
      if (!ac.signal.aborted) {
        setSearchError("Search failed. Try again.");
      }
    } finally {
      if (!ac.signal.aborted) setSearching(false);
    }
  }

  /** Prefer URL update; store syncs via the searchParams effect. */
  function pickSpace(id: string, sessionId?: string | null) {
    const space = spaces.find((s) => s.id === id);
    const nextSession = sessionId ?? null;
    // Optimistic update so the banner is correct before the URL effect runs
    setLogContext({
      spaceId: id,
      spaceName: space?.name ?? null,
      sessionId: nextSession,
    });
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("space", id);
        if (nextSession) next.set("session", nextSession);
        else next.delete("session");
        return next;
      },
      { replace: true },
    );
    // Keep picker open after group pick so user can choose a meeting;
    // close only when a session was chosen or group alone is enough.
    if (nextSession) setSpacePickerOpen(false);
  }

  function clearSpaceContext() {
    clearLogContext();
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("space");
        next.delete("session");
        return next;
      },
      { replace: true },
    );
    setSpacePickerOpen(false);
  }

  /** Sessions available for the group currently selected in the picker. */
  const pickerSessions = useMemo(() => {
    if (!logContext.spaceId) return [] as Session[];
    const fromSpace =
      spaces.find((s) => s.id === logContext.spaceId)?.sessions ?? [];
    const fromStore = sessions.filter((s) => s.spaceId === logContext.spaceId);
    const byId = new Map<string, Session>();
    for (const s of [...fromSpace, ...fromStore]) byId.set(s.id, s);
    return Array.from(byId.values()).sort((a, b) =>
      b.date.localeCompare(a.date),
    );
  }, [logContext.spaceId, spaces, sessions]);

  if (loadingIndex) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-serif tracking-tight text-primary">
          Bible
        </h2>
        <p className="text-sm text-muted font-serif italic">
          Loading {versionMeta.shortLabel}…
        </p>
      </div>
    );
  }

  if (error && books.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-serif tracking-tight text-primary">
          Bible
        </h2>
        <Card className="space-y-2">
          <p className="text-sm text-danger">{error}</p>
          <p className="text-xs text-muted">{versionMeta.notice}</p>
        </Card>
      </div>
    );
  }

  const logButtonLabel = selectionRange
    ? `Log ${currentBook?.name} ${chapter}:${selectionRange.start}${selectionRange.end !== selectionRange.start ? `–${selectionRange.end}` : ""}`
    : canOneTapLog
      ? "Log to this session"
      : "Log passage";

  return (
    <div className="space-y-3" ref={readerTopRef}>
      {!focusMode && (
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {logContext.spaceId && logContext.spaceName ? (
              <NavBreadcrumb
                className="mb-1.5"
                items={[
                  { label: "Groups", to: "/" },
                  {
                    label: logContext.spaceName,
                    to: `/space/${logContext.spaceId}`,
                  },
                  { label: "Bible" },
                ]}
              />
            ) : null}
            {canOneTapLog || logContext.spaceName ? (
              <>
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
                  Tonight’s study
                </p>
                <h2 className="text-xl sm:text-2xl font-serif tracking-tight text-primary leading-snug">
                  {sessionTitle ?? logContext.spaceName ?? "Bible"}
                </h2>
                <p className="text-sm text-muted mt-0.5 leading-snug">
                  {sessionHint ?? "Select verses · one-tap log"}
                </p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-serif tracking-tight text-primary">
                  Bible
                </h2>
                <p className="text-sm text-muted mt-0.5 leading-snug">
                  Read · select verses · log to a group
                </p>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div
              className="inline-flex items-center rounded-full border border-border/80 bg-surface/80 backdrop-blur-sm overflow-hidden"
              role="group"
              aria-label="Text size"
            >
              <button
                type="button"
                onClick={() => bumpFont(-1)}
                disabled={fontScale <= 0}
                className="px-2.5 py-2 text-xs font-semibold text-primary touch-manipulation tap-target disabled:opacity-35 hover:bg-surface-muted/60"
                aria-label="Smaller text"
              >
                A−
              </button>
              <span className="w-px self-stretch bg-border/80" aria-hidden />
              <button
                type="button"
                onClick={() => bumpFont(1)}
                disabled={fontScale >= 3}
                className="px-2.5 py-2 text-xs font-semibold text-primary touch-manipulation tap-target disabled:opacity-35 hover:bg-surface-muted/60"
                aria-label="Larger text"
              >
                A+
              </button>
            </div>
            <button
              type="button"
              onClick={() => setFocus(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-surface/80 px-3 py-2 text-xs font-medium text-primary backdrop-blur-sm touch-manipulation tap-target hover:border-primary/30 transition-colors"
              aria-pressed={false}
              title="Focus reading mode"
            >
              <Focus className="h-3.5 w-3.5" aria-hidden />
              Focus
            </button>
          </div>
        </header>
      )}

      {focusMode && (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted">
              Focus reading
            </p>
            {(sessionTitle || logContext.spaceName) && (
              <p className="text-sm font-medium text-primary truncate">
                {sessionTitle ?? logContext.spaceName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div
              className="inline-flex items-center rounded-full border border-border/80 bg-surface/80 backdrop-blur-sm overflow-hidden"
              role="group"
              aria-label="Text size"
            >
              <button
                type="button"
                onClick={() => bumpFont(-1)}
                disabled={fontScale <= 0}
                className="px-2.5 py-2 text-xs font-semibold text-primary touch-manipulation disabled:opacity-35"
                aria-label="Smaller text"
              >
                A−
              </button>
              <span className="w-px self-stretch bg-border/80" aria-hidden />
              <button
                type="button"
                onClick={() => bumpFont(1)}
                disabled={fontScale >= 3}
                className="px-2.5 py-2 text-xs font-semibold text-primary touch-manipulation disabled:opacity-35"
                aria-label="Larger text"
              >
                A+
              </button>
            </div>
            <button
              type="button"
              onClick={() => setFocus(false)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-surface/80 px-3 py-2 text-xs font-medium text-primary backdrop-blur-sm touch-manipulation tap-target hover:border-primary/30"
              aria-pressed={true}
            >
              <Maximize2 className="h-3.5 w-3.5" aria-hidden />
              Controls
            </button>
          </div>
        </div>
      )}

      {/* Continue where you left off — free browse only */}
      {!focusMode &&
        showContinueHint &&
        !canOneTapLog &&
        continueLabelRef.current && (
          <button
            type="button"
            onClick={() => setShowContinueHint(false)}
            className="w-full text-left touch-manipulation"
          >
            <Card
              padding="sm"
              className="flex items-center justify-between gap-2 bg-primary/5 border-primary/15"
            >
              <span className="text-sm text-primary">
                <span className="font-medium">Continue </span>
                <span className="font-serif">{continueLabelRef.current}</span>
              </span>
              <span className="text-xs text-muted shrink-0">Dismiss</span>
            </Card>
          </button>
        )}

      {/* Compact translation + Read/Search — one quiet chrome row */}
      {!focusMode && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div
              className="grid grid-cols-2 gap-0.5 rounded-xl bg-surface-muted/90 p-0.5 border border-border/50"
              role="group"
              aria-label="Bible translation"
            >
              {BIBLE_VERSIONS.map((v) => {
                const selected = bibleVersion === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleVersionChange(v.id)}
                    className={[
                      "rounded-lg py-2 text-xs font-semibold touch-manipulation tap-target",
                      selected
                        ? "bg-surface text-primary shadow-sm"
                        : "text-muted",
                    ].join(" ")}
                    aria-pressed={selected}
                  >
                    {v.shortLabel}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-0.5 rounded-xl bg-surface-muted/90 p-0.5 border border-border/50">
              <button
                type="button"
                onClick={() => setPanel("read")}
                className={[
                  "rounded-lg py-2 text-xs font-medium touch-manipulation tap-target",
                  panel === "read"
                    ? "bg-surface text-primary shadow-sm"
                    : "text-muted",
                ].join(" ")}
              >
                Read
              </button>
              <button
                type="button"
                onClick={() => {
                  setFocusMode(false);
                  setPanel("search");
                }}
                className={[
                  "rounded-lg py-2 text-xs font-medium touch-manipulation tap-target inline-flex items-center justify-center gap-1",
                  panel === "search"
                    ? "bg-surface text-primary shadow-sm"
                    : "text-muted",
                ].join(" ")}
              >
                <Search className="h-3.5 w-3.5" aria-hidden />
                Search
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-0.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted">
              <BookOpen className="h-3.5 w-3.5 text-primary/70" aria-hidden />
              {isOnline ? "Saves as you read" : "Offline"} ·{" "}
              {versionMeta.shortLabel}
            </span>
            {!isOnline && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-900 dark:text-amber-100 bg-amber-100/80 dark:bg-amber-950/50 border border-amber-200/70 dark:border-amber-800/50 rounded-full px-2 py-0.5">
                <WifiOff className="h-3 w-3" aria-hidden />
                Cached only
              </span>
            )}
          </div>
        </div>
      )}

      {/* Offline tip only when it matters */}
      {!focusMode && !isOnline && (
        <Card
          padding="sm"
          className="text-xs leading-relaxed border-amber-300/60 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-50"
        >
          <span className="font-semibold">You’re offline. </span>
          Only books and chapters you’ve opened before on this phone will load.
        </Card>
      )}

      {/* Group logging context — compact in focus mode when active */}
      {!focusMode &&
        (logContext.spaceName ? (
          <BibleLogContextBanner
            onChange={() => setSpacePickerOpen(true)}
            onClear={clearSpaceContext}
            sessionHint={sessionHint}
          />
        ) : (
          <button
            type="button"
            onClick={() => setSpacePickerOpen(true)}
            className="w-full text-left touch-manipulation"
          >
            <Card
              padding="sm"
              className="hover:border-primary/30 transition-colors flex items-center justify-between gap-2 bg-surface/70"
            >
              <span className="text-sm text-muted">
                Studying for a group?
              </span>
              <span className="text-xs font-medium text-primary shrink-0">
                Choose
              </span>
            </Card>
          </button>
        ))}

      {focusMode && (logContext.spaceName || canOneTapLog) && (
        <p className="text-xs text-center text-muted">
          {canOneTapLog ? (
            <>
              One-tap log to{" "}
              <span className="font-medium text-primary">
                {sessionTitle ?? logContext.spaceName}
              </span>
            </>
          ) : (
            <>
              Logging to{" "}
              <span className="font-medium text-primary">
                {logContext.spaceName}
              </span>
            </>
          )}
        </p>
      )}

      {/* Session guide + tonight’s passage trail */}
      {activeSession && sessionTemplate && sessionTemplate.steps.length > 0 && (
        <StudyGuideChip
          session={activeSession}
          template={sessionTemplate}
          compact={focusMode}
        />
      )}

      {activeSession && sessionPassages.length > 0 && (
        <SessionPassageTrail
          passages={sessionPassages}
          currentBookName={currentBook?.name}
          currentChapter={chapter}
          onJump={(p) => void jumpToPassage(p)}
          compact={focusMode}
        />
      )}

      {panel === "search" && !focusMode ? (
        <SearchPanel
          query={searchQuery}
          onQueryChange={setSearchQuery}
          scope={searchScope}
          onScopeChange={setSearchScope}
          currentBookName={currentBook?.name ?? "this book"}
          results={searchResults}
          searching={searching}
          error={searchError}
          onSubmit={handleSearch}
          onSelectResult={(v) =>
            goTo(v.bookId, v.chapter, v.verse, { enterFocus: true })
          }
          onLogResult={(v) => {
            goTo(v.bookId, v.chapter, v.verse, { enterFocus: true });
            setLogDraft({
              bookName: v.bookName,
              startChapter: v.chapter,
              startVerse: v.verse,
              endChapter: v.chapter,
              endVerse: v.verse,
            });
            setLogOpen(true);
          }}
        />
      ) : (
        <>
          {/* Sticky book / chapter chrome */}
          <div className="bible-sticky-chrome -mx-1 px-1 py-1.5 space-y-2 rounded-2xl bg-bg/55 backdrop-blur-xl border border-border/40 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={prevChapter}
                disabled={!canPrev || loadingChapter}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-primary touch-manipulation disabled:opacity-40 hover:bg-surface-muted/80"
                aria-label="Previous chapter"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>

              <button
                type="button"
                onClick={() => setBookPickerOpen(true)}
                className="min-w-0 flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-surface/90 border border-border/70 px-3 py-2.5 text-sm font-medium text-primary touch-manipulation tap-target hover:border-primary/30"
                aria-label="Choose book"
              >
                <Library className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                <span className="truncate font-serif">
                  {currentBook?.name ?? "Book"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
              </button>

              <button
                type="button"
                onClick={() => setChapterPickerOpen(true)}
                className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-surface/90 border border-border/70 px-3 py-2.5 text-sm font-semibold tabular-nums text-primary touch-manipulation tap-target hover:border-primary/30"
                aria-label="Choose chapter"
              >
                {chapter}
                <span className="text-muted font-normal text-xs">
                  /{currentBook?.chapterCount ?? "—"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 opacity-50" aria-hidden />
              </button>

              <button
                type="button"
                onClick={nextChapter}
                disabled={!canNext || loadingChapter}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-primary touch-manipulation disabled:opacity-40 hover:bg-surface-muted/80"
                aria-label="Next chapter"
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </div>

          {error && (
            <Card className="border-danger/30 bg-danger/10 text-danger text-sm">
              {error}
            </Card>
          )}

          {/* Sanctuary chapter surface — Cross video bg (AnimateStudio job) */}
          <article
            className={[
              "bible-reader relative rounded-3xl px-5 py-6 sm:px-7 sm:py-8",
              // LOCKED: overflow-hidden kills position:sticky for the video plate
              // in Chrome (plate only lasts one screen). See
              // docs/final/bible-reader-scroll-video-plate.md
              // Only clip when motion is off and there is no sticky plate.
              prefersReducedMotion
                ? "overflow-hidden"
                : "bible-reader--with-video overflow-visible",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-busy={loadingChapter}
            aria-label={
              currentBook
                ? `${currentBook.name} chapter ${chapter}`
                : "Chapter"
            }
          >
            <BibleReaderVideoBg
              active={!prefersReducedMotion}
              passageKey={`${bibleVersion}-${bookId}-${chapter}`}
            />

            <div className="bible-reader__content">
              {chapterGate && (
                <div className="bible-chapter-gate" aria-hidden>
                  <p className="bible-chapter-gate__label">
                    {chapterGate.bookName}
                    <span>Chapter {chapterGate.chapter}</span>
                  </p>
                </div>
              )}

              <header className="mb-6 text-center">
                <p className="text-[11px] font-sans font-medium uppercase tracking-[0.14em] text-muted mb-2">
                  {versionMeta.shortLabel}
                </p>
                <h2 className="text-[1.65rem] sm:text-[1.85rem] font-serif font-semibold text-primary tracking-tight leading-tight">
                  {currentBook?.name}
                </h2>
                <p className="mt-1 font-serif text-lg text-muted tabular-nums">
                  Chapter {chapter}
                </p>
                <div
                  className="mx-auto mt-4 h-px w-16 bg-gradient-to-r from-transparent via-accent/70 to-transparent"
                  aria-hidden
                />
              </header>

              {loadingChapter && !chapterData ? (
                <p className="text-sm text-muted text-center py-10 font-serif italic">
                  Loading chapter…
                </p>
              ) : chapterData ? (
                <div
                  className={[
                    "bible-reader-prose space-y-0.5",
                    loadingChapter && proseReveal ? "opacity-60" : "",
                  ].join(" ")}
                  data-reveal={proseReveal ? "true" : "false"}
                  style={
                    {
                      ["--reader-font-scale"]: String(fontMultiplier),
                    } as CSSProperties
                  }
                >
                  {chapterData.verses.map((v) => {
                    const inSelection =
                      selectionRange != null &&
                      v.verse >= selectionRange.start &&
                      v.verse <= selectionRange.end;
                    const active = highlightVerse === v.verse;
                    const logged = loggedVersesInChapter.has(v.verse);
                    const pulsing = pulseVerse === v.verse;
                    return (
                      <button
                        key={v.verse}
                        type="button"
                        id={`v-${v.verse}`}
                        onClick={() => handleVerseTap(v.verse)}
                        data-selected={inSelection ? "true" : "false"}
                        data-active={active ? "true" : "false"}
                        data-logged={logged ? "true" : "false"}
                        data-pulse={pulsing ? "true" : "false"}
                        className="bible-reader-verse"
                      >
                        <span className="bible-reader-vnum tabular-nums">
                          {v.verse}
                        </span>
                        {v.text}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {!focusMode && (
                <p className="mt-6 text-center text-[11px] font-sans text-muted/80">
                  Tap a verse to select · tap another for a range
                </p>
              )}
            </div>
          </article>

          {/* Sticky log + private reflection — above bottom nav */}
          <div
            className={[
              "bible-sticky-log rounded-2xl border border-border/70 bg-surface/90 backdrop-blur-xl p-2.5 shadow-[var(--shadow-card)] space-y-2",
              selectionRange ? "ring-1 ring-primary/20" : "",
            ].join(" ")}
          >
            {selectionRange && (
              <div className="space-y-2">
                {!showPrivateNote ? (
                  <button
                    type="button"
                    onClick={() => setShowPrivateNote(true)}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-medium text-muted hover:text-primary hover:bg-surface-muted/60 touch-manipulation"
                  >
                    <Lock className="h-3.5 w-3.5" aria-hidden />
                    Private note (this device only)
                  </button>
                ) : (
                  <div className="rounded-xl border border-primary/15 bg-primary/5 p-2.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-primary inline-flex items-center gap-1">
                        <Lock className="h-3.5 w-3.5" aria-hidden />
                        Private reflection
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPrivateNote(false);
                          setPrivateNoteDraft("");
                        }}
                        className="text-xs text-muted hover:text-primary px-1 py-1"
                      >
                        Hide
                      </button>
                    </div>
                    <textarea
                      value={privateNoteDraft}
                      onChange={(e) => setPrivateNoteDraft(e.target.value)}
                      rows={2}
                      placeholder="What stood out? What will you obey?"
                      className="w-full rounded-lg border border-border bg-bg/90 px-2.5 py-2 text-sm resize-y min-h-[52px]"
                      disabled={logging || savingNote}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        className="!py-2 !px-3 text-xs flex-1"
                        disabled={savingNote || !privateNoteDraft.trim()}
                        onClick={() => void handleSavePrivateNoteOnly()}
                      >
                        {savingNote ? "Saving…" : "Note only"}
                      </Button>
                      {!logContext.spaceId && (
                        <Button
                          variant="ghost"
                          className="!py-2 !px-3 text-xs"
                          onClick={() => setSpacePickerOpen(true)}
                        >
                          Choose space
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectionRange && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  fullWidth
                  className="!py-2.5 text-sm"
                  disabled={logging}
                  onClick={openPrayFromSelection}
                >
                  <HandHeart className="h-4 w-4" aria-hidden />
                  Pray this
                </Button>
                <Button
                  variant="ghost"
                  fullWidth
                  className="!py-2.5 text-sm"
                  disabled={logging}
                  onClick={clearSelection}
                >
                  Clear
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                fullWidth
                disabled={logging}
                onClick={() => void handleLogPassage()}
              >
                <BookMarked className="h-5 w-5" aria-hidden />
                {logging ? "Saving…" : logButtonLabel}
              </Button>
            </div>

            {canOneTapLog ? (
              <p className="text-[11px] text-center text-muted leading-snug">
                Saves to this session
                {privateNoteDraft.trim() ? " · note included" : ""}.{" "}
                <button
                  type="button"
                  onClick={() => openLogModal()}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  Change destination
                </button>
              </p>
            ) : (
              <p className="text-[11px] text-center text-muted">
                {logContext.spaceName
                  ? "Pick a session in the next step"
                  : "You’ll choose a space & session next"}
              </p>
            )}
          </div>

          {!focusMode && (
            <div className="flex gap-2 pb-1">
              <Button
                variant="secondary"
                fullWidth
                onClick={prevChapter}
                disabled={!canPrev || loadingChapter}
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
                Previous
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={nextChapter}
                disabled={!canNext || loadingChapter}
              >
                Next
                <ChevronRight className="h-5 w-5" aria-hidden />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Book picker */}
      <Modal
        open={bookPickerOpen}
        title="Choose book"
        onClose={() => setBookPickerOpen(false)}
      >
        <div className="space-y-5 max-h-[60dvh] overflow-y-auto -mx-1 px-1">
          <BookGroup
            title="Old Testament"
            books={ot}
            activeId={bookId}
            onSelect={selectBook}
          />
          <BookGroup
            title="New Testament"
            books={nt}
            activeId={bookId}
            onSelect={selectBook}
          />
        </div>
      </Modal>

      {/* Chapter picker */}
      <Modal
        open={chapterPickerOpen}
        title={`${currentBook?.name ?? "Book"} — chapter`}
        onClose={() => setChapterPickerOpen(false)}
      >
        <div className="grid grid-cols-5 gap-2 max-h-[55dvh] overflow-y-auto">
          {Array.from(
            { length: currentBook?.chapterCount ?? 0 },
            (_, i) => i + 1,
          ).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setChapter(n);
                setChapterPickerOpen(false);
              }}
              className={[
                "rounded-xl border py-3 text-sm font-medium touch-manipulation tap-target tabular-nums",
                n === chapter
                  ? "border-primary bg-primary text-on-primary"
                  : "border-border bg-bg text-primary hover:border-primary/40",
              ].join(" ")}
            >
              {n}
            </button>
          ))}
        </div>
      </Modal>

      {/* Group + meeting context picker */}
      <Modal
        open={spacePickerOpen}
        title="Studying for…"
        onClose={() => setSpacePickerOpen(false)}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted -mt-1">
            Choose which group receives passages you log. Optionally pick a
            meeting for one-tap log.
          </p>
          {spaces.length === 0 ? (
            <p className="text-sm text-muted">
              No groups yet.{" "}
              <Link to="/new" className="text-primary font-medium underline">
                Create one
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-2 max-h-[36dvh] overflow-y-auto">
              {spaces.map((s) => {
                const active = s.id === logContext.spaceId;
                const meetingCount =
                  s.sessions?.length ??
                  sessions.filter((sess) => sess.spaceId === s.id).length;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => pickSpace(s.id)}
                      className={[
                        "w-full text-left rounded-xl border px-3 py-3 touch-manipulation tap-target",
                        active
                          ? "border-primary bg-primary text-on-primary"
                          : "border-border bg-bg hover:border-primary/30",
                      ].join(" ")}
                    >
                      <p className="font-medium">{s.name}</p>
                      <p
                        className={[
                          "text-xs mt-0.5",
                          active ? "text-on-primary/80" : "text-muted",
                        ].join(" ")}
                      >
                        {s.members.length} people
                        {meetingCount > 0
                          ? ` · ${meetingCount} meeting${meetingCount === 1 ? "" : "s"}`
                          : ""}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {logContext.spaceId && (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-sm font-medium text-primary">
                Meeting{" "}
                <span className="text-muted font-normal">(optional)</span>
              </p>
              {pickerSessions.length === 0 ? (
                <p className="text-xs text-muted leading-relaxed">
                  No meetings yet for this group. You can still log passages and
                  pick a meeting later.
                </p>
              ) : (
                <ul className="space-y-1.5 max-h-[28dvh] overflow-y-auto">
                  {pickerSessions.slice(0, 12).map((sess) => {
                    const tpl = templates.find((t) => t.id === sess.templateId);
                    const label = sessionDisplayTitle(sess, tpl);
                    const active = sess.id === logContext.sessionId;
                    return (
                      <li key={sess.id}>
                        <button
                          type="button"
                          onClick={() =>
                            pickSpace(logContext.spaceId!, sess.id)
                          }
                          className={[
                            "w-full text-left rounded-xl border px-3 py-2.5 touch-manipulation tap-target",
                            active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-bg hover:border-primary/30",
                          ].join(" ")}
                        >
                          <p className="text-sm font-medium truncate">
                            {label}
                          </p>
                          <p className="text-[11px] text-muted mt-0.5 tabular-nums">
                            {sess.date.slice(0, 10)}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Button
                variant="secondary"
                fullWidth
                className="!py-2.5 text-sm"
                onClick={() => setSpacePickerOpen(false)}
              >
                Done
              </Button>
            </div>
          )}

          {logContext.spaceId && (
            <Button variant="ghost" fullWidth onClick={clearSpaceContext}>
              Clear group context
            </Button>
          )}
        </div>
      </Modal>

      {logDraft && (
        <LogPassageModal
          open={logOpen}
          onClose={() => {
            setLogOpen(false);
            setLogDraft(null);
          }}
          draft={logDraft}
          onLogged={handleLogged}
        />
      )}

      {prayDraft && logContext.spaceId && (
        <PrayFromVerseModal
          open={prayOpen}
          onClose={() => {
            setPrayOpen(false);
            setPrayDraft(null);
          }}
          spaceId={logContext.spaceId}
          sessionId={logContext.sessionId}
          members={linkedSpace?.members ?? []}
          draft={prayDraft}
        />
      )}
    </div>
  );
}

function BookGroup({
  title,
  books,
  activeId,
  onSelect,
}: {
  title: string;
  books: BibleBookMeta[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
        {title}
      </h3>
      <ul className="grid grid-cols-1 gap-1">
        {books.map((b) => {
          const active = b.id === activeId;
          return (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => onSelect(b.id)}
                className={[
                  "w-full flex items-center justify-between gap-2 rounded-xl px-3 py-3 text-left touch-manipulation tap-target",
                  active
                    ? "bg-primary text-on-primary"
                    : "bg-bg border border-border hover:border-primary/30",
                ].join(" ")}
              >
                <span className="font-medium truncate">{b.name}</span>
                <span
                  className={[
                    "text-xs shrink-0 tabular-nums",
                    active ? "text-on-primary/80" : "text-muted",
                  ].join(" ")}
                >
                  {b.chapterCount} ch
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SearchPanel({
  query,
  onQueryChange,
  scope,
  onScopeChange,
  currentBookName,
  results,
  searching,
  error,
  onSubmit,
  onSelectResult,
  onLogResult,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  scope: "book" | "all";
  onScopeChange: (s: "book" | "all") => void;
  currentBookName: string;
  results: SearchHit[];
  searching: boolean;
  error: string | null;
  onSubmit: (e?: FormEvent) => void;
  onSelectResult: (v: SearchHit) => void;
  onLogResult: (v: SearchHit) => void;
}) {
  return (
    <div className="space-y-4">
      <form onSubmit={(e) => onSubmit(e)} className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Search or jump</span>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 py-3 text-base"
              placeholder='e.g. "God so loved" or John 3:16'
              autoComplete="off"
              enterKeyHint="search"
            />
            {query && (
              <Button
                type="button"
                variant="ghost"
                className="!p-3 shrink-0"
                onClick={() => onQueryChange("")}
                aria-label="Clear search"
              >
                <X className="h-5 w-5" aria-hidden />
              </Button>
            )}
          </div>
        </label>

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1">
          <button
            type="button"
            onClick={() => onScopeChange("book")}
            className={[
              "rounded-lg py-2 text-xs font-medium touch-manipulation tap-target",
              scope === "book"
                ? "bg-surface text-primary shadow-sm"
                : "text-muted",
            ].join(" ")}
          >
            In {currentBookName}
          </button>
          <button
            type="button"
            onClick={() => onScopeChange("all")}
            className={[
              "rounded-lg py-2 text-xs font-medium touch-manipulation tap-target",
              scope === "all"
                ? "bg-surface text-primary shadow-sm"
                : "text-muted",
            ].join(" ")}
          >
            Whole Bible
          </button>
        </div>

        <Button type="submit" fullWidth disabled={searching}>
          <Search className="h-4 w-4" aria-hidden />
          {searching
            ? scope === "all"
              ? "Searching Bible…"
              : "Searching…"
            : "Search"}
        </Button>
        <p className="text-xs text-muted text-center">
          Results are ranked by relevance. Phrase matches appear first.
          {scope === "all"
            ? ` Hits in ${currentBookName} are boosted.`
            : null}
        </p>
      </form>

      {error && results.length === 0 && (
        <p className="text-sm text-muted text-center py-2">{error}</p>
      )}

      {results.length > 0 && (
        <ul className="space-y-2" aria-label="Search results">
          {results.map((v, index) => (
            <li key={`${v.bookId}-${v.chapter}-${v.verse}`}>
              <Card
                padding="sm"
                className="hover:border-primary/30 transition-colors space-y-2"
              >
                <button
                  type="button"
                  onClick={() => onSelectResult(v)}
                  className="w-full text-left touch-manipulation"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-primary">
                      {formatReference(v)}
                    </p>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted shrink-0">
                      {matchLabel(v.matchType)}
                      {index === 0 ? " · top" : ""}
                    </span>
                  </div>
                  <p className="text-[0.95rem] font-serif leading-[1.7] line-clamp-3 mt-1.5 text-text">
                    {splitHighlight(v.text, query).map((part, i) =>
                      part.match ? (
                        <mark
                          key={i}
                          className="bg-accent/35 text-inherit rounded-sm px-0.5 not-italic"
                        >
                          {part.text}
                        </mark>
                      ) : (
                        <span key={i}>{part.text}</span>
                      ),
                    )}
                  </p>
                </button>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="!py-2 !px-3 text-sm flex-1"
                    onClick={() => onSelectResult(v)}
                  >
                    Open
                  </Button>
                  <Button
                    className="!py-2 !px-3 text-sm flex-1"
                    onClick={() => onLogResult(v)}
                  >
                    <BookMarked className="h-4 w-4" aria-hidden />
                    Log
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function matchLabel(type: SearchHit["matchType"]): string {
  switch (type) {
    case "exact-phrase":
      return "Phrase";
    case "all-words":
      return "All words";
    case "reference":
      return "Reference";
    default:
      return "Partial";
  }
}
