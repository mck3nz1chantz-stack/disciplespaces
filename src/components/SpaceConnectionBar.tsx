import { useState } from "react";
import {
  Cloud,
  CloudOff,
  Copy,
  KeyRound,
  Link2,
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
import { RelinkRoomModal } from "./RelinkRoomModal";
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
  const reissueRoomKey = useAppStore((s) => s.reissueRoomKey);
  const setSpaceSyncPaused = useAppStore((s) => s.setSpaceSyncPaused);
  const buildSpaceExportPayload = useAppStore((s) => s.buildSpaceExportPayload);

  const { mode, networkOnline, setOnlineMode } = useOnlineMode();
  const [busy, setBusy] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [openRoomConfirm, setOpenRoomConfirm] = useState(false);
  const [relinkOpen, setRelinkOpen] = useState(false);

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
          "Shared meetings and people are up to date. Private notes stay on this phone. Your personal Spaces also save under your Account Key when Online.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      toast.error("Sync didn’t finish", {
        duration: 14000,
        description: `${msg} Your group is still on this phone — nothing was deleted. Use Fix link with the host’s current room key to re-connect without losing people or meetings.`,
        action: {
          label: "Fix link",
          onClick: () => setRelinkOpen(true),
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
          ? "Connected groups and your Account Key vault may refresh when the network is available."
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

  /**
   * Host re-sync: new join code, same room + members + meetings.
   * Friends already linked keep working; anyone with only the old code re-Joins.
   */
  async function handleReissueRoomKey() {
    if (!mayOpenRoom) {
      toast.message("Only the host can issue a new room key");
      return;
    }
    if (mode === "offline") {
      toast.message("Turn Online on first");
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
      window.setTimeout(() => setJustSynced(false), 4000);
      try {
        await navigator.clipboard.writeText(result.shortCode);
      } catch {
        // ignore
      }
      toast.success(`New room key · ${result.shortCode}`, {
        description:
          "Copied to clipboard. Share only with people who should stay in this group. Members on the list stay — they re-Join only if their phone lost the link.",
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
                ? "bg-primary text-on-primary"
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
        <div className="rounded-xl border-2 border-primary/30 bg-bg px-3 py-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted text-center">
            Pull latest from host
          </p>
          <p className="text-xs text-muted text-center leading-relaxed">
            Linked with room key{" "}
            <span className="font-mono font-medium text-primary">{roomKey}</span>
            . Tap <strong className="text-primary">Sync</strong> after the host
            updates people or meetings. If Sync fails, use{" "}
            <strong className="text-text">Fix link</strong> with their{" "}
            <em>current</em> room key — your data stays on this phone.
          </p>
        </div>
      )}

      {sync.lastError && (
        <div
          className="text-xs leading-relaxed rounded-lg border border-danger/30 bg-danger/5 px-2.5 py-2 space-y-2"
          role="alert"
        >
          <p className="text-danger">{sync.lastError}</p>
          <p className="text-muted">
            <strong className="text-primary">Your Space is still here</strong> —
            failed Sync never deletes meetings, people, or notes. Fix the link
            with the host’s current room key.
          </p>
          <div className="flex flex-col gap-1.5">
            <Button
              variant="primary"
              className="!py-2.5 w-full"
              disabled={!relayReady}
              onClick={() => setRelinkOpen(true)}
            >
              <Link2 className="h-4 w-4" aria-hidden />
              Fix link — keep my data
            </Button>
            <Button
              variant="secondary"
              className="!py-2 w-full"
              onClick={() => void saveGroupFile()}
            >
              Save group file now
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {connected ? (
          <Button
            fullWidth
            variant={justSynced ? "secondary" : "primary"}
            className={
              guest
                ? "!py-4 text-base font-semibold shadow-md"
                : "!py-3.5"
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
            className="!py-3.5"
            disabled={!relayReady}
            onClick={() => setRelinkOpen(true)}
          >
            <Link2 className="h-4 w-4" aria-hidden />
            {relayReady ? "Re-join with room key" : "Relay not on this build"}
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

      {/* Always offer repair for guests, and for hosts after errors */}
      {relayReady && (guest || sync.lastError || connected) && (
        <Button
          variant="ghost"
          className="!py-2 w-full !text-xs"
          onClick={() => setRelinkOpen(true)}
        >
          <Link2 className="h-3.5 w-3.5" aria-hidden />
          Fix link with host’s current room key
        </Button>
      )}

      {guest && !connected && (
        <p className="text-[11px] text-muted leading-relaxed text-center">
          You don’t create rooms. Paste the host’s room key in{" "}
          <strong className="text-text">Re-join</strong> (or Home → Join a
          group). Your people and meetings on this phone stay put.
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

      <RelinkRoomModal
        open={relinkOpen}
        space={space}
        onClose={() => setRelinkOpen(false)}
      />
    </section>
  );
}
