import type { BibleVersionId } from "./bible";
import type { PrivateNote, VerseAnchor } from "../types";

export function makeVerseKey(anchor: {
  version: BibleVersionId;
  bookId: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
}): string {
  const start = Math.min(anchor.startVerse, anchor.endVerse);
  const end = Math.max(anchor.startVerse, anchor.endVerse);
  return `${anchor.version}|${anchor.bookId}|${anchor.chapter}|${start}|${end}`;
}

export function verseAnchor(input: {
  version: BibleVersionId;
  bookId: string;
  bookName: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
}): VerseAnchor {
  const startVerse = Math.min(input.startVerse, input.endVerse);
  const endVerse = Math.max(input.startVerse, input.endVerse);
  return {
    version: input.version,
    bookId: input.bookId,
    bookName: input.bookName,
    chapter: input.chapter,
    startVerse,
    endVerse,
  };
}

/** John 3:16 or John 3:16–18 */
export function formatVerseTitle(anchor: VerseAnchor): string {
  const range =
    anchor.startVerse === anchor.endVerse
      ? `${anchor.chapter}:${anchor.startVerse}`
      : `${anchor.chapter}:${anchor.startVerse}–${anchor.endVerse}`;
  return `${anchor.bookName} ${range}`;
}

export function noteSortTime(note: PrivateNote): string {
  return note.updatedAt || note.createdAt;
}

export function noteListTitle(note: PrivateNote): string {
  if (note.verse) return formatVerseTitle(note.verse);
  const line = note.content
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean);
  if (line) return line.length > 80 ? `${line.slice(0, 77)}…` : line;
  const day = (note.createdAt || "").slice(0, 10);
  return day ? `Note ${day}` : "Note";
}

/** Smallest range that contains this verse, if any. */
export function noteCoveringVerse(
  notes: PrivateNote[],
  verse: number,
): PrivateNote | undefined {
  const hits = notes.filter(
    (n) =>
      n.verse &&
      verse >= n.verse.startVerse &&
      verse <= n.verse.endVerse,
  );
  hits.sort((a, b) => {
    const aw = a.verse!.endVerse - a.verse!.startVerse;
    const bw = b.verse!.endVerse - b.verse!.startVerse;
    return aw - bw;
  });
  return hits[0];
}
