/**
 * What’s next for one study. Local only.
 * Opening the Next line does not remove a row.
 * These rows are not part of a group room.
 */

import { db } from "./db";
import type { StudyAim, StudyQueueItem } from "../types";

export type { StudyQueueItem };

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatQueueLabel(item: {
  bookName: string;
  chapter: number;
  startVerse?: number;
  endVerse?: number;
}): string {
  const book = item.bookName === "Psalms" ? "Psalm" : item.bookName;
  let label = `${book} ${item.chapter}`;
  if (item.startVerse && item.startVerse > 0) {
    const end =
      item.endVerse && item.endVerse !== item.startVerse
        ? `–${item.endVerse}`
        : "";
    label += `:${item.startVerse}${end}`;
  }
  return label;
}

/** "Dec 16" from yyyy-MM-dd. No year, no countdown. */
export function formatAimDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${MONTHS[month - 1]} ${day}`;
}

export function formatAimLine(aim: StudyAim): string {
  const where = formatQueueLabel(aim);
  const when = formatAimDate(aim.byDate);
  return when
    ? `Aim to be at ${where} by ${when}.`
    : `Aim to be at ${where}.`;
}

function sortQueue(rows: StudyQueueItem[]): StudyQueueItem[] {
  return [...rows].sort(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id),
  );
}

export async function addQueueItem(input: {
  spaceId: string;
  bookId: string;
  bookName: string;
  chapter: number;
  startVerse?: number;
  endVerse?: number;
}): Promise<void> {
  const chapter = Math.round(input.chapter);
  if (!input.spaceId || !input.bookId || chapter < 1) return;
  let start =
    input.startVerse != null ? Math.round(input.startVerse) : undefined;
  let end = input.endVerse != null ? Math.round(input.endVerse) : undefined;
  if (start != null && (!Number.isFinite(start) || start < 1)) start = undefined;
  if (end != null && (!Number.isFinite(end) || end < 1)) end = undefined;
  if (start != null && end != null && end < start) {
    const swap = start;
    start = end;
    end = swap;
  }
  if (start != null && end == null) end = start;
  if (start == null) end = undefined;

  await db.transaction("rw", db.studyQueue, async () => {
    const rows = await db.studyQueue
      .where("spaceId")
      .equals(input.spaceId)
      .toArray();
    const order = rows.reduce((max, row) => Math.max(max, row.order), -1) + 1;
    const item: StudyQueueItem = {
      id: crypto.randomUUID(),
      spaceId: input.spaceId,
      order,
      bookId: input.bookId,
      bookName: input.bookName.trim() || input.bookId,
      chapter,
    };
    if (start != null && end != null) {
      item.startVerse = start;
      item.endVerse = end;
    }
    await db.studyQueue.put(item);
  });
}

export async function removeQueueItems(ids: string[]): Promise<void> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return;
  const first = await db.studyQueue.get(unique[0]);
  if (!first) return;
  const spaceId = first.spaceId;
  await db.transaction("rw", db.studyQueue, async () => {
    await db.studyQueue.bulkDelete(unique);
    const rows = sortQueue(
      await db.studyQueue.where("spaceId").equals(spaceId).toArray(),
    );
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].order !== i) {
        await db.studyQueue.put({ ...rows[i], order: i });
      }
    }
  });
}

/** Swap with the neighbor. No drag. */
export async function moveQueueItem(
  id: string,
  direction: -1 | 1,
): Promise<void> {
  const row = await db.studyQueue.get(id);
  if (!row) return;
  await db.transaction("rw", db.studyQueue, async () => {
    const rows = sortQueue(
      await db.studyQueue.where("spaceId").equals(row.spaceId).toArray(),
    );
    const index = rows.findIndex((item) => item.id === id);
    const swap = index + direction;
    if (index < 0 || swap < 0 || swap >= rows.length) return;
    const a = rows[index];
    const b = rows[swap];
    await db.studyQueue.put({ ...a, order: b.order });
    await db.studyQueue.put({ ...b, order: a.order });
  });
}

/** Queue rows whose book and chapter were just marked studied. */
export async function queueItemsCovering(
  spaceId: string,
  targets: Array<{ bookId: string; chapters: number[] }>,
): Promise<StudyQueueItem[]> {
  if (!spaceId || targets.length === 0) return [];
  const wanted = new Map<string, Set<number>>();
  for (const target of targets) {
    const set = wanted.get(target.bookId) ?? new Set<number>();
    for (const chapter of target.chapters) {
      if (chapter >= 1) set.add(chapter);
    }
    if (set.size > 0) wanted.set(target.bookId, set);
  }
  if (wanted.size === 0) return [];
  const rows = await db.studyQueue.where("spaceId").equals(spaceId).toArray();
  return sortQueue(
    rows.filter((row) => wanted.get(row.bookId)?.has(row.chapter)),
  );
}
