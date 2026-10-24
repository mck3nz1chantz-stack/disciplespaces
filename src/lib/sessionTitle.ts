/**
 * Custom session titles + smart fallbacks for timeline navigation.
 * Existing sessions without `title` keep working (template / passage fallback).
 */

import type { Passage, Session, Template } from "../types";
import { BIBLE_BOOK_NAMES, formatPassageRef } from "./passages";

const BOOKS_BY_LENGTH = [...BIBLE_BOOK_NAMES].sort((a, b) => b.length - a.length);

/** Max length for stored/display titles (keeps timeline scannable). */
export const SESSION_TITLE_MAX = 80;

/**
 * Default session name: the latest logged passage, e.g. "Daniel 12".
 * Passages are stored in log order, so the last row is the latest.
 */
export function suggestTitleFromPassages(
  passages: Passage[] | undefined | null,
): string {
  const list = passages ?? [];
  if (list.length === 0) return "";
  const latest = list[list.length - 1]!;
  return clampTitle(formatPassageRef(latest));
}

/**
 * True when the stored name is still a passage label, not a recap the
 * leader typed. Covers the plain ref and older labels like "Daniel 11 +2 more".
 */
export function titleTracksPassages(
  title: string | undefined | null,
  passages: Passage[] | undefined | null,
): boolean {
  const current = title?.trim() ?? "";
  if (!current) return true;
  for (const passage of passages ?? []) {
    const ref = formatPassageRef(passage).trim();
    if (!ref) continue;
    if (current === ref) return true;
    if (current.startsWith(`${ref} +`)) return true;
    if (current.startsWith(`${ref} –`) || current.startsWith(`${ref} -`)) {
      return true;
    }
  }
  return false;
}

/** A stored name that is itself a scripture reference, such as "Daniel 11". */
export function titleLooksLikePassage(
  title: string | undefined | null,
): boolean {
  const current = title?.trim().toLowerCase() ?? "";
  if (!current) return false;
  return BOOKS_BY_LENGTH.some((name) => {
    const book = name.toLowerCase();
    if (current === book) return true;
    if (!current.startsWith(`${book} `)) return false;
    const rest = current.slice(book.length).trim();
    return /^\d/.test(rest);
  });
}

/**
 * The name should follow the latest passage when it is blank, still a logged
 * reference, or an old reference that was removed (for example "Daniel 11").
 */
export function titleShouldFollowLatest(
  title: string | undefined | null,
  passages: Passage[] | undefined | null,
): boolean {
  const current = title?.trim() ?? "";
  if (!current) return (passages?.length ?? 0) > 0;
  if (titleTracksPassages(current, passages)) return true;
  return titleLooksLikePassage(current);
}

export function clampTitle(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ");
  if (t.length <= SESSION_TITLE_MAX) return t;
  return `${t.slice(0, SESSION_TITLE_MAX - 1).trimEnd()}…`;
}

/**
 * Label for lists and headers.
 * Priority: custom title → latest passage → template name → "Session".
 */
export function sessionDisplayTitle(
  session: Pick<Session, "title" | "passagesStudied">,
  template?: Template | null,
): string {
  const stored = session.title?.trim() ?? "";
  const latest = suggestTitleFromPassages(session.passagesStudied);
  if (titleShouldFollowLatest(stored, session.passagesStudied)) {
    if (latest) return latest;
  } else if (stored) {
    return stored;
  }

  const fromPassages = latest;
  if (fromPassages) return fromPassages;

  const tpl = template?.name?.trim();
  if (tpl) return tpl;

  return "Session";
}

/** Subtitle under the main title (date row companion). */
export function sessionTitleSubtitle(
  session: Pick<Session, "title" | "passagesStudied">,
  template?: Template | null,
): string | null {
  const custom = session.title?.trim();
  const tpl = template?.name?.trim();
  if (custom && tpl && custom !== tpl) return tpl;
  // Custom title already showing; if passages exist and title isn't just the ref, show template only
  if (custom) return tpl && custom !== tpl ? tpl : null;
  // Showing passage or template as main — no extra subtitle needed for template
  if (suggestTitleFromPassages(session.passagesStudied) && tpl) return tpl;
  return null;
}
