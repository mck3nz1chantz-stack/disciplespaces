import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import {
  CheckCircle2,
  HandHeart,
  Plus,
  Trash2,
  Users,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useLivePrayerBoard } from "../hooks/useLiveDb";
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
  /** Compact layout for embedding in session forms. */
  compact?: boolean;
  disabled?: boolean;
}

type BoardTab = PrayerBoardScope;

/**
 * Shared, space-facing prayer board (exportable with Space Updates).
 * Tabs: Individual | Group.
 */
export function PrayerBoard({
  spaceId,
  members,
  sessionId,
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

  const entries = useMemo(() => {
    const list = allEntries ?? [];
    return list.filter((e) => e.scope === tab);
  }, [allEntries, tab]);

  const individualCount =
    allEntries?.filter((e) => e.scope === "individual").length ?? 0;
  const groupCount = allEntries?.filter((e) => e.scope === "group").length ?? 0;

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

  async function markAnswered(entry: PrayerBoardEntry) {
    if (saving || disabled) return;
    setSaving(true);
    try {
      await updateEntry(entry.id, {
        status: entry.status === "answered" ? "open" : "answered",
      });
      toast.success(
        entry.status === "answered" ? "Marked open again" : "Marked as answered",
      );
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
            Shared with this space
            {sessionId ? " · logs from this session" : ""}. Travels with Space
            Updates (not private).
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

      {(composeOpen || !compact) && (
        <form onSubmit={handleAdd} className="space-y-2.5 border-t border-border pt-3">
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

      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {tab === "group" ? "Group prayers" : "Individual prayers"}
          </p>
          <span className="text-xs text-muted tabular-nums">
            {loading ? "…" : `${entries.length}`}
          </span>
        </div>

        {loading && (
          <p className="text-sm text-muted">Loading prayer board…</p>
        )}

        {!loading && entries.length === 0 && (
          <p className="text-sm text-muted italic rounded-xl bg-surface-muted/50 px-3 py-3">
            {tab === "group"
              ? "No group prayer items yet. Post a need the whole space can carry."
              : "No individual posts yet. Try “Sam requests prayers…” or “John prayed for Jeff.”"}
          </p>
        )}

        <ul className="space-y-2" aria-label={`${tab} prayer board entries`}>
          {entries.map((entry) => (
            <li
              key={entry.id}
              className={[
                "rounded-xl border px-3 py-2.5 space-y-1.5",
                entry.status === "answered"
                  ? "border-success/30 bg-success/5"
                  : "border-border bg-surface",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary">
                    {formatPrayerHeadline(entry)}
                  </p>
                  <p className="text-[11px] text-muted tabular-nums mt-0.5">
                    {formatEntryTime(entry.createdAt)}
                    {entry.status === "answered" ? " · Answered" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    className="!p-2"
                    onClick={() => void markAnswered(entry)}
                    disabled={disabled || saving}
                    aria-label={
                      entry.status === "answered"
                        ? "Mark as open"
                        : "Mark as answered"
                    }
                    title={
                      entry.status === "answered"
                        ? "Mark open"
                        : "Mark answered"
                    }
                  >
                    <CheckCircle2
                      className={[
                        "h-4 w-4",
                        entry.status === "answered"
                          ? "text-success"
                          : "text-muted",
                      ].join(" ")}
                      aria-hidden
                    />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="!p-2 text-danger"
                    onClick={() =>
                      setConfirmDeleteId(
                        confirmDeleteId === entry.id ? null : entry.id,
                      )
                    }
                    disabled={disabled || saving}
                    aria-label="Delete prayer entry"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </div>

              {entry.content &&
                !isHeadlineOnly(entry) && (
                  <p className="text-sm whitespace-pre-wrap text-text/90">
                    {entry.content}
                  </p>
                )}

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
          ))}
        </ul>
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
