import { getGroupLinkStatus, type GroupLinkStatus } from "../lib/sync";
import type { SpaceSyncState } from "../types";
import type { OnlineMode } from "../lib/onlineMode";

const toneClass: Record<GroupLinkStatus["kind"], string> = {
  live: "border-success/30 bg-success/10 text-success",
  offline: "border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-100",
  paused: "border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-100",
  error: "border-danger/30 bg-danger/10 text-danger",
  guest: "border-border bg-surface-muted text-muted",
  local: "border-border bg-surface-muted text-muted",
  "linked-idle": "border-primary/25 bg-primary/10 text-primary",
};

interface GroupLinkBadgeProps {
  sync: SpaceSyncState | undefined | null;
  onlineMode: OnlineMode;
  /** Compact chip (dashboard) vs slightly larger (hero). */
  size?: "sm" | "md";
  className?: string;
}

/** Truthful room-link chip — never “Live” while Offline or errored. */
export function GroupLinkBadge({
  sync,
  onlineMode,
  size = "sm",
  className = "",
}: GroupLinkBadgeProps) {
  const status = getGroupLinkStatus(sync, onlineMode);
  // Local-only groups without guest role: omit chip (noise)
  if (status.kind === "local") return null;

  return (
    <span
      className={[
        "shrink-0 inline-flex items-center gap-1 rounded-full border font-semibold",
        size === "sm"
          ? "px-1.5 py-0.5 text-[10px]"
          : "px-2.5 py-1 text-xs",
        toneClass[status.kind],
        className,
      ].join(" ")}
      title={status.title}
    >
      {status.isLive && (
        <span
          className="h-1.5 w-1.5 rounded-full bg-success ds-pulse-dot"
          aria-hidden
        />
      )}
      {status.label}
    </span>
  );
}
