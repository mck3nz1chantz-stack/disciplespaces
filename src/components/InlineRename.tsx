import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "./Button";

/**
 * Rename a group title in normal page flow.
 * A field inside the fixed dialog loses the caret in Safari on every keystroke.
 */
export function InlineRename({
  name,
  onSave,
  onCancel,
}: {
  name: string;
  onSave: (next: string) => Promise<void> | void;
  onCancel: () => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const focusedOnce = useRef(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const el = inputRef.current;
    if (!el || focusedOnce.current) return;
    focusedOnce.current = true;
    el.focus();
    const end = el.value.length;
    try {
      el.setSelectionRange(end, end);
    } catch {
      // Some browsers reject selection before the field is painted.
    }
    // The fixed tab bar covers the lower cards. Scroll the whole form
    // above it so Save is the control under the pointer.
    const form = el.closest("form");
    const nav = document.querySelector('nav[aria-label="Main"]');
    if (!form) return;
    const navTop = nav?.getBoundingClientRect().top ?? window.innerHeight;
    const overlap = form.getBoundingClientRect().bottom - (navTop - 12);
    if (overlap > 0) window.scrollBy(0, overlap);
  }, []);

  async function commit(e?: FormEvent) {
    e?.preventDefault();
    const next = value.trim();
    if (!next || saving) return;
    setSaving(true);
    try {
      await onSave(next);
    } catch {
      // Caller shows the error. Keep the draft so the name is not lost.
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void commit(e)} className="min-w-0 flex-1 space-y-2">
      <label className="sr-only" htmlFor={inputId}>
        Group name
      </label>
      <input
        id={inputId}
        ref={inputRef}
        data-group-rename=""
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
        }}
        maxLength={80}
        required
        disabled={saving}
        autoComplete="off"
        autoCapitalize="words"
        enterKeyHint="done"
        className="w-full min-w-0 rounded-xl border border-border bg-bg px-3 py-2.5 text-base font-semibold font-serif text-primary"
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          className="!py-2 !px-3 text-sm"
          disabled={saving || !value.trim()}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="!py-2 !px-3 text-sm"
          disabled={saving}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
