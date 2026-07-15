import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronDown, CircleHelp } from "lucide-react";
import { Card } from "../components/Card";
import { TUTORIAL_INTRO, TUTORIAL_SECTIONS } from "../lib/tutorial";
import {
  BACKUP_HEADLINE,
  BACKUP_STEPS,
  PRODUCTION_URL,
  RESTORE_NOTE,
} from "../lib/legal";
import { TestingGuideCard } from "../components/TestingPhaseNotice";

/**
 * Offline Help / tutorial. Content from src/lib/tutorial.ts.
 */
export function Help() {
  const [openId, setOpenId] = useState<string | null>(TUTORIAL_SECTIONS[0]?.id ?? null);

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="space-y-5">
      <Link
        to="/settings"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary touch-manipulation tap-target -ml-1 px-1"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Settings
      </Link>

      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CircleHelp className="h-6 w-6" aria-hidden />
        </div>
        <div className="min-w-0">
          <h2 className="text-2xl">Help & tutorial</h2>
          <p className="text-sm text-muted mt-1">{TUTORIAL_INTRO}</p>
        </div>
      </div>

      <TestingGuideCard variant="full" />

      <Card padding="sm" className="bg-primary/5 border-primary/15">
        <p className="text-sm text-muted">
          <span className="font-medium text-primary">Tip: </span>
          One Space holds Group or Family, every Mode, and all sessions. In a
          meeting, use Session for shared answers and Private for device-only
          notes that stay locked to the step you’re on. Prayer board is shared;
          header icon sets light/dark.
        </p>
      </Card>

      <Card className="space-y-3 border-primary/20">
        <div>
          <h3 className="text-base font-semibold text-primary">
            {BACKUP_HEADLINE}
          </h3>
          <p className="text-sm text-muted mt-1">
            Use one bookmark:{" "}
            <span className="font-medium text-text break-all">
              {PRODUCTION_URL}
            </span>
            . Full backup controls live under Settings.
          </p>
        </div>
        <ol className="space-y-2" aria-label="How to keep your Spaces safe">
          {BACKUP_STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-2.5 text-sm">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary tabular-nums"
                aria-hidden
              >
                {i + 1}
              </span>
              <span>
                <span className="font-medium text-primary">{step.title}. </span>
                <span className="text-muted">{step.detail}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted">{RESTORE_NOTE}</p>
        <Link
          to="/settings"
          className="inline-flex text-sm font-medium text-primary underline underline-offset-2 touch-manipulation"
        >
          Open Settings to back up
        </Link>
      </Card>

      <ul className="space-y-2" aria-label="Tutorial topics">
        {TUTORIAL_SECTIONS.map((section, index) => {
          const isOpen = openId === section.id;
          const panelId = `help-panel-${section.id}`;
          const buttonId = `help-btn-${section.id}`;

          return (
            <li key={section.id}>
              <Card padding="sm" className="!p-0 overflow-hidden">
                <button
                  type="button"
                  id={buttonId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggle(section.id)}
                  className="w-full flex items-start gap-3 text-left px-3.5 py-3.5 touch-manipulation tap-target hover:bg-surface-muted/40 transition-colors"
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary tabular-nums mt-0.5"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-primary block">
                      {section.title}
                    </span>
                    <span className="text-sm text-muted block mt-0.5">
                      {section.summary}
                    </span>
                  </span>
                  <ChevronDown
                    className={[
                      "h-5 w-5 shrink-0 text-muted mt-1 transition-transform",
                      isOpen ? "rotate-180" : "",
                    ].join(" ")}
                    aria-hidden
                  />
                </button>

                {isOpen && (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className="px-3.5 pb-4 pt-0 border-t border-border"
                  >
                    <ul className="space-y-2.5 pt-3 pl-10">
                      {section.body.map((para, i) => (
                        <li
                          key={i}
                          className="text-sm text-muted leading-relaxed list-disc ml-1"
                        >
                          <span className="text-text/90">{para}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ul>

      <Card className="space-y-2 text-sm text-muted">
        <p className="font-medium text-primary">Still stuck?</p>
        <p>
          Check Settings for sharing tools and the full privacy disclaimer.
          Your data stays on this device unless you export it yourself.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
          <Link
            to="/"
            className="font-medium text-primary underline-offset-2 hover:underline touch-manipulation py-2"
          >
            Your spaces
          </Link>
          <Link
            to="/bible"
            className="font-medium text-primary underline-offset-2 hover:underline touch-manipulation py-2"
          >
            Bible
          </Link>
          <Link
            to="/settings"
            className="font-medium text-primary underline-offset-2 hover:underline touch-manipulation py-2"
          >
            Settings
          </Link>
        </div>
      </Card>
    </div>
  );
}
