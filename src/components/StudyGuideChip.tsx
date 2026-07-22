import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, ListChecks, X } from "lucide-react";
import type { Session, Template, TemplateStep } from "../types";
import { Button } from "./Button";

const GUIDE_STEP_KEY = "ds-reader-guide-step-v1";

function loadStepIndex(sessionId: string, max: number): number {
  try {
    const raw = sessionStorage.getItem(`${GUIDE_STEP_KEY}:${sessionId}`);
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n < max) return n;
  } catch {
    // ignore
  }
  // Prefer first passage-log step when opening a session guide
  return 0;
}

function saveStepIndex(sessionId: string, index: number): void {
  try {
    sessionStorage.setItem(`${GUIDE_STEP_KEY}:${sessionId}`, String(index));
  } catch {
    // ignore
  }
}

interface StudyGuideChipProps {
  session: Session;
  template: Template | null | undefined;
  /** Collapse to a single chip (Focus mode default). */
  compact?: boolean;
}

/**
 * Floating session guide — template steps as quiet prompts while reading.
 * Step index is per-session on this device (sessionStorage).
 */
export function StudyGuideChip({
  session,
  template,
  compact = false,
}: StudyGuideChipProps) {
  const steps = template?.steps ?? [];
  const stepCount = steps.length;
  const [open, setOpen] = useState(!compact);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    setOpen(!compact);
  }, [compact]);

  useEffect(() => {
    if (stepCount === 0) return;
    // Prefer Scripture / passage-log step as default start
    const passageIdx = steps.findIndex((s) => s.fieldType === "passage-log");
    const saved = loadStepIndex(session.id, stepCount);
    if (saved > 0 || passageIdx < 0) {
      setStepIndex(saved);
    } else {
      setStepIndex(passageIdx);
      saveStepIndex(session.id, passageIdx);
    }
    // steps content is stable per template id; session + count is enough
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, session.templateId, stepCount]);

  const step: TemplateStep | undefined = steps[stepIndex];
  const response = step ? session.responses?.[step.id] : undefined;
  const answered = useMemo(() => {
    if (response == null) return false;
    if (typeof response === "string") return response.trim().length > 0;
    if (Array.isArray(response)) return response.length > 0;
    return false;
  }, [response]);

  if (steps.length === 0 || !step) return null;

  function go(delta: -1 | 1) {
    setStepIndex((i) => {
      const next = Math.min(steps.length - 1, Math.max(0, i + delta));
      saveStepIndex(session.id, next);
      return next;
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/25 bg-surface/90 backdrop-blur-md px-3 py-2 text-xs font-medium text-primary shadow-[var(--shadow-card)] touch-manipulation tap-target hover:border-primary/40"
        aria-expanded={false}
      >
        <ListChecks className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">
          Guide · {step.title}
          <span className="text-muted font-normal">
            {" "}
            ({stepIndex + 1}/{steps.length})
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-surface/95 backdrop-blur-xl shadow-[var(--shadow-card)] p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Session guide
            {template?.name ? ` · ${template.name}` : ""}
          </p>
          <p className="text-sm font-medium text-primary leading-snug mt-0.5">
            {stepIndex + 1}. {step.title}
            {answered && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-success align-middle">
                <Check className="h-3 w-3" aria-hidden />
                noted
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="shrink-0 rounded-lg p-1.5 text-muted hover:text-primary hover:bg-surface-muted/80 touch-manipulation"
          aria-label="Collapse guide"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <p className="text-sm text-muted leading-relaxed font-serif">
        {step.prompt}
      </p>

      {step.fieldType === "passage-log" && (
        <p className="text-[11px] text-primary/90 bg-primary/5 border border-primary/10 rounded-lg px-2.5 py-1.5">
          Select verses below, then log them to this session.
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          className="!py-2 !px-2.5 flex-1"
          disabled={stepIndex <= 0}
          onClick={() => go(-1)}
          aria-label="Previous guide step"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Prev
        </Button>
        <span className="text-[11px] text-muted tabular-nums shrink-0">
          {stepIndex + 1} / {steps.length}
        </span>
        <Button
          variant="secondary"
          className="!py-2 !px-2.5 flex-1"
          disabled={stepIndex >= steps.length - 1}
          onClick={() => go(1)}
          aria-label="Next guide step"
        >
          Next
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
