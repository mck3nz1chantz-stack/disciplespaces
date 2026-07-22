/**
 * Settings: Account Key create / view / regenerate + private notes opt-in.
 * Linking a key now also tries to restore Spaces from the encrypted cloud vault.
 * Never wipes IndexedDB data.
 */

import { useCallback, useEffect, useState } from "react";
import {
  CloudUpload,
  KeyRound,
  Link2,
  Loader2,
  RefreshCw,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "./Card";
import { Button } from "./Button";
import { KeyRevealGate } from "./KeyRevealGate";
import { Modal } from "./Modal";
import {
  createAndStoreAccountKey,
  getAccountKeyMeta,
  getAccountKeyPrefs,
  getStoredAccountKey,
  hasAccountKey,
  linkAccountKey,
  regenerateAccountKey,
  setAccountKeyPrefs,
  type AccountKeyMeta,
} from "../lib/keys";
import {
  downloadAccountVault,
  peekAccountVault,
  uploadAccountVault,
  type VaultMeta,
} from "../lib/keys/accountVault";
import { setVaultSyncedAt } from "../lib/keys/vaultAuto";
import {
  buildPersonalBackup,
  decryptPersonalNotes,
  downloadPersonalBackup,
} from "../lib/keys/personalBackup";
import { useAppStore } from "../stores/useAppStore";
import { db } from "../lib/db";
import { isSpaceRelayConfigured } from "../lib/sync";

async function gatherBackupInput() {
  const spaces = useAppStore.getState().spaces;
  const sessions = await db.sessions.toArray();
  const prayers = await db.prayerBoard.toArray();
  const notes = await db.privateNotes.toArray();
  const sessionsBySpace = new Map<string, typeof sessions>();
  const prayerBySpace = new Map<string, typeof prayers>();
  for (const s of sessions) {
    const list = sessionsBySpace.get(s.spaceId) ?? [];
    list.push(s);
    sessionsBySpace.set(s.spaceId, list);
  }
  for (const p of prayers) {
    const list = prayerBySpace.get(p.spaceId) ?? [];
    list.push(p);
    prayerBySpace.set(p.spaceId, list);
  }
  return { spaces, sessionsBySpace, prayerBySpace, privateNotes: notes };
}

async function restorePersonalPayload(
  personal: Awaited<ReturnType<typeof downloadAccountVault>>,
): Promise<{ spaces: number; sessions: number; notes: number }> {
  if (!personal) return { spaces: 0, sessions: 0, notes: 0 };
  const importSpaceExport = useAppStore.getState().importSpaceExport;
  let sessionTotal = 0;
  for (const pack of personal.spaces) {
    // LWW replace-shared so Account Key vault is true personal home
    const result = await importSpaceExport(pack, {
      mergeStrategy: "replace-shared",
    });
    sessionTotal += result.addedSessions;
  }
  let notesRestored = 0;
  if (personal.privateNotesIncluded && personal.privateNotesEnc) {
    const key = getStoredAccountKey();
    if (key) {
      const notes = await decryptPersonalNotes(personal, key);
      for (const n of notes) {
        const exists = await db.privateNotes.get(n.id);
        if (!exists) {
          await db.privateNotes.put(n);
          notesRestored += 1;
        }
      }
    }
  }
  await useAppStore.getState().loadSpaces();
  return {
    spaces: personal.spaces.length,
    sessions: sessionTotal,
    notes: notesRestored,
  };
}

export function AccountKeyCard() {
  const spaces = useAppStore((s) => s.spaces);
  const [meta, setMeta] = useState<AccountKeyMeta | null>(null);
  const [prefs, setPrefs] = useState(getAccountKeyPrefs());
  const [vaultMeta, setVaultMeta] = useState<VaultMeta | null>(null);
  const [reveal, setReveal] = useState<{
    secret: string;
    title: string;
    description: string;
  } | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    setMeta(getAccountKeyMeta());
    setPrefs(getAccountKeyPrefs());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!hasAccountKey() || !isSpaceRelayConfigured()) {
      setVaultMeta(null);
      return;
    }
    let cancelled = false;
    void peekAccountVault().then((m) => {
      if (!cancelled) setVaultMeta(m);
    });
    return () => {
      cancelled = true;
    };
  }, [meta?.keyId, spaces.length]);

  async function handleCreate() {
    setBusy(true);
    try {
      const { secret, meta: m } = await createAndStoreAccountKey();
      setMeta(m);
      setReveal({
        secret,
        title: "Your Account Key",
        description:
          "This is the home for your Spaces. Save it now — we cannot reset it for you. When Online, DiscipleSpaces encrypts and stores your groups under this key so another phone can restore them. Group room keys are only for inviting people — not your personal backup.",
      });
      // Seed empty vault so link on another device knows the key is real
      if (isSpaceRelayConfigured()) {
        try {
          const input = await gatherBackupInput();
          const vm = await uploadAccountVault(input);
          setVaultSyncedAt(vm.updatedAt);
          setVaultMeta(vm);
        } catch {
          // optional on create
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create key");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerate() {
    if (
      !window.confirm(
        "Regenerate Account Key?\n\nThe old key will stop working on every device. Spaces and private notes on this phone stay put — but other devices must enter the new key, and you should Upload my Spaces again.\n\nContinue?",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const { secret, meta: m } = await regenerateAccountKey();
      setMeta(m);
      setReveal({
        secret,
        title: "New Account Key",
        description:
          "Your previous Account Key no longer works. Save this new key securely. Local Spaces and notes on this device were not deleted. Upload my Spaces so the new key can restore them elsewhere.",
      });
      toast.success("Account Key regenerated");
      if (isSpaceRelayConfigured()) {
        try {
          const input = await gatherBackupInput();
          const vm = await uploadAccountVault(input);
          setVaultSyncedAt(vm.updatedAt);
          setVaultMeta(vm);
        } catch {
          // optional
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not regenerate");
    } finally {
      setBusy(false);
    }
  }

  function handleView() {
    const secret = getStoredAccountKey();
    const m = getAccountKeyMeta();
    if (!secret || !m) {
      toast.error("No Account Key on this device");
      return;
    }
    setReveal({
      secret,
      title: "Your Account Key",
      description:
        "Anyone with this key can restore your personal backup on another device. Store it securely.",
    });
  }

  async function handleLink() {
    setBusy(true);
    try {
      const m = await linkAccountKey(linkInput);
      setMeta(m);
      setLinkOpen(false);
      const keyText = linkInput;
      setLinkInput("");

      // Pull encrypted Spaces from cloud vault (if this key ever uploaded)
      let restored: { spaces: number; sessions: number; notes: number } | null =
        null;
      if (isSpaceRelayConfigured()) {
        try {
          const personal = await downloadAccountVault(keyText);
          if (personal && personal.spaces.length > 0) {
            restored = await restorePersonalPayload(personal);
          }
          setVaultMeta(await peekAccountVault());
        } catch (err) {
          toast.message("Account Key linked", {
            description:
              err instanceof Error
                ? err.message
                : "Could not reach cloud backup — try Upload on your other device, or restore a DSP1. file.",
            duration: 9000,
          });
          setBusy(false);
          return;
        }
      }

      if (restored && restored.spaces > 0) {
        toast.success(
          `Account linked · restored ${restored.spaces} space${restored.spaces === 1 ? "" : "s"}`,
          {
            description: [
              restored.sessions > 0
                ? `${restored.sessions} new session${restored.sessions === 1 ? "" : "s"}`
                : "spaces already matched local data",
              restored.notes > 0
                ? `${restored.notes} private note${restored.notes === 1 ? "" : "s"}`
                : null,
            ]
              .filter(Boolean)
              .join(" · "),
            duration: 10000,
          },
        );
      } else {
        toast.success("Account Key linked on this device", {
          description: isSpaceRelayConfigured()
            ? "No Spaces under this key yet. On your other device open Settings → Account Key → Save Spaces to my key (or wait for auto-save Online), then link again — or restore a personal backup file (DSP1.)."
            : "Use a personal backup file (DSP1.) to move Spaces between devices on this build.",
          duration: 10000,
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not link key");
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadVault() {
    if (!hasAccountKey()) {
      toast.error("Create or link an Account Key first");
      return;
    }
    if (!isSpaceRelayConfigured()) {
      toast.message("Cloud backup not on this build", {
        description: "Use Download personal backup (file) instead.",
      });
      return;
    }
    setBusy(true);
    try {
      const input = await gatherBackupInput();
      if (input.spaces.length === 0) {
        toast.message("No Spaces to upload yet", {
          description: "Create a group first, then upload.",
        });
        return;
      }
      const vm = await uploadAccountVault(input);
      setVaultSyncedAt(vm.updatedAt);
      setVaultMeta(vm);
      toast.success(
        `Saved ${vm.spaceCount} space${vm.spaceCount === 1 ? "" : "s"} under your Account Key`,
        {
          description:
            "On another device: Settings → Account Key → I already have a key → paste the same key to restore. Auto-save also runs when Online.",
          duration: 9000,
        },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRestoreVault() {
    if (!hasAccountKey()) {
      toast.error("Link your Account Key first");
      return;
    }
    if (!isSpaceRelayConfigured()) {
      toast.message("Cloud restore not on this build");
      return;
    }
    setBusy(true);
    try {
      const personal = await downloadAccountVault();
      if (!personal || personal.spaces.length === 0) {
        toast.message("No cloud backup for this key yet", {
          description:
            "On your other device: Account Key → Save Spaces to my key. Or restore a DSP1. file under Your Spaces & data.",
          duration: 8000,
        });
        return;
      }
      const restored = await restorePersonalPayload(personal);
      const vm = await peekAccountVault();
      if (vm?.updatedAt) setVaultSyncedAt(vm.updatedAt);
      setVaultMeta(vm);
      toast.success(
        `Restored ${restored.spaces} space${restored.spaces === 1 ? "" : "s"} from your Account Key`,
        {
          description:
            restored.sessions > 0
              ? `${restored.sessions} session${restored.sessions === 1 ? "" : "s"} merged`
              : "Spaces updated from your key’s cloud vault",
        },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setBusy(false);
    }
  }

  function toggleNotesPref(checked: boolean) {
    if (checked && !hasAccountKey()) {
      toast.error("Create or link an Account Key first");
      return;
    }
    const next = setAccountKeyPrefs({
      includePrivateNotesInPersonalBackup: checked,
    });
    setPrefs(next);
    toast.success(
      checked
        ? "Personal backups can include encrypted private notes"
        : "Private notes stay device-only in backups",
    );
  }

  async function handlePersonalBackup() {
    setBusy(true);
    try {
      const input = await gatherBackupInput();
      const payload = await buildPersonalBackup(input);
      downloadPersonalBackup(payload);
      toast.success(
        payload.privateNotesIncluded
          ? "Personal backup downloaded (notes encrypted)"
          : "Personal backup downloaded (notes not included)",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Backup failed");
    } finally {
      setBusy(false);
    }
  }

  const linked = meta != null && hasAccountKey();
  const cloudOk = isSpaceRelayConfigured();

  return (
    <>
      <Card className="space-y-3 border-primary/20">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-primary">
              Account Key
            </h3>
            <p className="text-sm text-muted mt-0.5 leading-relaxed">
              <strong className="text-primary font-medium">
                Your Spaces live under this key
              </strong>{" "}
              (encrypted cloud backup when Online). Link phone and desktop
              without email or password. A group room key only shares meetings
              with people you invite — it is not your personal backup.
            </p>
          </div>
        </div>

        {linked && meta ? (
          <dl className="grid grid-cols-2 gap-2 text-sm rounded-xl border border-border bg-bg/80 px-3 py-2.5">
            <dt className="text-muted">Status</dt>
            <dd className="text-right font-medium text-primary">On this device</dd>
            <dt className="text-muted">Fingerprint</dt>
            <dd className="text-right font-mono text-xs">{meta.fingerprint}</dd>
            <dt className="text-muted">Created</dt>
            <dd className="text-right text-xs">
              {meta.createdAt.slice(0, 10)}
            </dd>
            {cloudOk && (
              <>
                <dt className="text-muted">Cloud Spaces</dt>
                <dd className="text-right text-xs">
                  {vaultMeta
                    ? `${vaultMeta.spaceCount} · ${vaultMeta.updatedAt.slice(0, 10)}`
                    : "Not uploaded yet"}
                </dd>
              </>
            )}
          </dl>
        ) : (
          <p className="text-sm text-muted rounded-lg border border-border bg-bg/60 px-3 py-2">
            No Account Key yet. Create one so your Spaces have a personal home.
            The app will upload an encrypted copy when Online; another device
            restores by pasting the same key.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {!linked ? (
            <>
              <Button fullWidth disabled={busy} onClick={() => void handleCreate()}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" aria-hidden />
                )}
                Create Account Key
              </Button>
              <Button
                variant="secondary"
                fullWidth
                disabled={busy}
                onClick={() => setLinkOpen(true)}
              >
                <Link2 className="h-4 w-4" aria-hidden />
                I already have a key
              </Button>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  fullWidth
                  disabled={busy}
                  onClick={handleView}
                >
                  View key
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  disabled={busy}
                  onClick={() => void handleRegenerate()}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden />
                  Regenerate
                </Button>
              </div>
              {cloudOk && (
                <>
                  <Button
                    fullWidth
                    disabled={busy || spaces.length === 0}
                    onClick={() => void handleUploadVault()}
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <CloudUpload className="h-4 w-4" aria-hidden />
                    )}
                    Save Spaces to my key
                  </Button>
                  <Button
                    variant="secondary"
                    fullWidth
                    disabled={busy}
                    onClick={() => void handleRestoreVault()}
                  >
                    Restore Spaces from my key
                  </Button>
                </>
              )}
              <Button
                variant="secondary"
                fullWidth
                disabled={busy || spaces.length === 0}
                onClick={() => void handlePersonalBackup()}
              >
                <Shield className="h-4 w-4" aria-hidden />
                Download personal backup (file)
              </Button>
            </>
          )}
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer pt-1 border-t border-border">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-border"
            checked={prefs.includePrivateNotesInPersonalBackup}
            onChange={(e) => toggleNotesPref(e.target.checked)}
          />
          <span className="text-sm text-muted leading-snug">
            <span className="font-medium text-primary">
              Include private notes in personal backups
            </span>
            {" — "}
            encrypted with your Account Key. Never sent plain to the group room.
            Default is off (notes stay on this device only).
          </span>
        </label>
      </Card>

      {reveal && (
        <KeyRevealGate
          open
          title={reveal.title}
          description={reveal.description}
          keyLabel="Account Key"
          secret={reveal.secret}
          fingerprint={meta?.fingerprint}
          onComplete={() => {
            setReveal(null);
            refresh();
          }}
        />
      )}

      <Modal
        open={linkOpen}
        title="Link Account Key"
        onClose={() => setLinkOpen(false)}
      >
        <div className="space-y-3 p-1">
          <p className="text-sm text-muted">
            Paste the Account Key from your other device. This does not delete
            Spaces already on this phone. If that device uploaded Spaces, they
            restore automatically when Online.
          </p>
          <textarea
            className="w-full min-h-[88px] rounded-xl border border-border bg-bg px-3 py-2 text-sm font-mono"
            placeholder="DS-ACC-...."
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <Button
            fullWidth
            disabled={busy || !linkInput.trim()}
            onClick={() => void handleLink()}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Link2 className="h-4 w-4" aria-hidden />
            )}
            Link & restore Spaces
          </Button>
        </div>
      </Modal>
    </>
  );
}
