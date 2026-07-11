import { useEffect } from "react";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import type { Passage } from "../types";
import {
  BIBLE_BOOK_NAMES,
  emptyPassageDraft,
  ensurePassageIds,
  formatPassageRef,
  isValidPassage,
} from "../lib/passages";
import { Button } from "./Button";

interface PassageListProps {
  passages: Passage[];
  /** View-only list */
  readOnly?: boolean;
  onChange?: (passages: Passage[]) => void;
  disabled?: boolean;
  /** Compact density for cards */
  compact?: boolean;
  /** Emphasize manual entry (Freeform sessions, etc.) */
  emphasizeManual?: boolean;
}

/**
 * Display and optionally edit/remove logged passages.
 * Manual add uses book + chapter + verse range (no Bible reader required).
 *
 * Keys use stable passage.id (never formatPassageRef) so typing does not
 * remount inputs and dismiss the mobile keyboard.
 */
export function PassageList({
  passages,
  readOnly = false,
  onChange,
  disabled = false,
  compact = false,
  emphasizeManual = false,
}: PassageListProps) {
  // Assign missing ids so legacy rows keep focus-stable keys while editing.
  useEffect(() => {
    if (readOnly || !onChange || passages.length === 0) return;
    const next = ensurePassageIds(passages);
    if (next !== passages) onChange(next);
  }, [passages, onChange, readOnly]);

  function removeAt(index: number) {
    if (!onChange) return;
    onChange(passages.filter((_, i) => i !== index));
  }

  function updateAt(index: number, patch: Partial<Passage>) {
    if (!onChange) return;
    onChange(
      passages.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    );
  }

  function addPassage() {
    if (!onChange) return;
    onChange([...passages, emptyPassageDraft()]);
  }

  if (passages.length === 0 && readOnly) {
    return (
      <p className="text-sm text-muted italic">No passages logged yet.</p>
    );
  }

  const bookListId = "ds-bible-book-names";

  return (
    <div className="space-y-2">
      {passages.length === 0 && !readOnly && (
        <p className="text-sm text-muted rounded-xl bg-surface-muted/50 px-3 py-3">
          {emphasizeManual
            ? "Log a passage by book, chapter, and verse range — no Bible reader required."
            : "No passages yet. Add one manually or log from the Bible reader."}
        </p>
      )}

      {!readOnly && (
        <datalist id={bookListId}>
          {BIBLE_BOOK_NAMES.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      )}

      <ul className="space-y-2" aria-label="Logged passages">
        {passages.map((p, index) => (
          <li key={p.id ?? `passage-fallback-${index}`}>
            {readOnly ? (
              <div
                className={[
                  "rounded-xl border border-border bg-bg px-3",
                  compact ? "py-2" : "py-3",
                ].join(" ")}
              >
                <p className="font-medium text-primary text-sm flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {formatPassageRef(p)}
                </p>
                {p.contextNote && (
                  <p className="text-sm text-muted mt-1 whitespace-pre-wrap">
                    {p.contextNote}
                  </p>
                )}
              </div>
            ) : (
              <PassageEditorRow
                passage={p}
                disabled={disabled}
                bookListId={bookListId}
                onChange={(next) => updateAt(index, next)}
                onRemove={() => removeAt(index)}
              />
            )}
          </li>
        ))}
      </ul>

      {!readOnly && (
        <Button
          type="button"
          variant="secondary"
          className="!py-2.5"
          onClick={addPassage}
          disabled={disabled}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add passage manually
        </Button>
      )}
    </div>
  );
}

function PassageEditorRow({
  passage,
  onChange,
  onRemove,
  disabled,
  bookListId,
}: {
  passage: Passage;
  onChange: (patch: Partial<Passage>) => void;
  onRemove: () => void;
  disabled?: boolean;
  bookListId: string;
}) {
  const valid = isValidPassage(passage);

  return (
    <div
      className={[
        "rounded-xl border bg-bg p-3 space-y-2.5",
        valid ? "border-border" : "border-danger/40",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">
          {formatPassageRef(passage)}
        </p>
        <Button
          type="button"
          variant="ghost"
          className="!p-2 text-danger"
          onClick={onRemove}
          disabled={disabled}
          aria-label="Remove passage"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-medium">Book</span>
        <input
          list={bookListId}
          value={passage.book}
          onChange={(e) => onChange({ book: e.target.value })}
          className="w-full rounded-lg border border-border bg-surface px-2.5 py-2.5 text-base"
          disabled={disabled}
          placeholder="John"
          autoComplete="off"
          enterKeyHint="next"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Start chapter"
          value={passage.startChapter}
          disabled={disabled}
          onChange={(n) => onChange({ startChapter: n })}
        />
        <OptionalNumberField
          label="Start verse"
          value={passage.startVerse}
          disabled={disabled}
          placeholder="1"
          onChange={(n) => onChange({ startVerse: n })}
        />
        <NumberField
          label="End chapter"
          value={passage.endChapter}
          disabled={disabled}
          onChange={(n) => onChange({ endChapter: n })}
        />
        <OptionalNumberField
          label="End verse"
          value={passage.endVerse}
          disabled={disabled}
          placeholder="1"
          onChange={(n) => onChange({ endVerse: n })}
        />
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-medium">Study notes (optional)</span>
        <textarea
          value={passage.contextNote ?? ""}
          onChange={(e) => onChange({ contextNote: e.target.value })}
          className="w-full rounded-lg border border-border bg-surface px-2.5 py-2.5 text-base min-h-[72px] resize-y"
          disabled={disabled}
          placeholder="Observations, application, questions…"
          maxLength={1000}
        />
      </label>
    </div>
  );
}

/**
 * Required positive number. Allows empty intermediate input so backspace
 * can clear the field; empty commits as 1 only on blur if still empty.
 */
function NumberField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const display =
    value === 0 || !Number.isFinite(value) ? "" : String(value);

  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={display}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d]/g, "");
          if (raw === "") {
            // Keep a transient 0 so the field can be empty while editing
            onChange(0);
            return;
          }
          const n = parseInt(raw, 10);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        onBlur={() => {
          if (!value || value < 1) onChange(1);
        }}
        className="w-full rounded-lg border border-border bg-surface px-2.5 py-2.5 text-base tabular-nums"
        disabled={disabled}
        autoComplete="off"
      />
    </label>
  );
}

/** Optional verse — empty is allowed (undefined). */
function OptionalNumberField({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const display =
    value == null || value === 0 || !Number.isFinite(value)
      ? ""
      : String(value);

  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={display}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d]/g, "");
          if (raw === "") {
            onChange(undefined);
            return;
          }
          const n = parseInt(raw, 10);
          onChange(Number.isFinite(n) && n > 0 ? n : undefined);
        }}
        className="w-full rounded-lg border border-border bg-surface px-2.5 py-2.5 text-base tabular-nums"
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
      />
    </label>
  );
}
