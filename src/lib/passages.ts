import type { Passage } from "../types";
import type { BibleVerse } from "./bible";

/** Human-readable scripture reference for a Passage. */
export function formatPassageRef(p: Passage): string {
  const book = p.book;
  const sameChapter = p.startChapter === p.endChapter;

  if (sameChapter) {
    const ch = p.startChapter;
    const sv = p.startVerse;
    const ev = p.endVerse;
    if (sv != null && ev != null) {
      if (sv === ev) return `${book} ${ch}:${sv}`;
      return `${book} ${ch}:${sv}–${ev}`;
    }
    if (sv != null) return `${book} ${ch}:${sv}`;
    return `${book} ${ch}`;
  }

  const start =
    p.startVerse != null
      ? `${p.startChapter}:${p.startVerse}`
      : `${p.startChapter}`;
  const end =
    p.endVerse != null ? `${p.endChapter}:${p.endVerse}` : `${p.endChapter}`;
  return `${book} ${start}–${end}`;
}

/** Build a Passage from a verse selection (same book; range within or across chapters). */
export function passageFromSelection(opts: {
  bookName: string;
  startChapter: number;
  startVerse: number;
  endChapter: number;
  endVerse: number;
  contextNote?: string;
}): Passage {
  let {
    bookName,
    startChapter,
    startVerse,
    endChapter,
    endVerse,
    contextNote,
  } = opts;

  // Normalize order
  if (
    endChapter < startChapter ||
    (endChapter === startChapter && endVerse < startVerse)
  ) {
    [startChapter, endChapter] = [endChapter, startChapter];
    [startVerse, endVerse] = [endVerse, startVerse];
  }

  return {
    id: crypto.randomUUID(),
    book: bookName,
    startChapter,
    startVerse,
    endChapter,
    endVerse,
    contextNote: contextNote?.trim() || undefined,
  };
}

export function passageFromVerse(
  verse: BibleVerse,
  contextNote?: string,
): Passage {
  return passageFromSelection({
    bookName: verse.bookName,
    startChapter: verse.chapter,
    startVerse: verse.verse,
    endChapter: verse.chapter,
    endVerse: verse.verse,
    contextNote,
  });
}

/** Compare two passages for equality (ignore note). */
export function passagesEqual(a: Passage, b: Passage): boolean {
  return (
    a.book === b.book &&
    a.startChapter === b.startChapter &&
    a.endChapter === b.endChapter &&
    (a.startVerse ?? null) === (b.startVerse ?? null) &&
    (a.endVerse ?? null) === (b.endVerse ?? null)
  );
}

/** Canonical KJV book names for manual passage entry (offline, no fetch). */
export const BIBLE_BOOK_NAMES: string[] = [
  "Genesis",
  "Exodus",
  "Leviticus",
  "Numbers",
  "Deuteronomy",
  "Joshua",
  "Judges",
  "Ruth",
  "1 Samuel",
  "2 Samuel",
  "1 Kings",
  "2 Kings",
  "1 Chronicles",
  "2 Chronicles",
  "Ezra",
  "Nehemiah",
  "Esther",
  "Job",
  "Psalms",
  "Proverbs",
  "Ecclesiastes",
  "Song of Solomon",
  "Isaiah",
  "Jeremiah",
  "Lamentations",
  "Ezekiel",
  "Daniel",
  "Hosea",
  "Joel",
  "Amos",
  "Obadiah",
  "Jonah",
  "Micah",
  "Nahum",
  "Habakkuk",
  "Zephaniah",
  "Haggai",
  "Zechariah",
  "Malachi",
  "Matthew",
  "Mark",
  "Luke",
  "John",
  "Acts",
  "Romans",
  "1 Corinthians",
  "2 Corinthians",
  "Galatians",
  "Ephesians",
  "Philippians",
  "Colossians",
  "1 Thessalonians",
  "2 Thessalonians",
  "1 Timothy",
  "2 Timothy",
  "Titus",
  "Philemon",
  "Hebrews",
  "James",
  "1 Peter",
  "2 Peter",
  "1 John",
  "2 John",
  "3 John",
  "Jude",
  "Revelation",
];

/** Manual empty passage draft for forms. */
export function emptyPassageDraft(book = "John"): Passage {
  return {
    id: crypto.randomUUID(),
    book,
    startChapter: 1,
    startVerse: 1,
    endChapter: 1,
    endVerse: 1,
  };
}

/** Ensure every passage has a stable id (legacy rows / imports). */
export function ensurePassageIds(passages: Passage[]): Passage[] {
  let changed = false;
  const next = passages.map((p) => {
    if (p.id) return p;
    changed = true;
    return { ...p, id: crypto.randomUUID() };
  });
  return changed ? next : passages;
}

export function isValidPassage(p: Passage): boolean {
  if (!p.book.trim()) return false;
  if (p.startChapter < 1 || p.endChapter < 1) return false;
  if (p.startVerse != null && p.startVerse < 1) return false;
  if (p.endVerse != null && p.endVerse < 1) return false;
  if (p.endChapter < p.startChapter) return false;
  if (
    p.startChapter === p.endChapter &&
    p.startVerse != null &&
    p.endVerse != null &&
    p.endVerse < p.startVerse
  ) {
    return false;
  }
  return true;
}
