import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import {
  HandHeart,
  Plus,
  Trash2,
  Users,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useLivePrayerBoard } from "../hooks/useLiveDb";
import { calendarDay } from "../lib/meetingCalendar";
import { useAppStore } from "../stores/useAppStore";
import type {
  Member,
  PrayerBoardEntry,
  PrayerBoardKind,
  PrayerBoardScope,
} from "../types";
import { Button } from "./Button";

interface PrayerBoardProps {
  spaceId: string;
  members: Member[];
  /** When logging from a session, attaches sessionId. */
  sessionId?: string;
  /**
   * yyyy-MM-dd of the session being started.
   * Open prayers from before that day are last session’s, ready to complete.
   */
  reviewDay?: string;
  /**
   * Set inside a session window so that session does not show another session’s prayers.
   * current: last week’s completed, then follow-ups, then this session.
   * past: only prayers from that session.
   */
  sessionScope?: PrayerSessionScope;
  /** All open: every prayer that is not completed. */
  openOnly?: boolean;
  /** Shown on the form, such as “Saves on Wed, Oct 28”. */
  saveNote?: string;
  /** Compact layout for embedding in session forms. */
  compact?: boolean;
  disabled?: boolean;
}

type BoardTab = PrayerBoardScope;

export interface PrayerSessionScope {
  role: "past" | "current";
  /** yyyy-MM-dd this window covers. Current uses today. Past uses that session day. */
  day: string;
  /** Prior session day. Prayers on that day belong to the prior session. */
  previousDay?: string;
  /** This session’s id. Prayers saved on it stay with it. */
  sessionId?: string;
  /** The completed night before this one. */
  previousSessionId?: string;
}

function isPrayerDone(entry: PrayerBoardEntry): boolean {
  return entry.status === "closed" || entry.status === "answered";
}

/**
 * Shared, space-facing prayer board (exportable with Space Updates).
 * Tabs: Individual | Group.
 */
export function PrayerBoard({
  spaceId,
  members,
  sessionId,
  reviewDay,
  sessionScope,
  openOnly = false,
  saveNote,
  compact = false,
  disabled = false,
}: PrayerBoardProps) {
  const addEntry = useAppStore((s) => s.addPrayerBoardEntry);
  const updateEntry = useAppStore((s) => s.updatePrayerBoardEntry);
  const deleteEntry = useAppStore((s) => s.deletePrayerBoardEntry);

  const allEntries = useLivePrayerBoard(spaceId, "all");
  const [tab, setTab] = useState<BoardTab>("individual");
  const [kind, setKind] = useState<PrayerBoardKind>("request");
  const [authorMemberId, setAuthorMemberId] = useState(
    () => members[0]?.id ?? "",
  );
  const [authorCustom, setAuthorCustom] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(!compact);

  useEffect(() => {
    if (sessionScope?.role === "current") setComposeOpen(true);
    if (sessionScope?.role === "past") setComposeOpen(false);
  }, [sessionScope?.role, sessionScope?.sessionId]);

  const entries = useMemo(() => {
    const list = allEntries ?? [];
    return list.filter((e) => e.scope === tab);
  }, [allEntries, tab]);

  const boundary = calendarDay(
    sessionScope?.role === "current"
      ? sessionScope.day
      : (reviewDay ?? ""),
  );
  const openEntries = entries.filter((entry) => !isPrayerDone(entry));
  const doneEntries = entries.filter((entry) => isPrayerDone(entry));
  const inPastSession = (entry: PrayerBoardEntry) => {
    if (sessionScope?.role !== "past") return false;
    if (sessionScope.sessionId && entry.sessionId === sessionScope.sessionId) {
      return true;
    }
    if (entry.sessionId) return false;
    const day = calendarDay(entry.createdAt);
    if (!day || day > sessionScope.day) return false;
    if (sessionScope.previousDay) return day > sessionScope.previousDay;
    return day <= sessionScope.day;
  };
  const inLastWeek = (entry: PrayerBoardEntry) => {
    if (sessionScope?.role !== "current") return false;
    if (
      sessionScope.previousSessionId &&
      entry.sessionId === sessionScope.previousSessionId
    ) {
      return true;
    }
    if (entry.sessionId) return false;
    if (!boundary) return false;
    const day = calendarDay(entry.createdAt);
    if (!day || day >= boundary) return false;
    if (sessionScope.previousDay) return day >= sessionScope.previousDay;
    return true;
  };
  const pastEntries = sessionScope?.role === "past" ? entries.filter(inPastSession) : [];
  const lastCompleted =
    sessionScope?.role === "current"
      ? entries.filter((entry) => inLastWeek(entry) && isPrayerDone(entry))
      : [];
  const carryOver =
    sessionScope?.role === "past"
      ? []
      : sessionScope?.role === "current"
        ? entries.filter((entry) => inLastWeek(entry) && !isPrayerDone(entry))
        : boundary
          ? openEntries.filter((entry) => calendarDay(entry.createdAt) < boundary)
          : [];
  const currentEntries = openOnly
    ? openEntries
    : sessionScope?.role === "past"
      ? pastEntries.filter((entry) => !isPrayerDone(entry))
      : sessionScope?.role === "current"
        ? openEntries.filter((entry) => {
            if (
              sessionScope.sessionId &&
              entry.sessionId === sessionScope.sessionId
            ) {
              return true;
            }
            if (entry.sessionId) return false;
            return calendarDay(entry.createdAt) >= boundary;
          })
        : boundary
          ? openEntries.filter((entry) => calendarDay(entry.createdAt) >= boundary)
          : openEntries;
  const visibleDone = openOnly
    ? []
    : sessionScope?.role === "past"
      ? pastEntries.filter((entry) => isPrayerDone(entry))
      : sessionScope?.role === "current"
        ? []
        : doneEntries;

  function countFor(scopeName: PrayerBoardScope): number {
    const list = (allEntries ?? []).filter((entry) => entry.scope === scopeName);
    if (openOnly) return list.filter((entry) => !isPrayerDone(entry)).length;
    if (sessionScope?.role === "past") {
      return list.filter((entry) => inPastSession(entry) && !isPrayerDone(entry)).length;
    }
    if (sessionScope?.role === "current") {
      return list.filter((entry) => {
        if (isPrayerDone(entry)) return false;
        if (inLastWeek(entry)) return true;
        if (sessionScope.sessionId && entry.sessionId === sessionScope.sessionId) {
          return true;
        }
        if (entry.sessionId) return false;
        return Boolean(boundary) && calendarDay(entry.createdAt) >= boundary;
      }).length;
    }
    return list.filter((entry) => !isPrayerDone(entry)).length;
  }
  const individualCount = countFor("individual");
  const groupCount = countFor("group");

  const authorName = resolveAuthorName(
    members,
    authorMemberId,
    authorCustom,
  );

  async function handleAdd(e?: FormEvent) {
    e?.preventDefault();
    if (saving || disabled) return;
    if (!authorName) {
      toast.error("Choose who is posting");
      return;
    }
    if (!content.trim()) {
      toast.error("Add a short prayer note");
      return;
    }
    setSaving(true);
    try {
      await addEntry({
        spaceId,
        sessionId,
        scope: tab,
        kind,
        authorMemberId: authorMemberId || undefined,
        authorName,
        subject,
        content,
      });
      setContent("");
      setSubject("");
      toast.success(
        tab === "group" ? "Added to group prayer board" : "Added to prayer board",
        {
          description: "Shared with this space · included in Space Updates",
        },
      );
      if (compact) setComposeOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not add prayer entry",
      );
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(
    entry: PrayerBoardEntry,
    status: "open" | "closed",
  ) {
    if (saving || disabled) return;
    setSaving(true);
    try {
      await updateEntry(entry.id, { status });
      toast.success(status === "closed" ? "Prayer completed" : "Prayer opened again");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    } finally {
      setSaving(false);
    }
  }

  async function completeCarryOver() {
    if (saving || disabled || carryOver.length === 0) return;
    setSaving(true);
    try {
      for (const entry of carryOver) {
        await updateEntry(entry.id, { status: "closed" });
      }
      toast.success("Last session’s prayers completed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (saving || disabled) return;
    setSaving(true);
    try {
      await deleteEntry(id);
      setConfirmDeleteId(null);
      toast.success("Removed from prayer board");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setSaving(false);
    }
  }

  const loading = allEntries === undefined;

  function renderEntry(entry: PrayerBoardEntry, completed: boolean) {
    const statusLabel =
      entry.status === "answered"
        ? "Answered"
        : entry.status === "closed"
          ? "Completed"
          : "";
    return (
      <li
        key={entry.id}
        className={[
          "rounded-xl border px-3 py-2.5 space-y-1.5",
          completed ? "border-success/30 bg-success/5" : "border-border bg-surface",
        ].join(" ")}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary">
            {formatPrayerHeadline(entry)}
          </p>
          <p className="text-[11px] text-muted tabular-nums mt-0.5">
            {formatEntryTime(entry.createdAt)}
            {statusLabel ? ` · ${statusLabel}` : ""}
          </p>
        </div>
        {entry.content && !isHeadlineOnly(entry) && (
          <p className="text-sm whitespace-pre-wrap text-text/90">{entry.content}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={completed ? "ghost" : "secondary"}
            className="!min-h-11"
            onClick={() => void setStatus(entry, completed ? "open" : "closed")}
            disabled={disabled || saving}
          >
            {completed ? "Open again" : "Mark completed"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="!min-h-11 text-danger"
            onClick={() =>
              setConfirmDeleteId(confirmDeleteId === entry.id ? null : entry.id)
            }
            disabled={disabled || saving}
            aria-label={`Delete ${formatPrayerHeadline(entry)}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Delete
          </Button>
        </div>
        {confirmDeleteId === entry.id && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              className="!py-2"
              onClick={() => setConfirmDeleteId(null)}
              disabled={saving}
            >
              Keep
            </Button>
            <Button
              type="button"
              variant="danger"
              fullWidth
              className="!py-2"
              onClick={() => void handleDelete(entry.id)}
              disabled={saving}
            >
              Delete
            </Button>
          </div>
        )}
      </li>
    );
  }

  return (
    <section
      className={[
        "rounded-2xl border border-border bg-bg/80 space-y-3",
        compact ? "p-3" : "p-3.5",
      ].join(" ")}
      aria-label="Prayer board"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-primary flex items-center gap-1.5">
            <HandHeart className="h-4 w-4 shrink-0" aria-hidden />
            Prayer board
          </h3>
          <p className="text-xs text-muted mt-0.5">
            {sessionScope?.role === "past"
              ? "Only prayers from this session. Later requests stay on the current session."
              : sessionScope?.role === "current"
                ? "Last week’s completed prayers stay separate from follow-ups and new requests."
                : boundary
                  ? "Last session stays up until you mark it completed. New requests are for this session."
                  : "Shared with this space. Travels with Space Updates (not private)."}
          </p>
        </div>
        {compact && (
          <Button
            type="button"
            variant="secondary"
            className="!py-2 !px-2.5 shrink-0 text-xs"
            onClick={() => setComposeOpen((o) => !o)}
            disabled={disabled}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {composeOpen ? "Hide" : "Add"}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div
        className="grid grid-cols-2 gap-1 rounded-xl bg-surface-muted/70 p-1"
        role="tablist"
        aria-label="Prayer board scope"
      >
        <TabButton
          selected={tab === "individual"}
          onClick={() => setTab("individual")}
          icon={<User className="h-3.5 w-3.5" aria-hidden />}
          label="Individual"
          count={individualCount}
        />
        <TabButton
          selected={tab === "group"}
          onClick={() => setTab("group")}
          icon={<Users className="h-3.5 w-3.5" aria-hidden />}
          label="Group"
          count={groupCount}
        />
      </div>

      {lastCompleted.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Last week’s completed
          </p>
          <ul className="space-y-2" aria-label="Last week’s completed prayers">
            {lastCompleted.map((entry) => renderEntry(entry, true))}
          </ul>
        </div>
      )}

      {carryOver.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {sessionScope?.role === "current" ? "Upcoming follow up" : "From last session"}
          </p>
          <p className="text-sm text-primary">
            {sessionScope?.role === "current"
              ? "Still open from last session. Mark one completed after you talk it through."
              : "Talk through these, then mark them completed."}
          </p>
          {carryOver.length > 1 && (
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => void completeCarryOver()}
              disabled={disabled || saving}
            >
              Mark all completed
            </Button>
          )}
          <ul className="space-y-2" aria-label="Prayers from the last session">
            {carryOver.map((entry) => renderEntry(entry, false))}
          </ul>
        </div>
      )}

      {(composeOpen || !compact) && (
        <form onSubmit={handleAdd} className="space-y-2.5 border-t border-border pt-3">
          {saveNote ? <p className="text-sm text-muted">{saveNote}</p> : null}
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: "request" as const, label: "Request" },
                { id: "prayed" as const, label: "I prayed" },
                { id: "update" as const, label: "Update" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setKind(opt.id)}
                disabled={disabled || saving}
                className={[
                  "rounded-lg border px-2 py-2 text-xs font-medium touch-manipulation tap-target",
                  kind === opt.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface text-muted",
                ].join(" ")}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted">Who</span>
              {members.length > 0 ? (
                <select
                  value={authorMemberId}
                  onChange={(e) => {
                    setAuthorMemberId(e.target.value);
                    if (e.target.value) setAuthorCustom("");
                  }}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-base"
                  disabled={disabled || saving}
                >
                  <option value="">Other name…</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              ) : null}
              {(members.length === 0 || !authorMemberId) && (
                <input
                  value={authorCustom}
                  onChange={(e) => setAuthorCustom(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-base"
                  placeholder="Your name"
                  maxLength={60}
                  disabled={disabled || saving}
                />
              )}
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted">
                {kind === "prayed" ? "Prayed for" : "For (optional)"}
              </span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-base"
                placeholder={
                  kind === "prayed"
                    ? "e.g. Jeff"
                    : kind === "request"
                      ? "e.g. healing, family"
                      : "e.g. job search"
                }
                maxLength={80}
                disabled={disabled || saving}
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted">
              {kind === "request"
                ? "Prayer request"
                : kind === "prayed"
                  ? "Note (optional detail)"
                  : "Update"}
            </span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-base min-h-[72px] resize-y"
              placeholder={
                kind === "request"
                  ? tab === "group"
                    ? "e.g. Please pray for our church retreat this weekend"
                    : "e.g. Sam requests prayers for an upcoming surgery"
                  : kind === "prayed"
                    ? "e.g. Lifted Jeff in prayer for peace and healing"
                    : "e.g. Surgery went well — thank you for praying"
              }
              maxLength={2000}
              disabled={disabled || saving}
            />
          </label>

          <Button
            type="submit"
            fullWidth
            disabled={disabled || saving || !content.trim() || !authorName}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Post to {tab === "group" ? "group" : "individual"} board
          </Button>
        </form>
      )}

      <div className="space-y-4 border-t border-border pt-3">
        {loading && (
          <p className="text-sm text-muted">Loading prayer board…</p>
        )}

        {sessionScope?.role === "past" &&
          currentEntries.length === 0 &&
          visibleDone.length === 0 && (
            <p className="text-sm text-muted italic rounded-xl bg-surface-muted/50 px-3 py-3">
              No prayers were saved on this session.
            </p>
          )}

        {(sessionScope?.role !== "past" || currentEntries.length > 0) && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {sessionScope?.role === "past"
              ? "Requests"
              : boundary || sessionScope?.role === "current"
                ? "This session"
                : tab === "group"
                  ? "Group prayers"
                  : "Individual prayers"}
          </p>
          {!loading && currentEntries.length === 0 && visibleDone.length === 0 && (
            <p className="text-sm text-muted italic rounded-xl bg-surface-muted/50 px-3 py-3">
              {sessionScope?.role === "past"
                ? "No prayers were saved on this session."
                : boundary || sessionScope?.role === "current"
                ? "No new requests yet."
                : tab === "group"
                  ? "No group prayer items yet. Post a need the whole space can carry."
                  : "No individual posts yet. Try “Sam requests prayers…” or “John prayed for Jeff.”"}
            </p>
          )}
          <ul className="space-y-2" aria-label={`${tab} prayer board entries`}>
            {currentEntries.map((entry) => renderEntry(entry, false))}
          </ul>
        </div>
        )}

        {visibleDone.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Completed
            </p>
            <ul className="space-y-2" aria-label="Completed prayers">
              {visibleDone.map((entry) => renderEntry(entry, true))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function TabButton({
  selected,
  onClick,
  icon,
  label,
  count,
}: {
  selected: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={[
        "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold touch-manipulation tap-target transition-colors",
        selected
          ? "bg-surface text-primary shadow-sm"
          : "text-muted hover:text-text",
      ].join(" ")}
    >
      {icon}
      {label}
      {count > 0 && (
        <span className="tabular-nums text-[10px] opacity-80">({count})</span>
      )}
    </button>
  );
}

function resolveAuthorName(
  members: Member[],
  memberId: string,
  custom: string,
): string {
  if (memberId) {
    const m = members.find((x) => x.id === memberId);
    if (m?.name.trim()) return m.name.trim();
  }
  return custom.trim();
}

/** Headline like “John prayed for Jeff” or “Sam requests prayers for surgery”. */
export function formatPrayerHeadline(entry: PrayerBoardEntry): string {
  const who = entry.authorName.trim() || "Someone";
  const subject = entry.subject?.trim();

  if (entry.kind === "prayed") {
    if (subject) return `${who} prayed for ${subject}`;
    return `${who} prayed`;
  }
  if (entry.kind === "request") {
    if (subject) return `${who} requests prayers for ${subject}`;
    return `${who} requests prayer`;
  }
  // update
  if (subject) return `${who} · update on ${subject}`;
  return `${who} · update`;
}

function isHeadlineOnly(entry: PrayerBoardEntry): boolean {
  // If content is essentially the same as subject scaffolding, still show it;
  // only hide when content is empty (already handled).
  return !entry.content.trim();
}

function formatEntryTime(iso: string): string {
  try {
    const d = parseISO(iso);
    return `${format(d, "MMM d · h:mm a")} (${formatDistanceToNow(d, { addSuffix: true })})`;
  } catch {
    return iso.slice(0, 16);
  }
}
