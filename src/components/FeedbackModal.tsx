import { useEffect, useState, type FormEvent } from "react";
import { MessageSquareWarning } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "./Modal";
import { Button } from "./Button";
import {
  flushFeedbackQueue,
  submitFeedback,
  type FeedbackKind,
} from "../lib/feedback";
import { isSpaceRelayConfigured } from "../lib/sync";
import { useAppStore } from "../stores/useAppStore";
import { normalizeSpaceSync } from "../lib/sync";

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

const KINDS: { id: FeedbackKind; label: string }[] = [
  { id: "bug", label: "Something broke" },
  { id: "confusing", label: "I’m confused" },
  { id: "idea", label: "Idea / wish" },
  { id: "other", label: "Other" },
];

/**
 * Pilot feedback: message + optional contact + safe diagnostics.
 * Never requests private notes.
 */
export function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const spaces = useAppStore((s) => s.spaces);
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [includeDiag, setIncludeDiag] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKind("bug");
    setMessage("");
    setContact("");
    setIncludeDiag(true);
    // Try flush any earlier offline reports
    void flushFeedbackQueue().then((n) => {
      if (n > 0) {
        toast.success(
          n === 1
            ? "Sent 1 saved report from earlier"
            : `Sent ${n} saved reports from earlier`,
        );
      }
    });
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const connectedSpaceCount = spaces.filter((s) => {
        const sync = normalizeSpaceSync(s.sync);
        return sync.mode === "connected";
      }).length;

      const result = await submitFeedback({
        kind,
        message,
        contact,
        includeDiagnostics: includeDiag,
        spaceCount: spaces.length,
        connectedSpaceCount,
      });

      if (result.queued) {
        toast.success("Saved on this phone", {
          description:
            "We’ll send it when you’re Online with network — or share a screenshot with your host.",
          duration: 5000,
        });
      } else {
        toast.success("Report sent — thank you", {
          description: "The testing team can see this and fix things faster.",
          duration: 4000,
        });
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open={open} title="Report a problem" onClose={onClose}>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="flex items-start gap-2 text-sm text-muted -mt-1">
          <MessageSquareWarning
            className="h-5 w-5 shrink-0 text-primary mt-0.5"
            aria-hidden
          />
          <p>
            You’re helping a <strong className="text-text">testing pilot</strong>.
            Describe what went wrong or what confused you.{" "}
            <strong className="text-text">Don’t paste private notes.</strong>
          </p>
        </div>

        {!isSpaceRelayConfigured() && (
          <p className="text-xs rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-amber-950 dark:text-amber-50">
            Feedback will save on this phone until the reporting service is
            available, then send automatically.
          </p>
        )}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">What kind?</legend>
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <label
                key={k.id}
                className={[
                  "rounded-xl border px-3 py-2.5 text-sm cursor-pointer touch-manipulation",
                  kind === k.id
                    ? "border-primary bg-primary/5 font-medium text-primary"
                    : "border-border bg-bg text-muted",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="feedback-kind"
                  className="sr-only"
                  checked={kind === k.id}
                  onChange={() => setKind(k.id)}
                />
                {k.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">What happened?</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base min-h-[120px] resize-y"
            placeholder="e.g. I tapped Sync and nothing happened. I expected…"
            maxLength={4000}
            required
            autoFocus
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">
            Your name or email{" "}
            <span className="text-muted font-normal">(optional)</span>
          </span>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
            placeholder="So we can follow up"
            maxLength={120}
            autoComplete="email"
          />
        </label>

        <label className="flex items-start gap-3 rounded-xl border border-border bg-bg px-3 py-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-primary"
            checked={includeDiag}
            onChange={(e) => setIncludeDiag(e.target.checked)}
          />
          <span className="text-sm">
            <span className="font-medium text-text">
              Include device info (recommended)
            </span>
            <span className="block text-xs text-muted mt-0.5 leading-relaxed">
              Browser, Online/Offline mode, screen size, group counts — helps
              us fix bugs. Never includes private notes or Bible highlights.
            </span>
          </span>
        </label>

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={onClose}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button type="submit" fullWidth disabled={sending}>
            {sending ? "Sending…" : "Send report"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
