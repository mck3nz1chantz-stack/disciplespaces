import { useState, type FormEvent } from "react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLivePrivateNotes } from "../hooks/useLiveDb";
import { useAppStore } from "../stores/useAppStore";
import type { PrivateNote } from "../types";
import { Button } from "./Button";

interface PrivateNotesEditorProps {
  spaceId: string;
  sessionId?: string;
  /** When set, only this section; when undefined, all notes in scope. */
  sectionKey?: string;
  /** When true with no sectionKey, only unscoped notes. */
  generalOnly?: boolean;
  description?: string;
  placeholder?: string;
  /** Hide outer chrome when embedded in a section panel. */
  compact?: boolean;
}

/**
 * Device-local private note list + composer (shared by modal + session drawer).
 */
export function PrivateNotesEditor({
  spaceId,
  sessionId,
  sectionKey,
  generalOnly = false,
  description,
  placeholder = 'e.g. "Prayed for John today — check back later"',
  compact = false,
}: PrivateNotesEditorProps) {
  const addPrivateNote = useAppStore((s) => s.addPrivateNote);
  const updatePrivateNote = useAppStore((s) => s.updatePrivateNote);
  const deletePrivateNote = useAppStore((s) => s.deletePrivateNote);

  const notes = useLivePrivateNotes({
    spaceId,
    sessionId: sessionId === undefined ? null : sessionId,
    sectionKey: generalOnly ? null : sectionKey,
  });

  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function handleAdd(e?: FormEvent) {
    e?.preventDefault();
    const content = draft.trim();
    if (!content || saving) return;
    setSaving(true);
    try {
      await addPrivateNote({
        spaceId,
        sessionId,
        sectionKey: generalOnly ? undefined : sectionKey,
        content,
      });
      setDraft("");
      toast.success("Private note saved", {
        description: "Stays on this device only — never shared in exports.",
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save private note",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(noteId: string) {
    const content = editDraft.trim();
    if (!content || saving) return;
    setSaving(true);
    try {
      await updatePrivateNote(noteId, content);
      setEditingId(null);
      setEditDraft("");
      toast.success("Private note updated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not update note",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(noteId: string) {
    if (saving) return;
    setSaving(true);
    try {
      await deletePrivateNote(noteId);
      setConfirmDeleteId(null);
      if (editingId === noteId) {
        setEditingId(null);
        setEditDraft("");
      }
      toast.success("Private note deleted");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not delete note",
      );
    } finally {
      setSaving(false);
    }
  }

  const list = notes ?? [];
  const loading = notes === undefined;

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {description && (
        <div className="flex items-start gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2.5">
          <Lock
            className="h-4 w-4 shrink-0 text-primary mt-0.5"
            aria-hidden
          />
          <p className="text-xs text-muted leading-relaxed">{description}</p>
        </div>
      )}

      <form onSubmit={handleAdd} className="space-y-2">
        <label
          htmlFor="private-note-draft-embedded"
          className="text-sm font-medium text-primary"
        >
          Add a private note
        </label>
        <textarea
          id="private-note-draft-embedded"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base min-h-[88px] resize-y"
          placeholder={placeholder}
          maxLength={4000}
          disabled={saving}
        />
        <Button type="submit" fullWidth disabled={saving || !draft.trim()}>
          <Plus className="h-4 w-4" aria-hidden />
          Save private note
        </Button>
      </form>

      <section className="space-y-2 border-t border-border pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-primary">History</h3>
          <span className="text-xs text-muted tabular-nums">
            {loading
              ? "…"
              : `${list.length} note${list.length === 1 ? "" : "s"}`}
          </span>
        </div>

        {loading && (
          <p className="text-sm text-muted">Loading private notes…</p>
        )}

        {!loading && list.length === 0 && (
          <p className="text-sm text-muted rounded-xl bg-surface-muted/60 px-3 py-3 italic">
            No private notes in this section yet.
          </p>
        )}

        <ul className="space-y-2.5" aria-label="Private note history">
          {list.map((note) => (
            <PrivateNoteRow
              key={note.id}
              note={note}
              editing={editingId === note.id}
              editDraft={editDraft}
              confirmDelete={confirmDeleteId === note.id}
              saving={saving}
              onStartEdit={() => {
                setEditingId(note.id);
                setEditDraft(note.content);
                setConfirmDeleteId(null);
              }}
              onCancelEdit={() => {
                setEditingId(null);
                setEditDraft("");
              }}
              onEditDraft={setEditDraft}
              onSaveEdit={() => void handleUpdate(note.id)}
              onAskDelete={() => setConfirmDeleteId(note.id)}
              onCancelDelete={() => setConfirmDeleteId(null)}
              onConfirmDelete={() => void handleDelete(note.id)}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function PrivateNoteRow({
  note,
  editing,
  editDraft,
  confirmDelete,
  saving,
  onStartEdit,
  onCancelEdit,
  onEditDraft,
  onSaveEdit,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  note: PrivateNote;
  editing: boolean;
  editDraft: string;
  confirmDelete: boolean;
  saving: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onEditDraft: (v: string) => void;
  onSaveEdit: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const when = formatNoteTime(note.createdAt);
  const edited =
    note.updatedAt && note.updatedAt !== note.createdAt
      ? formatNoteTime(note.updatedAt)
      : null;

  return (
    <li className="rounded-xl border border-border bg-bg px-3 py-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-primary tabular-nums">
            {when}
          </p>
          {edited && (
            <p className="text-[11px] text-muted">Edited {edited}</p>
          )}
        </div>
        {!editing && !confirmDelete && (
          <div className="flex shrink-0 gap-0.5">
            <Button
              type="button"
              variant="ghost"
              className="!p-2"
              onClick={onStartEdit}
              aria-label="Edit private note"
              disabled={saving}
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="!p-2 text-danger"
              onClick={onAskDelete}
              aria-label="Delete private note"
              disabled={saving}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={editDraft}
            onChange={(e) => onEditDraft(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-sm min-h-[80px] resize-y"
            maxLength={4000}
            disabled={saving}
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={onCancelEdit}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              fullWidth
              onClick={onSaveEdit}
              disabled={saving || !editDraft.trim()}
            >
              Save
            </Button>
          </div>
        </div>
      ) : confirmDelete ? (
        <div className="space-y-2">
          <p className="text-sm text-danger">Delete this private note?</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={onCancelDelete}
              disabled={saving}
            >
              Keep
            </Button>
            <Button
              type="button"
              variant="danger"
              fullWidth
              onClick={onConfirmDelete}
              disabled={saving}
            >
              Delete
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm whitespace-pre-wrap">{note.content}</p>
      )}
    </li>
  );
}

function formatNoteTime(iso: string): string {
  try {
    const d = parseISO(iso);
    const absolute = format(d, "MMM d, yyyy · h:mm a");
    const relative = formatDistanceToNow(d, { addSuffix: true });
    return `${absolute} (${relative})`;
  } catch {
    return iso.slice(0, 16);
  }
}
