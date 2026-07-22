/**
 * Per-Space Group Key — host only, immediate regenerate (no member votes).
 * Additive only — does not wipe local sessions/notes.
 */

import { useState } from "react";
import { KeyRound, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./Button";
import { KeyRevealGate } from "./KeyRevealGate";
import { useAppStore } from "../stores/useAppStore";
import { getGroupKeyMeta, getStoredGroupKey } from "../lib/keys";
import { isSpaceGuest, normalizeSpaceSync } from "../lib/sync";
import type { Space } from "../types";

interface GroupKeySectionProps {
  space: Space;
  /** Unused — kept for call-site compatibility. */
  actingMemberId?: string | null;
}

export function GroupKeySection({ space }: GroupKeySectionProps) {
  const regenerateGroupKeyNow = useAppStore((s) => s.regenerateGroupKeyNow);
  const cancelGroupKeyRotation = useAppStore((s) => s.cancelGroupKeyRotation);
  const ensureSpaceGroupKey = useAppStore((s) => s.ensureSpaceGroupKey);

  const sync = normalizeSpaceSync(space.sync);
  const guest = isSpaceGuest(sync);
  const meta = getGroupKeyMeta(space.id);
  const fingerprint =
    meta?.fingerprint ?? sync.groupKeyFingerprint ?? null;
  const stalePending = sync.groupKeyRotation?.status === "pending";

  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState<{
    secret: string;
    title: string;
    description: string;
    fingerprint?: string;
  } | null>(null);

  if (guest) {
    return (
      <div className="rounded-xl border border-border bg-bg px-3 py-3 space-y-1.5">
        <p className="text-sm font-semibold text-primary flex items-center gap-2">
          <KeyRound className="h-4 w-4 shrink-0" aria-hidden />
          Group Key
        </p>
        <p className="text-xs text-muted leading-relaxed">
          Only the host manages keys. To re-join, paste the host’s{" "}
          <strong className="text-text">room key</strong> (short code like
          ABCD-EF on their group card). Group Key (DS-GRP-…) is optional trusted
          re-link — not the usual invite.
        </p>
      </div>
    );
  }

  async function handleCreate() {
    setBusy(true);
    try {
      const result = await ensureSpaceGroupKey(space.id);
      if (result.secret) {
        setReveal({
          secret: result.secret,
          title: "Group Key",
          description:
            "Trusted re-link secret — not the everyday invite. Friends normally Join with the short room key (ABCD-EF) on this group’s card. Share Group Key only with trusted members. Regenerating also issues a new room key when the room is open.",
          fingerprint: result.meta.fingerprint,
        });
      } else {
        const existing = getStoredGroupKey(space.id);
        if (existing) {
          setReveal({
            secret: existing,
            title: "Group Key",
            description:
              "Store this securely. Only you (host) should share it with trusted people.",
            fingerprint: getGroupKeyMeta(space.id)?.fingerprint,
          });
        } else {
          toast.message("Group Key already on record", {
            description: "Fingerprint is shown below. Create was skipped.",
          });
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create key");
    } finally {
      setBusy(false);
    }
  }

  function handleView() {
    const secret = getStoredGroupKey(space.id);
    if (!secret) {
      toast.error("No Group Key stored on this device yet");
      return;
    }
    setReveal({
      secret,
      title: "Group Key",
      description:
        "Anyone with this key may re-link to this group’s trusted layer. Store securely; regenerate if compromised.",
      fingerprint: fingerprint ?? undefined,
    });
  }

  async function handleRegenerate() {
    if (
      !window.confirm(
        `Regenerate Group Key for “${space.name}”?\n\n` +
          "• Happens immediately (no member votes)\n" +
          "• Old Group Key stops working\n" +
          "• A new room key (join code) is issued if the room is open\n" +
          "• Share the new room key only with people who should stay\n" +
          "• People already linked can keep Syncing; others re-Join\n\n" +
          "Continue?",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const result = await regenerateGroupKeyNow(space.id);
      setReveal({
        secret: result.newSecret,
        title: "New Group Key",
        description:
          "Old key retired. Save this key. Share the new room key only with people who should stay in the group. Guests who lost the link re-Join with the new code, then Sync.",
        fingerprint: result.fingerprint,
      });
      const code = normalizeSpaceSync(result.space.sync).shortCode;
      toast.success("Group Key regenerated", {
        description: code
          ? `New room key: ${code}`
          : "Share the new key with trusted members only.",
        duration: 8000,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not regenerate");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-bg px-3 py-3 space-y-3">
      <div className="flex items-start gap-2">
        <KeyRound className="h-4 w-4 shrink-0 text-primary mt-0.5" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary">Group Key</p>
          <p className="text-xs text-muted mt-0.5 leading-relaxed">
            Host only — regenerate anytime (no votes). That retires the old key
            and issues a{" "}
            <strong className="text-primary">new room key</strong> when the room
            is connected. You alone add or remove people on the list.
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-1.5 text-xs">
        <dt className="text-muted">On this device</dt>
        <dd className="text-right font-medium">
          {getStoredGroupKey(space.id) ? "Key saved" : "Not stored"}
        </dd>
        <dt className="text-muted">Fingerprint</dt>
        <dd className="text-right font-mono">{fingerprint ?? "—"}</dd>
        {sync.shortCode && (
          <>
            <dt className="text-muted">Room key</dt>
            <dd className="text-right font-mono font-medium">{sync.shortCode}</dd>
          </>
        )}
      </dl>

      {stalePending && (
        <div className="rounded-lg border border-amber-300/40 bg-amber-50/50 dark:bg-amber-950/20 px-2.5 py-2 space-y-2">
          <p className="text-xs text-muted leading-relaxed">
            An old “waiting for approvals” rotation is leftover. Cancel it, or
            Regenerate now to finish with the new host-only flow.
          </p>
          <Button
            variant="ghost"
            className="!py-1.5 !text-xs"
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  await cancelGroupKeyRotation(space.id);
                  toast.success("Old rotation cleared");
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : "Could not clear",
                  );
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Clear old rotation
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {!getStoredGroupKey(space.id) ? (
          <Button
            variant="secondary"
            className="!py-2 !text-xs"
            disabled={busy}
            onClick={() => void handleCreate()}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <KeyRound className="h-3.5 w-3.5" aria-hidden />
            )}
            Create Group Key
          </Button>
        ) : (
          <Button
            variant="ghost"
            className="!py-2 !text-xs"
            disabled={busy}
            onClick={handleView}
          >
            View key
          </Button>
        )}
        <Button
          variant="secondary"
          className="!py-2 !text-xs"
          disabled={busy}
          onClick={() => void handleRegenerate()}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Regenerate now
        </Button>
      </div>

      {reveal && (
        <KeyRevealGate
          open
          title={reveal.title}
          description={reveal.description}
          keyLabel="Group Key"
          secret={reveal.secret}
          fingerprint={reveal.fingerprint}
          extraLines={[
            `Space: ${space.name}`,
            sync.shortCode ? `Room key: ${sync.shortCode}` : "",
          ].filter(Boolean)}
          onComplete={() => setReveal(null)}
        />
      )}
    </div>
  );
}
