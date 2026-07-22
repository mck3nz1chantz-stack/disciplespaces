/**
 * Offline public-domain Bible loader.
 * - KJV: public/data/bible/*.json
 * - WEB: public/data/bible/web/*.json (World English Bible)
 * Only free, no-registration translations. Never paywalled Bibles.
 */

export type Testament = "OT" | "NT";

/** Supported offline Bible editions (public domain only). */
export type BibleVersionId = "kjv" | "web";

export const BIBLE_VERSIONS: Array<{
  id: BibleVersionId;
  label: string;
  shortLabel: string;
  notice: string;
}> = [
  {
    id: "kjv",
    label: "King James Version",
    shortLabel: "KJV",
    notice: "Public domain King James Version (KJV).",
  },
  {
    id: "web",
    label: "World English Bible",
    shortLabel: "WEB",
    notice:
      "Public domain World English Bible (WEB). Modern English · no registration.",
  },
];

export function normalizeBibleVersion(value: unknown): BibleVersionId {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  if (v === "web") return "web";
  return "kjv";
}

export function bibleVersionMeta(id: BibleVersionId) {
  return BIBLE_VERSIONS.find((v) => v.id === id) ?? BIBLE_VERSIONS[0]!;
}

function dataBaseForVersion(version: BibleVersionId): string {
  return version === "web" ? "/data/bible/web" : "/data/bible";
}

export interface BibleBookMeta {
  id: string;
  name: string;
  abbrev: string;
  testament: Testament;
  chapterCount: number;
  order: number;
}

export interface BibleIndex {
  version: string;
  translation: string;
  publicDomain: boolean;
  bookCount: number;
  verseCountApprox: number;
  books: BibleBookMeta[];
}

/** Book payload: chapters[chapterIndex][verseIndex] = verse text (0-based). */
export interface BibleBook {
  id: string;
  name: string;
  abbrev: string;
  testament: Testament;
  chapters: string[][];
}

export interface BibleVerse {
  bookId: string;
  bookName: string;
  bookAbbrev: string;
  chapter: number; // 1-based
  verse: number; // 1-based
  text: string;
  /** Which edition this verse text came from. */
  version?: BibleVersionId;
}

export interface ChapterData {
  book: BibleBookMeta;
  chapter: number; // 1-based
  verses: BibleVerse[];
  version: BibleVersionId;
}

const indexCache = new Map<BibleVersionId, Promise<BibleIndex>>();
const bookCache = new Map<string, Promise<BibleBook>>();

const POSITION_KEY = "ds-bible-position-v1";
const VERSION_KEY = "ds-bible-version-v1";

export interface ReadingPosition {
  bookId: string;
  chapter: number;
  /** Display label cached for “Continue reading” without loading the index. */
  bookName?: string;
  updatedAt?: string;
}

export function loadReadingVersion(): BibleVersionId {
  try {
    return normalizeBibleVersion(localStorage.getItem(VERSION_KEY));
  } catch {
    return "kjv";
  }
}

export function saveReadingVersion(version: BibleVersionId): void {
  try {
    localStorage.setItem(VERSION_KEY, version);
  } catch {
    // ignore
  }
}

export function loadBibleIndex(
  version: BibleVersionId = "kjv",
): Promise<BibleIndex> {
  const v = normalizeBibleVersion(version);
  const existing = indexCache.get(v);
  if (existing) return existing;

  const promise = fetch(`${dataBaseForVersion(v)}/index.json`)
    .then(async (res) => {
      if (!res.ok) throw new Error(`Could not load Bible index (${v})`);
      return (await res.json()) as BibleIndex;
    })
    .catch((err) => {
      indexCache.delete(v);
      throw err;
    });

  indexCache.set(v, promise);
  return promise;
}

export function loadBook(
  bookId: string,
  version: BibleVersionId = "kjv",
): Promise<BibleBook> {
  const v = normalizeBibleVersion(version);
  const key = `${v}:${bookId}`;
  const existing = bookCache.get(key);
  if (existing) return existing;

  const promise = fetch(`${dataBaseForVersion(v)}/${bookId}.json`)
    .then(async (res) => {
      if (!res.ok) throw new Error(`Could not load book: ${bookId} (${v})`);
      return (await res.json()) as BibleBook;
    })
    .catch((err) => {
      bookCache.delete(key);
      throw err;
    });

  bookCache.set(key, promise);
  return promise;
}

export async function getBooks(
  version: BibleVersionId = "kjv",
): Promise<BibleBookMeta[]> {
  const index = await loadBibleIndex(version);
  return index.books;
}

export async function getBookMeta(
  bookId: string,
  version: BibleVersionId = "kjv",
): Promise<BibleBookMeta | undefined> {
  const books = await getBooks(version);
  return books.find((b) => b.id === bookId);
}

/** Load a 1-based chapter with structured verses. */
export async function getChapter(
  bookId: string,
  chapter: number,
  version: BibleVersionId = "kjv",
): Promise<ChapterData> {
  const v = normalizeBibleVersion(version);
  const [meta, book] = await Promise.all([
    getBookMeta(bookId, v),
    loadBook(bookId, v),
  ]);
  if (!meta) throw new Error(`Unknown book: ${bookId}`);
  if (chapter < 1 || chapter > book.chapters.length) {
    throw new Error(`Chapter ${chapter} out of range for ${meta.name}`);
  }

  const verseTexts = book.chapters[chapter - 1] ?? [];
  const verses: BibleVerse[] = verseTexts.map((text, i) => ({
    bookId: book.id,
    bookName: book.name,
    bookAbbrev: book.abbrev,
    chapter,
    verse: i + 1,
    text,
    version: v,
  }));

  return { book: meta, chapter, verses, version: v };
}

export function formatReference(v: Pick<BibleVerse, "bookName" | "chapter" | "verse">): string {
  return `${v.bookName} ${v.chapter}:${v.verse}`;
}

export interface SearchOptions {
  /** Limit to one book id, or search all when omitted. */
  bookId?: string;
  /**
   * When searching whole Bible, boost hits from this book
   * (e.g. the chapter the user is currently reading).
   */
  preferBookId?: string;
  /** Max hits to return (default 50). */
  limit?: number;
  signal?: AbortSignal;
}

export type SearchMatchType =
  | "exact-phrase"
  | "all-words"
  | "partial"
  | "reference";

export interface SearchHit extends BibleVerse {
  score: number;
  matchType: SearchMatchType;
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "is",
  "are",
  "be",
  "by",
  "as",
  "at",
  "it",
  "he",
  "she",
  "they",
  "we",
  "you",
  "his",
  "her",
  "their",
  "with",
  "from",
  "that",
  "this",
  "was",
  "were",
  "shall",
  "unto",
  "thy",
  "thou",
  "ye",
  "not",
]);

function tokenizeQuery(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Score a verse for relevance against a normalized query + tokens.
 * Higher = better. Returns 0 if the verse should not appear.
 */
export function scoreVerseMatch(
  text: string,
  queryLower: string,
  tokens: string[],
): { score: number; matchType: SearchMatchType } | null {
  const lower = text.toLowerCase();
  let score = 0;
  let matchType: SearchMatchType = "partial";

  const hasPhrase = queryLower.length >= 2 && lower.includes(queryLower);

  if (hasPhrase) {
    score += 120;
    matchType = "exact-phrase";
    // Phrase near the start of the verse
    const idx = lower.indexOf(queryLower);
    if (idx === 0) score += 25;
    else if (idx > 0 && idx < 24) score += 12;
    // Compact verses where the phrase dominates
    if (text.length <= queryLower.length + 40) score += 15;
  }

  let tokenHits = 0;
  let wordBoundaryHits = 0;
  for (const t of tokens) {
    if (!lower.includes(t)) continue;
    tokenHits += 1;
    const re = new RegExp(`\\b${escapeRegExp(t)}\\b`, "i");
    if (re.test(text)) {
      wordBoundaryHits += 1;
      score += 14;
    } else {
      score += 5;
    }
  }

  if (!hasPhrase && tokenHits === 0) return null;
  if (!hasPhrase && tokens.length > 0 && tokenHits < Math.min(tokens.length, 2) && tokens.length >= 2) {
    // Require at least 2 tokens when multi-word (unless phrase matched)
    if (tokenHits < 2) return null;
  }

  if (tokens.length > 1 && tokenHits === tokens.length) {
    score += 45;
    if (matchType !== "exact-phrase") matchType = "all-words";
  } else if (tokenHits > 0 && matchType !== "exact-phrase") {
    matchType = tokenHits === tokens.length ? "all-words" : "partial";
  }

  // Coverage density: reward when many tokens hit a short verse
  if (tokens.length > 0) {
    const coverage = tokenHits / tokens.length;
    score += Math.round(coverage * 20);
  }

  // Prefer slightly shorter verses (tighter match feel)
  score += Math.max(0, 18 - Math.floor(text.length / 50));

  // Bonus for word-boundary density
  score += wordBoundaryHits * 2;

  return { score, matchType };
}

/**
 * Relevance-ranked client-side verse search.
 * - Exact phrase matches rank highest
 * - Multi-word queries prefer verses containing all meaningful tokens
 * - Optional preferBookId boosts the book the user is reading
 * - When bookId is set, search is limited to that book
 */
export async function searchVerses(
  query: string,
  options: SearchOptions & { version?: BibleVersionId } = {},
): Promise<SearchHit[]> {
  const qRaw = query.trim();
  const q = qRaw.toLowerCase();
  if (q.length < 2) return [];

  const version = normalizeBibleVersion(options.version ?? "kjv");
  const tokens = tokenizeQuery(qRaw);
  const limit = options.limit ?? 50;
  const books = await getBooks(version);
  const targets = options.bookId
    ? books.filter((b) => b.id === options.bookId)
    : books;

  const hits: SearchHit[] = [];

  for (const meta of targets) {
    if (options.signal?.aborted) break;
    const book = await loadBook(meta.id, version);
    const bookBoost =
      options.preferBookId && options.preferBookId === book.id ? 55 : 0;

    for (let c = 0; c < book.chapters.length; c++) {
      const chapter = book.chapters[c];
      for (let v = 0; v < chapter.length; v++) {
        const text = chapter[v];
        const scored = scoreVerseMatch(text, q, tokens);
        if (!scored) continue;

        hits.push({
          bookId: book.id,
          bookName: book.name,
          bookAbbrev: book.abbrev,
          chapter: c + 1,
          verse: v + 1,
          text,
          version,
          score: scored.score + bookBoost,
          matchType: scored.matchType,
        });
      }
    }
  }

  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Stable canonical order for ties
    if (a.bookId !== b.bookId) return a.bookName.localeCompare(b.bookName);
    if (a.chapter !== b.chapter) return a.chapter - b.chapter;
    return a.verse - b.verse;
  });

  return hits.slice(0, limit);
}

/** Parse simple refs like "John 3:16", "Gen 1", "psalm 23:1-3" (first verse). */
export async function parseReference(
  input: string,
): Promise<{ bookId: string; chapter: number; verse?: number } | null> {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const match = trimmed.match(
    /^(\d?\s*[A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+)(?::(\d+))?/,
  );
  if (!match) return null;

  const bookPart = match[1].replace(/\s+/g, " ").trim().toLowerCase();
  const chapter = parseInt(match[2], 10);
  const verse = match[3] ? parseInt(match[3], 10) : undefined;

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

  if (!book) return null;
  if (chapter < 1 || chapter > book.chapterCount) return null;
  return { bookId: book.id, chapter, verse };
}

export function loadReadingPosition(): ReadingPosition | null {
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReadingPosition;
    if (
      typeof parsed.bookId === "string" &&
      typeof parsed.chapter === "number" &&
      parsed.chapter >= 1
    ) {
      return {
        bookId: parsed.bookId,
        chapter: parsed.chapter,
        bookName:
          typeof parsed.bookName === "string" ? parsed.bookName : undefined,
        updatedAt:
          typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveReadingPosition(pos: ReadingPosition): void {
  try {
    const payload: ReadingPosition = {
      bookId: pos.bookId,
      chapter: pos.chapter,
      bookName: pos.bookName,
      updatedAt: pos.updatedAt ?? new Date().toISOString(),
    };
    localStorage.setItem(POSITION_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

/** Human label for continue cards — prefers cached book name. */
export function formatReadingPositionLabel(pos: ReadingPosition): string {
  const name = pos.bookName?.trim() || pos.bookId;
  return `${name} ${pos.chapter}`;
}

export function groupBooksByTestament(books: BibleBookMeta[]): {
  ot: BibleBookMeta[];
  nt: BibleBookMeta[];
} {
  return {
    ot: books.filter((b) => b.testament === "OT"),
    nt: books.filter((b) => b.testament === "NT"),
  };
}

/**
 * Highlight query matches in verse text.
 * Prefers exact phrase; falls back to token highlights for multi-word queries.
 */
export function splitHighlight(
  text: string,
  query: string,
): Array<{ text: string; match: boolean }> {
  const q = query.trim();
  if (!q) return [{ text, match: false }];

  const lower = text.toLowerCase();
  const qLower = q.toLowerCase();

  // Prefer whole-phrase highlights when present
  if (lower.includes(qLower)) {
    const parts: Array<{ text: string; match: boolean }> = [];
    let start = 0;
    let idx = lower.indexOf(qLower, start);
    while (idx !== -1) {
      if (idx > start) {
        parts.push({ text: text.slice(start, idx), match: false });
      }
      parts.push({ text: text.slice(idx, idx + q.length), match: true });
      start = idx + q.length;
      idx = lower.indexOf(qLower, start);
    }
    if (start < text.length) {
      parts.push({ text: text.slice(start), match: false });
    }
    return parts.length ? parts : [{ text, match: false }];
  }

  // Token-based highlight ranges
  const tokens = tokenizeQuery(q);
  if (tokens.length === 0) return [{ text, match: false }];

  const ranges: Array<{ start: number; end: number }> = [];
  for (const t of tokens) {
    const re = new RegExp(escapeRegExp(t), "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      ranges.push({ start: m.index, end: m.index + m[0].length });
    }
  }
  if (ranges.length === 0) return [{ text, match: false }];

  ranges.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ ...r });
    }
  }

  const parts: Array<{ text: string; match: boolean }> = [];
  let cursor = 0;
  for (const r of merged) {
    if (r.start > cursor) {
      parts.push({ text: text.slice(cursor, r.start), match: false });
    }
    parts.push({ text: text.slice(r.start, r.end), match: true });
    cursor = r.end;
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), match: false });
  }
  return parts;
}
