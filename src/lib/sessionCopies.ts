import type { Session } from "../types";
import { calendarDay, studyNameKey } from "./meetingCalendar";

export interface SessionCopyGroup {
  /** Calendar day plus study name. */
  key: string;
  day: string;
  studyKey: string;
  /** Stable order. The first row is the one the lists show. */
  sessions: Session[];
}

/**
 * Real session rows that share a group, a calendar day, and a study name.
 * A blank name matches another blank name.
 * Held weekdays and later weeks of a repeating plan are not rows here.
 */
export function sessionCopyGroups(sessions: Session[]): SessionCopyGroup[] {
  const map = new Map<string, Session[]>();
  for (const session of sessions) {
    const day = calendarDay(session.date);
    if (!day) continue;
    const studyKey = studyNameKey(session);
    const key = `${day}|${studyKey}`;
    const list = map.get(key) ?? [];
    list.push(session);
    map.set(key, list);
  }
  const groups: SessionCopyGroup[] = [];
  for (const [key, list] of map) {
    if (list.length < 2) continue;
    const sessionsInOrder = [...list].sort((a, b) => a.id.localeCompare(b.id));
    groups.push({
      key,
      day: calendarDay(sessionsInOrder[0]!.date),
      studyKey: studyNameKey(sessionsInOrder[0]!),
      sessions: sessionsInOrder,
    });
  }
  return groups;
}

export function copyGroupFor(
  session: Session,
  groups: SessionCopyGroup[],
): SessionCopyGroup | undefined {
  const key = `${calendarDay(session.date)}|${studyNameKey(session)}`;
  return groups.find((group) => group.key === key);
}

export function isCopyLead(session: Session, groups: SessionCopyGroup[]): boolean {
  const group = copyGroupFor(session, groups);
  if (!group) return true;
  return group.sessions[0]?.id === session.id;
}
