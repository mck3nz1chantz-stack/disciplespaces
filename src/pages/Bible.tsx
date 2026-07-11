import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  BookMarked,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Library,
  Search,
  WifiOff,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Modal } from "../components/Modal";
import {
  LogPassageModal,
  type PassageDraft,
} from "../components/LogPassageModal";
import { BibleLogContextBanner } from "../components/BibleLogContextBanner";
import { KJV_NOTICE } from "../lib/legal";
import {
  formatReference,
  getBooks,
  getChapter,
  groupBooksByTestament,
  loadReadingPosition,
  parseReference,
  saveReadingPosition,
  searchVerses,
  splitHighlight,
  type BibleBookMeta,
  type ChapterData,
  type SearchHit,
} from "../lib/bible";
import { useAppStore } from "../stores/useAppStore";
import { useBibleStore } from "../stores/useBibleStore";
import type { Session } from "../types";

type Panel = "read" | "search";

export function Bible() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const spaces = useAppStore((s) => s.spaces);
  const sessions = useAppStore((s) => s.sessions);
  const templates = useAppStore((s) => s.templates);
  const initialize = useAppStore((s) => s.initialize);
  const logContext = useBibleStore((s) => s.logContext);
  const setLogContext = useBibleStore((s) => s.setLogContext);
  const clearLogContext = useBibleStore((s) => s.clearLogContext);

  const [books, setBooks] = useState<BibleBookMeta[]>([]);
  const [bookId, setBookId] = useState("john");
  const [chapter, setChapter] = useState(1);
  const [chapterData, setChapterData] = useState<ChapterData | null>(null);
  const [loadingIndex, setLoadingIndex] = useState(true);
  const [loadingChapter, setLoadingChapter] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  const readerTopRef = useRef<HTMLDivElement>(null);

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

  const sessionHint = useMemo(() => {
    if (!logContext.sessionId) return null;
    const session =
      sessions.find((s) => s.id === logContext.sessionId) ??
      spaces
        .flatMap((s) => s.sessions ?? [])
        .find((s) => s.id === logContext.sessionId);
    if (!session) return "pre-selected";
    const tpl = templates.find((t) => t.id === session.templateId)?.name;
    const day = session.date.slice(0, 10);
    return tpl ? `${day} · ${tpl}` : day;
  }, [logContext.sessionId, sessions, spaces, templates]);

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

  // Ensure spaces are available for URL → context resolution
  useEffect(() => {
    void initialize();
  }, [initialize]);

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

  // Clear context when leaving the Bible reader
  useEffect(() => {
    return () => {
      clearLogContext();
    };
  }, [clearLogContext]);

  // Load index + restore position
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingIndex(true);
      setError(null);
      try {
        const list = await getBooks();
        if (cancelled) return;
        setBooks(list);
        const saved = loadReadingPosition();
        if (saved && list.some((b) => b.id === saved.bookId)) {
          const meta = list.find((b) => b.id === saved.bookId)!;
          setBookId(saved.bookId);
          setChapter(
            Math.min(Math.max(1, saved.chapter), meta.chapterCount),
          );
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
  }, []);

  // Load chapter when book/chapter changes
  useEffect(() => {
    if (!bookId || loadingIndex) return;
    let cancelled = false;
    setSelectStart(null);
    setSelectEnd(null);
    (async () => {
      setLoadingChapter(true);
      setError(null);
      try {
        const data = await getChapter(bookId, chapter);
        if (cancelled) return;
        setChapterData(data);
        saveReadingPosition({ bookId, chapter });
      } catch {
        if (!cancelled) {
          setError("Could not load this chapter.");
          setChapterData(null);
        }
      } finally {
        if (!cancelled) setLoadingChapter(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId, chapter, loadingIndex]);

  // Scroll to highlighted verse
  useEffect(() => {
    if (highlightVerse == null || loadingChapter) return;
    const el = document.getElementById(`v-${highlightVerse}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const t = window.setTimeout(() => setHighlightVerse(null), 2500);
      return () => window.clearTimeout(t);
    }
  }, [highlightVerse, loadingChapter, chapterData]);

  const goTo = useCallback(
    (nextBookId: string, nextChapter: number, verse?: number) => {
      setBookId(nextBookId);
      setChapter(nextChapter);
      setPanel("read");
      setBookPickerOpen(false);
      setChapterPickerOpen(false);
      setSelectStart(null);
      setSelectEnd(null);
      if (verse) setHighlightVerse(verse);
      readerTopRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    },
    [],
  );

  function selectBook(id: string) {
    const meta = books.find((b) => b.id === id);
    setBookId(id);
    setChapter(1);
    setBookPickerOpen(false);
    if (meta) saveReadingPosition({ bookId: id, chapter: 1 });
  }

  function prevChapter() {
    if (!currentBook) return;
    if (chapter > 1) {
      setChapter(chapter - 1);
      return;
    }
    const idx = books.findIndex((b) => b.id === bookId);
    if (idx > 0) {
      const prev = books[idx - 1];
      setBookId(prev.id);
      setChapter(prev.chapterCount);
    }
  }

  function nextChapter() {
    if (!currentBook) return;
    if (chapter < currentBook.chapterCount) {
      setChapter(chapter + 1);
      return;
    }
    const idx = books.findIndex((b) => b.id === bookId);
    if (idx >= 0 && idx < books.length - 1) {
      const next = books[idx + 1];
      setBookId(next.id);
      setChapter(1);
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

  function clearSelection() {
    setSelectStart(null);
    setSelectEnd(null);
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

    setLogDraft({
      bookName: currentBook.name,
      startChapter: chapter,
      startVerse: startV,
      endChapter: chapter,
      endVerse: endV,
    });
    setLogOpen(true);
  }

  function handleLogged(session: Session) {
    clearSelection();
    toast.success("Passage logged", {
      description: "Saved to the session’s passages studied list.",
      action: {
        label: "View space",
        onClick: () => navigate(`/space/${session.spaceId}`),
      },
    });
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
  function pickSpace(id: string) {
    const space = spaces.find((s) => s.id === id);
    // Optimistic update so the banner is correct before the URL effect runs
    setLogContext({
      spaceId: id,
      spaceName: space?.name ?? null,
      sessionId: null,
    });
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("space", id);
        next.delete("session");
        return next;
      },
      { replace: true },
    );
    setSpacePickerOpen(false);
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

  if (loadingIndex) {
    return (
      <div className="space-y-4">
        <Header />
        <p className="text-sm text-muted">Loading offline KJV…</p>
      </div>
    );
  }

  if (error && books.length === 0) {
    return (
      <div className="space-y-4">
        <Header />
        <Card className="space-y-2">
          <p className="text-sm text-danger">{error}</p>
          <p className="text-xs text-muted">{KJV_NOTICE}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4" ref={readerTopRef}>
      <Header />

      {/* Context + offline badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success bg-success/10 border border-success/25 rounded-full px-2.5 py-1">
          <BookOpen className="h-3.5 w-3.5" aria-hidden />
          Offline Bible · KJV
        </span>
        {!isOnline && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-900 bg-amber-100 border border-amber-200 rounded-full px-2.5 py-1">
            <WifiOff className="h-3.5 w-3.5" aria-hidden />
            Reading offline
          </span>
        )}
      </div>

      {/* Space logging context (URL-driven) */}
      {logContext.spaceName ? (
        <BibleLogContextBanner
          onSwitchSpace={() => setSpacePickerOpen(true)}
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
            className="hover:border-primary/30 transition-colors flex items-center justify-between gap-2"
          >
            <span className="text-sm text-muted">
              Tip: open Bible from a Space to log passages with context.
            </span>
            <span className="text-xs font-medium text-primary shrink-0">
              Choose space
            </span>
          </Card>
        </button>
      )}

      {/* Panel tabs */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1">
        <button
          type="button"
          onClick={() => setPanel("read")}
          className={[
            "rounded-lg py-2.5 text-sm font-medium touch-manipulation tap-target",
            panel === "read"
              ? "bg-surface text-primary shadow-sm"
              : "text-muted",
          ].join(" ")}
        >
          Read
        </button>
        <button
          type="button"
          onClick={() => setPanel("search")}
          className={[
            "rounded-lg py-2.5 text-sm font-medium touch-manipulation tap-target inline-flex items-center justify-center gap-1.5",
            panel === "search"
              ? "bg-surface text-primary shadow-sm"
              : "text-muted",
          ].join(" ")}
        >
          <Search className="h-4 w-4" aria-hidden />
          Search
        </button>
      </div>

      {panel === "search" ? (
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
          onSelectResult={(v) => goTo(v.bookId, v.chapter, v.verse)}
          onLogResult={(v) => {
            goTo(v.bookId, v.chapter, v.verse);
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
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                className="!px-3 flex-1 justify-between min-w-0"
                onClick={() => setBookPickerOpen(true)}
                aria-label="Choose book"
              >
                <span className="inline-flex items-center gap-2 min-w-0">
                  <Library className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">
                    {currentBook?.name ?? "Book"}
                  </span>
                </span>
                <ChevronDown
                  className="h-4 w-4 shrink-0 opacity-60"
                  aria-hidden
                />
              </Button>
              <Button
                variant="secondary"
                className="!px-3 shrink-0 tabular-nums"
                onClick={() => setChapterPickerOpen(true)}
                aria-label="Choose chapter"
              >
                Ch {chapter}
                <ChevronDown className="h-4 w-4 opacity-60" aria-hidden />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="!px-3 flex-1"
                onClick={prevChapter}
                disabled={!canPrev || loadingChapter}
                aria-label="Previous chapter"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
                Prev
              </Button>
              <p className="text-sm text-muted text-center shrink-0 min-w-[5.5rem] tabular-nums">
                {chapter}
                <span className="text-muted/70">
                  {" "}
                  / {currentBook?.chapterCount ?? "—"}
                </span>
              </p>
              <Button
                variant="ghost"
                className="!px-3 flex-1"
                onClick={nextChapter}
                disabled={!canNext || loadingChapter}
                aria-label="Next chapter"
              >
                Next
                <ChevronRight className="h-5 w-5" aria-hidden />
              </Button>
            </div>
          </div>

          {error && (
            <Card className="border-danger/30 bg-danger/10 text-danger text-sm">
              {error}
            </Card>
          )}

          {/* Selection + log bar */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button fullWidth onClick={() => openLogModal()}>
              <BookMarked className="h-5 w-5" aria-hidden />
              {selectionRange
                ? `Log ${currentBook?.name} ${chapter}:${selectionRange.start}${selectionRange.end !== selectionRange.start ? `–${selectionRange.end}` : ""}`
                : "Log passage"}
            </Button>
            {selectionRange && (
              <Button variant="secondary" fullWidth onClick={clearSelection}>
                Clear selection
              </Button>
            )}
          </div>
          <p className="text-xs text-muted text-center -mt-1">
            Tap a verse to select · tap another to set the range end
          </p>

          <article
            className="rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)] px-4 py-5 sm:px-5"
            aria-busy={loadingChapter}
            aria-label={
              currentBook
                ? `${currentBook.name} chapter ${chapter}`
                : "Chapter"
            }
          >
            <header className="mb-5 text-center border-b border-border pb-4">
              <h2 className="text-xl font-serif text-primary">
                {currentBook?.name} {chapter}
              </h2>
              <p className="text-xs text-muted mt-1">{KJV_NOTICE}</p>
            </header>

            {loadingChapter && !chapterData ? (
              <p className="text-sm text-muted text-center py-8">
                Loading chapter…
              </p>
            ) : chapterData ? (
              <div
                className={[
                  "space-y-1 font-serif text-[1.0625rem] leading-[1.75] text-text",
                  loadingChapter ? "opacity-60" : "",
                ].join(" ")}
              >
                {chapterData.verses.map((v) => {
                  const inSelection =
                    selectionRange != null &&
                    v.verse >= selectionRange.start &&
                    v.verse <= selectionRange.end;
                  const active = highlightVerse === v.verse;
                  return (
                    <button
                      key={v.verse}
                      type="button"
                      id={`v-${v.verse}`}
                      onClick={() => handleVerseTap(v.verse)}
                      className={[
                        "w-full text-left scroll-mt-36 rounded-lg px-2 py-1.5 -mx-1 transition-colors touch-manipulation",
                        inSelection
                          ? "bg-primary/10 ring-1 ring-primary/25"
                          : active
                            ? "bg-accent/25 ring-1 ring-accent/40"
                            : "hover:bg-surface-muted/60",
                      ].join(" ")}
                    >
                      <sup className="mr-1.5 text-[0.7rem] font-sans font-semibold text-muted select-none tabular-nums">
                        {v.verse}
                      </sup>
                      {v.text}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </article>

          <div className="flex gap-2 pb-2">
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
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-bg text-primary hover:border-primary/40",
              ].join(" ")}
            >
              {n}
            </button>
          ))}
        </div>
      </Modal>

      {/* Space context picker */}
      <Modal
        open={spacePickerOpen}
        title="Log passages to…"
        onClose={() => setSpacePickerOpen(false)}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted -mt-1">
            Choose which space receives passages you log from the reader.
          </p>
          {spaces.length === 0 ? (
            <p className="text-sm text-muted">
              No spaces yet.{" "}
              <Link to="/" className="text-primary font-medium underline">
                Create one
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-2 max-h-[50dvh] overflow-y-auto">
              {spaces.map((s) => {
                const active = s.id === logContext.spaceId;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => pickSpace(s.id)}
                      className={[
                        "w-full text-left rounded-xl border px-3 py-3 touch-manipulation tap-target",
                        active
                          ? "border-primary bg-primary text-white"
                          : "border-border bg-bg hover:border-primary/30",
                      ].join(" ")}
                    >
                      <p className="font-medium">{s.name}</p>
                      <p
                        className={[
                          "text-xs mt-0.5",
                          active ? "text-white/80" : "text-muted",
                        ].join(" ")}
                      >
                        {s.members.length} member
                        {s.members.length === 1 ? "" : "s"}
                        {s.sessions?.length != null
                          ? ` · ${s.sessions.length} session${s.sessions.length === 1 ? "" : "s"}`
                          : ""}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {logContext.spaceId && (
            <Button variant="ghost" fullWidth onClick={clearSpaceContext}>
              Clear space context
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
    </div>
  );
}

function Header() {
  return (
    <div>
      <h2 className="text-2xl">Bible</h2>
      <p className="text-sm text-muted mt-1">
        Public domain King James Version — read offline, log passages to your
        spaces.
      </p>
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
                    ? "bg-primary text-white"
                    : "bg-bg border border-border hover:border-primary/30",
                ].join(" ")}
              >
                <span className="font-medium truncate">{b.name}</span>
                <span
                  className={[
                    "text-xs shrink-0 tabular-nums",
                    active ? "text-white/80" : "text-muted",
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
                  <p className="text-sm font-serif leading-relaxed line-clamp-3 mt-1">
                    {splitHighlight(v.text, query).map((part, i) =>
                      part.match ? (
                        <mark
                          key={i}
                          className="bg-accent/40 text-inherit rounded-sm px-0.5"
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
