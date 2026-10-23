import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/Button";
import { useLiveAllPrivateNotes, useLiveSpaces } from "../hooks/useLiveDb";
import { getChapter, parseReference } from "../lib/bible";
import {
  formatReferenceSentence,
  formatVerseTitle,
  noteListTitle,
} from "../lib/verseNote";
import {
  isPersonalStudy,
  normalizeHue,
  orderedStudies,
  PERSONAL_HUE,
  PERSONAL_STUDY_ID,
  studyColor,
} from "../lib/study";
import { useAppStore } from "../stores/useAppStore";
import type { PrivateNote, VerseAnchor } from "../types";

function noteBodyPreview(note: PrivateNote): string {
  if (!note.verse) return note.content;
  return note.content;
}

export function Notes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const studyFilter = searchParams.get("study");
  const notes = useLiveAllPrivateNotes();
  const spaces = useLiveSpaces();
  const addPrivateNote = useAppStore((s) => s.addPrivateNote);
  const updatePrivateNote = useAppStore((s) => s.updatePrivateNote);
  const deletePrivateNote = useAppStore((s) => s.deletePrivateNote);
  const setAnotherVerse = useAppStore((s) => s.setAnotherVerse);

  const [openId, setOpenId] = useState<string | null>(null);
  const [linkDraft, setLinkDraft] = useState("");
  const [savingLink, setSavingLink] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [verseOnly, setVerseOnly] = useState(false);
  const [query, setQuery] = useState("");

  const spaceName = useMemo(() => {
    const map = new Map<string, string>();
    for (const space of spaces ?? []) map.set(space.id, space.name);
    return map;
  }, [spaces]);

  const hasVerseNotes = (notes ?? []).some((n) => n.verse);
  const showSearch = (notes ?? []).length > 6;

  const filteredStudy = (spaces ?? []).find((space) => space.id === studyFilter);
  const inThisFilter = useMemo(() => {
    let list = notes ?? [];
    if (studyFilter) {
      const personal =
        studyFilter === PERSONAL_STUDY_ID ||
        (filteredStudy ? isPersonalStudy(filteredStudy) : false);
      list = list.filter((note) =>
        personal
          ? !note.spaceId || note.spaceId === studyFilter
          : note.spaceId === studyFilter,
      );
    }
    return list;
  }, [notes, studyFilter, filteredStudy]);
  const savedVerseCount = inThisFilter.filter((note) => note.verse).length;
  const savedFilterLabel = studyFilter
    ? filteredStudy?.name ?? "Study"
    : "All";
  const visible = useMemo(() => {
    let list = inThisFilter;
    if (verseOnly) list = list.filter((n) => n.verse);
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((n) => {
      const title = noteListTitle(n).toLowerCase();
      const ref = n.verse
        ? `${n.verse.bookName} ${n.verse.chapter}`.toLowerCase()
        : "";
      return (
        title.includes(q) ||
        ref.includes(q) ||
        n.content.toLowerCase().includes(q)
      );
    });
  }, [inThisFilter, verseOnly, query]);

  async function handleCreate() {
    const text = draft.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const note = await addPrivateNote({ content: text });
      setDraft("");
      setComposerOpen(false);
      setOpenId(note.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save note");
    } finally {
      setSaving(false);
    }
  }

  function openRead(note: PrivateNote) {
    if (!note.verse) return;
    const v = note.verse;
    const params = new URLSearchParams({
      ver: v.version,
      b: v.bookId,
      c: String(v.chapter),
      sv: String(v.startVerse),
      ev: String(v.endVerse),
      note: "1",
      space: note.spaceId || PERSONAL_STUDY_ID,
    });
    navigate(`/bible?${params.toString()}`);
  }

  function openAnother(note: PrivateNote) {
    const linked = note.anotherVerse;
    const own = note.verse;
    if (!linked || !own) return;
    const params = new URLSearchParams({
      ver: own.version,
      b: linked.bookId,
      c: String(linked.chapter),
      sv: String(linked.startVerse),
      ev: String(linked.endVerse),
      space: note.spaceId || PERSONAL_STUDY_ID,
    });
    navigate(`/bible?${params.toString()}`);
  }

  async function addAnother(note: PrivateNote) {
    const own = note.verse;
    const typed = linkDraft.trim();
    if (!own || !typed || savingLink) return;
    setSavingLink(true);
    try {
      const parsed = await parseReference(typed);
      if (!parsed?.verse) {
        toast.error(
          parsed ? "Add a verse, such as John 1:1." : "Could not read that reference.",
        );
        return;
      }
      const chapter = await getChapter(parsed.bookId, parsed.chapter, own.version);
      const max = chapter.verses.length;
      if (parsed.verse > max) {
        toast.error("Could not read that reference.");
        return;
      }
      const startVerse = parsed.verse;
      const endVerse = Math.min(parsed.endVerse ?? parsed.verse, max);
      const lo = Math.min(startVerse, endVerse);
      const hi = Math.max(startVerse, endVerse);
      if (
        own.bookId === parsed.bookId &&
        own.chapter === parsed.chapter &&
        own.startVerse === lo &&
        own.endVerse === hi
      ) {
        toast.error("That is this verse.");
        return;
      }
      const another: VerseAnchor = {
        version: own.version,
        bookId: parsed.bookId,
        bookName: parsed.bookName,
        chapter: parsed.chapter,
        startVerse: lo,
        endVerse: hi,
      };
      await setAnotherVerse(note.id, another);
      setLinkDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSavingLink(false);
    }
  }

  function selectStudy(id: string | null) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set("study", id);
        else next.delete("study");
        return next;
      },
      { replace: true },
    );
  }

  function toggle(note: PrivateNote) {
    if (openId === note.id) {
      setOpenId(null);
      setLinkDraft("");
      return;
    }
    setOpenId(note.id);
    setEditDraft(note.content);
    setLinkDraft("");
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="font-serif text-2xl text-primary">Notes</h2>
        <p className="text-sm text-muted">
          On this phone. A verse note stays with that verse.
        </p>
      </header>

      <div
        className="flex gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Studies"
      >
        <button
          type="button"
          role="tab"
          aria-selected={!studyFilter}
          onClick={() => selectStudy(null)}
          className={[
            "inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 py-2 text-sm font-medium touch-manipulation",
            !studyFilter
              ? "border-primary bg-primary text-on-primary"
              : "border-border bg-transparent text-primary",
          ].join(" ")}
        >
          All
        </button>
        {orderedStudies(spaces ?? []).map((study) => {
          const color = studyColor(normalizeHue(study.colorHue) ?? PERSONAL_HUE);
          const selected = studyFilter === study.id;
          return (
            <button
              key={study.id}
              type="button"
              role="tab"
              data-study-id={study.id}
              aria-selected={selected}
              onClick={() => selectStudy(study.id)}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium touch-manipulation"
              style={
                selected
                  ? {
                      background: color.fill,
                      borderColor: color.stroke,
                      color: color.ink,
                    }
                  : {
                      background: "transparent",
                      borderColor: color.stroke,
                      color: color.stroke,
                    }
              }
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: selected ? color.ink : color.fill }}
                aria-hidden
              />
              {study.name}
            </button>
          );
        })}
      </div>

      <Button fullWidth onClick={() => setComposerOpen((v) => !v)}>
        <Pencil className="h-5 w-5" aria-hidden />
        New note
      </Button>

      {composerOpen && (
        <form
          className="rounded-2xl border border-border bg-surface p-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void handleCreate();
          }}
        >
          <label className="block text-sm font-medium text-primary" htmlFor="new-note">
            Note
          </label>
          <textarea
            id="new-note"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            placeholder="First line is the title"
            className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-base"
          />
          <Button type="submit" fullWidth disabled={saving || !draft.trim()}>
            {saving ? "Saving…" : "Save note"}
          </Button>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {hasVerseNotes && (
          <button
            type="button"
            aria-pressed={verseOnly}
            onClick={() => setVerseOnly((v) => !v)}
            className={[
              "rounded-full px-3 py-2 text-sm font-medium touch-manipulation",
              verseOnly
                ? "bg-primary text-on-primary"
                : "bg-surface-muted text-primary",
            ].join(" ")}
          >
            On a verse
          </button>
        )}
        {showSearch && (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a note"
            aria-label="Find a note"
            className="min-w-[12rem] flex-1 rounded-full border border-border bg-surface px-3 py-2 text-sm"
          />
        )}
      </div>

      {notes !== undefined && (
        <p
          className="text-sm text-muted"
          data-saved-verse-count={savedVerseCount}
          data-saved-verse-filter={savedFilterLabel}
        >
          {savedFilterLabel} · {savedVerseCount} saved{" "}
          {savedVerseCount === 1 ? "verse" : "verses"}
        </p>
      )}

      {notes === undefined ? (
        <p className="text-sm text-muted">Loading notes…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted">
          {studyFilter
            ? "No notes in this study yet."
            : notes.length === 0
              ? "No notes yet. Write one here, or tap a verse while you read."
              : "No notes match."}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((note) => {
            const open = openId === note.id;
            const title = noteListTitle(note);
            const study = note.spaceId
              ? (spaces ?? []).find((item) => item.id === note.spaceId)
              : (spaces ?? []).find((item) => isPersonalStudy(item));
            const studyHue = studyColor(
              normalizeHue(study?.colorHue) ?? PERSONAL_HUE,
            );
            const studyLabel = note.spaceId
              ? spaceName.get(note.spaceId) ?? "Study"
              : study?.name ?? "My study";
            const when = note.updatedAt || note.createdAt;
            return (
              <li
                key={note.id}
                className="rounded-2xl border border-border bg-surface"
              >
                <div className="flex items-stretch">
                  {note.verse ? (
                    <button
                      type="button"
                      onClick={() => openRead(note)}
                      className="flex-1 text-left px-3 py-3 touch-manipulation"
                    >
                      <span className="block font-medium text-primary">{title}</span>
                      {note.verse ? (
                        <span
                          className="mt-0.5 block text-sm text-muted"
                          data-reference-sentence
                        >
                          {formatReferenceSentence(note.verse)}
                        </span>
                      ) : null}
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: studyHue.fill }}
                          aria-hidden
                        />
                        <span style={{ color: studyHue.stroke }}>{studyLabel}</span>
                        <span>· Open in Read</span>
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => toggle(note)}
                      className="flex-1 text-left px-3 py-3 touch-manipulation"
                    >
                      <span className="block font-medium text-primary">{title}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: studyHue.fill }}
                          aria-hidden
                        />
                        <span style={{ color: studyHue.stroke }}>{studyLabel}</span>
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-label={open ? "Close note" : "Open note"}
                    onClick={() => toggle(note)}
                    className="px-3 text-muted touch-manipulation"
                  >
                    <ChevronDown
                      className={["h-5 w-5 transition-transform", open ? "rotate-180" : ""].join(" ")}
                      aria-hidden
                    />
                  </button>
                </div>
                {note.verse && note.anotherVerse ? (
                  <div className="px-3 pb-3" data-another-verse={formatVerseTitle(note.anotherVerse)}>
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => openAnother(note)}
                        className="min-w-0 flex-1 text-left touch-manipulation"
                      >
                        <span className="block text-sm font-medium text-primary">
                          Another verse · {formatVerseTitle(note.anotherVerse)}
                        </span>
                        <span className="mt-0.5 block text-sm text-muted">
                          You added this.
                        </span>
                        <span className="mt-0.5 block text-sm text-muted" data-reference-sentence>
                          {formatReferenceSentence(note.anotherVerse)}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="shrink-0 px-2 py-2 text-sm text-muted touch-manipulation"
                        onClick={() => {
                          void setAnotherVerse(note.id, null).catch((err: unknown) =>
                            toast.error(
                              err instanceof Error ? err.message : "Could not clear",
                            ),
                          );
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : null}
                {open && (
                  <div className="px-3 pb-3 space-y-2 border-t border-border/70">
                    <p className="text-xs text-muted pt-2">
                      {format(parseISO(when), "MMM d, yyyy")}
                    </p>
                    <label className="sr-only" htmlFor={`edit-${note.id}`}>
                      Note text
                    </label>
                    <textarea
                      id={`edit-${note.id}`}
                      value={openId === note.id ? editDraft : noteBodyPreview(note)}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={5}
                      className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-base"
                    />
                    {note.verse ? (
                      <form
                        className="space-y-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void addAnother(note);
                        }}
                      >
                        <label
                          className="block text-sm font-medium text-primary"
                          htmlFor={`another-${note.id}`}
                        >
                          Another verse
                        </label>
                        <input
                          id={`another-${note.id}`}
                          value={openId === note.id ? linkDraft : ""}
                          onChange={(e) => setLinkDraft(e.target.value)}
                          placeholder="John 1:1"
                          className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-base"
                        />
                        <Button
                          type="submit"
                          variant="secondary"
                          fullWidth
                          disabled={savingLink || !linkDraft.trim()}
                        >
                          {savingLink ? "Saving…" : "Add"}
                        </Button>
                      </form>
                    ) : null}
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        disabled={!editDraft.trim() || editDraft.trim() === note.content}
                        onClick={() => {
                          void updatePrivateNote(note.id, editDraft)
                            .then(() => toast.success("Note saved"))
                            .catch((err: unknown) =>
                              toast.error(
                                err instanceof Error ? err.message : "Could not save",
                              ),
                            );
                        }}
                      >
                        Save
                      </Button>
                      <Button
                        variant="secondary"
                        aria-label="Delete note"
                        onClick={() => {
                          if (!window.confirm("Delete this note?")) return;
                          void deletePrivateNote(note.id).then(() => {
                            if (openId === note.id) setOpenId(null);
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
