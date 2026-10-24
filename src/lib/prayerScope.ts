import type { PrayerSessionScope } from "../components/PrayerBoard";
import { studyKey } from "./currentStudy";
import {
  calendarDay,
  localTodayKey,
  previousSessionDay,
  repeatOf,
  rollSession,
} from "./meetingCalendar";
import type { Session } from "../types";

function occurrenceDaysOf(sessions: Session[]): string[] {
  const days = new Set<string>();
  for (const raw of sessions) {
    const session = rollSession(raw);
    const day = calendarDay(session.date);
    if (day) days.add(day);
    for (const held of raw.heldDates ?? []) {
      const heldDay = calendarDay(held.date);
      if (heldDay) days.add(heldDay);
    }
  }
  return [...days];
}

/** The window the prayer board already uses for a session sheet. */
export function buildPrayerScope(args: {
  session: Session | null | undefined;
  openedDay?: string | null;
  sessions: Session[];
  today?: string;
}): PrayerSessionScope | undefined {
  const todayKey = args.today || localTodayKey();
  const active = args.session;
  const day =
    calendarDay(args.openedDay || "") ||
    calendarDay(active?.date ?? "") ||
    "";
  if (!day || !active) return undefined;
  // Tonight stays open so prayers can be added during the meeting.
  const past = day < todayKey;
  const boundary = past ? calendarDay(active.date) || day : todayKey;
  const siblings = args.sessions.filter(
    (session) =>
      session.id !== active.id &&
      studyKey(session) === studyKey(active) &&
      studyKey(session) !== "",
  );
  const previous = siblings
    .filter((session) => session.meetingDone)
    .sort((a, b) => calendarDay(b.date).localeCompare(calendarDay(a.date)))[0];
  return {
    role: past ? "past" : "current",
    day: boundary,
    previousDay: previous
      ? calendarDay(previous.date)
      : previousSessionDay(boundary, occurrenceDaysOf(args.sessions)),
    sessionId: active.id,
    previousSessionId: past ? undefined : previous?.id,
  };
}

/** A completed night, forced to the past window so only its prayers show. */
export function pastPrayerScope(
  session: Session,
  sessions: Session[],
  today?: string,
): PrayerSessionScope {
  const built = buildPrayerScope({
    session,
    openedDay: calendarDay(session.date),
    sessions,
    today,
  });
  return {
    role: "past",
    day: calendarDay(session.date) || built?.day || localTodayKey(),
    previousDay: built?.previousDay,
    sessionId: session.id,
  };
}

function nightIsComplete(session: Session, today: string): boolean {
  const day = calendarDay(session.date);
  if (!day || day >= today) return false;
  if (session.meetingDone) return true;
  return repeatOf(session) === "once";
}

/** Completed nights in this group, newest first. Skips the night shown as This session. */
export function completedPrayerNights(
  sessions: Session[],
  today: string,
  skipId?: string,
): Session[] {
  const rows: Session[] = [];
  const seen = new Set<string>();
  for (const session of sessions) {
    if (!nightIsComplete(session, today)) continue;
    if (session.id === skipId || seen.has(session.id)) continue;
    seen.add(session.id);
    rows.push(session);
  }
  rows.sort((a, b) => calendarDay(b.date).localeCompare(calendarDay(a.date)));
  return rows;
}
