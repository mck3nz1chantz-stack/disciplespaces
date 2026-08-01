import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { BookOpen, HandHeart, Plus, UserPlus, Users } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { QuickStartChecklist } from "../components/QuickStartChecklist";
import { ShareUpdateModal } from "../components/ShareUpdateModal";
import {
  consumePendingHomeAction,
  consumePendingJoinRaw,
} from "../components/Layout";
import { GroupLinkBadge } from "../components/GroupLinkBadge";
import { lastActivityIso, useAppStore } from "../stores/useAppStore";
import {
  useLiveOpenPrayerSummary,
  useLiveSpaces,
} from "../hooks/useLiveDb";
import { useOnlineMode } from "../hooks/useOnlineMode";
import { QUICKSTART_DISMISS_KEY, readFlag } from "../lib/onboarding";
import { getSpaceTemplateMeta } from "../lib/spaceTemplates";
import {
  formatReadingPositionLabel,
  loadReadingPosition,
} from "../lib/bible";
import type { Space } from "../types";
import { maxMembersForSpace, spaceKindLabel } from "../types";

export function Dashboard() {
  const navigate = useNavigate();
  const storeSpaces = useAppStore((s) => s.spaces);
  const liveSpaces = useLiveSpaces();
  /** Prefer live Dexie list when ready; fall back to store during first paint. */
  const spaces = liveSpaces ?? storeSpaces;
  const isLoading = useAppStore((s) => s.isLoading) && liveSpaces === undefined;
  const error = useAppStore((s) => s.error);
  const initialize = useAppStore((s) => s.initialize);
  const { mode: onlineMode } = useOnlineMode();

  const [backupOpen, setBackupOpen] = useState(false);
  const [backupMode, setBackupMode] = useState<"export" | "import">("export");
  const [showQuickStart, setShowQuickStart] = useState(
    () => !readFlag(QUICKSTART_DISMISS_KEY),
  );

  useEffect(() => {
    void initialize();
  }, [initialize]);

  // Legacy home-action handoff → full-page routes (deep links restore a place)
  useEffect(() => {
    function openPendingFromHandoff() {
      const action = consumePendingHomeAction();
      if (action === "create") {
        navigate("/new");
        return;
      }
      if (action === "join") {
        navigate("/join");
        return;
      }

      const pendingJoin = consumePendingJoinRaw();
      if (pendingJoin) {
        try {
          sessionStorage.setItem("ds-pending-join-raw", pendingJoin);
        } catch {
          // ignore
        }
        navigate("/join");
      }
    }

    openPendingFromHandoff();
    window.addEventListener("ds-pending-join", openPendingFromHandoff);
    return () =>
      window.removeEventListener("ds-pending-join", openPendingFromHandoff);
  }, [navigate]);

  const hasAnySessions = useMemo(
    () => spaces.some((s) => (s.sessions?.length ?? 0) > 0),
    [spaces],
  );

  const showChecklist =
    showQuickStart && !isLoading && (spaces.length === 0 || !hasAnySessions);

  const continueReading = useMemo(() => {
    const pos = loadReadingPosition();
    if (!pos) return null;
    return formatReadingPositionLabel(pos);
  }, [spaces.length]);

  /** Most recently active group (list is activity-sorted in store; live query may differ). */
  const lastSpace = useMemo(() => {
    if (spaces.length === 0) return null;
    return [...spaces].sort((a, b) =>
      lastActivityIso(b).localeCompare(lastActivityIso(a)),
    )[0]!;
  }, [spaces]);

  const openPrayers = useLiveOpenPrayerSummary();
  const prayerSpace =
    openPrayers && openPrayers.count > 0
      ? (spaces.find((s) => s.id === openPrayers.spaceId) ?? null)
      : null;

  const showNextUp =
    Boolean(lastSpace) || Boolean(continueReading) || Boolean(prayerSpace);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl">Your groups</h2>
        <p className="text-sm text-muted mt-1">
          Create a group to get a room key, or Join with a friend’s key. Sync
          keeps you together; private notes stay on this phone.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          fullWidth
          className="!py-3.5"
          onClick={() => navigate("/new")}
        >
          <Plus className="h-5 w-5" aria-hidden />
          New group
        </Button>
        <Button
          variant="secondary"
          fullWidth
          className="!py-3.5"
          onClick={() => navigate("/join")}
        >
          <UserPlus className="h-5 w-5" aria-hidden />
          Join a group
        </Button>
      </div>

      {showNextUp && (
        <section className="space-y-2" aria-label="Next up">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted px-0.5">
            Next up
          </h3>
          <div className="-mx-0.5 overflow-x-auto pb-0.5">
            <ul className="flex gap-2 min-w-min px-0.5">
              {lastSpace && (
                <li>
                  <Link
                    to={`/space/${lastSpace.id}`}
                    className={[
                      "inline-flex items-center gap-2 rounded-2xl border border-border/90",
                      "bg-surface/95 px-3 py-2.5 touch-manipulation",
                      "hover:border-primary/35 hover:bg-primary/5 active:scale-[0.98]",
                      "max-w-[14rem]",
                    ].join(" ")}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Users className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 text-left">
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted">
                        Last group
                      </span>
                      <span className="block text-sm font-medium text-primary truncate">
                        {lastSpace.name}
                      </span>
                    </span>
                  </Link>
                </li>
              )}
              {continueReading && (
                <li>
                  <Link
                    to="/bible"
                    className={[
                      "inline-flex items-center gap-2 rounded-2xl border border-border/90",
                      "bg-surface/95 px-3 py-2.5 touch-manipulation",
                      "hover:border-primary/35 hover:bg-primary/5 active:scale-[0.98]",
                      "max-w-[14rem]",
                    ].join(" ")}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <BookOpen className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 text-left">
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted">
                        Continue Bible
                      </span>
                      <span className="block text-sm font-serif font-medium text-primary truncate">
                        {continueReading}
                      </span>
                    </span>
                  </Link>
                </li>
              )}
              {prayerSpace && openPrayers && (
                <li>
                  <Link
                    to={`/space/${prayerSpace.id}`}
                    state={{ openPrayer: true }}
                    className={[
                      "inline-flex items-center gap-2 rounded-2xl border border-primary/25",
                      "bg-primary/8 px-3 py-2.5 touch-manipulation",
                      "hover:border-primary/40 active:scale-[0.98]",
                      "max-w-[14rem]",
                    ].join(" ")}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <HandHeart className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 text-left">
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted">
                        Prayer
                      </span>
                      <span className="block text-sm font-medium text-primary truncate">
                        {openPrayers.count} open
                        {prayerSpace.name
                          ? ` · ${prayerSpace.name}`
                          : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </section>
      )}

      {showChecklist && (
        <QuickStartChecklist
          hasSpaces={spaces.length > 0}
          hasSessions={hasAnySessions}
          firstSpaceId={spaces[0]?.id ?? null}
          onCreateSpace={() => navigate("/new")}
          onJoinSpace={() => navigate("/join")}
          onDismiss={() => setShowQuickStart(false)}
        />
      )}

      {error && (
        <Card className="border-danger/30 bg-danger/10 text-danger text-sm space-y-3">
          <p>{error}</p>
          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              fullWidth
              className="!py-2.5"
              onClick={() => {
                useAppStore.getState().clearError();
                void initialize();
              }}
            >
              Try again
            </Button>
            <p className="text-xs text-muted leading-relaxed">
              If this keeps failing after an app update, try Settings → Restore
              with a backup file, or fully refresh the site (clear site cache
              only if you have a backup).
            </p>
          </div>
        </Card>
      )}

      {isLoading && spaces.length === 0 && (
        <p className="text-sm text-muted">Loading…</p>
      )}

      {!isLoading && spaces.length === 0 && !showChecklist && (
        <Card className="text-center py-10 space-y-4">
          <Users className="h-10 w-10 mx-auto text-muted" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium text-primary">No groups yet</p>
            <p className="text-sm text-muted max-w-xs mx-auto">
              Start a small group, or join one you were invited to.
            </p>
          </div>
          <div className="flex flex-col gap-2 max-w-xs mx-auto w-full">
            <Button onClick={() => navigate("/new")}>
              <Plus className="h-5 w-5" aria-hidden />
              Start a group
            </Button>
            <Button variant="secondary" onClick={() => navigate("/join")}>
              <UserPlus className="h-5 w-5" aria-hidden />
              I was invited
            </Button>
          </div>
        </Card>
      )}

      <ul className="space-y-3">
        {spaces.map((space) => {
          const n = space.members.length;
          const max = maxMembersForSpace(space.spaceKind);
          return (
            <li key={space.id}>
              <Link
                to={`/space/${space.id}`}
                className="block touch-manipulation"
              >
                <Card className="cursor-pointer transition-all duration-150 hover:border-primary/40 hover:shadow-md hover:-translate-y-px active:scale-[0.99] active:translate-y-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-lg font-semibold truncate text-primary">
                          {space.name}
                        </h3>
                        <GroupLinkBadge
                          sync={space.sync}
                          onlineMode={onlineMode}
                        />
                      </div>
                      <p className="text-sm text-muted mt-1">
                        {n === 0
                          ? "No people listed yet"
                          : `${n} of ${max} people`}
                        {space.sessions.length > 0
                          ? ` · ${space.sessions.length} meeting${space.sessions.length === 1 ? "" : "s"}`
                          : ""}
                      </p>
                      {n > 0 && (
                        <p className="text-xs text-muted mt-0.5 truncate">
                          {space.members.map((m) => m.name).join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted">
                        {formatIsoDay(lastActivityIso(space))}
                      </p>
                      <p className="text-[11px] text-muted/80 mt-0.5">
                        {activityLabel(space)}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>

      {spaces.length > 0 && (
        <p className="text-center text-xs text-muted pb-1">
          <button
            type="button"
            className="text-primary font-medium underline-offset-2 hover:underline touch-manipulation"
            onClick={() => {
              setBackupMode("export");
              setBackupOpen(true);
            }}
          >
            Save a copy of a group
          </button>
          <span className="mx-1.5">·</span>
          <Link
            to="/settings"
            className="text-primary font-medium underline-offset-2 hover:underline"
          >
            Settings
          </Link>
        </p>
      )}

      <ShareUpdateModal
        open={backupOpen}
        defaultMode={backupMode}
        onClose={() => setBackupOpen(false)}
      />
    </div>
  );
}

export function SpaceTemplateBadge({
  templateId,
  labelSuffix = "",
}: {
  templateId?: string | null;
  /** e.g. " mode" for living-space lens. */
  labelSuffix?: string;
}) {
  const meta = getSpaceTemplateMeta(templateId);
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 text-primary text-[11px] font-semibold px-2 py-0.5 shrink-0">
      {meta.shortLabel}
      {labelSuffix}
    </span>
  );
}

export function SpaceKindBadge({
  kind,
}: {
  kind?: string | null;
}) {
  const family = kind === "family";
  return (
    <span
      className={[
        "inline-flex items-center rounded-full text-[11px] font-semibold px-2 py-0.5 shrink-0",
        family
          ? "bg-accent/20 text-primary"
          : "bg-surface-muted text-muted",
      ].join(" ")}
    >
      {spaceKindLabel(kind)}
    </span>
  );
}

function formatIsoDay(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d");
  } catch {
    return iso.slice(0, 10);
  }
}

function activityLabel(space: Space): string {
  const last = lastActivityIso(space);
  try {
    const d = parseISO(last);
    if (space.sessions.length === 0) {
      return "Created " + formatDistanceToNow(d, { addSuffix: true });
    }
    return "Active " + formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "";
  }
}
