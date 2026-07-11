import { useState } from "react";
import { BookOpen, Share2, ShieldCheck, Users, Sparkles } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import {
  ONBOARDING_DONE_KEY,
  ONBOARDING_SLIDES,
  writeFlag,
} from "../lib/onboarding";

const ICONS = [Sparkles, Users, BookOpen, Share2, ShieldCheck] as const;

interface OnboardingProps {
  open: boolean;
  onFinished: (action?: "create" | "join" | "skip") => void;
}

/**
 * Calm first-launch welcome. Skippable; marks onboarding complete on dismiss.
 */
export function Onboarding({ open, onFinished }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const slide = ONBOARDING_SLIDES[step]!;
  const Icon = ICONS[step] ?? Sparkles;
  const isLast = step >= ONBOARDING_SLIDES.length - 1;

  function finish(action?: "create" | "join" | "skip") {
    writeFlag(ONBOARDING_DONE_KEY, true);
    setStep(0);
    onFinished(action);
  }

  function next() {
    if (isLast) finish();
    else setStep((s) => s + 1);
  }

  function back() {
    setStep((s) => Math.max(0, s - 1));
  }

  return (
    <Modal
      open={open}
      title={slide.title}
      onClose={() => finish("skip")}
      dismissible
    >
      <div className="space-y-5">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="h-7 w-7" aria-hidden />
          </div>
        </div>

        <p className="text-sm text-muted text-center leading-relaxed -mt-1">
          {slide.body}
        </p>

        <div
          className="flex justify-center gap-1.5"
          role="tablist"
          aria-label="Onboarding steps"
        >
          {ONBOARDING_SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === step}
              aria-label={`Step ${i + 1}`}
              onClick={() => setStep(i)}
              className={[
                "h-2 rounded-full transition-all touch-manipulation",
                i === step
                  ? "w-6 bg-primary"
                  : "w-2 bg-border hover:bg-muted/40",
              ].join(" ")}
            />
          ))}
        </div>

        {isLast ? (
          <div className="space-y-2">
            <p className="text-xs text-muted text-center">
              Ready when you are — create a Space or join with an invite.
            </p>
            <Button fullWidth onClick={() => finish("create")}>
              Create your first Space
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => finish("join")}
            >
              Join a Space
            </Button>
            <Button variant="ghost" fullWidth onClick={() => finish("skip")}>
              Explore on my own
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            {step > 0 ? (
              <Button variant="secondary" fullWidth onClick={back}>
                Back
              </Button>
            ) : (
              <Button
                variant="ghost"
                fullWidth
                onClick={() => finish("skip")}
              >
                Skip
              </Button>
            )}
            <Button fullWidth onClick={next}>
              Next
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
