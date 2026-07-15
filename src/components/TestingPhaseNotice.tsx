import { useState } from "react";
import { AlertTriangle, ChevronDown, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "./Card";
import { Button } from "./Button";
import { FeedbackModal } from "./FeedbackModal";
import {
  TESTING_GUIDE_STEPS,
  TESTING_PHASE_BODY,
  TESTING_PHASE_HEADLINE,
  TESTING_PHASE_SHORT,
} from "../lib/legal";
import {
  readFlag,
  writeFlag,
} from "../lib/onboarding";

/** Collapse the long guide after user has read it (ribbon stays). */
export const TESTING_GUIDE_COLLAPSE_KEY = "ds-testing-guide-collapsed-v1";

/**
 * Always-visible testing ribbon under the app header.
 */
export function TestingPhaseRibbon() {
  return (
    <div
      className="border-b border-amber-300/80 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-50"
      role="status"
    >
      <div className="mx-auto max-w-lg safe-x py-1.5 flex items-center gap-2 text-xs sm:text-sm">
        <AlertTriangle
          className="h-3.5 w-3.5 shrink-0 text-amber-800 dark:text-amber-200"
          aria-hidden
        />
        <p className="min-w-0 flex-1 font-medium leading-snug">
          <span className="uppercase tracking-wide text-[10px] sm:text-xs font-bold mr-1.5 opacity-90">
            Testing
          </span>
          Early development — back up often. Not a finished app.
        </p>
      </div>
    </div>
  );
}

interface TestingGuideCardProps {
  /** compact = home; full = settings / help */
  variant?: "compact" | "full";
  onBackup?: () => void;
}

/**
 * What friends/family need to know during the pilot.
 */
export function TestingGuideCard({
  variant = "compact",
  onBackup,
}: TestingGuideCardProps) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [expanded, setExpanded] = useState(
    () => !readFlag(TESTING_GUIDE_COLLAPSE_KEY),
  );

  function collapse() {
    writeFlag(TESTING_GUIDE_COLLAPSE_KEY, true);
    setExpanded(false);
  }

  function expand() {
    writeFlag(TESTING_GUIDE_COLLAPSE_KEY, false);
    setExpanded(true);
  }

  if (variant === "compact" && !expanded) {
    return (
      <button
        type="button"
        onClick={expand}
        className="w-full text-left rounded-2xl border-2 border-amber-400/70 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700 px-3 py-3 touch-manipulation active:scale-[0.99]"
      >
        <div className="flex items-start gap-2.5">
          <ShieldAlert
            className="h-5 w-5 shrink-0 text-amber-800 dark:text-amber-200 mt-0.5"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-950 dark:text-amber-50">
              {TESTING_PHASE_HEADLINE}
            </p>
            <p className="text-xs text-amber-900/90 dark:text-amber-100/85 mt-0.5 leading-relaxed">
              {TESTING_PHASE_SHORT}{" "}
              <span className="font-semibold underline underline-offset-2">
                Tap for what to do
              </span>
            </p>
          </div>
          <ChevronDown
            className="h-4 w-4 shrink-0 text-amber-800 dark:text-amber-200 mt-1"
            aria-hidden
          />
        </div>
      </button>
    );
  }

  return (
    <Card className="space-y-3 border-2 border-amber-400/70 bg-amber-50/90 dark:bg-amber-950/35 dark:border-amber-700">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-200/80 text-amber-950 dark:bg-amber-900 dark:text-amber-50">
          <ShieldAlert className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
            Pilot · testing phase
          </p>
          <h3 className="text-base font-semibold text-amber-950 dark:text-amber-50 mt-0.5">
            {TESTING_PHASE_HEADLINE}
          </h3>
          <p className="text-sm text-amber-950/90 dark:text-amber-50/90 mt-1 leading-relaxed">
            {TESTING_PHASE_BODY}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-amber-300/60 bg-bg/70 dark:bg-bg/40 px-3 py-2.5 space-y-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          What you should do
        </p>
        <ol className="space-y-2.5 list-decimal pl-4">
          {TESTING_GUIDE_STEPS.map((step) => (
            <li key={step.title} className="text-sm text-muted pl-0.5">
              <span className="font-medium text-primary">{step.title}. </span>
              <span className="leading-relaxed">{step.detail}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-2">
        <Button fullWidth onClick={() => setFeedbackOpen(true)}>
          Report a problem
        </Button>
        <div className="flex flex-col gap-2 sm:flex-row">
          {onBackup && (
            <Button fullWidth variant="secondary" onClick={onBackup}>
              Back up a group now
            </Button>
          )}
          <Link to="/settings" className="block sm:flex-1">
            <Button fullWidth variant="ghost">
              Open Settings
            </Button>
          </Link>
        </div>
      </div>

      {variant === "compact" && (
        <button
          type="button"
          onClick={collapse}
          className="w-full text-center text-xs font-medium text-amber-900/80 dark:text-amber-100/80 py-1 touch-manipulation"
        >
          Collapse (Testing banner stays at top)
        </button>
      )}

      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
    </Card>
  );
}
