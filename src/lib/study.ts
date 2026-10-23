/**
 * Local study layer on top of a Space.
 * Color, role, and reading place stay on this phone. They are not room fields.
 * ensureStudies adds My study and hues. It does not delete groups.
 */

import type { Space, StudyReadingPlace } from "../types";
import { loadReadingPosition, loadReadingVersion } from "./bible";
import { db } from "./db";
import { deriveInviteCode } from "./invite";
import { defaultSpaceSync } from "./sync/defaults";

export const PERSONAL_STUDY_ID = "study-personal";
export const PERSONAL_HUE = 42;
export const CLOSE_HUE = 18;
export const ACTIVE_STUDY_KEY = "ds-active-study-v1";

/** First free hues: red, blue, then spread around the wheel. */
const HUE_ANCHORS = [
  0, 220, 140, 280, 320, 180, 90, 30, 250, 50, 200, 160, 120, 300, 20, 70,
];

const placeWriteToken = new Map<string, number>();

export function normalizeHue(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return ((Math.round(n) % 360) + 360) % 360;
}

export function hueDistance(a: number, b: number): number {
  const d = Math.abs(normalizeHue(a)! - normalizeHue(b)!);
  return Math.min(d, 360 - d);
}

export function nextFreeHue(used: number[]): number {
  const clean = used
    .map((h) => normalizeHue(h))
    .filter((h): h is number => h != null);
  for (const hue of HUE_ANCHORS) {
    if (clean.every((u) => hueDistance(u, hue) >= CLOSE_HUE)) return hue;
  }
  let best = 0;
  let bestDistance = -1;
  for (let hue = 0; hue < 360; hue++) {
    const distance =
      clean.length === 0
        ? 180
        : Math.min(...clean.map((u) => hueDistance(u, hue)));
    if (distance > bestDistance) {
      bestDistance = distance;
      best = hue;
    }
  }
  return best;
}

export function studyColor(hue: number): {
  hue: number;
  fill: string;
  stroke: string;
  soft: string;
  ink: string;
} {
  const h = normalizeHue(hue) ?? PERSONAL_HUE;
  const ink =
    (h >= 35 && h <= 95) || (h >= 150 && h <= 185) ? "#1a140c" : "#ffffff";
  return {
    hue: h,
    fill: `hsl(${h} 72% 42%)`,
    stroke: `hsl(${h} 72% 38%)`,
    soft: `hsl(${h} 70% 46% / 0.18)`,
    ink,
  };
}

export function isPersonalStudy(space: {
  id: string;
  studyRole?: string | null;
}): boolean {
  return space.studyRole === "personal" || space.id === PERSONAL_STUDY_ID;
}

export function orderedStudies<T extends Space>(spaces: T[]): T[] {
  return [...spaces].sort((a, b) => {
    const aPersonal = isPersonalStudy(a) ? 0 : 1;
    const bPersonal = isPersonalStudy(b) ? 0 : 1;
    if (aPersonal !== bPersonal) return aPersonal - bPersonal;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function closestOtherStudy(
  hue: number,
  spaces: Array<Pick<Space, "name" | "colorHue">>,
): { name: string; distance: number } | null {
  let best: { name: string; distance: number } | null = null;
  for (const space of spaces) {
    const other = normalizeHue(space.colorHue);
    if (other == null) continue;
    const distance = hueDistance(hue, other);
    if (distance < CLOSE_HUE && (!best || distance < best.distance)) {
      best = { name: space.name, distance };
    }
  }
  return best;
}

export function loadActiveStudyId(): string | null {
  try {
    const id = localStorage.getItem(ACTIVE_STUDY_KEY);
    return id && id.trim() ? id : null;
  } catch {
    return null;
  }
}

export function saveActiveStudyId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_STUDY_KEY, id);
  } catch {
    // ignore
  }
}

export function beginPlaceWrite(id: string): number {
  const next = (placeWriteToken.get(id) ?? 0) + 1;
  placeWriteToken.set(id, next);
  return next;
}

export function isLatestPlaceWrite(id: string, token: number): boolean {
  return placeWriteToken.get(id) === token;
}

function seedPersonalPlace(): StudyReadingPlace | undefined {
  const pos = loadReadingPosition();
  if (!pos) return undefined;
  const version = loadReadingVersion();
  return {
    version: version === "web" ? "web" : "kjv",
    bookId: pos.bookId,
    chapter: pos.chapter,
    bookName: pos.bookName,
  };
}

/**
 * Add My study beside existing groups. Assign a hue where one is missing.
 * Does not delete rows, members, meetings, notes, or sync state.
 */
export async function ensureStudies(): Promise<void> {
  const rows = await db.spaces.toArray();
  let personal =
    rows.find((row) => row.studyRole === "personal") ??
    rows.find((row) => row.id === PERSONAL_STUDY_ID);

  if (!personal) {
    const now = new Date().toISOString();
    const created = {
      id: PERSONAL_STUDY_ID,
      name: "My study",
      createdAt: now,
      members: [],
      preferredBibleVersion: "KJV" as const,
      spaceTemplate: "custom" as const,
      spaceKind: "group" as const,
      studyRole: "personal" as const,
      colorHue: PERSONAL_HUE,
      readingPlace: seedPersonalPlace(),
      inviteCode: await deriveInviteCode(PERSONAL_STUDY_ID),
      sync: defaultSpaceSync("host"),
    };
    await db.spaces.add(created);
    personal = created;
  } else {
    const patch: Partial<typeof personal> = {};
    if (personal.studyRole !== "personal") patch.studyRole = "personal";
    if (normalizeHue(personal.colorHue) == null) patch.colorHue = PERSONAL_HUE;
    if (!personal.readingPlace) {
      const seeded = seedPersonalPlace();
      if (seeded) patch.readingPlace = seeded;
    }
    if (Object.keys(patch).length > 0) {
      await db.spaces.update(personal.id, patch);
      personal = { ...personal, ...patch };
    }
  }

  const used: number[] = [];
  const personalHue = normalizeHue(personal.colorHue);
  if (personalHue != null) used.push(personalHue);

  const groups = rows
    .filter((row) => row.id !== personal!.id && row.studyRole !== "personal")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const row of groups) {
    const hue = normalizeHue(row.colorHue);
    if (hue != null) used.push(hue);
  }

  for (const row of groups) {
    const patch: Partial<typeof row> = {};
    if (row.studyRole !== "group") patch.studyRole = "group";
    if (normalizeHue(row.colorHue) == null) {
      const hue = nextFreeHue(used);
      patch.colorHue = hue;
      used.push(hue);
    }
    if (Object.keys(patch).length > 0) {
      await db.spaces.update(row.id, patch);
    }
  }
}
