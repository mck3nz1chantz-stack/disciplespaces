/**
 * Chapters marked studied, per study. Local only.
 * Opening or scrolling a chapter does not write a row.
 * These rows are not part of a group room.
 */

import type { BibleBookMeta } from "./bible";
import { db } from "./db";
import type { ChapterMark, Passage } from "../types";

export type { ChapterMark };

export interface ChapterSpan {
  bookId: string;
  bookName: string;
  chapters: number[];
}

export function chapterMarkId(
  spaceId: string,
  bookId: string,
  chapter: number,
): string {
  return `${spaceId}|${bookId}|${chapter}`;
}

export async function setChapterStudied(opts: {
  spaceId: string;
  bookId: string;
  chapter: number;
  studied: boolean;
}): Promise<void> {
  const chapter = Math.round(opts.chapter);
  if (!opts.spaceId || !opts.bookId || chapter < 1) return;
  const id = chapterMarkId(opts.spaceId, opts.bookId, chapter);
  if (!opts.studied) {
    await db.chapterMarks.delete(id);
    return;
  }
  const existing = await db.chapterMarks.get(id);
  if (existing) return;
  await db.chapterMarks.put({
    id,
    spaceId: opts.spaceId,
    bookId: opts.bookId,
    chapter,
    markedAt: new Date().toISOString(),
  });
}

/** Add marks. Leaves chapters that are already marked, and their time, alone. */
export async function markChaptersStudied(
  spaceId: string,
  spans: ChapterSpan[],
): Promise<void> {
  if (!spaceId || spans.length === 0) return;
  const markedAt = new Date().toISOString();
  await db.transaction("rw", db.chapterMarks, async () => {
    for (const span of spans) {
      for (const chapter of span.chapters) {
        const id = chapterMarkId(spaceId, span.bookId, chapter);
        const existing = await db.chapterMarks.get(id);
        if (existing) continue;
        await db.chapterMarks.put({
          id,
          spaceId,
          bookId: span.bookId,
          chapter,
          markedAt,
        });
      }
    }
  });
}

function bookForPassage(
  passage: Passage,
  books: BibleBookMeta[],
): BibleBookMeta | undefined {
  const name = passage.book.trim().toLowerCase();
  if (!name) return undefined;
  return books.find(
    (book) =>
      book.name.toLowerCase() === name ||
      book.abbrev.toLowerCase() === name ||
      book.id === name,
  );
}

/** Chapters a logged passage covers. Does not mark them. */
export function chaptersFromPassage(
  passage: Passage | undefined,
  books: BibleBookMeta[],
): ChapterSpan | null {
  if (!passage) return null;
  const book = bookForPassage(passage, books);
  if (!book) return null;
  let start = Math.round(passage.startChapter);
  let end = Math.round(passage.endChapter || start);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (end < start) [start, end] = [end, start];
  start = Math.max(1, start);
  end = Math.min(book.chapterCount, end);
  if (end < start) return null;
  const chapters: number[] = [];
  for (let n = start; n <= end; n++) chapters.push(n);
  return { bookId: book.id, bookName: book.name, chapters };
}

export function chapterSpansFromPassages(
  passages: Passage[],
  books: BibleBookMeta[],
): ChapterSpan[] {
  const map = new Map<string, { bookName: string; chapters: Set<number> }>();
  for (const passage of passages) {
    const span = chaptersFromPassage(passage, books);
    if (!span) continue;
    const row = map.get(span.bookId) ?? {
      bookName: span.bookName,
      chapters: new Set<number>(),
    };
    for (const chapter of span.chapters) row.chapters.add(chapter);
    map.set(span.bookId, row);
  }
  return [...map.entries()].map(([bookId, row]) => ({
    bookId,
    bookName: row.bookName,
    chapters: [...row.chapters].sort((a, b) => a - b),
  }));
}

export function formatChapterSpans(spans: ChapterSpan[]): string {
  return spans
    .map((span) => {
      const first = span.chapters[0];
      const last = span.chapters[span.chapters.length - 1];
      if (span.chapters.length === 1) return `${span.bookName} ${first}`;
      const consecutive =
        span.chapters.length === last - first + 1 &&
        span.chapters.every((n, i) => n === first + i);
      return consecutive
        ? `${span.bookName} ${first}–${last}`
        : `${span.bookName} ${span.chapters.join(", ")}`;
    })
    .join(", ");
}
