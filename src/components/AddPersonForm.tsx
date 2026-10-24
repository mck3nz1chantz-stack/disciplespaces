import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "./Button";

/** Name field in the page, not in a dialog, so the caret stays while typing. */
export function AddPersonForm({
  onSave,
  onCancel,
}: {
  onSave: (name: string) => Promise<void> | void;
  onCancel: () => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const focusedOnce = useRef(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const el = inputRef.current;
    if (!el || focusedOnce.current) return;
    focusedOnce.current = true;
    el.focus();
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
      // Caller shows the error. Keep the name so it is not lost.
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      id="group-add-person"
      onSubmit={(e) => void commit(e)}
      className="min-w-0 flex flex-wrap items-center gap-2"
    >
      <label className="sr-only" htmlFor={inputId}>
        Person’s name
      </label>
      <input
        id={inputId}
        ref={inputRef}
        data-add-person=""
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
        }}
        maxLength={60}
        required
        disabled={saving}
        autoComplete="name"
        autoCapitalize="words"
        enterKeyHint="done"
        placeholder="Name"
        className="min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 py-2.5 text-base text-primary"
      />
      <Button
        type="submit"
        className="!py-2 !px-3 text-sm"
        disabled={saving || !value.trim()}
      >
        {saving ? "Adding…" : "Add"}
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
    </form>
  );
}
