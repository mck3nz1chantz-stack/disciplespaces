import type { Session } from "../types";
import { calendarDay, repeatOf } from "./meetingCalendar";

/** Name that groups nights into one study. */
export function studyLabel(session: Session): string {
  return (session.studyName || session.title || "").trim();
}

export function studyKey(session: Session): string {
  return studyLabel(session).toLowerCase();
}

/**
 * A named repeating plan, or a night already filed into a study.
 * A one-time meeting is included when its name matches a study.
 */
export function isNamedPlan(session: Session): boolean {
  if (session.studyName?.trim()) return true;
  if (session.meetingDone || session.studyDone || session.sessionNumber) {
    return true;
  }
  return Boolean(session.title?.trim()) && repeatOf(session) !== "once";
}

function nightIsDone(session: Session, today: string): boolean {
  if (session.meetingDone) return true;
  const day = calendarDay(session.date);
  return repeatOf(session) === "once" && Boolean(day) && day <= today;
}

export interface StudyGroup {
  key: string;
  name: string;
  finished: boolean;
  done: Session[];
  next: Session | null;
}

function byNumber(a: Session, b: Session): number {
  const an = a.sessionNumber ?? 0;
  const bn = b.sessionNumber ?? 0;
  if (an !== bn) return an - bn;
  return calendarDay(a.date).localeCompare(calendarDay(b.date));
}

/** Current studies stay open. Past studies are finished books, not finished nights. */
export function groupStudies(sessions: Session[], today = ""): {
  current: StudyGroup[];
  past: StudyGroup[];
} {
  const todayKey =
    today ||
    (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    })();
  const keys = new Set(
    sessions.map((session) => (isNamedPlan(session) ? studyKey(session) : "")).filter(Boolean),
  );
  const map = new Map<string, Session[]>();
  for (const session of sessions) {
    const key = studyKey(session);
    if (!key || !keys.has(key)) continue;
    const list = map.get(key) ?? [];
    list.push(session);
    map.set(key, list);
  }

  const current: StudyGroup[] = [];
  const past: StudyGroup[] = [];
  for (const [key, list] of map) {
    const name = studyLabel(list[0]!) || "Study";
    const finished = list.some((session) => session.studyDone);
    const done = list.filter((session) => nightIsDone(session, todayKey)).sort(byNumber);
    const next = finished
      ? null
      : list
          .filter((session) => !nightIsDone(session, todayKey))
          .sort((a, b) => calendarDay(a.date).localeCompare(calendarDay(b.date)))[0] ??
        null;
    const group: StudyGroup = {
      key,
      name,
      finished,
      done: finished ? [...list].sort(byNumber) : done,
      next,
    };
    if (finished) past.push(group);
    else current.push(group);
  }
  current.sort((a, b) => a.name.localeCompare(b.name));
  past.sort((a, b) => a.name.localeCompare(b.name));
  return { current, past };
}

export function sessionNumberLabel(session: Session, fallback: number): string {
  return `Session ${session.sessionNumber ?? fallback}`;
}

/** Sessions already shown inside a study, so the loose meeting list can skip them. */
export function groupedSessionIds(sessions: Session[], today = ""): Set<string> {
  const { current, past } = groupStudies(sessions, today);
  const ids = new Set<string>();
  for (const study of [...current, ...past]) {
    for (const session of study.done) ids.add(session.id);
    if (study.next) ids.add(study.next.id);
  }
  return ids;
}
