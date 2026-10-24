import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { format, parseISO } from "date-fns";
import { Button } from "./Button";
import type { SavedDateKind, SavedGroupDate } from "../types";

function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dayLabel(date: string): string {
  try {
    return format(parseISO(date), "EEEE, MMM d");
  } catch {
    return date;
  }
}

/** Save a completed or upcoming day for one group. Page flow, not a dialog. */
export function SaveGroupDates({
  dates,
  onSave,
  onRemove,
}: {
  dates: SavedGroupDate[];
  onSave: (
    date: string,
    kind: SavedDateKind,
    covered?: string,
  ) => Promise<void>;
  onRemove: (date: string) => Promise<void>;
}) {
  const dateId = useId();
  const coveredId = useId();
  const kindName = useId();
  const errorId = useId();
  const pendingScroll = useRef<string | null>(null);
  const [date, setDate] = useState(todayKey);
  const [kind, setKind] = useState<SavedDateKind>("completed");
  const [covered, setCovered] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const existing = dates.find((row) => row.date === date);
    if (!existing) return;
    setKind(existing.kind);
    setCovered(existing.covered ?? "");
    // Prefill once for the day already on screen. Later edits stay put.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const target = pendingScroll.current;
    if (!target) return;
    const row = document.getElementById(`saved-date-${target}`);
    if (!row) return;
    pendingScroll.current = null;
    const nav = document.querySelector('nav[aria-label="Main"]');
    const navTop = nav?.getBoundingClientRect().top ?? window.innerHeight;
    const bottom = row.getBoundingClientRect().bottom;
    if (bottom > navTop - 12) {
      window.scrollBy(0, bottom - (navTop - 12));
    }
  }, [dates]);

  async function commit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    const form = e.currentTarget;
    const picked =
      form.querySelector<HTMLInputElement>('input[type="date"]')?.value ?? "";
    const pickedKind = form.querySelector<HTMLInputElement>(
      'input[type="radio"]:checked',
    )?.value;
    const nextKind: SavedDateKind =
      pickedKind === "upcoming" ? "upcoming" : "completed";
    const coveredInput = form.querySelector<HTMLInputElement>(
      'input[name="covered"]',
    );
    const nextCovered =
      nextKind === "completed"
        ? (coveredInput?.value ?? "").trim().replace(/\s+/g, " ").slice(0, 100)
        : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(picked)) {
      setError("Pick a date");
      return;
    }
    setDate(picked);
    setKind(nextKind);
    setCovered(nextCovered);
    setSaving(true);
    setError("");
    try {
      await onSave(picked, nextKind, nextCovered || undefined);
      pendingScroll.current = picked;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the date");
    } finally {
      setSaving(false);
    }
  }

  async function remove(savedDate: string) {
    setError("");
    try {
      await onRemove(savedDate);
      document.getElementById("group-save-date-button")?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the date");
    }
  }

  return (
    <form
      id="group-save-date"
      onSubmit={(e) => void commit(e)}
      className="space-y-3 rounded-xl border border-border bg-surface/95 p-3"
      aria-labelledby="group-save-date-heading"
    >
      <div>
        <h3 id="group-save-date-heading" className="text-sm font-medium text-primary">
          Save a date
        </h3>
        <p className="text-xs text-muted mt-0.5">
          Completed is green and stays under Done. Upcoming is gold and stays under Coming.
        </p>
      </div>
      <label className="block space-y-1.5" htmlFor={dateId}>
        <span className="text-sm font-medium text-primary">Date</span>
        <input
          id={dateId}
          type="date"
          value={date}
          onChange={(e) => {
            const next = e.target.value;
            setDate(next);
            setError("");
            const existing = dates.find((row) => row.date === next);
            setKind(existing?.kind ?? kind);
            setCovered(existing?.covered ?? "");
          }}
          required
          disabled={saving}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="w-full min-h-11 rounded-xl border border-border bg-bg px-3 py-3 text-base text-primary"
        />
      </label>
      <fieldset>
        <legend className="text-sm font-medium text-primary">Mark as</legend>
        <div className="mt-1.5 grid grid-cols-2 gap-1">
          {(
            [
              ["completed", "Completed"],
              ["upcoming", "Upcoming"],
            ] as const
          ).map(([value, label]) => {
            const on = kind === value;
            return (
              <label
                key={value}
                className={[
                  "relative flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border text-sm font-medium text-primary touch-manipulation",
                  "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
                  on && value === "completed"
                    ? "border-success bg-success/15"
                    : on
                      ? "border-upcoming bg-upcoming/15"
                      : "border-border",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name={kindName}
                  value={value}
                  checked={on}
                  disabled={saving}
                  onChange={() => setKind(value)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
                <span
                  aria-hidden
                  className={
                    value === "completed"
                      ? "h-2.5 w-2.5 rounded-full bg-success"
                      : "h-2.5 w-2.5 rounded-sm bg-upcoming"
                  }
                />
                {label}
              </label>
            );
          })}
        </div>
      </fieldset>
      {kind === "completed" ? (
        <label className="block space-y-1.5" htmlFor={coveredId}>
          <span className="text-sm font-medium text-primary">What we covered</span>
          <input
            id={coveredId}
            name="covered"
            type="text"
            value={covered}
            onChange={(e) => setCovered(e.target.value)}
            maxLength={100}
            disabled={saving}
            autoComplete="off"
            placeholder="John 4 & 5"
            className="w-full min-h-11 rounded-xl border border-border bg-bg px-3 py-3 text-base text-primary"
          />
          <span className="text-xs text-muted">
            This stays on the day, so a past date still shows the lesson.
          </span>
        </label>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" id="group-save-date-button" fullWidth disabled={saving}>
        {saving ? "Saving…" : "Save date"}
      </Button>
      {dates.length === 0 ? (
        <p className="text-sm text-muted">No dates saved for this group yet.</p>
      ) : (
        <ul className="space-y-1" aria-label="Saved dates">
          {dates.map((row) => {
            const when = dayLabel(row.date);
            const kindLabel = row.kind === "completed" ? "Completed" : "Upcoming";
            return (
              <li
                key={row.date}
                id={`saved-date-${row.date}`}
                className={[
                  "flex min-h-11 items-start justify-between gap-2 rounded-lg border bg-bg px-3 py-1",
                  row.kind === "completed" ? "border-success/40" : "border-upcoming/50",
                ].join(" ")}
              >
                <span className="min-w-0 py-1.5 text-sm text-primary">
                  <span className="flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className={
                        row.kind === "completed"
                          ? "h-2.5 w-2.5 shrink-0 rounded-full bg-success"
                          : "h-2.5 w-2.5 shrink-0 rounded-sm bg-upcoming"
                      }
                    />
                    <span
                      className={
                        row.kind === "completed"
                          ? "font-medium text-success"
                          : "font-medium text-primary"
                      }
                    >
                      {kindLabel}
                    </span>
                    <span className="text-muted">· {when}</span>
                  </span>
                  {row.covered ? (
                    <span className="mt-0.5 block pl-4">{row.covered}</span>
                  ) : null}
                </span>
                <button
                  type="button"
                  onClick={() => void remove(row.date)}
                  className="min-h-11 shrink-0 rounded-lg px-2 text-sm text-muted touch-manipulation hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  aria-label={`Remove ${kindLabel} ${when}`}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </form>
  );
}
