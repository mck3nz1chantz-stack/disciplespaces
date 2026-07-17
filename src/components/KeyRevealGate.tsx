/**
 * Shared save gate for Account Key / Group Key reveal.
 * Requires user-initiated download + acknowledgements before Done.
 */

import { useState } from "react";
import { Check, Copy, Download, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { downloadKeyCard } from "../lib/keys";

export interface KeyRevealGateProps {
  open: boolean;
  title: string;
  description: string;
  keyLabel: string;
  secret: string;
  fingerprint?: string;
  extraLines?: string[];
  /** Called only after gate completed — parent may close and clear secret from UI. */
  onComplete: () => void;
  /** If false, Escape / backdrop cannot dismiss until complete. */
  allowCancel?: boolean;
  onCancel?: () => void;
}

export function KeyRevealGate({
  open,
  title,
  description,
  keyLabel,
  secret,
  fingerprint,
  extraLines,
  onComplete,
  allowCancel = false,
  onCancel,
}: KeyRevealGateProps) {
  const [ackCannotRecover, setAckCannotRecover] = useState(false);
  const [ackStored, setAckStored] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const canFinish = ackCannotRecover && ackStored && downloaded;

  function reset() {
    setAckCannotRecover(false);
    setAckStored(false);
    setDownloaded(false);
  }

  function handleDownload() {
    downloadKeyCard({
      title: keyLabel,
      key: secret,
      fingerprint,
      extraLines,
    });
    setDownloaded(true);
    toast.success("Key file download started — keep it somewhere safe");
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(secret);
      toast.success("Key copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  function handleDone() {
    if (!canFinish) return;
    reset();
    onComplete();
  }

  function handleClose() {
    if (allowCancel && onCancel) {
      reset();
      onCancel();
    }
  }

  return (
    <Modal
      open={open}
      title={title}
      onClose={handleClose}
      dismissible={allowCancel}
      containBody
    >
      <div className="space-y-4 p-1">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <KeyRound className="h-5 w-5" aria-hidden />
          </div>
          <p className="text-sm text-muted leading-relaxed">{description}</p>
        </div>

        <div className="rounded-xl border border-border bg-bg px-3 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {keyLabel}
          </p>
          <p className="font-mono text-sm break-all text-primary select-all leading-relaxed">
            {secret}
          </p>
          {fingerprint && (
            <p className="text-xs text-muted">
              Fingerprint:{" "}
              <span className="font-mono font-medium text-primary">
                {fingerprint}
              </span>
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="secondary" className="!py-2" onClick={() => void handleCopy()}>
              <Copy className="h-4 w-4" aria-hidden />
              Copy
            </Button>
            <Button variant="secondary" className="!py-2" onClick={handleDownload}>
              <Download className="h-4 w-4" aria-hidden />
              Download key file
              {downloaded ? <Check className="h-4 w-4 text-green-600" /> : null}
            </Button>
          </div>
        </div>

        <ul className="space-y-2 text-sm">
          <li>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border"
                checked={ackCannotRecover}
                onChange={(e) => setAckCannotRecover(e.target.checked)}
              />
              <span className="text-muted leading-snug">
                I understand DiscipleSpaces{" "}
                <strong className="text-primary">cannot recover this key</strong>{" "}
                for me. If I lose it, I use my backup file or re-join the group.
              </span>
            </label>
          </li>
          <li>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border"
                checked={ackStored}
                onChange={(e) => setAckStored(e.target.checked)}
              />
              <span className="text-muted leading-snug">
                I will store this securely (write it down, save the file/QR, or
                password manager) — not in a group chat.
              </span>
            </label>
          </li>
          <li>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border"
                checked={downloaded}
                onChange={(e) => setDownloaded(e.target.checked)}
              />
              <span className="text-muted leading-snug">
                I downloaded the key file (or already copied it to a safe place).
              </span>
            </label>
          </li>
        </ul>

        <p className="text-xs text-muted leading-relaxed rounded-lg border border-border bg-bg/60 px-3 py-2">
          Tip: also use <strong className="text-primary">Back up</strong> under
          Your Spaces &amp; data. Hard files are the safety net if a key is lost.
        </p>

        <Button fullWidth disabled={!canFinish} onClick={handleDone}>
          Done — I saved my key
        </Button>
      </div>
    </Modal>
  );
}
