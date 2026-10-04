import type { Passage, WeekReading } from "../types";
import { getBooks, type BibleVerse } from "./bible";

/** Plain label, e.g. "John 3:16–18" or "John 3". */
export function formatWeekReading(r: WeekReading): string {
  const book = r.book.trim();
  const ch = r.chapter;
  const sv = r.startVerse;
  const ev = r.endVerse;
  if (sv != null && ev != null && sv !== ev) return `${book} ${ch}:${sv}–${ev}`;
  if (sv != null) return `${book} ${ch}:${sv}`;
  return `${book} ${ch}`;
}

/**
 * One passage: "John 3", "John 3:16", or "John 3:16-18" (hyphen or en dash).
 * Empty input is null. Unrecognized text is null.
 */
export async function parseWeekPassage(
  input: string,
): Promise<WeekReading | null> {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(
    /^(\d?\s*[A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+)(?::(\d+)(?:\s*[–-]\s*(\d+))?)?$/,
  );
  if (!match) return null;

  const bookPart = match[1].replace(/\s+/g, " ").trim().toLowerCase();
  const chapter = parseInt(match[2], 10);
  const startVerse = match[3] ? parseInt(match[3], 10) : undefined;
  let endVerse = match[4] ? parseInt(match[4], 10) : startVerse;
  if (!Number.isFinite(chapter) || chapter < 1) return null;

  const books = await getBooks();
  const book = books.find((b) => {
    const name = b.name.toLowerCase();
    const abbrev = b.abbrev.toLowerCase();
    const id = b.id.replace(/-/g, " ");
    return (
      name === bookPart ||
      abbrev === bookPart ||
      id === bookPart ||
      name.startsWith(bookPart) ||
      abbrev.startsWith(bookPart)
    );
  });
  if (!book || chapter > book.chapterCount) return null;

  let sv = startVerse;
  let ev = endVerse;
  if (sv != null && (!Number.isFinite(sv) || sv < 1)) return null;
  if (ev != null && (!Number.isFinite(ev) || ev < 1)) return null;
  if (sv != null && ev != null && ev < sv) {
    const swap = sv;
    sv = ev;
    ev = swap;
  }

  return {
    book: book.name,
    bookId: book.id,
    chapter,
    startVerse: sv,
    endVerse: sv != null ? ev : undefined,
  };
}

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
