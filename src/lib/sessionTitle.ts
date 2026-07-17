/**
 * Custom session titles + smart fallbacks for timeline navigation.
 * Existing sessions without `title` keep working (template / passage fallback).
 */

import type { Passage, Session, Template } from "../types";
import { formatPassageRef } from "./passages";

/** Max length for stored/display titles (keeps timeline scannable). */
export const SESSION_TITLE_MAX = 80;

/**
 * Suggest a title from the primary (first) passage, e.g. "Romans 13".
 * Optional short note suffix when the passage has contextNote.
 */
export function suggestTitleFromPassages(
  passages: Passage[] | undefined | null,
): string {
  const list = passages ?? [];
  if (list.length === 0) return "";
  const primary = list[0]!;
  const ref = formatPassageRef(primary);
  const note = primary.contextNote?.trim();
  if (note && note.length <= 40) {
    return clampTitle(`${ref} – ${note}`);
  }
  if (list.length === 1) return clampTitle(ref);
  return clampTitle(`${ref} +${list.length - 1} more`);
}

export function clampTitle(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ");
  if (t.length <= SESSION_TITLE_MAX) return t;
  return `${t.slice(0, SESSION_TITLE_MAX - 1).trimEnd()}…`;
}

/**
 * Label for lists and headers.
 * Priority: custom title → primary passage → template name → "Session".
 */
export function sessionDisplayTitle(
  session: Pick<Session, "title" | "passagesStudied">,
  template?: Template | null,
): string {
  const custom = session.title?.trim();
  if (custom) return custom;

  const fromPassages = suggestTitleFromPassages(session.passagesStudied);
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
