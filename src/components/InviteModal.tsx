import { useEffect, useState } from "react";
import { Check, Copy, Download, QrCode, Share2 } from "lucide-react";
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
  downloadTextFile,
  exportFilename,
  formatExportShareText,
  type SpaceExportPayload,
} from "../lib/share";
import {
  INVITE_HISTORY_NOTE,
  INVITE_PRIVACY_NOTE,
  INVITE_SYNC_NOTE,
} from "../lib/legal";

interface InviteModalProps {
  open: boolean;
  spaceId: string | null;
  onClose: () => void;
}

export function InviteModal({ open, spaceId, onClose }: InviteModalProps) {
  const createInvitePayload = useAppStore((s) => s.createInvitePayload);
  const buildSpaceExportPayload = useAppStore((s) => s.buildSpaceExportPayload);
  const addMember = useAppStore((s) => s.addMember);
  const getSpace = useAppStore((s) => s.getSpace);

  const [payload, setPayload] = useState<SpaceInvitePayload | null>(null);
  const [exportPayload, setExportPayload] = useState<SpaceExportPayload | null>(
    null,
  );
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<"code" | "package" | null>(null);
  const [inviteeName, setInviteeName] = useState("");
  const [inviteeSaved, setInviteeSaved] = useState(false);
  const [includeHistory, setIncludeHistory] = useState(false);
  const [savingInvitee, setSavingInvitee] = useState(false);

  useEffect(() => {
    if (!open || !spaceId) {
      setPayload(null);
      setExportPayload(null);
      setQrDataUrl(null);
      setInviteeName("");
      setInviteeSaved(false);
      setIncludeHistory(false);
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

  useEffect(() => {
    if (!open || !spaceId || !includeHistory) {
      setExportPayload(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const exp = await buildSpaceExportPayload(spaceId);
        if (!cancelled) setExportPayload(exp);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not prepare history package",
        );
        if (!cancelled) setIncludeHistory(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, spaceId, includeHistory, buildSpaceExportPayload]);

  async function ensureInviteeOnHost() {
    if (!spaceId || !inviteeName.trim() || inviteeSaved) return;
    setSavingInvitee(true);
    try {
      const space = await getSpace(spaceId);
      const name = inviteeName.trim();
      const already = space?.members.some(
        (m) => m.name.toLowerCase() === name.toLowerCase(),
      );
      if (!already) {
        await addMember(spaceId, name);
      }
      // Refresh invite snapshot so package includes the new member
      const p = await createInvitePayload(spaceId);
      setPayload(p);
      const pack = encodeInvitePackage(p);
      const url = await QRCode.toDataURL(pack, {
        width: 280,
        margin: 2,
        color: { dark: "#1e3a2f", light: "#ffffff" },
        errorCorrectionLevel: "M",
      });
      setQrDataUrl(url);
      setInviteeSaved(true);
      toast.success(`${name} added to your member list`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add member");
    } finally {
      setSavingInvitee(false);
    }
  }

  async function copyText(text: string, kind: "code" | "package") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      toast.success(kind === "code" ? "Code copied" : "Invite copied");
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Could not copy — select and copy manually");
    }
  }

  function shareBody(): string | null {
    if (includeHistory && exportPayload) {
      return formatExportShareText(exportPayload);
    }
    if (payload) return formatInviteShareText(payload);
    return null;
  }

  async function shareNative() {
    if (inviteeName.trim() && !inviteeSaved) {
      await ensureInviteeOnHost();
    }
    const text = shareBody();
    if (!text || !payload) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: includeHistory
            ? `Join ${payload.name} (with history) — DiscipleSpaces`
            : `Join ${payload.name} on DiscipleSpaces`,
          text,
        });
        return;
      } catch {
        // user cancelled or share failed — fall through to copy
      }
    }
    await copyText(text, "package");
  }

  function downloadInvite() {
    const text = shareBody();
    if (!text || !payload) return;
    const name = includeHistory
      ? exportFilename(payload.name)
      : `disciple-spaces-invite-${payload.code}.txt`;
    downloadTextFile(name, text);
    toast.success("Download started — attach this file in Messages if text truncates");
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

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">
                Who are you inviting?{" "}
                <span className="text-muted font-normal">(recommended)</span>
              </span>
              <div className="flex gap-2">
                <input
                  value={inviteeName}
                  onChange={(e) => {
                    setInviteeName(e.target.value);
                    setInviteeSaved(false);
                  }}
                  className="flex-1 rounded-xl border border-border bg-bg px-3 py-3 text-base min-w-0"
                  placeholder="e.g. Anastasia"
                  maxLength={60}
                  disabled={savingInvitee}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0"
                  disabled={!inviteeName.trim() || inviteeSaved || savingInvitee}
                  onClick={() => void ensureInviteeOnHost()}
                >
                  {inviteeSaved ? "Added" : savingInvitee ? "…" : "Add"}
                </Button>
              </div>
              <p className="text-xs text-muted">
                Adds them on <em>this</em> phone so Attendees shows 2/5 right
                away. They still need the invite package or QR on their phone.
              </p>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-border bg-bg px-3 py-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-primary"
                checked={includeHistory}
                onChange={(e) => setIncludeHistory(e.target.checked)}
              />
              <span className="text-sm">
                <span className="font-medium text-text">Share with history</span>
                <span className="block text-muted text-xs mt-0.5">
                  Include past sessions and the prayer board (larger package —
                  best as a file or long message, not QR).
                  {exportPayload
                    ? ` ${exportPayload.sessions.length} session${exportPayload.sessions.length === 1 ? "" : "s"} ready.`
                    : includeHistory
                      ? " Preparing…"
                      : ""}
                </span>
              </span>
            </label>

            <div className="rounded-xl border border-border bg-bg px-4 py-4 text-center space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Invite code
              </p>
              <p className="text-2xl font-semibold tracking-widest text-primary tabular-nums">
                {payload.code}
              </p>
              <p className="text-xs text-muted px-2">
                The short code alone is not enough — use Share or the full
                package / link.
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

            {qrDataUrl && !includeHistory && (
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

            {includeHistory && (
              <p className="text-xs text-muted text-center">
                QR is hidden for history packages (too large). Use Share or
                Download instead.
              </p>
            )}

            <div className="rounded-xl bg-surface-muted/60 border border-border px-3 py-3 space-y-2 text-sm text-muted">
              <p className="font-medium text-text text-sm">What they get</p>
              <p>
                {includeHistory
                  ? "They import past shared sessions and the prayer board, then can take part going forward. Private notes never leave this device."
                  : INVITE_HISTORY_NOTE}
              </p>
              <p className="text-xs">{INVITE_SYNC_NOTE}</p>
              <p className="text-xs">{INVITE_PRIVACY_NOTE}</p>
            </div>

            <div className="flex flex-col gap-2">
              <Button fullWidth onClick={() => void shareNative()}>
                <Share2 className="h-5 w-5" aria-hidden />
                {includeHistory ? "Share invite + history" : "Share invite"}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    const text = shareBody();
                    if (text) void copyText(text, "package");
                  }}
                >
                  {copied === "package" ? (
                    <Check className="h-4 w-4" aria-hidden />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden />
                  )}
                  Copy
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={downloadInvite}
                >
                  <Download className="h-4 w-4" aria-hidden />
                  Download
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
