import { Check, X } from "lucide-react";
import { Button } from "./Button";
import {
  GATHER_STEPS,
  nextGatherStep,
  primaryGatherLabel,
  type GatherStepId,
  type GatherState,
} from "../lib/gather";

interface GatherRitualBarProps {
  gather: GatherState;
  /** Optional meeting title for context */
  sessionHint?: string | null;
  busy?: boolean;
  onSelectStep: (step: GatherStepId) => void;
  onPrimary: () => void;
  onAdvance: () => void;
  onEnd: () => void;
}

/**
 * In-flow gather ritual: Meet → Study → Prayer.
 * Lives under the Space hero — not sticky vs bottom nav.
 */
export function GatherRitualBar({
  gather,
  sessionHint,
  busy = false,
  onSelectStep,
  onPrimary,
  onAdvance,
  onEnd,
}: GatherRitualBarProps) {
  const hasSession = Boolean(gather.sessionId);
  const primary = primaryGatherLabel(gather.step, hasSession);
  const next = nextGatherStep(gather.step);
  const allDone =
    gather.done.meet && gather.done.study && gather.done.prayer;

  return (
    <div
      className="rounded-2xl border border-primary/25 bg-primary/8 px-3 py-3 space-y-3"
      role="region"
      aria-label="Gather tonight"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
            Gather
          </p>
          <p className="text-sm text-muted mt-0.5 leading-snug">
            Meet · Study · Prayer
            {sessionHint ? (
              <>
                {" "}
                <span className="text-primary/90 font-medium">
                  · {sessionHint}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={onEnd}
          className="inline-flex items-center justify-center rounded-lg p-2 text-muted hover:text-primary hover:bg-surface/80 touch-manipulation tap-target shrink-0"
          aria-label="End gather"
          title="End gather"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <ol
        className="grid grid-cols-3 gap-1.5"
        aria-label="Gather steps"
      >
        {GATHER_STEPS.map((s, i) => {
          const isCurrent = gather.step === s.id;
          const isDone = Boolean(gather.done[s.id]);
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelectStep(s.id)}
                aria-current={isCurrent ? "step" : undefined}
                className={[
                  "w-full flex flex-col items-center gap-1 rounded-xl border px-1.5 py-2.5",
                  "text-center touch-manipulation transition-colors",
                  isCurrent
                    ? "border-primary bg-primary text-on-primary shadow-sm"
                    : isDone
                      ? "border-primary/30 bg-surface/90 text-primary"
                      : "border-border/80 bg-bg/70 text-muted hover:border-primary/30",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
                    isCurrent
                      ? "bg-on-primary/15 text-on-primary"
                      : isDone
                        ? "bg-primary/15 text-primary"
                        : "bg-surface-muted text-muted",
                  ].join(" ")}
                >
                  {isDone && !isCurrent ? (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={[
                    "text-xs font-semibold",
                    isCurrent ? "text-on-primary" : "",
                  ].join(" ")}
                >
                  {s.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-2">
        {allDone ? (
          <Button fullWidth className="!py-3.5" onClick={onEnd} disabled={busy}>
            Finish gather
          </Button>
        ) : (
          <>
            <Button
              fullWidth
              className="!py-3.5"
              onClick={onPrimary}
              disabled={busy}
            >
              {busy ? "Working…" : primary}
            </Button>
            {next && (
              <Button
                type="button"
                variant="secondary"
                fullWidth
                className="!py-2.5 text-sm"
                onClick={onAdvance}
                disabled={busy}
              >
                Next · {GATHER_STEPS.find((s) => s.id === next)?.label}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
