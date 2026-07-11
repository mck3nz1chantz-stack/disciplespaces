import { useEffect, useState } from "react";
import { Check, Copy, QrCode, Share2 } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { useAppStore } from "../stores/useAppStore";
import {
  encodeInvitePackage,
  formatInviteShareText,
  type SpaceInvitePayload,
} from "../lib/invite";
import {
  INVITE_HISTORY_NOTE,
  INVITE_PRIVACY_NOTE,
} from "../lib/legal";

interface InviteModalProps {
  open: boolean;
  spaceId: string | null;
  onClose: () => void;
}

export function InviteModal({ open, spaceId, onClose }: InviteModalProps) {
  const createInvitePayload = useAppStore((s) => s.createInvitePayload);
  const [payload, setPayload] = useState<SpaceInvitePayload | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<"code" | "package" | null>(null);

  useEffect(() => {
    if (!open || !spaceId) {
      setPayload(null);
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const p = await createInvitePayload(spaceId);
        if (cancelled) return;
        setPayload(p);
        const pack = encodeInvitePackage(p);
        const url = await QRCode.toDataURL(pack, {
          width: 280,
          margin: 2,
          color: { dark: "#1e3a2f", light: "#ffffff" },
          errorCorrectionLevel: "M",
        });
        if (!cancelled) setQrDataUrl(url);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not create invite",
        );
        onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, spaceId, createInvitePayload, onClose]);

  async function copyText(text: string, kind: "code" | "package") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      toast.success(kind === "code" ? "Code copied" : "Invite package copied");
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Could not copy — select and copy manually");
    }
  }

  async function shareNative() {
    if (!payload) return;
    const text = formatInviteShareText(payload);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${payload.name} on DiscipleSpaces`,
          text,
        });
        return;
      } catch {
        // user cancelled or share failed — fall through to copy
      }
    }
    await copyText(text, "package");
  }

  return (
    <Modal open={open} title="Invite to Space" onClose={onClose}>
      <div className="space-y-4">
        {loading && (
          <p className="text-sm text-muted">Preparing invite…</p>
        )}

        {payload && (
          <>
            <p className="text-sm text-muted -mt-1">
              Share this invite with people you trust. They join{" "}
              <strong className="text-text">{payload.name}</strong> on their
              own device.
            </p>

            <div className="rounded-xl border border-border bg-bg px-4 py-4 text-center space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Invite code
              </p>
              <p className="text-2xl font-semibold tracking-widest text-primary tabular-nums">
                {payload.code}
              </p>
              <Button
                variant="secondary"
                className="!py-2 mt-2"
                onClick={() => void copyText(payload.code, "code")}
              >
                {copied === "code" ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden />
                )}
                Copy code
              </Button>
            </div>

            {qrDataUrl && (
              <div className="flex flex-col items-center gap-2">
                <div className="rounded-2xl border border-border bg-surface p-3 shadow-sm">
                  <img
                    src={qrDataUrl}
                    alt={`QR invite for ${payload.name}`}
                    className="w-[200px] h-[200px]"
                    width={200}
                    height={200}
                  />
                </div>
                <p className="text-xs text-muted inline-flex items-center gap-1">
                  <QrCode className="h-3.5 w-3.5" aria-hidden />
                  Scan with DiscipleSpaces → Join a Space
                </p>
              </div>
            )}

            <div className="rounded-xl bg-surface-muted/60 border border-border px-3 py-3 space-y-2 text-sm text-muted">
              <p className="font-medium text-text text-sm">What they get</p>
              <p>{INVITE_HISTORY_NOTE}</p>
              <p className="text-xs">{INVITE_PRIVACY_NOTE}</p>
            </div>

            <div className="flex flex-col gap-2">
              <Button fullWidth onClick={() => void shareNative()}>
                <Share2 className="h-5 w-5" aria-hidden />
                Share invite
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={() =>
                  void copyText(formatInviteShareText(payload), "package")
                }
              >
                {copied === "package" ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden />
                )}
                Copy full package
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
