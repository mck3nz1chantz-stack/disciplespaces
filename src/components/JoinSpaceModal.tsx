import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, CheckCircle2, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { useAppStore } from "../stores/useAppStore";
import {
  buildMemberJoinPayload,
  detectJoinPackageKind,
  formatMemberJoinShareText,
  parseInviteInput,
  parseMemberJoinInput,
  type MemberJoinPayload,
  type SpaceInvitePayload,
} from "../lib/invite";
import { parseExportInput, type SpaceExportPayload } from "../lib/share";
import {
  INVITE_HISTORY_NOTE,
  INVITE_PRIVACY_NOTE,
  INVITE_SYNC_NOTE,
} from "../lib/legal";
import type { Member } from "../types";

interface JoinSpaceModalProps {
  open: boolean;
  onClose: () => void;
  /** Prefill from deep link / parent. */
  initialRaw?: string | null;
}

type Step = "input" | "confirm" | "done" | "host-confirm-done";

type ParsedPackage =
  | { kind: "invite"; payload: SpaceInvitePayload }
  | { kind: "export"; payload: SpaceExportPayload }
  | { kind: "member-join"; payload: MemberJoinPayload };

export function JoinSpaceModal({
  open,
  onClose,
  initialRaw = null,
}: JoinSpaceModalProps) {
  const navigate = useNavigate();
  const joinFromInvite = useAppStore((s) => s.joinFromInvite);
  const joinFromExport = useAppStore((s) => s.joinFromExport);
  const applyMemberJoin = useAppStore((s) => s.applyMemberJoin);

  const [step, setStep] = useState<Step>("input");
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<ParsedPackage | null>(null);
  const [joinerName, setJoinerName] = useState("");
  const [saving, setSaving] = useState(false);
  const [resultSpaceId, setResultSpaceId] = useState<string | null>(null);
  const [alreadyHad, setAlreadyHad] = useState(false);
  const [historyImported, setHistoryImported] = useState(false);
  const [sessionsAdded, setSessionsAdded] = useState(0);
  const [joiner, setJoiner] = useState<Member | null>(null);
  const [confirmPayload, setConfirmPayload] =
    useState<MemberJoinPayload | null>(null);
  const [hostAddedName, setHostAddedName] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimer = useRef<number | null>(null);

  function reset() {
    stopScan();
    setStep("input");
    setRaw("");
    setParsed(null);
    setJoinerName("");
    setSaving(false);
    setResultSpaceId(null);
    setAlreadyHad(false);
    setHistoryImported(false);
    setSessionsAdded(0);
    setJoiner(null);
    setConfirmPayload(null);
    setHostAddedName(null);
  }

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    if (initialRaw?.trim()) {
      setRaw(initialRaw);
      tryParse(initialRaw);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when opened / initialRaw changes
  }, [open, initialRaw]);

  function stopScan() {
    if (scanTimer.current != null) {
      window.clearInterval(scanTimer.current);
      scanTimer.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  async function startScan() {
    const Detector = (
      window as unknown as {
        BarcodeDetector?: new (opts: {
          formats: string[];
        }) => {
          detect: (
            source: ImageBitmapSource,
          ) => Promise<Array<{ rawValue: string }>>;
        };
      }
    ).BarcodeDetector;

    if (!Detector) {
      toast.message("Camera scan not available on this device", {
        description: "Paste the invite package or open the invite link instead.",
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setScanning(true);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const detector = new Detector({ formats: ["qr_code"] });
      scanTimer.current = window.setInterval(() => {
        void (async () => {
          const video = videoRef.current;
          if (!video || video.readyState < 2) return;
          try {
            const codes = await detector.detect(video);
            const value = codes[0]?.rawValue;
            if (value) {
              stopScan();
              setRaw(value);
              tryParse(value);
            }
          } catch {
            // keep scanning
          }
        })();
      }, 500);
    } catch {
      stopScan();
      toast.error("Could not open camera. Paste the invite package instead.");
    }
  }

  function tryParse(text: string) {
    try {
      const kind = detectJoinPackageKind(text);
      if (kind === "member-join") {
        const p = parseMemberJoinInput(text);
        setParsed({ kind: "member-join", payload: p });
        setStep("confirm");
        return;
      }
      if (kind === "export") {
        const p = parseExportInput(text);
        setParsed({ kind: "export", payload: p });
        setStep("confirm");
        return;
      }
      // invite or unknown — try invite parser (better errors)
      const p = parseInviteInput(text);
      setParsed({ kind: "invite", payload: p });
      setStep("confirm");
    } catch (err) {
      // Last chance: export or member-join if detect failed
      try {
        const p = parseExportInput(text);
        setParsed({ kind: "export", payload: p });
        setStep("confirm");
        return;
      } catch {
        // continue
      }
      try {
        const p = parseMemberJoinInput(text);
        setParsed({ kind: "member-join", payload: p });
        setStep("confirm");
        return;
      } catch {
        // continue
      }
      toast.error(err instanceof Error ? err.message : "Invalid invite");
    }
  }

  function handleContinue(e: FormEvent) {
    e.preventDefault();
    tryParse(raw);
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (!parsed) return;

    if (parsed.kind === "member-join") {
      setSaving(true);
      try {
        const { space, added } = await applyMemberJoin(parsed.payload);
        setResultSpaceId(space.id);
        setHostAddedName(parsed.payload.member.name);
        setStep("host-confirm-done");
        toast.success(
          added
            ? `Added ${parsed.payload.member.name} — member count updated`
            : `${parsed.payload.member.name} was already on this space`,
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not apply join");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!joinerName.trim()) {
      toast.error("Enter your name for the member list");
      return;
    }

    setSaving(true);
    try {
      if (parsed.kind === "invite") {
        const { space, alreadyHad: had, joiner: j } = await joinFromInvite({
          payload: parsed.payload,
          joinerName,
        });
        setResultSpaceId(space.id);
        setAlreadyHad(had);
        setHistoryImported(false);
        setSessionsAdded(0);
        setJoiner(j);
        if (j) {
          setConfirmPayload(
            buildMemberJoinPayload({
              spaceId: space.id,
              code: space.inviteCode || parsed.payload.code,
              spaceName: space.name,
              member: j,
            }),
          );
        }
        setStep("done");
        if (had) {
          toast.message("You already have this space", {
            description:
              "Opened your local copy — past sessions stay as they were.",
          });
        } else {
          toast.success("Joined space");
        }
      } else {
        const result = await joinFromExport({
          payload: parsed.payload,
          joinerName,
        });
        setResultSpaceId(result.space.id);
        setAlreadyHad(result.alreadyHad);
        setHistoryImported(true);
        setSessionsAdded(result.addedSessions);
        setJoiner(result.joiner);
        if (result.joiner) {
          setConfirmPayload(
            buildMemberJoinPayload({
              spaceId: result.space.id,
              code:
                result.space.inviteCode ||
                parsed.payload.space.inviteCode ||
                "",
              spaceName: result.space.name,
              member: result.joiner,
            }),
          );
        }
        setStep("done");
        toast.success(
          result.addedSessions > 0
            ? `Joined with ${result.addedSessions} session${result.addedSessions === 1 ? "" : "s"} imported`
            : result.alreadyHad
              ? "Space updated"
              : "Joined space",
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not join");
    } finally {
      setSaving(false);
    }
  }

  async function shareJoinConfirm() {
    if (!confirmPayload) return;
    const text = formatMemberJoinShareText(confirmPayload);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `I'm in — ${confirmPayload.spaceName}`,
          text,
        });
        return;
      } catch {
        // fall through
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Join confirmation copied — send it to the host");
    } catch {
      toast.error("Could not copy confirmation");
    }
  }

  function handleClose() {
    stopScan();
    onClose();
  }

  const confirmTitle =
    parsed?.kind === "member-join"
      ? "Add member on this device"
      : parsed?.kind === "export"
        ? "Join with history"
        : "You are joining";

  return (
    <Modal open={open} title="Join a Space" onClose={handleClose}>
      {step === "input" && (
        <form onSubmit={handleContinue} className="space-y-4">
          <p className="text-sm text-muted -mt-1">
            Paste an invite link or package (DS1.), a history package (DSX1.),
            or a join confirmation (DSM1.). You can also scan a QR code.
          </p>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Invite / package</span>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-sm min-h-[120px] resize-y font-mono"
              placeholder="Paste link or text starting with DS1. / DSX1. / DSM1."
              autoFocus
            />
          </label>

          {scanning ? (
            <div className="space-y-2">
              <video
                ref={videoRef}
                className="w-full rounded-xl border border-border bg-black aspect-square object-cover"
                muted
                playsInline
              />
              <Button type="button" variant="secondary" fullWidth onClick={stopScan}>
                Stop camera
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => void startScan()}
            >
              <Camera className="h-5 w-5" aria-hidden />
              Scan QR code
            </Button>
          )}

          <p className="text-xs text-muted">{INVITE_PRIVACY_NOTE}</p>

          <div className="flex gap-2">
            <Button type="button" variant="secondary" fullWidth onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" fullWidth disabled={!raw.trim()}>
              Continue
            </Button>
          </div>
        </form>
      )}

      {step === "confirm" && parsed && (
        <form onSubmit={handleJoin} className="space-y-4">
          <div className="rounded-xl border border-border bg-bg px-3 py-3 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {confirmTitle}
            </p>
            {parsed.kind === "member-join" ? (
              <>
                <p className="text-lg font-semibold text-primary">
                  {parsed.payload.member.name}
                </p>
                <p className="text-sm text-muted">
                  wants to join{" "}
                  <strong className="text-text">{parsed.payload.spaceName}</strong>
                </p>
                <p className="text-xs text-muted">Code {parsed.payload.code}</p>
              </>
            ) : parsed.kind === "invite" ? (
              <>
                <p className="text-lg font-semibold text-primary">
                  {parsed.payload.name}
                </p>
                {parsed.payload.description && (
                  <p className="text-sm text-muted">{parsed.payload.description}</p>
                )}
                <p className="text-xs text-muted">Code {parsed.payload.code}</p>
                {parsed.payload.members.length > 0 && (
                  <p className="text-sm text-muted pt-1">
                    Members:{" "}
                    {parsed.payload.members.map((m) => m.name).join(", ")}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-lg font-semibold text-primary">
                  {parsed.payload.space.name}
                </p>
                <p className="text-sm text-muted">
                  {parsed.payload.sessions.length} session
                  {parsed.payload.sessions.length === 1 ? "" : "s"}
                  {(parsed.payload.prayerBoard?.length ?? 0) > 0
                    ? ` · ${parsed.payload.prayerBoard!.length} prayer board entr${parsed.payload.prayerBoard!.length === 1 ? "y" : "ies"}`
                    : ""}
                </p>
                {(parsed.payload.space.members?.length ?? 0) > 0 && (
                  <p className="text-sm text-muted pt-1">
                    Members:{" "}
                    {parsed.payload.space.members.map((m) => m.name).join(", ")}
                  </p>
                )}
              </>
            )}
          </div>

          {parsed.kind !== "member-join" && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Your name on this device</span>
              <input
                value={joinerName}
                onChange={(e) => setJoinerName(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
                placeholder="How should the group see you?"
                maxLength={60}
                required
                autoFocus
              />
            </label>
          )}

          <div className="rounded-xl bg-surface-muted/60 border border-border px-3 py-3 text-sm text-muted space-y-2">
            {parsed.kind === "member-join" ? (
              <p>
                This only updates the member list on <em>this</em> phone (the
                host). It does not re-send history.
              </p>
            ) : parsed.kind === "export" ? (
              <p>
                This package includes shared session history. Private notes are
                never imported.
              </p>
            ) : (
              <p>{INVITE_HISTORY_NOTE}</p>
            )}
            <p className="text-xs">{INVITE_SYNC_NOTE}</p>
            <p className="text-xs">{INVITE_PRIVACY_NOTE}</p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => setStep("input")}
              disabled={saving}
            >
              Back
            </Button>
            <Button type="submit" fullWidth disabled={saving}>
              {saving
                ? "Working…"
                : parsed.kind === "member-join"
                  ? "Add to my list"
                  : parsed.kind === "export"
                    ? "Join & import history"
                    : "Join space"}
            </Button>
          </div>
        </form>
      )}

      {step === "done" && resultSpaceId && (
        <div className="space-y-4 text-center">
          <CheckCircle2
            className="h-12 w-12 mx-auto text-success"
            aria-hidden
          />
          <div className="space-y-2">
            <p className="font-medium text-primary text-lg">
              {alreadyHad ? "Space already on this device" : "You're in"}
            </p>
            <p className="text-sm text-muted">
              {historyImported
                ? sessionsAdded > 0
                  ? `Imported ${sessionsAdded} session${sessionsAdded === 1 ? "" : "s"}. You can take part going forward on this device.`
                  : "History package applied. Sessions already on this device were kept."
                : alreadyHad
                  ? "We opened your existing local copy. Past sessions were not overwritten."
                  : "You can take part in current and future sessions on this device."}
            </p>
            {!historyImported && (
              <p className="text-xs text-muted">
                Past history can still be imported if someone shares a Space
                Update (DSX1.) with you.
              </p>
            )}
          </div>

          {confirmPayload && joiner && (
            <div className="rounded-xl border border-border bg-bg px-3 py-3 text-left space-y-2">
              <p className="text-sm font-medium text-text">
                Tell the host you joined
              </p>
              <p className="text-xs text-muted">
                Their phone will not update automatically. Send this so their
                Attendees count shows you (e.g. 2/5).
              </p>
              <div className="flex flex-col gap-2">
                <Button fullWidth onClick={() => void shareJoinConfirm()}>
                  <Share2 className="h-5 w-5" aria-hidden />
                  Send “I&apos;m in” to host
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        formatMemberJoinShareText(confirmPayload),
                      );
                      toast.success("Confirmation copied");
                    } catch {
                      toast.error("Could not copy");
                    }
                  }}
                >
                  <Copy className="h-4 w-4" aria-hidden />
                  Copy confirmation
                </Button>
              </div>
            </div>
          )}

          <Button
            fullWidth
            onClick={() => {
              handleClose();
              navigate(`/space/${resultSpaceId}`);
            }}
          >
            Open space
          </Button>
          <Button variant="ghost" fullWidth onClick={handleClose}>
            Close
          </Button>
        </div>
      )}

      {step === "host-confirm-done" && resultSpaceId && (
        <div className="space-y-4 text-center">
          <CheckCircle2
            className="h-12 w-12 mx-auto text-success"
            aria-hidden
          />
          <div className="space-y-2">
            <p className="font-medium text-primary text-lg">Member list updated</p>
            <p className="text-sm text-muted">
              {hostAddedName
                ? `${hostAddedName} is on this Space on your device. Open the Space to see the new count.`
                : "Your local member list is up to date."}
            </p>
          </div>
          <Button
            fullWidth
            onClick={() => {
              handleClose();
              navigate(`/space/${resultSpaceId}`);
            }}
          >
            Open space
          </Button>
          <Button variant="ghost" fullWidth onClick={handleClose}>
            Close
          </Button>
        </div>
      )}
    </Modal>
  );
}
