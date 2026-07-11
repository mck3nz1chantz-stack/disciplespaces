import { Modal } from "./Modal";
import { Button } from "./Button";
import { LEGAL_DISCLAIMER, KJV_NOTICE, PRIVACY_SUMMARY } from "../lib/legal";
import { useAppStore } from "../stores/useAppStore";

/** First-launch blocking modal. */
export function LegalDisclaimerModal() {
  const hasAcknowledgedLegal = useAppStore((s) => s.hasAcknowledgedLegal);
  const acknowledgeLegal = useAppStore((s) => s.acknowledgeLegal);

  return (
    <Modal
      open={!hasAcknowledgedLegal}
      title="Privacy & disclaimer"
      onClose={() => {}}
      dismissible={false}
    >
      <div className="space-y-4 text-sm text-muted leading-relaxed">
        <p className="text-text font-medium">{PRIVACY_SUMMARY}</p>
        <p>{LEGAL_DISCLAIMER}</p>
        <p className="text-xs">{KJV_NOTICE}</p>
        <Button fullWidth onClick={acknowledgeLegal}>
          I understand
        </Button>
      </div>
    </Modal>
  );
}

/** Inline block for Settings (and anywhere else). */
export function LegalDisclaimerText({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-xl bg-surface-muted border border-border p-4 text-sm text-muted leading-relaxed space-y-2 ${className}`}
    >
      <p className="font-medium text-text">Privacy & disclaimer</p>
      <p>{LEGAL_DISCLAIMER}</p>
      <p className="text-xs">{KJV_NOTICE}</p>
    </div>
  );
}
