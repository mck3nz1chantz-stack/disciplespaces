import { useState } from "react";
import {
  ChevronDown,
  Cloud,
  CloudOff,
  Copy,
  KeyRound,
  Link2,
  Loader2,
  RefreshCw,
  Share2,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { toast } from "sonner";
import { Button } from "./Button";
import {
  ConnectSafelyHelpButton,
  ConnectSafelyModal,
} from "./ConnectSafelyGuide";
import { RelinkRoomModal } from "./RelinkRoomModal";
import { useAppStore } from "../stores/useAppStore";
import { useOnlineMode } from "../hooks/useOnlineMode";
import {
  canConnectSpaceToRelay,
  formatSyncChangeDescription,
  formatSyncSuccessTitle,
  getGroupLinkStatus,
  isSpaceGuest,
  isSpaceRelayConfigured,
  normalizeSpaceSync,
  noteManualSyncToast,
  SYNC_FAIL_TOAST_ID,
  SYNC_SUCCESS_TOAST_ID,
} from "../lib/sync";
import {
  downloadTextFile,
  exportFilename,
  formatExportShareText,
} from "../lib/share";
import type { Space } from "../types";

interface SpaceConnectionBarProps {
  space: Space;
  /** When true, expand Sharing tools on first paint (e.g. host needs room key). */
  defaultExpanded?: boolean;
}

function lastSyncedLabel(iso?: string): string | null {
  if (!iso) return null;
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return null;
  }
}

async function shareOrCopyRoomKey(
  roomKey: string,
  groupName: string,
): Promise<"shared" | "copied" | "failed"> {
  const text = `Join my DiscipleSpaces group “${groupName}” with room key: ${roomKey}\nhttps://disciple-spaces.pages.dev/`;
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({
        title: `${groupName} · DiscipleSpaces`,
        text,
      });
      return "shared";
    }
  } catch (err) {
    // User cancel is fine
    if (err instanceof Error && /abort|cancel/i.test(err.name + err.message)) {
      return "failed";
    }
  }
  try {
    await navigator.clipboard.writeText(roomKey);
    return "copied";
  } catch {
    return "failed";
  }
}

/**
 * Group pulse — progressive disclosure:
 * 1) Status (truthful) + Sync  — Online/Offline lives in the header only
 * 2) Expand: room key, Fix link, file backup, help
 */
export function SpaceConnectionBar({
  space,
  defaultExpanded = false,
}: SpaceConnectionBarProps) {
  const connectSpaceToRelay = useAppStore((s) => s.connectSpaceToRelay);
  const syncSpaceNow = useAppStore((s) => s.syncSpaceNow);
  const reissueRoomKey = useAppStore((s) => s.reissueRoomKey);
  const setSpaceSyncPaused = useAppStore((s) => s.setSpaceSyncPaused);
  const buildSpaceExportPayload = useAppStore((s) => s.buildSpaceExportPayload);

  const { mode, networkOnline } = useOnlineMode();
  const [busy, setBusy] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [openRoomConfirm, setOpenRoomConfirm] = useState(false);
  const [relinkOpen, setRelinkOpen] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const relayReady = isSpaceRelayConfigured();
  const sync = normalizeSpaceSync(space.sync);
  const link = getGroupLinkStatus(sync, mode);
  const connected = sync.mode === "connected" && Boolean(sync.roomId);
  const guest = isSpaceGuest(sync);
  const mayOpenRoom = canConnectSpaceToRelay(sync);
  const paused = sync.paused === true;
  const ago = lastSyncedLabel(sync.lastSyncedAt);
  const roomKey = sync.shortCode;
  const hasError = Boolean(sync.lastError);
  const appOffline = mode === "offline";

  async function saveGroupFile() {
    try {
      const payload = await buildSpaceExportPayload(space.id);
      downloadTextFile(
        exportFilename(payload.space.name),
        formatExportShareText(payload),
      );
      toast.success("Group file saved on this phone", {
        description:
          "Your meetings are in that file (DSX1.). Private “Just for me” notes stay in the app only.",
        duration: 6000,
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save group file",
      );
    }
  }

  async function handleSync() {
    if (!connected) return;
    if (appOffline) {
      toast.message("App is set to Offline", {
        description: "Tap Online in the header, then Sync.",
      });
      return;
    }
    setBusy(true);
    try {
      if (paused) await setSpaceSyncPaused(space.id, false);
      const { changes } = await syncSpaceNow(space.id);
      setJustSynced(true);
      window.setTimeout(() => setJustSynced(false), 4200);
      noteManualSyncToast();
      toast.success(formatSyncSuccessTitle(changes), {
        id: SYNC_SUCCESS_TOAST_ID,
        description: formatSyncChangeDescription(changes) ?? undefined,
        duration: changes.hasChanges ? 5200 : 3200,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      toast.error("Sync didn’t finish", {
        id: SYNC_FAIL_TOAST_ID,
        duration: 14000,
        description: `${msg} Your group is still on this phone — nothing was deleted.`,
        action: {
          label: "Fix link",
          onClick: () => {
            setExpanded(true);
            setRelinkOpen(true);
          },
        },
      });
    } finally {
      setBusy(false);
    }
  }

  function openRoomFlow() {
    if (!relayReady) {
      toast.message("Shared rooms not on this build", {
        description: "Use Invite (QR) or a group file for now.",
      });
      return;
    }
    if (!mayOpenRoom) {
      toast.message("Only the host opens the room", {
        description:
          "Ask them for the room key. On this phone use Join a group — never open a second room.",
        duration: 6000,
      });
      setGuideOpen(true);
      return;
    }
    if (appOffline) {
      toast.message("Turn Online on first", {
        description: "Use the Online control in the header, then open the room.",
      });
      return;
    }
    setOpenRoomConfirm(true);
  }

  async function confirmOpenRoom() {
    setBusy(true);
    try {
      const updated = await connectSpaceToRelay(space.id);
      setJustSynced(true);
      setOpenRoomConfirm(false);
      setExpanded(true);
      const code = normalizeSpaceSync(updated.sync).shortCode;
      const meetingCount = updated.sessions?.length ?? 0;
      if (code) {
        const shareResult = await shareOrCopyRoomKey(code, space.name);
        if (shareResult === "shared") {
          toast.success(`Room ready · ${code}`, {
            description:
              meetingCount > 0
                ? `Shared history uploaded (${meetingCount} meeting${meetingCount === 1 ? "" : "s"}). Friends Join once with that key, then Sync.`
                : "Share sheet opened. Friends Join once with the key, then Sync.",
            duration: 9000,
          });
        } else if (shareResult === "copied") {
          toast.success(`Room key copied · ${code}`, {
            description:
              "Text or message that key to friends. They Join once — then you both Sync.",
            duration: 9000,
          });
        } else {
          toast.success(code ? `Room key ready · ${code}` : "Room ready", {
            description:
              "Open Sharing tools below to copy or share the key.",
            duration: 9000,
          });
        }
      } else {
        toast.success("Room ready — share the key", {
          description: "Open Sharing tools to see the room key.",
          duration: 7000,
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open room");
    } finally {
      setBusy(false);
    }
  }

  function copyRoomKey() {
    if (!roomKey) return;
    void navigator.clipboard.writeText(roomKey).then(
      () => toast.success("Room key copied"),
      () => toast.error("Could not copy"),
    );
  }

  async function handleShareRoomKey() {
    if (!roomKey) return;
    const result = await shareOrCopyRoomKey(roomKey, space.name);
    if (result === "shared") {
      toast.success("Share sheet opened");
    } else if (result === "copied") {
      toast.success("Room key copied", {
        description: "This device has no share sheet — key is on the clipboard.",
      });
    } else {
      toast.message("Could not share", {
        description: "Copy the key manually.",
      });
    }
  }

  async function handleReissueRoomKey() {
    if (!mayOpenRoom) {
      toast.message("Only the host can issue a new room key");
      return;
    }
    if (appOffline) {
      toast.message("Turn Online on first (header)");
      return;
    }
    if (
      !window.confirm(
        `Issue a new room key for “${space.name}”?\n\n` +
          "• Same group, members, and meetings stay on the server\n" +
          "• The old join code stops working\n" +
          "• Friends already linked can still Sync\n" +
          "• Anyone not linked yet uses the new key in Join a group\n\n" +
          "Continue?",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const result = await reissueRoomKey(space.id, { rotateGroupKey: true });
      setJustSynced(true);
      setExpanded(true);
      window.setTimeout(() => setJustSynced(false), 4000);
      await shareOrCopyRoomKey(result.shortCode, space.name);
      toast.success(`New room key · ${result.shortCode}`, {
        description:
          "Old key no longer works. Share the new key only with people who should stay in this group.",
        duration: 12000,
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not issue a new room key",
        {
          action: {
            label: "Save group file",
            onClick: () => void saveGroupFile(),
          },
        },
      );
    } finally {
      setBusy(false);
    }
  }

  const pulseLabel = (() => {
    if (justSynced) return "Just synced";
    if (appOffline) return "App Offline — Online is in the header";
    if (!relayReady) return "Local only";
    if (hasError) return sync.lastError || "Link needs attention";
    if (guest && !connected) return "Join with room key";
    if (guest && connected) {
      return ago ? `Linked · ${ago}` : "Linked · tap Sync";
    }
    if (!connected) return "Open room for a share key";
    if (paused) return "Sync paused for this group";
    if (!networkOnline) return "Network unclear — Sync may still work";
    if (ago) return `Synced ${ago}`;
    return "Room open · share key";
  })();

  const pulseTone = (() => {
    if (justSynced) return "success";
    if (hasError) return "danger";
    if (appOffline || paused) return "amber";
    if (link.isLive) return "live";
    return "muted";
  })();

  return (
    <section
      className={[
        "rounded-2xl border px-3 py-3 space-y-2.5 transition-colors duration-300",
        justSynced
          ? "border-success/40 bg-success/10 ds-sync-pulse"
          : hasError
            ? "border-danger/30 bg-danger/5"
            : "border-primary/25 bg-primary/5",
      ].join(" ")}
      aria-label="Group room and sync"
    >
      {/* Pulse strip — no Online toggle (header owns that) */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 flex items-start gap-2">
          {link.isLive && !hasError ? (
            <span className="relative mt-0.5 shrink-0" aria-hidden>
              <Cloud className="h-4 w-4 text-primary" />
              <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-success ds-pulse-dot" />
            </span>
          ) : hasError ? (
            <Link2
              className="h-4 w-4 shrink-0 mt-0.5 text-danger"
              aria-hidden
            />
          ) : appOffline ? (
            <CloudOff
              className="h-4 w-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-300"
              aria-hidden
            />
          ) : (
            <Cloud
              className="h-4 w-4 shrink-0 mt-0.5 text-muted"
              aria-hidden
            />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary leading-tight">
              {guest
                ? connected
                  ? "Linked with host"
                  : "Join with room key"
                : connected
                  ? "Group pulse"
                  : "Group room"}
            </p>
            <p
              className={[
                "text-xs mt-0.5 leading-snug",
                pulseTone === "success"
                  ? "text-success font-medium"
                  : pulseTone === "danger"
                    ? "text-danger"
                    : pulseTone === "amber"
                      ? "text-amber-800 dark:text-amber-200"
                      : "text-muted",
              ].join(" ")}
            >
              {pulseLabel}
            </p>
          </div>
        </div>
        {link.kind !== "local" && (
          <span
            className={[
              "shrink-0 mt-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              link.isLive
                ? "border-success/30 bg-success/10 text-success"
                : link.kind === "error"
                  ? "border-danger/30 bg-danger/10 text-danger"
                  : link.kind === "offline" || link.kind === "paused"
                    ? "border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-100"
                    : "border-border bg-bg text-muted",
            ].join(" ")}
            title={link.title}
          >
            {link.label}
          </span>
        )}
      </div>

      {/* Primary action row */}
      <div className="flex gap-2">
        {connected ? (
          <Button
            fullWidth
            variant={justSynced ? "secondary" : "primary"}
            className={
              guest ? "!py-3.5 text-base font-semibold shadow-sm" : "!py-3"
            }
            disabled={busy}
            onClick={() => void handleSync()}
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : justSynced ? (
              <Cloud className="h-5 w-5" aria-hidden />
            ) : (
              <RefreshCw className="h-5 w-5" aria-hidden />
            )}
            {busy
              ? "Syncing…"
              : justSynced
                ? "Synced ✓"
                : guest
                  ? "Sync"
                  : "Sync now"}
          </Button>
        ) : guest ? (
          <Button
            fullWidth
            variant="primary"
            className="!py-3"
            disabled={!relayReady}
            onClick={() => {
              setExpanded(true);
              setRelinkOpen(true);
            }}
          >
            <Link2 className="h-4 w-4" aria-hidden />
            {relayReady ? "Re-join with room key" : "Relay not on this build"}
          </Button>
        ) : (
          <Button
            fullWidth
            variant="primary"
            className="!py-3"
            disabled={busy || !relayReady}
            onClick={openRoomFlow}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <KeyRound className="h-4 w-4" aria-hidden />
            )}
            {relayReady ? "Open group room" : "Local only"}
          </Button>
        )}
      </div>

      {/* Compact room key — expand only (no silent copy) */}
      {connected && roomKey && !guest && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 flex items-center justify-between gap-2 touch-manipulation active:scale-[0.99]"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Room key
          </span>
          <span className="font-mono text-base font-semibold tracking-wider text-primary">
            {roomKey}
          </span>
          <span className="text-[11px] font-medium text-primary shrink-0">
            Open
          </span>
        </button>
      )}

      {hasError && (
        <div
          className="text-xs leading-relaxed rounded-lg border border-danger/30 bg-danger/5 px-2.5 py-2 space-y-2"
          role="alert"
        >
          <p className="text-danger line-clamp-3">{sync.lastError}</p>
          <Button
            variant="primary"
            className="!py-2.5 w-full"
            disabled={!relayReady}
            onClick={() => {
              setExpanded(true);
              setRelinkOpen(true);
            }}
          >
            <Link2 className="h-4 w-4" aria-hidden />
            Fix link — keep my data
          </Button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-left touch-manipulation"
        aria-expanded={expanded}
      >
        <span className="text-xs font-semibold text-muted">
          {expanded ? "Hide sharing tools" : "Sharing tools · key, backup, help"}
        </span>
        <ChevronDown
          className={[
            "h-4 w-4 text-muted transition-transform",
            expanded ? "rotate-180" : "",
          ].join(" ")}
          aria-hidden
        />
      </button>

      {expanded && (
        <div className="space-y-3 pt-0.5 border-t border-border/70">
          {connected && roomKey && !guest && (
            <div className="rounded-xl border border-border bg-bg px-3 py-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" aria-hidden />
                Room key · invite code
              </p>
              <p
                className="font-mono text-xl font-semibold tracking-wider text-primary text-center"
                aria-label={`Room key ${roomKey}`}
              >
                {roomKey}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  className="!py-2.5 flex-1"
                  onClick={() => void handleShareRoomKey()}
                >
                  <Share2 className="h-4 w-4" aria-hidden />
                  Share
                </Button>
                <Button
                  variant="secondary"
                  className="!py-2.5 flex-1"
                  onClick={copyRoomKey}
                >
                  <Copy className="h-4 w-4" aria-hidden />
                  Copy
                </Button>
              </div>
              <p className="text-[11px] text-muted leading-relaxed text-center">
                Friends: Join a group → paste this key. After they join, you both
                tap Sync.
              </p>
              <Button
                variant="secondary"
                className="!py-2 w-full !text-xs"
                disabled={busy}
                onClick={() => void handleReissueRoomKey()}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                )}
                New room key (keep members)
              </Button>
            </div>
          )}

          {connected && roomKey && guest && (
            <p className="text-xs text-muted text-center leading-relaxed rounded-xl border border-border bg-bg px-3 py-2.5">
              Linked with{" "}
              <span className="font-mono font-medium text-primary">{roomKey}</span>
              . Tap <strong className="text-primary">Sync</strong> after the host
              updates people or meetings.
            </p>
          )}

          {relayReady && (guest || hasError || connected) && (
            <Button
              variant="ghost"
              className="!py-2 w-full !text-xs"
              onClick={() => setRelinkOpen(true)}
            >
              <Link2 className="h-3.5 w-3.5" aria-hidden />
              Fix link with host’s current room key
            </Button>
          )}

          <div className="flex flex-col sm:flex-row gap-2 justify-center items-stretch sm:items-center">
            <Button
              variant="ghost"
              className="!py-2 !text-xs"
              onClick={() => void saveGroupFile()}
            >
              Save group file (backup)
            </Button>
            <ConnectSafelyHelpButton onClick={() => setGuideOpen(true)}>
              {connected ? "How room keys & Sync work" : "How sharing works"}
            </ConnectSafelyHelpButton>
          </div>

          {mode === "online" && !networkOnline && (
            <p className="text-[11px] text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
              <CloudOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Phone may still have data — tap Sync to try.
            </p>
          )}
        </div>
      )}

      <ConnectSafelyModal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        audience={guest ? "guest" : "host"}
        title={connected ? "Room keys & Sync" : "Share this group safely"}
      />

      <ConnectSafelyModal
        open={openRoomConfirm}
        onClose={() => !busy && setOpenRoomConfirm(false)}
        audience="host"
        title="Open group room"
        primaryLabel={busy ? "Opening…" : "Open room & get key"}
        onPrimary={() => void confirmOpenRoom()}
        primaryBusy={busy}
      />

      <RelinkRoomModal
        open={relinkOpen}
        space={space}
        onClose={() => setRelinkOpen(false)}
      />
    </section>
  );
}
