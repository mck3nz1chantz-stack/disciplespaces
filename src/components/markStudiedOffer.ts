/**
 * Offer to mark logged chapters studied. Does not mark them by itself.
 */

import { toast } from "sonner";
import { getBooks } from "../lib/bible";
import {
  chapterSpansFromPassages,
  formatChapterSpans,
  markChaptersStudied,
} from "../lib/chapterMarks";
import {
  formatQueueLabel,
  queueItemsCovering,
  removeQueueItems,
} from "../lib/studyQueue";
import type { Passage } from "../types";

/**
 * After a chapter is marked studied, ask before removing a matching queue row.
 * Does nothing when that chapter is not on what’s next. Dismissing leaves it.
 */
export async function offerTakeOffWhatsNext(
  spaceId: string,
  targets: Array<{ bookId: string; chapters: number[] }>,
): Promise<boolean> {
  if (!spaceId || targets.length === 0) return false;
  const hits = await queueItemsCovering(spaceId, targets);
  if (hits.length === 0) return false;
  const label = hits.map((hit) => formatQueueLabel(hit)).join(", ");
  toast.message("Take this off what’s next?", {
    description: `${label}. It stays until you tap.`,
    action: {
      label: "Take it off",
      onClick: () => {
        void removeQueueItems(hits.map((hit) => hit.id)).then(() => {
          toast.success("Taken off what’s next");
        });
      },
    },
  });
  return true;
}

export async function offerMarkTheseStudied(
  spaceId: string,
  passages: Passage[],
): Promise<void> {
  if (!spaceId || passages.length === 0) return;
  const books = await getBooks("kjv");
  const spans = chapterSpansFromPassages(passages, books);
  if (spans.length === 0) return;
  const summary = formatChapterSpans(spans);
  toast.message("Mark these studied?", {
    description: `${summary}. Nothing is marked until you tap.`,
    action: {
      label: "Mark these studied",
      onClick: () => {
        void markChaptersStudied(spaceId, spans).then(() => {
          toast.success(`${summary} marked studied`);
          void offerTakeOffWhatsNext(
            spaceId,
            spans.map((span) => ({
              bookId: span.bookId,
              chapters: span.chapters,
            })),
          );
        });
      },
    },
  });
}
