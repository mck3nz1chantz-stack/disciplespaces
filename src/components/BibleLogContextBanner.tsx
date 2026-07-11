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
      className="flex items-start gap-3 bg-primary/5 border-primary/20"
    >
      <BookMarked
        className="h-5 w-5 text-primary shrink-0 mt-0.5"
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-primary">
          Logging to: {logContext.spaceName}
        </p>
        <p className="text-xs text-muted mt-0.5">
          Tap verses to select a range, then log to a session in this space.
          {sessionHint ? (
            <>
              {" "}
              <span className="text-primary/90">Session: {sessionHint}</span>
            </>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          {onSwitchSpace && (
            <Button
              variant="secondary"
              className="!py-2 !px-3 text-sm"
              onClick={onSwitchSpace}
            >
              Switch space
            </Button>
          )}
          <Button
            variant="ghost"
            className="!py-2 !px-3 text-sm"
            onClick={onClear}
          >
            Clear
          </Button>
          <Link
            to={`/space/${logContext.spaceId}`}
            className="inline-flex items-center text-sm font-medium text-primary underline-offset-2 hover:underline px-1 py-2"
          >
            Back to space
          </Link>
        </div>
      </div>
    </Card>
  );
}
