import { useState } from "react";
import {
  Cloud,
  CloudOff,
  Copy,
  KeyRound,
  Loader2,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { toast } from "sonner";
import { Button } from "./Button";
import {
  ConnectSafelyHelpButton,
  ConnectSafelyModal,
} from "./ConnectSafelyGuide";
import { useAppStore } from "../stores/useAppStore";
import { useOnlineMode } from "../hooks/useOnlineMode";
import {
  canConnectSpaceToRelay,
  isSpaceGuest,
  isSpaceRelayConfigured,
  normalizeSpaceSync,
} from "../lib/sync";
import {
  downloadTextFile,
  exportFilename,
  formatExportShareText,
} from "../lib/share";
import type { Space } from "../types";

interface SpaceConnectionBarProps {
  space: Space;
}

function lastSyncedLabel(iso?: string): string | null {
  if (!iso) return null;
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return null;
  }
}

/**
 * Space connectivity — highest priority for multi-person groups.
 * Online-first model:
 * - Host: owns the room key (join code); opens room on create; share key only
 * - Guest: Join once with the key; Sync after that; never “Connect”
 * - Offline mode is a pause after you’re linked, not the default path
 */
export function SpaceConnectionBar({ space }: SpaceConnectionBarProps) {
  const connectSpaceToRelay = useAppStore((s) => s.connectSpaceToRelay);
  const syncSpaceNow = useAppStore((s) => s.syncSpaceNow);
  const setSpaceSyncPaused = useAppStore((s) => s.setSpaceSyncPaused);
  const buildSpaceExportPayload = useAppStore((s) => s.buildSpaceExportPayload);

  const { mode, networkOnline, setOnlineMode } = useOnlineMode();
  const [busy, setBusy] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [openRoomConfirm, setOpenRoomConfirm] = useState(false);

  const relayReady = isSpaceRelayConfigured();
  const sync = normalizeSpaceSync(space.sync);
  const connected = sync.mode === "connected" && Boolean(sync.roomId);
  const guest = isSpaceGuest(sync);
  const mayOpenRoom = canConnectSpaceToRelay(sync); // host only
  const paused = sync.paused === true;
  const ago = lastSyncedLabel(sync.lastSyncedAt);
  const roomKey = sync.shortCode;

  /** Local file backup — works with no network. Never loses the Space. */
  async function saveGroupFile() {
    try {
      const payload = await buildSpaceExportPayload(space.id);
      downloadTextFile(
        exportFilename(payload.space.name),
        formatExportShareText(payload),
      );
      toast.success("Group file saved on this phone", {
        description:
          "Your meetings are in that file (DSX1.). Private “Just for me” notes stay in the app only. Keep the file in Files / Drive / email.",
        duration: 7000,
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save group file",
      );
    }
  }

  async function handleSync() {
    if (!connected) return;
    if (mode === "offline") {
      toast.message("App is set to Offline", {
        description:
          "Tap Online on this card (or in the header), then Sync now.",
      });
      return;
    }
    setBusy(true);
    try {
      if (paused) await setSpaceSyncPaused(space.id, false);
      await syncSpaceNow(space.id);
      setJustSynced(true);
      window.setTimeout(() => setJustSynced(false), 4000);
      toast.success("Group updated", {
        description:
          "Shared meetings and people are up to date. Private notes stay on this phone.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      toast.error("Sync didn’t finish", {
        duration: 12000,
        description: `${msg} Your group is still on this phone — nothing was deleted. The big code above is your room key (invite), not a fault code.`,
        action: {
          label: "Save group file",
          onClick: () => void saveGroupFile(),
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
          "Ask them for the room key (join code). On this phone use Join a group — never open a second room.",
        duration: 6000,
      });
      setGuideOpen(true);
      return;
    }
    if (mode === "offline") {
      toast.message("Turn Online on first", {
        description: "Opening a shared room needs Online mode.",
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
      const code = normalizeSpaceSync(updated.sync).shortCode;
      const meetingCount = updated.sessions?.length ?? 0;
      toast.success(
        code ? `Room key ready · ${code}` : "Room ready — share the key",
        {
          description:
            meetingCount > 0
              ? `Shared history uploaded (${meetingCount} meeting${meetingCount === 1 ? "" : "s"}). Send the room key — guests Join once, then Sync. The key is not an error code.`
              : "Send this room key to friends (it is an invite code, not an error). They Join once — then both of you Sync after new meetings.",
          duration: 9000,
        },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open room");
    } finally {
      setBusy(false);
    }
  }

  function handleToggleOnline() {
    const next = mode === "online" ? "offline" : "online";
    setOnlineMode(next);
    toast.message(next === "online" ? "Online mode" : "Offline mode", {
      description:
        next === "online"
          ? "Shared groups may refresh when the network is available."
          : "Sync paused — your group stays on this phone until you go Online again.",
      duration: 3500,
    });
  }

  function copyRoomKey() {
    if (!roomKey) return;
    void navigator.clipboard.writeText(roomKey).then(
      () => toast.success("Room key copied"),
      () => toast.error("Could not copy"),
    );
  }

  const statusLine = (() => {
    if (justSynced) return "Just synced ✓";
    if (mode === "offline") return "Offline mode — sync paused (tap Online)";
    if (!relayReady) return "Local only · Invite with QR / file";
    if (guest && !connected) {
      return "Use Join a group with the host’s room key";
    }
    if (guest && connected) {
      return ago ? `Linked · synced ${ago}` : "Linked · tap Sync to refresh";
    }
    if (!connected) {
      return "Open the shared room to get a room key for friends";
    }
    if (paused) return "Sync paused for this group";
    if (sync.lastError) return sync.lastError;
    if (!networkOnline) {
      return "Browser unsure about network — Sync may still work";
    }
    if (ago) return `Synced ${ago}`;
    return "Room open · share the key, then Sync";
  })();

  return (
    <section
      className="rounded-2xl border border-primary/25 bg-primary/5 px-3 py-3 space-y-3"
      aria-label="Group room and sync"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-start gap-2">
          {mode === "online" && networkOnline ? (
            <Wifi className="h-4 w-4 shrink-0 mt-0.5 text-primary" aria-hidden />
          ) : (
            <WifiOff
              className="h-4 w-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-300"
              aria-hidden
            />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary leading-tight">
              {guest
                ? connected
                  ? "You’re linked"
                  : "Join with room key"
                : connected
                  ? "Your group room"
                  : "Group room"}
            </p>
            <p
              className={[
                "text-xs mt-0.5 leading-snug",
                justSynced ? "text-success font-medium" : "text-muted",
              ].join(" ")}
            >
              {statusLine}
            </p>
          </div>
        </div>

        <div
          className="shrink-0 inline-flex rounded-full border border-border bg-bg p-0.5"
          role="group"
          aria-label="Online or offline mode"
        >
          <button
            type="button"
            onClick={() => {
              if (mode !== "online") handleToggleOnline();
            }}
            className={[
              "rounded-full min-h-10 px-3 py-2 text-xs font-semibold touch-manipulation transition-colors",
              mode === "online"
                ? "bg-primary text-white"
                : "text-muted hover:text-primary",
            ].join(" ")}
            aria-pressed={mode === "online"}
          >
            Online
          </button>
          <button
            type="button"
            onClick={() => {
              if (mode !== "offline") handleToggleOnline();
            }}
            className={[
              "rounded-full min-h-10 px-3 py-2 text-xs font-semibold touch-manipulation transition-colors",
              mode === "offline"
                ? "bg-amber-600 text-white"
                : "text-muted hover:text-primary",
            ].join(" ")}
            aria-pressed={mode === "offline"}
          >
            Offline
          </button>
        </div>
      </div>

      {/* Room key — primary artifact for hosts */}
      {connected && roomKey && !guest && (
        <div className="rounded-xl border border-border bg-bg px-3 py-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5" aria-hidden />
            Room key (invite code) · not an error
          </p>
          <div className="flex items-center gap-2">
            <p
              className="flex-1 font-mono text-xl font-semibold tracking-wider text-primary text-center"
              aria-label={`Room key ${roomKey}`}
            >
              {roomKey}
            </p>
            <Button
              variant="secondary"
              className="!py-2.5 shrink-0"
              onClick={copyRoomKey}
            >
              <Copy className="h-4 w-4" aria-hidden />
              Copy
            </Button>
          </div>
          <p className="text-[11px] text-muted leading-relaxed text-center">
            Friends: Join a group → paste this key. After they join, you both
            tap Sync so past meetings transfer. They never open a second room.
          </p>
        </div>
      )}

      {connected && roomKey && guest && (
        <p className="text-xs text-muted text-center rounded-lg border border-border bg-bg/80 px-2 py-2">
          Linked with room key{" "}
          <span className="font-mono font-medium text-primary">{roomKey}</span>
          . Tap Sync when Online to refresh. If Sync fails, use{" "}
          <strong className="text-text">Join a group</strong> again with the
          host’s <em>current</em> key (same site).
        </p>
      )}

      {sync.lastError && (
        <div
          className="text-xs leading-relaxed rounded-lg border border-danger/30 bg-danger/5 px-2.5 py-2 space-y-2"
          role="alert"
        >
          <p className="text-danger">{sync.lastError}</p>
          <p className="text-muted">
            <strong className="text-primary">Your Space is still here</strong> —
            failed Sync never deletes meetings or notes. Save a group file so
            you can’t lose it.
          </p>
          <Button
            variant="secondary"
            className="!py-2 w-full"
            onClick={() => void saveGroupFile()}
          >
            Save group file now
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        {connected ? (
          <Button
            fullWidth
            variant={justSynced ? "secondary" : "primary"}
            className="!py-3.5"
            disabled={busy}
            onClick={() => void handleSync()}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : justSynced ? (
              <Cloud className="h-4 w-4" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
            {busy ? "Syncing…" : justSynced ? "Synced" : "Sync now"}
          </Button>
        ) : guest ? (
          <Button
            fullWidth
            variant="secondary"
            className="!py-3.5"
            onClick={() => setGuideOpen(true)}
          >
            <KeyRound className="h-4 w-4" aria-hidden />
            Need the host’s room key
          </Button>
        ) : (
          <Button
            fullWidth
            variant="primary"
            className="!py-3.5"
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

      {guest && !connected && (
        <p className="text-[11px] text-muted leading-relaxed text-center">
          You don’t create rooms. Use{" "}
          <strong className="text-text">Join a group</strong> with the host’s
          room key once — then Sync keeps you linked. Other Spaces on this phone
          stay put.
        </p>
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
          Phone may still have data — tap{" "}
          <strong className="font-semibold">Sync now</strong> to try.
        </p>
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
    </section>
  );
}
