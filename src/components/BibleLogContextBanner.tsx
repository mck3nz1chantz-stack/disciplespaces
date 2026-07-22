import { Link } from "react-router-dom";
import { BookMarked } from "lucide-react";
import { Card } from "./Card";
import { Button } from "./Button";
import { useBibleStore } from "../stores/useBibleStore";

interface BibleLogContextBannerProps {
  /** Open space picker / switcher */
  onSwitchSpace?: () => void;
  /** After clear: also strip URL params (caller owns URL). */
  onClear: () => void;
  /** Optional human label for a pre-selected session */
  sessionHint?: string | null;
}

/**
 * Shown when the Bible reader was opened with Space context (URL-driven).
 */
export function BibleLogContextBanner({
  onSwitchSpace,
  onClear,
  sessionHint,
}: BibleLogContextBannerProps) {
  const logContext = useBibleStore((s) => s.logContext);

  if (!logContext.spaceName || !logContext.spaceId) {
    return null;
  }

  return (
    <Card
      padding="sm"
      className="flex items-start gap-3 bg-primary/8 border-primary/20 backdrop-blur-sm"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <BookMarked className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-primary">
          Logging to {logContext.spaceName}
        </p>
        <p className="text-xs text-muted mt-0.5 leading-relaxed">
          Select verses, then log to a session.
          {sessionHint ? (
            <>
              {" "}
              <span className="text-primary/90 font-medium">{sessionHint}</span>
            </>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {onSwitchSpace && (
            <Button
              variant="secondary"
              className="!py-1.5 !px-2.5 text-xs"
              onClick={onSwitchSpace}
            >
              Switch
            </Button>
          )}
          <Button
            variant="ghost"
            className="!py-1.5 !px-2.5 text-xs"
            onClick={onClear}
          >
            Clear
          </Button>
          <Link
            to={`/space/${logContext.spaceId}`}
            className="inline-flex items-center text-xs font-medium text-primary underline-offset-2 hover:underline px-1.5 py-1.5"
          >
            Back to space
          </Link>
        </div>
      </div>
    </Card>
  );
}
