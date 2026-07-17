import { useMemo, useState } from "react";
import {
  Cloud,
  CloudOff,
  Copy,
  Download,
  Link2Off,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Card } from "./Card";
import { Button } from "./Button";
import {
  CANONICAL_APP_ORIGIN,
  canConnectSpaceToRelay,
  isSpaceGuest,
  isSpaceRelayConfigured,
  normalizeSpaceSync,
} from "../lib/sync";
import {
  DATA_CONFIDENCE_BODY,
  DATA_CONFIDENCE_HEADLINE,
  DATA_CONFIDENCE_STEPS,
  PRIVATE_NOTES_PILL,
  PRODUCTION_URL,
  RELAY_COMING_NOTE,
  RELAY_CONNECT_CONSENT,
} from "../lib/legal";
import { useAppStore } from "../stores/useAppStore";
import { GroupKeySection } from "./GroupKeySection";
import type { Space } from "../types";

interface YourDataBundleProps {
  /** Number of Spaces (compact teaser). */
  spaceCount?: number;
  onBackup: () => void;
  onImport: () => void;
  /**
   * full = Settings (status + per-space + advanced)
   * compact = Dashboard teaser
   */
  variant?: "full" | "compact";
  /** When set, only show controls for this Space (Space detail strip). */
  focusSpaceId?: string | null;
}

function syncLabel(space: Space): string {
  const s = normalizeSpaceSync(space.sync);
  if (s.mode === "connected") {
    if (s.paused) return "Paused";
    return "Connected";
  }
  return "This device only";
}

function lastSyncText(space: Space): string | null {
  const at = normalizeSpaceSync(space.sync).lastSyncedAt;
  if (!at) return null;
  try {
    return formatDistanceToNow(parseISO(at), { addSuffix: true });
  } catch {
    return null;
  }
}

/**
 * Confidence control panel: backup, restore, connect/sync, advanced offline.
 * Default remains local-only; relay is opt-in when configured.
 */
export function YourDataBundle({
  spaceCount = 0,
  onBackup,
  onImport,
  variant = "full",
  focusSpaceId = null,
}: YourDataBundleProps) {
  const spaces = useAppStore((s) => s.spaces);
  const connectSpaceToRelay = useAppStore((s) => s.connectSpaceToRelay);
  const syncSpaceNow = useAppStore((s) => s.syncSpaceNow);
  const setSpaceSyncPaused = useAppStore((s) => s.setSpaceSyncPaused);
  const unlinkSpaceFromRelay = useAppStore((s) => s.unlinkSpaceFromRelay);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const relayReady = isSpaceRelayConfigured();
  const bookmarkUrl = CANONICAL_APP_ORIGIN || PRODUCTION_URL;

  const list = useMemo(() => {
    if (focusSpaceId) {
      return spaces.filter((s) => s.id === focusSpaceId);
    }
    return spaces;
  }, [spaces, focusSpaceId]);

  async function runSpaceAction(
    spaceId: string,
    action: () => Promise<unknown>,
    ok: string,
  ) {
    setBusyId(spaceId);
    try {
      await action();
      toast.success(ok);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  function copyText(label: string, text: string) {
    void navigator.clipboard.writeText(text).then(
      () => toast.success(`${label} copied`),
      () => toast.error("Could not copy"),
    );
  }

  if (variant === "compact") {
    return (
      <Card className="space-y-3 border-primary/20 bg-primary/5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-primary text-sm">
              {DATA_CONFIDENCE_HEADLINE}
            </p>
            <p className="text-xs text-muted mt-0.5 leading-relaxed">
              {PRIVATE_NOTES_PILL}. Bookmark{" "}
              <span className="font-medium text-text break-all">
                {bookmarkUrl}
              </span>
              . Back up anytime — your Spaces stay on this phone until you
              choose otherwise.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            fullWidth
            className="!py-2.5"
            onClick={onBackup}
            disabled={spaceCount === 0}
          >
            <Download className="h-4 w-4" aria-hidden />
            Back up
          </Button>
          <Button
            variant="secondary"
            fullWidth
            className="!py-2.5"
            onClick={onImport}
          >
            <Upload className="h-4 w-4" aria-hidden />
            Restore
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 border-primary/25 bg-primary/5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <ShieldCheck className="h-6 w-6" aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-primary">
            Your Spaces &amp; data
          </h3>
          <p className="text-sm text-muted mt-1 leading-relaxed">
            {DATA_CONFIDENCE_BODY}
          </p>
          <p className="text-xs font-medium text-primary mt-2">
            {PRIVATE_NOTES_PILL}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm rounded-xl border border-border bg-bg/80 px-3 py-2.5">
        <dt className="text-muted">On this device</dt>
        <dd className="text-right font-medium tabular-nums">
          {spaces.length} Space{spaces.length === 1 ? "" : "s"}
        </dd>
        <dt className="text-muted">Site to bookmark</dt>
        <dd className="text-right">
          <button
            type="button"
            className="text-xs font-medium text-primary underline-offset-2 hover:underline max-w-full truncate"
            onClick={() => copyText("Site address", bookmarkUrl)}
          >
            {bookmarkUrl.replace(/^https:\/\//, "")}
          </button>
        </dd>
        <dt className="text-muted">Easy join (cloud)</dt>
        <dd className="text-right font-medium">
          {relayReady ? "Ready" : "Preview — local for now"}
        </dd>
      </dl>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          fullWidth
          onClick={onBackup}
          disabled={spaces.length === 0}
        >
          <Download className="h-4 w-4" aria-hidden />
          Back up
        </Button>
        <Button variant="secondary" fullWidth onClick={onImport}>
          <Upload className="h-4 w-4" aria-hidden />
          Restore
        </Button>
      </div>

      {!relayReady && (
        <p className="text-xs text-muted leading-relaxed rounded-lg bg-bg/60 border border-border px-3 py-2">
          {RELAY_COMING_NOTE}
        </p>
      )}

      {list.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {focusSpaceId ? "This Space" : "Per Space"}
          </p>
          <ul className="space-y-2">
            {list.map((space) => {
              const sync = normalizeSpaceSync(space.sync);
              const connected = sync.mode === "connected";
              const busy = busyId === space.id;
              const ago = lastSyncText(space);

              return (
                <li
                  key={space.id}
                  className="rounded-xl border border-border bg-bg px-3 py-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-primary truncate">
                        {space.name}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {syncLabel(space)}
                        {ago ? ` · synced ${ago}` : ""}
                        {sync.shortCode ? ` · ${sync.shortCode}` : ""}
                      </p>
                      {sync.lastError && (
                        <p className="text-xs text-danger mt-1">
                          {sync.lastError}
                        </p>
                      )}
                    </div>
                    {connected ? (
                      <Cloud
                        className="h-4 w-4 shrink-0 text-primary"
                        aria-hidden
                      />
                    ) : (
                      <CloudOff
                        className="h-4 w-4 shrink-0 text-muted"
                        aria-hidden
                      />
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {!connected && canConnectSpaceToRelay(sync) && (
                      <Button
                        variant="secondary"
                        className="!py-2 !text-xs"
                        disabled={busy || !relayReady}
                        onClick={() => {
                          if (
                            !window.confirm(
                              RELAY_CONNECT_CONSENT.replace(
                                "{name}",
                                space.name,
                              ),
                            )
                          ) {
                            return;
                          }
                          void runSpaceAction(
                            space.id,
                            () => connectSpaceToRelay(space.id),
                            "Space connected — share the short code to invite",
                          );
                        }}
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Cloud className="h-3.5 w-3.5" aria-hidden />
                        )}
                        Connect for easy invite
                      </Button>
                    )}
                    {!connected && isSpaceGuest(sync) && (
                      <p className="text-[11px] text-muted w-full leading-relaxed">
                        Joined on this phone — only the host can Connect. Use
                        Join a group with their code when they share it.
                      </p>
                    )}

                    {connected && (
                      <>
                        <Button
                          variant="secondary"
                          className="!py-2 !text-xs"
                          disabled={busy || !relayReady}
                          onClick={() =>
                            void runSpaceAction(
                              space.id,
                              () => syncSpaceNow(space.id),
                              "Space updated",
                            )
                          }
                        >
                          {busy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                          )}
                          Sync now
                        </Button>
                        <Button
                          variant="ghost"
                          className="!py-2 !text-xs"
                          disabled={busy}
                          onClick={() =>
                            void runSpaceAction(
                              space.id,
                              () =>
                                setSpaceSyncPaused(space.id, !sync.paused),
                              sync.paused ? "Sync resumed" : "Sync paused",
                            )
                          }
                        >
                          {sync.paused ? (
                            <Play className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <Pause className="h-3.5 w-3.5" aria-hidden />
                          )}
                          {sync.paused ? "Resume" : "Pause"}
                        </Button>
                        {sync.shortCode && (
                          <Button
                            variant="ghost"
                            className="!py-2 !text-xs"
                            onClick={() =>
                              copyText("Join code", sync.shortCode!)
                            }
                          >
                            <Copy className="h-3.5 w-3.5" aria-hidden />
                            Code
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          className="!py-2 !text-xs"
                          disabled={busy}
                          onClick={() => {
                            if (
                              !window.confirm(
                                "Unlink this Space from the cloud room? Everything stays on this phone.",
                              )
                            ) {
                              return;
                            }
                            void runSpaceAction(
                              space.id,
                              () =>
                                unlinkSpaceFromRelay(space.id, {
                                  deleteRemote: true,
                                }),
                              "Unlinked — still on this device",
                            );
                          }}
                        >
                          <Link2Off className="h-3.5 w-3.5" aria-hidden />
                          Unlink
                        </Button>
                      </>
                    )}
                  </div>

                  <GroupKeySection space={space} />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="border-t border-border pt-3 space-y-2">
        <button
          type="button"
          className="text-xs font-semibold uppercase tracking-wide text-muted hover:text-primary"
          onClick={() => setAdvancedOpen((v) => !v)}
          aria-expanded={advancedOpen}
        >
          {advancedOpen ? "▾" : "▸"} Advanced: offline packages &amp; steps
        </button>
        {advancedOpen && (
          <ol className="list-decimal pl-5 space-y-2 text-sm text-muted">
            {DATA_CONFIDENCE_STEPS.map((step) => (
              <li key={step.title}>
                <span className="font-medium text-primary">{step.title}</span>
                <span className="block text-xs mt-0.5">{step.detail}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}

/** Re-export name used by older imports (alias). */
export { YourDataBundle as DataBackupCard };
