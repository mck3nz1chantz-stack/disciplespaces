import { BookMarked, ChevronRight } from "lucide-react";
import type { Passage } from "../types";
import { formatPassageRef } from "../lib/passages";
import { Card } from "./Card";

interface SessionPassageTrailProps {
  passages: Passage[];
  /** Current chapter context for subtle “here” label */
  currentBookName?: string;
  currentChapter?: number;
  onJump: (passage: Passage) => void;
  compact?: boolean;
}

/**
 * Tonight’s logged passages — jump back into the text without leaving study.
 */
export function SessionPassageTrail({
  passages,
  currentBookName,
  currentChapter,
  onJump,
  compact = false,
}: SessionPassageTrailProps) {
  if (passages.length === 0) return null;

  return (
    <Card
      padding="sm"
      className={[
        "space-y-2 bg-surface/80",
        compact ? "border-border/60" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-1.5 px-0.5">
        <BookMarked className="h-3.5 w-3.5 text-primary/80" aria-hidden />
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
          Tonight’s passages
        </p>
        <span className="text-[11px] text-muted tabular-nums">
          ({passages.length})
        </span>
      </div>
      <ul className="flex flex-wrap gap-1.5" aria-label="Passages studied tonight">
        {passages.map((p, i) => {
          const ref = formatPassageRef(p);
          const isHere =
            currentBookName != null &&
            currentChapter != null &&
            p.book.toLowerCase() === currentBookName.toLowerCase() &&
            p.startChapter <= currentChapter &&
            p.endChapter >= currentChapter;
          return (
            <li key={p.id ?? `${ref}-${i}`}>
              <button
                type="button"
                onClick={() => onJump(p)}
                className={[
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-medium touch-manipulation",
                  isHere
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-bg/80 text-primary hover:border-primary/30",
                ].join(" ")}
              >
                <span className="font-serif">{ref}</span>
                <ChevronRight className="h-3 w-3 opacity-50" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
