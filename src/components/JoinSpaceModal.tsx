import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { useAppStore } from "../stores/useAppStore";
import { parseInviteInput, type SpaceInvitePayload } from "../lib/invite";
import {
  INVITE_HISTORY_NOTE,
  INVITE_PRIVACY_NOTE,
} from "../lib/legal";

interface JoinSpaceModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = "input" | "confirm" | "done";

export function JoinSpaceModal({ open, onClose }: JoinSpaceModalProps) {
  const navigate = useNavigate();
  const joinFromInvite = useAppStore((s) => s.joinFromInvite);

  const [step, setStep] = useState<Step>("input");
  const [raw, setRaw] = useState("");
  const [payload, setPayload] = useState<SpaceInvitePayload | null>(null);
  const [joinerName, setJoinerName] = useState("");
  const [saving, setSaving] = useState(false);
  const [resultSpaceId, setResultSpaceId] = useState<string | null>(null);
  const [alreadyHad, setAlreadyHad] = useState(false);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimer = useRef<number | null>(null);

  function reset() {
    stopScan();
    setStep("input");
    setRaw("");
    setPayload(null);
    setJoinerName("");
    setSaving(false);
    setResultSpaceId(null);
    setAlreadyHad(false);
  }

  useEffect(() => {
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when closed
  }, [open]);

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
        description: "Paste the invite package instead (from Share invite).",
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
      const p = parseInviteInput(text);
      setPayload(p);
      setStep("confirm");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid invite");
    }
  }

  function handleContinue(e: FormEvent) {
    e.preventDefault();
    tryParse(raw);
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (!payload) return;
    if (!joinerName.trim()) {
      toast.error("Enter your name for the member list");
      return;
    }
    setSaving(true);
    try {
      const { space, alreadyHad: had } = await joinFromInvite({
        payload,
        joinerName,
      });
      setResultSpaceId(space.id);
      setAlreadyHad(had);
      setStep("done");
      if (had) {
        toast.message("You already have this space", {
          description: "Opened your local copy — past sessions stay as they were.",
        });
      } else {
        toast.success("Joined space");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not join");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    stopScan();
    onClose();
  }

  return (
    <Modal open={open} title="Join a Space" onClose={handleClose}>
      {step === "input" && (
        <form onSubmit={handleContinue} className="space-y-4">
          <p className="text-sm text-muted -mt-1">
            Paste the full invite package you received, or scan the QR code.
            Short codes alone are not enough offline — use the package or QR.
          </p>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Invite package</span>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-sm min-h-[120px] resize-y font-mono"
              placeholder="Paste text starting with DS1. …"
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

      {step === "confirm" && payload && (
        <form onSubmit={handleJoin} className="space-y-4">
          <div className="rounded-xl border border-border bg-bg px-3 py-3 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              You are joining
            </p>
            <p className="text-lg font-semibold text-primary">{payload.name}</p>
            {payload.description && (
              <p className="text-sm text-muted">{payload.description}</p>
            )}
            <p className="text-xs text-muted">Code {payload.code}</p>
            {payload.members.length > 0 && (
              <p className="text-sm text-muted pt-1">
                Members: {payload.members.map((m) => m.name).join(", ")}
              </p>
            )}
          </div>

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

          <div className="rounded-xl bg-surface-muted/60 border border-border px-3 py-3 text-sm text-muted space-y-2">
            <p>{INVITE_HISTORY_NOTE}</p>
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
              {saving ? "Joining…" : "Join space"}
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
              {alreadyHad
                ? "We opened your existing local copy. Past sessions were not overwritten."
                : "You can take part in current and future sessions on this device."}
            </p>
            <p className="text-xs text-muted">
              Past history can be imported later with a Space Update export if
              someone shares one with you.
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
