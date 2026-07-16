import { useState } from "react";
import {
  Cloud,
  CloudOff,
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
 * Obvious sync CTA + Online/Offline toggle for a Space.
 * Keeps worship layout clean while making connection status unmissable.
 */
export function SpaceConnectionBar({ space }: SpaceConnectionBarProps) {
  const connectSpaceToRelay = useAppStore((s) => s.connectSpaceToRelay);
  const syncSpaceNow = useAppStore((s) => s.syncSpaceNow);
  const setSpaceSyncPaused = useAppStore((s) => s.setSpaceSyncPaused);

  const { mode, networkOnline, canSync, setOnlineMode } = useOnlineMode();
  const [busy, setBusy] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  /** Connect confirm uses the same guide modal with a primary action. */
  const [connectConfirmOpen, setConnectConfirmOpen] = useState(false);

  const relayReady = isSpaceRelayConfigured();
  const sync = normalizeSpaceSync(space.sync);
  const connected = sync.mode === "connected" && Boolean(sync.roomId);
  const guest = isSpaceGuest(sync);
  const mayConnect = canConnectSpaceToRelay(sync);
  const paused = sync.paused === true;
  const ago = lastSyncedLabel(sync.lastSyncedAt);

  async function handleSync() {
    if (!connected) return;
    if (!networkOnline) {
      toast.message("You’re offline", {
        description: "Reconnect or turn Online on, then try Sync again.",
      });
      return;
    }
    if (mode === "offline") {
      toast.message("App is set to Offline", {
        description: "Flip to Online to refresh this group with others.",
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
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  function openConnectFlow() {
    if (!relayReady) {
      toast.message("Easy join not on this build", {
        description: "Use Invite (QR) or save a group file for now.",
      });
      return;
    }
    if (!mayConnect) {
      toast.message("Only the host can Connect", {
        description:
          "Ask them to Connect and share the join code. On this phone use Join a group — your other Spaces stay as they are.",
        duration: 6000,
      });
      setGuideOpen(true);
      return;
    }
    if (!canSync) {
      toast.message("Turn Online on first", {
        description: "Connect needs a network and Online mode.",
      });
      return;
    }
    setConnectConfirmOpen(true);
  }

  async function confirmConnect() {
    setBusy(true);
    try {
      await connectSpaceToRelay(space.id);
      setJustSynced(true);
      setConnectConfirmOpen(false);
      toast.success("Connected — share the join code", {
        description:
          "Open Invite and send the code. Friends Join — they should not Connect.",
        duration: 5500,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not connect");
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
          ? "This app may refresh connected groups when the network is available."
          : "Staying on this phone only — no group sync until you turn Online on.",
      duration: 3500,
    });
  }

  const statusLine = (() => {
    if (justSynced) return "Just synced ✓";
    if (!networkOnline) return "No network — working on this phone";
    if (mode === "offline") return "Offline mode — sync paused";
    if (!relayReady) return "Local group · Invite with QR";
    if (guest && !connected) {
      return "Joined copy · host Connects, you use their join code";
    }
    if (!connected) return "Not connected · host can Connect for easy invite";
    if (paused) return "Sync paused for this group";
    if (sync.lastError) return sync.lastError;
    if (ago) return `Synced ${ago}`;
    return "Connected · not synced yet";
  })();

  return (
    <section
      className="rounded-2xl border border-border bg-surface px-3 py-3 space-y-3"
      aria-label="Connection and sync"
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
              {connected
                ? justSynced
                  ? "Up to date"
                  : "Group connection"
                : "This phone"}
            </p>
            <p
              className={[
                "text-xs mt-0.5 leading-snug",
                justSynced ? "text-success font-medium" : "text-muted",
              ].join(" ")}
            >
              {statusLine}
              {connected && sync.shortCode ? (
                <span className="text-muted font-normal">
                  {" "}
                  · code {sync.shortCode}
                </span>
              ) : null}
            </p>
          </div>
        </div>

        {/* Online / Offline toggle — 44px min hit area */}
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
            <Cloud className="h-4 w-4" aria-hidden />
            Waiting on host to Connect
          </Button>
        ) : (
          <Button
            fullWidth
            variant="secondary"
            className="!py-3.5"
            disabled={busy || !relayReady}
            onClick={openConnectFlow}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Cloud className="h-4 w-4" aria-hidden />
            )}
            {relayReady ? "Connect for easy invite" : "Local only"}
          </Button>
        )}
      </div>

      {guest && !connected && (
        <p className="text-[11px] text-muted leading-relaxed text-center">
          You joined this group on this phone. Only the host can Connect. When
          they share a join code, use{" "}
          <strong className="text-text">Join a group</strong> — your other
          Spaces are not changed.
        </p>
      )}

      <div className="flex justify-center">
        <ConnectSafelyHelpButton onClick={() => setGuideOpen(true)}>
          {connected ? "How sharing & Sync work" : "How to connect safely"}
        </ConnectSafelyHelpButton>
      </div>

      {!networkOnline && (
        <p className="text-[11px] text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
          <CloudOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
          No Wi‑Fi or cell data — meetings and notes still work here.
        </p>
      )}

      {/* Read-only guide */}
      <ConnectSafelyModal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        audience="both"
        title={connected ? "Sharing & Sync" : "Connect safely"}
      />

      {/* Connect consent = same steps + primary action (replaces window.confirm) */}
      <ConnectSafelyModal
        open={connectConfirmOpen}
        onClose={() => !busy && setConnectConfirmOpen(false)}
        audience="host"
        title={`Connect “${space.name}”?`}
        primaryLabel="Connect this group"
        onPrimary={confirmConnect}
        primaryBusy={busy}
      />
    </section>
  );
}
