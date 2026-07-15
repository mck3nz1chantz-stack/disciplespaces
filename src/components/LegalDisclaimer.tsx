import { Modal } from "./Modal";
import { Button } from "./Button";
import {
  APP_MISSION,
  BIBLE_EDITIONS_NOTICE,
  LEGAL_DISCLAIMER,
  KJV_NOTICE,
  PRIVACY_SUMMARY,
  TESTING_PHASE_HEADLINE,
  TESTING_PHASE_SHORT,
} from "../lib/legal";
import { useAppStore } from "../stores/useAppStore";

/** First-launch blocking modal. */
export function LegalDisclaimerModal() {
  const hasAcknowledgedLegal = useAppStore((s) => s.hasAcknowledgedLegal);
  const acknowledgeLegal = useAppStore((s) => s.acknowledgeLegal);

  return (
    <Modal
      open={!hasAcknowledgedLegal}
      title="Testing · privacy"
      onClose={() => {}}
      dismissible={false}
    >
      <div className="space-y-4 text-sm text-muted leading-relaxed">
        <div className="rounded-xl border-2 border-amber-400/70 bg-amber-50 dark:bg-amber-950/40 px-3 py-3 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
            Development pilot
          </p>
          <p className="font-semibold text-amber-950 dark:text-amber-50">
            {TESTING_PHASE_HEADLINE}
          </p>
          <p className="text-amber-950/90 dark:text-amber-50/90 text-sm">
            {TESTING_PHASE_SHORT}
          </p>
        </div>
        <p className="text-text font-medium">{PRIVACY_SUMMARY}</p>
        <p className="text-sm text-muted">{APP_MISSION}</p>
        <p>{LEGAL_DISCLAIMER}</p>
        <p className="text-xs">{BIBLE_EDITIONS_NOTICE}</p>
        <p className="text-xs">{KJV_NOTICE}</p>
        <Button fullWidth onClick={acknowledgeLegal}>
          I understand — continue testing
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
      <p className="text-amber-900 dark:text-amber-100 font-medium text-sm">
        {TESTING_PHASE_HEADLINE}. {TESTING_PHASE_SHORT}
      </p>
      <p className="text-sm">{APP_MISSION}</p>
      <p>{LEGAL_DISCLAIMER}</p>
      <p className="text-xs">{BIBLE_EDITIONS_NOTICE}</p>
      <p className="text-xs">{KJV_NOTICE}</p>
    </div>
  );
}
