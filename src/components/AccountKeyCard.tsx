/**
 * Settings: Account Key create / view / regenerate + private notes opt-in.
 * Never wipes IndexedDB data.
 */

import { useCallback, useEffect, useState } from "react";
import {
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
import { useAppStore } from "../stores/useAppStore";
import {
  buildPersonalBackup,
  downloadPersonalBackup,
} from "../lib/keys/personalBackup";
import { db } from "../lib/db";

export function AccountKeyCard() {
  const spaces = useAppStore((s) => s.spaces);
  const [meta, setMeta] = useState<AccountKeyMeta | null>(null);
  const [prefs, setPrefs] = useState(getAccountKeyPrefs());
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

  async function handleCreate() {
    setBusy(true);
    try {
      const { secret, meta: m } = await createAndStoreAccountKey();
      setMeta(m);
      setReveal({
        secret,
        title: "Your Account Key",
        description:
          "This links your data across phone and desktop without email or password. Save it now — we cannot reset it for you.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create key");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerate() {
    if (
      !window.confirm(
        "Regenerate Account Key?\n\nThe old key will stop working on every device. Spaces and private notes on this phone stay put — but other devices must enter the new key or restore a new personal backup.\n\nContinue?",
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
          "Your previous Account Key no longer works. Save this new key securely. Local Spaces and notes on this device were not deleted.",
      });
      toast.success("Account Key regenerated");
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
      setLinkInput("");
      toast.success("Account Key linked on this device");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not link key");
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
      const payload = await buildPersonalBackup({
        spaces,
        sessionsBySpace,
        prayerBySpace,
        privateNotes: notes,
      });
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
              Optional. Link phone and desktop without email or password. You can
              always use DiscipleSpaces without a key.
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
          </dl>
        ) : (
          <p className="text-sm text-muted rounded-lg border border-border bg-bg/60 px-3 py-2">
            No Account Key yet. Create one to encrypt personal backups (optional
            private notes) and restore on another device.
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
              <Button
                variant="secondary"
                fullWidth
                disabled={busy || spaces.length === 0}
                onClick={() => void handlePersonalBackup()}
              >
                <Shield className="h-4 w-4" aria-hidden />
                Download personal backup
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
            Spaces already on this phone.
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
            Link this device
          </Button>
        </div>
      </Modal>
    </>
  );
}
