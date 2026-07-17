/**
 * Per-Space Group Key + unanimous regenerate (all members).
 * Additive only — does not wipe local sessions/notes.
 */

import { useMemo, useState } from "react";
import {
  KeyRound,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "./Button";
import { KeyRevealGate } from "./KeyRevealGate";
import { useAppStore } from "../stores/useAppStore";
import {
  getGroupKeyMeta,
  getPendingGroupKeySecret,
  getStoredGroupKey,
} from "../lib/keys";
import { normalizeSpaceSync } from "../lib/sync";
import type { Space } from "../types";

interface GroupKeySectionProps {
  space: Space;
  /** Prefer a known member when proposing / approving. */
  actingMemberId?: string | null;
}

export function GroupKeySection({
  space,
  actingMemberId = null,
}: GroupKeySectionProps) {
  const proposeGroupKeyRotation = useAppStore((s) => s.proposeGroupKeyRotation);
  const approveGroupKeyRotation = useAppStore((s) => s.approveGroupKeyRotation);
  const cancelGroupKeyRotation = useAppStore((s) => s.cancelGroupKeyRotation);
  const finalizeGroupKeyRotation = useAppStore((s) => s.finalizeGroupKeyRotation);
  const ensureSpaceGroupKey = useAppStore((s) => s.ensureSpaceGroupKey);

  const sync = normalizeSpaceSync(space.sync);
  const meta = getGroupKeyMeta(space.id);
  const fingerprint =
    meta?.fingerprint ?? sync.groupKeyFingerprint ?? null;
  const rotation = sync.groupKeyRotation;
  const pending = rotation?.status === "pending" ? rotation : null;

  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState<{
    secret: string;
    title: string;
    description: string;
    fingerprint?: string;
  } | null>(null);

  const defaultMember = useMemo(() => {
    if (actingMemberId) {
      const m = space.members.find((x) => x.id === actingMemberId);
      if (m) return m;
    }
    return space.members[0] ?? null;
  }, [space.members, actingMemberId]);

  const approvedIds = new Set(pending?.approvals.map((a) => a.memberId) ?? []);
  const remaining =
    pending?.requiredMemberIds.filter((id) => !approvedIds.has(id)) ?? [];

  async function run(action: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await action();
      toast.success(ok);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
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
            "This is your group’s trusted key. Share only with current members. Short join codes are still for inviting people; regenerate this key when someone leaves or it may have leaked.",
          fingerprint: result.meta.fingerprint,
        });
      } else {
        const existing = getStoredGroupKey(space.id);
        if (existing) {
          setReveal({
            secret: existing,
            title: "Group Key",
            description:
              "Store this securely. Only current members should have it.",
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

  async function handlePropose() {
    if (!defaultMember) {
      toast.error("Add at least one member before managing a Group Key");
      return;
    }
    if (
      !window.confirm(
        `Regenerate Group Key for “${space.name}”?\n\nEvery member must approve. When complete, a new join code is issued and the old Group Key stops working.\n\nContinue?`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const result = await proposeGroupKeyRotation(space.id, {
        memberId: defaultMember.id,
        memberName: defaultMember.name,
      });
      if (result.completed && result.newSecret) {
        setReveal({
          secret: result.newSecret,
          title: "New Group Key",
          description:
            "All members approved (or you were the only member). Old key and join code are retired. Save this new key and share the new join code with trusted members only.",
          fingerprint: result.fingerprint,
        });
        toast.success("Group Key rotated");
      } else {
        toast.success("Rotation proposed — waiting for all members");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not propose");
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove(memberId: string, name: string, onBehalf: boolean) {
    setBusy(true);
    try {
      const result = await approveGroupKeyRotation(space.id, {
        memberId,
        memberName: name,
        onBehalf,
      });
      if (result.completed && result.newSecret) {
        setReveal({
          secret: result.newSecret,
          title: "New Group Key",
          description:
            "Everyone approved. Save this key. A new short join code is active — share it only with people who should stay in the group.",
          fingerprint: result.fingerprint,
        });
        toast.success("Group Key rotated — all members approved");
      } else {
        toast.success(`Recorded approval for ${name}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not approve");
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
            Trusted members only. Any member may propose regenerate;{" "}
            <strong className="text-primary">all members</strong> must approve.
            On complete, a <strong className="text-primary">new join code</strong>{" "}
            is issued.
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-1.5 text-xs">
        <dt className="text-muted">On this device</dt>
        <dd className="text-right font-medium">
          {getStoredGroupKey(space.id) ? "Key saved" : "Not stored"}
        </dd>
        <dt className="text-muted">Fingerprint</dt>
        <dd className="text-right font-mono">
          {fingerprint ?? "—"}
        </dd>
        {sync.shortCode && (
          <>
            <dt className="text-muted">Join code</dt>
            <dd className="text-right font-mono font-medium">{sync.shortCode}</dd>
          </>
        )}
      </dl>

      {!pending && (
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
            disabled={busy || space.members.length === 0}
            onClick={() => void handlePropose()}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Regenerate…
          </Button>
        </div>
      )}

      {pending && (
        <div className="space-y-2 rounded-lg border border-amber-300/40 bg-amber-50/50 dark:bg-amber-950/20 px-2.5 py-2">
          <p className="text-xs font-medium text-primary flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" aria-hidden />
            Waiting for all members ({pending.approvals.length}/
            {pending.requiredMemberIds.length})
          </p>
          <p className="text-[11px] text-muted leading-relaxed">
            Proposed by {pending.proposedByName}. New key fingerprint{" "}
            <span className="font-mono">{pending.proposedFingerprint}</span>
          </p>
          <ul className="space-y-1.5">
            {space.members.map((m) => {
              const done = approvedIds.has(m.id);
              return (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className={done ? "text-muted line-through" : "text-primary"}>
                    {m.name}
                    {done ? " · approved" : ""}
                  </span>
                  {!done && (
                    <Button
                      variant="ghost"
                      className="!py-1 !px-2 !text-[11px]"
                      disabled={busy}
                      onClick={() => {
                        const onBehalf = defaultMember?.id !== m.id;
                        if (onBehalf) {
                          if (
                            !window.confirm(
                              `Mark approval for ${m.name}?\n\nOnly do this if you confirmed with them in person. Misuse weakens group safety.`,
                            )
                          ) {
                            return;
                          }
                        }
                        void handleApprove(m.id, m.name, onBehalf);
                      }}
                    >
                      Approve
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          {remaining.length === 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted leading-relaxed">
                All members approved. The device that tapped{" "}
                <strong className="text-primary">Regenerate</strong> should
                finish to reveal the new Group Key and join code.
              </p>
              {getPendingGroupKeySecret(space.id) && (
                <Button
                  variant="secondary"
                  className="!py-2 !text-xs"
                  disabled={busy}
                  onClick={() => {
                    void (async () => {
                      setBusy(true);
                      try {
                        const result = await finalizeGroupKeyRotation(space.id);
                        if (result.completed && result.newSecret) {
                          setReveal({
                            secret: result.newSecret,
                            title: "New Group Key",
                            description:
                              "Rotation complete. Save this key and share the new join code only with trusted members.",
                            fingerprint: result.fingerprint,
                          });
                          toast.success("Group Key rotated");
                        }
                      } catch (err) {
                        toast.error(
                          err instanceof Error
                            ? err.message
                            : "Could not finish rotation",
                        );
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  Finish rotation on this device
                </Button>
              )}
            </div>
          )}
          <Button
            variant="ghost"
            className="!py-1.5 !text-xs"
            disabled={busy}
            onClick={() =>
              void run(
                () => cancelGroupKeyRotation(space.id),
                "Rotation cancelled",
              )
            }
          >
            Cancel rotation
          </Button>
        </div>
      )}

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
            sync.shortCode ? `Join code: ${sync.shortCode}` : "",
          ].filter(Boolean)}
          onComplete={() => setReveal(null)}
        />
      )}
    </div>
  );
}
