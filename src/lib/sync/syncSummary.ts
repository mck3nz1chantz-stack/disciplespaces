/**
 * Human-readable “what changed” after a shared-layer pull+push.
 * Private notes are never part of this snapshot.
 */

import { db } from "../db";

export interface SharedStateSnap {
  memberNames: string[];
  sessionIds: string[];
  prayerIds: string[];
  openPrayerIds: string[];
}

export interface SyncChangeSummary {
  addedSessions: number;
  removedSessions: number;
  addedPrayers: number;
  removedPrayers: number;
  answeredPrayers: number;
  addedMembers: string[];
  removedMembers: string[];
  totalSessions: number;
  totalMembers: number;
  openPrayers: number;
  /** True when any shared count or roster entry shifted. */
  hasChanges: boolean;
}

export async function captureSharedState(
  spaceId: string,
): Promise<SharedStateSnap> {
  const [row, sessions, prayers] = await Promise.all([
    db.spaces.get(spaceId),
    db.sessions.where("spaceId").equals(spaceId).toArray(),
    db.prayerBoard.where("spaceId").equals(spaceId).toArray(),
  ]);
  return {
    memberNames: (row?.members ?? [])
      .map((m) => m.name.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b)),
    sessionIds: sessions.map((s) => s.id).sort(),
    prayerIds: prayers.map((p) => p.id).sort(),
    openPrayerIds: prayers
      .filter((p) => p.status === "open")
      .map((p) => p.id)
      .sort(),
  };
}

function setDiff(before: string[], after: string[]): {
  added: string[];
  removed: string[];
} {
  const b = new Set(before);
  const a = new Set(after);
  const added: string[] = [];
  const removed: string[] = [];
  for (const id of a) if (!b.has(id)) added.push(id);
  for (const id of b) if (!a.has(id)) removed.push(id);
  return { added, removed };
}

export function diffSharedState(
  before: SharedStateSnap,
  after: SharedStateSnap,
): SyncChangeSummary {
  const sessions = setDiff(before.sessionIds, after.sessionIds);
  const prayers = setDiff(before.prayerIds, after.prayerIds);
  const members = setDiff(before.memberNames, after.memberNames);
  // Answered = was open before, no longer open after (and still exists or not)
  const openBefore = new Set(before.openPrayerIds);
  const openAfter = new Set(after.openPrayerIds);
  let answeredPrayers = 0;
  for (const id of openBefore) {
    if (!openAfter.has(id)) answeredPrayers += 1;
  }

  const summary: SyncChangeSummary = {
    addedSessions: sessions.added.length,
    removedSessions: sessions.removed.length,
    addedPrayers: prayers.added.length,
    removedPrayers: prayers.removed.length,
    answeredPrayers,
    addedMembers: members.added,
    removedMembers: members.removed,
    totalSessions: after.sessionIds.length,
    totalMembers: after.memberNames.length,
    openPrayers: after.openPrayerIds.length,
    hasChanges: false,
  };

  summary.hasChanges =
    summary.addedSessions > 0 ||
    summary.removedSessions > 0 ||
    summary.addedPrayers > 0 ||
    summary.removedPrayers > 0 ||
    summary.answeredPrayers > 0 ||
    summary.addedMembers.length > 0 ||
    summary.removedMembers.length > 0;

  return summary;
}

/** One-line toast description; null when nothing notable (caller uses generic). */
export function formatSyncChangeDescription(
  changes: SyncChangeSummary,
): string | null {
  if (!changes.hasChanges) {
    const bits: string[] = [];
    if (changes.totalSessions > 0) {
      bits.push(
        `${changes.totalSessions} meeting${changes.totalSessions === 1 ? "" : "s"}`,
      );
    }
    if (changes.totalMembers > 0) {
      bits.push(
        `${changes.totalMembers} people`,
      );
    }
    if (changes.openPrayers > 0) {
      bits.push(
        `${changes.openPrayers} open prayer${changes.openPrayers === 1 ? "" : "s"}`,
      );
    }
    if (bits.length === 0) {
      return "Shared meetings are up to date. Private notes stay on this phone.";
    }
    return `You’re in sync · ${bits.join(" · ")}. Private notes stay on this phone.`;
  }

  const parts: string[] = [];
  if (changes.addedSessions > 0) {
    parts.push(
      `+${changes.addedSessions} meeting${changes.addedSessions === 1 ? "" : "s"}`,
    );
  }
  if (changes.removedSessions > 0) {
    parts.push(
      `−${changes.removedSessions} meeting${changes.removedSessions === 1 ? "" : "s"}`,
    );
  }
  if (changes.addedMembers.length > 0) {
    const names = changes.addedMembers.slice(0, 2).join(", ");
    const more =
      changes.addedMembers.length > 2
        ? ` +${changes.addedMembers.length - 2}`
        : "";
    parts.push(`${names}${more} joined the list`);
  }
  if (changes.removedMembers.length > 0) {
    parts.push(
      `${changes.removedMembers.length} name${changes.removedMembers.length === 1 ? "" : "s"} removed`,
    );
  }
  if (changes.addedPrayers > 0) {
    parts.push(
      `+${changes.addedPrayers} prayer${changes.addedPrayers === 1 ? "" : "s"}`,
    );
  }
  if (changes.answeredPrayers > 0) {
    parts.push(
      `${changes.answeredPrayers} prayer${changes.answeredPrayers === 1 ? "" : "s"} answered/closed`,
    );
  }

  const tail =
    changes.totalSessions > 0
      ? ` · ${changes.totalSessions} meeting${changes.totalSessions === 1 ? "" : "s"} shared`
      : "";
  return `${parts.join(" · ")}${tail}. Private notes stay on this phone.`;
}

export function formatSyncSuccessTitle(changes: SyncChangeSummary): string {
  if (!changes.hasChanges) return "Group up to date";
  if (changes.addedSessions > 0 && changes.addedMembers.length > 0) {
    return "Meetings & people updated";
  }
  if (changes.addedSessions > 0) return "New meetings shared";
  if (changes.addedMembers.length > 0) return "People list updated";
  if (changes.addedPrayers > 0 || changes.answeredPrayers > 0) {
    return "Prayer board updated";
  }
  return "Group updated";
}
