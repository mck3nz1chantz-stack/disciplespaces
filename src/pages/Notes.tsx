import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/Button";
import { useLiveAllPrivateNotes, useLiveSpaces } from "../hooks/useLiveDb";
import { noteListTitle } from "../lib/verseNote";
import { useAppStore } from "../stores/useAppStore";
import type { PrivateNote } from "../types";

function noteBodyPreview(note: PrivateNote): string {
  if (!note.verse) return note.content;
  return note.content;
}

export function Notes() {
  const navigate = useNavigate();
  const notes = useLiveAllPrivateNotes();
  const spaces = useLiveSpaces();
  const addPrivateNote = useAppStore((s) => s.addPrivateNote);
  const updatePrivateNote = useAppStore((s) => s.updatePrivateNote);
  const deletePrivateNote = useAppStore((s) => s.deletePrivateNote);

  const [openId, setOpenId] = useState<string | null>(null);
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

  const visible = useMemo(() => {
    let list = notes ?? [];
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
  }, [notes, verseOnly, query]);

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
    });
    navigate(`/bible?${params.toString()}`);
  }

  function toggle(note: PrivateNote) {
    if (openId === note.id) {
      setOpenId(null);
      return;
    }
    setOpenId(note.id);
    setEditDraft(note.content);
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="font-serif text-2xl text-primary">Notes</h2>
        <p className="text-sm text-muted">
          On this phone. A verse note stays with that verse.
        </p>
      </header>

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

      {notes === undefined ? (
        <p className="text-sm text-muted">Loading notes…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted">
          {notes.length === 0
            ? "No notes yet. Write one here, or tap a verse while you read."
            : "No notes match."}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((note) => {
            const open = openId === note.id;
            const title = noteListTitle(note);
            const group = note.spaceId ? spaceName.get(note.spaceId) : undefined;
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
                      <span className="block text-xs text-muted mt-0.5">
                        Open in Read
                        {group ? ` · ${group}` : ""}
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
                      {group && (
                        <span className="block text-xs text-muted mt-0.5">{group}</span>
                      )}
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
