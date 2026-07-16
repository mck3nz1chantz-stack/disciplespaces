import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  QrCode,
  Share2,
} from "lucide-react";
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
  INVITE_PRIVACY_NOTE,
  INVITE_SIMPLE_HINT,
} from "../lib/legal";
import { normalizeSpaceSync } from "../lib/sync";
import { ConnectSafelyDisclosure } from "./ConnectSafelyGuide";

interface InviteModalProps {
  open: boolean;
  spaceId: string | null;
  onClose: () => void;
}

/**
 * P1 invite: name → Share / QR. Advanced (history file, full package) collapsed.
 */
export function InviteModal({ open, spaceId, onClose }: InviteModalProps) {
  const createInvitePayload = useAppStore((s) => s.createInvitePayload);
  const buildSpaceExportPayload = useAppStore((s) => s.buildSpaceExportPayload);
  const addMember = useAppStore((s) => s.addMember);
  const getSpace = useAppStore((s) => s.getSpace);
  const spaces = useAppStore((s) => s.spaces);

  const space = useMemo(
    () => spaces.find((s) => s.id === spaceId) ?? null,
    [spaces, spaceId],
  );
  const sync = normalizeSpaceSync(space?.sync);
  const connected =
    sync.mode === "connected" && Boolean(sync.roomId || sync.shortCode);
  const easyCode = (sync.shortCode || space?.inviteCode || "").trim();

  const [payload, setPayload] = useState<SpaceInvitePayload | null>(null);
  const [exportPayload, setExportPayload] = useState<SpaceExportPayload | null>(
    null,
  );
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<"code" | "message" | null>(null);
  const [inviteeName, setInviteeName] = useState("");
  const [inviteeSaved, setInviteeSaved] = useState(false);
  const [includeHistory, setIncludeHistory] = useState(false);
  const [savingInvitee, setSavingInvitee] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (!open || !spaceId) {
      setPayload(null);
      setExportPayload(null);
      setQrDataUrl(null);
      setInviteeName("");
      setInviteeSaved(false);
      setIncludeHistory(false);
      setAdvancedOpen(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const p = await createInvitePayload(spaceId);
        if (cancelled) return;
        setPayload(p);

        // QR: short code when connected; otherwise full offline package
        const live = await getSpace(spaceId);
        const liveSync = normalizeSpaceSync(live?.sync);
        const isConnected =
          liveSync.mode === "connected" &&
          Boolean(liveSync.roomId || liveSync.shortCode);
        const qrPayload =
          isConnected && (liveSync.shortCode || p.code)
            ? String(liveSync.shortCode || p.code)
            : encodeInvitePackage(p);

        const url = await QRCode.toDataURL(qrPayload, {
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
  }, [open, spaceId, createInvitePayload, getSpace, onClose]);

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
          err instanceof Error
            ? err.message
            : "Could not prepare group file",
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
      const current = await getSpace(spaceId);
      const name = inviteeName.trim();
      const already = current?.members.some(
        (m) => m.name.toLowerCase() === name.toLowerCase(),
      );
      if (!already) {
        await addMember(spaceId, name);
      }
      const p = await createInvitePayload(spaceId);
      setPayload(p);
      setInviteeSaved(true);
      toast.success(`${name} is on your people list`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add person");
    } finally {
      setSavingInvitee(false);
    }
  }

  async function copyText(text: string, kind: "code" | "message") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      toast.success(kind === "code" ? "Code copied" : "Invite message copied");
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Could not copy — select and copy manually");
    }
  }

  function shareBody(): string | null {
    if (includeHistory && exportPayload) {
      return formatExportShareText(exportPayload);
    }
    if (!payload) return null;
    return formatInviteShareText(payload, {
      shortCode: easyCode || payload.code,
      connected,
    });
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
          title: `Join ${payload.name}`,
          text,
        });
        return;
      } catch {
        // cancelled — fall through
      }
    }
    await copyText(text, "message");
  }

  function downloadInvite() {
    const text = shareBody();
    if (!text || !payload) return;
    const name = includeHistory
      ? exportFilename(payload.name)
      : `invite-${payload.name.replace(/\s+/g, "-").toLowerCase()}.txt`;
    downloadTextFile(name, text);
    toast.success("Download started — you can attach the file in Messages");
  }

  const displayCode = connected
    ? easyCode || payload?.code
    : payload?.code;

  return (
    <Modal open={open} title="Invite people" onClose={onClose}>
      <div className="space-y-4">
        {loading && (
          <p className="text-sm text-muted">Preparing invite…</p>
        )}

        {payload && (
          <>
            <p className="text-sm text-muted -mt-1">{INVITE_SIMPLE_HINT}</p>

            {/* 1. Name */}
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">
                Their name{" "}
                <span className="text-muted font-normal">(for your list)</span>
              </span>
              <div className="flex gap-2">
                <input
                  value={inviteeName}
                  onChange={(e) => {
                    setInviteeName(e.target.value);
                    setInviteeSaved(false);
                  }}
                  className="flex-1 rounded-xl border border-border bg-bg px-3 py-3 text-base min-w-0"
                  placeholder="e.g. Ana"
                  maxLength={60}
                  disabled={savingInvitee}
                  autoFocus
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0"
                  disabled={
                    !inviteeName.trim() || inviteeSaved || savingInvitee
                  }
                  onClick={() => void ensureInviteeOnHost()}
                >
                  {inviteeSaved ? "Added" : savingInvitee ? "…" : "Add"}
                </Button>
              </div>
              <p className="text-xs text-muted">
                Updates <strong className="text-text">Who’s here</strong> on
                this phone. They still need Share or the QR on their phone.
              </p>
            </label>

            {/* 2. Primary share */}
            <Button
              fullWidth
              className="!py-4 text-base"
              onClick={() => void shareNative()}
            >
              <Share2 className="h-5 w-5" aria-hidden />
              Share invite
            </Button>

            {/* 3. Big QR for in-person */}
            {qrDataUrl && !includeHistory && (
              <div className="flex flex-col items-center gap-2 pt-1">
                <div className="rounded-2xl border border-border bg-surface p-3 shadow-sm">
                  <img
                    src={qrDataUrl}
                    alt={`QR invite for ${payload.name}`}
                    className="w-[220px] h-[220px]"
                    width={220}
                    height={220}
                  />
                </div>
                <p className="text-xs text-muted inline-flex items-center gap-1 text-center px-2">
                  <QrCode className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  In the same room? They open DiscipleSpaces → Join a group →
                  scan this
                </p>
              </div>
            )}

            {/* Code — meaningful when connected */}
            {displayCode && (
              <div className="rounded-xl border border-border bg-bg px-4 py-3 text-center space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {connected ? "Join code" : "Reference code"}
                </p>
                <p className="text-2xl font-semibold tracking-widest text-primary tabular-nums">
                  {displayCode}
                </p>
                {connected ? (
                  <p className="text-xs text-muted">
                    They Join a group → type this code + their name. They
                    should not tap Connect.
                  </p>
                ) : (
                  <p className="text-xs text-muted">
                    Prefer Share or QR — this code alone isn’t enough offline.
                    Connect first if you want a simple join code.
                  </p>
                )}
                <Button
                  variant="secondary"
                  className="!py-2 mt-1"
                  onClick={() => void copyText(displayCode, "code")}
                >
                  {copied === "code" ? (
                    <Check className="h-4 w-4" aria-hidden />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden />
                  )}
                  Copy code
                </Button>
              </div>
            )}

            <ConnectSafelyDisclosure
              audience={connected ? "both" : "host"}
              label="How to connect safely"
            />

            <p className="text-[11px] text-muted text-center leading-relaxed">
              {INVITE_PRIVACY_NOTE}
            </p>

            {/* Advanced collapsed */}
            <div className="border-t border-border pt-3 space-y-3">
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 text-left touch-manipulation tap-target py-1"
                aria-expanded={advancedOpen}
              >
                <span className="text-sm font-semibold text-muted">
                  Other ways · past meetings, file
                </span>
                <ChevronDown
                  className={[
                    "h-5 w-5 text-muted transition-transform",
                    advancedOpen ? "rotate-180" : "",
                  ].join(" ")}
                  aria-hidden
                />
              </button>

              {advancedOpen && (
                <div className="space-y-3">
                  <label className="flex items-start gap-3 rounded-xl border border-border bg-bg px-3 py-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-primary"
                      checked={includeHistory}
                      onChange={(e) => setIncludeHistory(e.target.checked)}
                    />
                    <span className="text-sm">
                      <span className="font-medium text-text">
                        Include past meetings
                      </span>
                      <span className="block text-muted text-xs mt-0.5">
                        Sends a larger group file (shared meetings + prayer).
                        Notes marked “Just for me” are never included.
                        {exportPayload
                          ? ` ${exportPayload.sessions.length} meeting${exportPayload.sessions.length === 1 ? "" : "s"} ready.`
                          : includeHistory
                            ? " Preparing…"
                            : ""}
                      </span>
                    </span>
                  </label>

                  {includeHistory && (
                    <p className="text-xs text-muted text-center">
                      QR is hidden for large files — use Share or Download.
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary"
                      fullWidth
                      onClick={() => {
                        const text = shareBody();
                        if (text) void copyText(text, "message");
                      }}
                    >
                      {copied === "message" ? (
                        <Check className="h-4 w-4" aria-hidden />
                      ) : (
                        <Copy className="h-4 w-4" aria-hidden />
                      )}
                      Copy message
                    </Button>
                    <Button
                      variant="secondary"
                      fullWidth
                      onClick={downloadInvite}
                    >
                      <Download className="h-4 w-4" aria-hidden />
                      Download file
                    </Button>
                  </div>

                  {!connected && (
                    <p className="text-xs text-muted leading-relaxed">
                      Tip: On the group page, use{" "}
                      <strong className="text-text">
                        Connect for easy invite
                      </strong>{" "}
                      (when Online) so friends can join with a short code next
                      time.
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
