import { Download, Upload, ShieldCheck } from "lucide-react";
import { Card } from "./Card";
import { Button } from "./Button";
import {
  BACKUP_BODY,
  BACKUP_HEADLINE,
  BACKUP_STEPS,
  PRODUCTION_URL,
  RESTORE_NOTE,
} from "../lib/legal";

interface DataBackupCardProps {
  /** Number of Spaces on this device (for CTA copy). */
  spaceCount?: number;
  onBackup: () => void;
  /** Open restore flow (import DSX1. package or file). */
  onImport: () => void;
  /**
   * full = Settings (all steps + CTAs)
   * compact = Dashboard / home teaser
   */
  variant?: "full" | "compact";
}

/**
 * Always-visible data confidence guide: local storage + backup / restore.
 */
export function DataBackupCard({
  spaceCount = 0,
  onBackup,
  onImport,
  variant = "full",
}: DataBackupCardProps) {
  if (variant === "compact") {
    return (
      <Card className="space-y-3 border-primary/20 bg-primary/5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-primary text-sm">
              Your data stays on this device
            </p>
            <p className="text-xs text-muted mt-0.5 leading-relaxed">
              Bookmark{" "}
              <span className="font-medium text-text break-all">
                {PRODUCTION_URL}
              </span>
              . Back up or restore Spaces anytime from here or Settings.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            fullWidth
            className="!py-2.5"
            onClick={onBackup}
            disabled={spaceCount === 0}
          >
            <Download className="h-4 w-4" aria-hidden />
            Back up
          </Button>
          <Button
            variant="secondary"
            fullWidth
            className="!py-2.5"
            onClick={onImport}
          >
            <Upload className="h-4 w-4" aria-hidden />
            Import
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-3 border-primary/25 bg-primary/5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-primary">
            {BACKUP_HEADLINE}
          </h3>
          <p className="text-sm text-muted mt-1 leading-relaxed">{BACKUP_BODY}</p>
        </div>
      </div>

      <ol className="space-y-2.5" aria-label="How to keep your Spaces safe">
        {BACKUP_STEPS.map((step, i) => (
          <li
            key={step.title}
            className="flex gap-3 rounded-xl border border-border/80 bg-bg/80 px-3 py-2.5"
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary tabular-nums"
              aria-hidden
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-primary">{step.title}</p>
              <p className="text-xs text-muted mt-0.5 leading-relaxed">
                {step.detail}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <p className="text-xs text-muted leading-relaxed">{RESTORE_NOTE}</p>

      <div className="flex flex-col gap-2">
        <Button fullWidth onClick={onImport}>
          <Upload className="h-5 w-5" aria-hidden />
          Import previous data
        </Button>
        <Button
          variant="secondary"
          fullWidth
          onClick={onBackup}
          disabled={spaceCount === 0}
        >
          <Download className="h-5 w-5" aria-hidden />
          {spaceCount === 0
            ? "Create a Space first to back up"
            : "Back up Spaces now"}
        </Button>
        {spaceCount > 1 && (
          <p className="text-xs text-muted text-center">
            Download once per Space when backing up ({spaceCount} on this
            device).
          </p>
        )}
        {spaceCount === 0 && (
          <p className="text-xs text-muted text-center">
            Restoring? Use Import previous data with a DSX1. backup file.
          </p>
        )}
      </div>
    </Card>
  );
}
