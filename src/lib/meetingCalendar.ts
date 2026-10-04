/**
 * One meeting row can be a single date or a weekly plan.
 * Past dates are remembered on the same row. The next date is not a new row.
 */

import { format, parseISO } from "date-fns";
import type { ComingReply, HeldMeetingDate, Session } from "../types";

/** Keep the newest past dates. Older weeks stay off the room payload. */
const HELD_CAP = 52;
const ROLL_GUARD = 520;

export function calendarDay(iso: string): string {
  const day = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "";
}

/** "HH:mm" or undefined. Empty and invalid times mean “no time”. */
export function normalizeStartTime(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const match = /^(\d{1,2}):(\d{2})/.exec(raw.trim());
  if (!match) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return undefined;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export type RepeatKind = "once" | "week" | "biweek" | "month";

export function repeatOf(session: {
  weekly?: boolean;
  repeat?: string;
}): RepeatKind {
  if (
    session.repeat === "week" ||
    session.repeat === "biweek" ||
    session.repeat === "month"
  ) {
    return session.repeat;
  }
  return session.weekly ? "week" : "once";
}

export function repeatLabel(session: {
  weekly?: boolean;
  repeat?: string;
}): string | null {
  const kind = repeatOf(session);
  if (kind === "week") return "Every week";
  if (kind === "biweek") return "Every two weeks";
  if (kind === "month") return "Once a month";
  return null;
}

function addDays(day: string, n: number): string {
  const dt = new Date(`${day}T00:00:00`);
  dt.setDate(dt.getDate() + n);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Same day-of-month, or the last day when the month is shorter. */
function addMonth(day: string, anchor: number): string {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  const last = new Date(nextYear, nextMonth, 0).getDate();
  const date = Math.min(Math.max(1, anchor), last);
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
}

/**
 * When this occurrence is over.
 * A time is past once that minute has passed.
 * A day with no time stays current until the next local midnight.
 */
export function occurrenceEndsAt(day: string, startTime?: string): number {
  const date = calendarDay(day);
  const time = normalizeStartTime(startTime);
  if (!date) return 0;
  if (time) {
    const [hh, mm] = time.split(":").map(Number);
    const dt = new Date(`${date}T00:00:00`);
    dt.setHours(hh, mm, 0, 0);
    return dt.getTime() + 60_000;
  }
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + 1);
  return next.getTime();
}

export function isOccurrencePast(
  day: string,
  startTime: string | undefined,
  now: Date,
): boolean {
  const ends = occurrenceEndsAt(day, startTime);
  return ends > 0 && now.getTime() >= ends;
}

function heldKey(entry: HeldMeetingDate): string {
  return `${entry.date}|${entry.startTime ?? ""}`;
}

function copyComing(list?: ComingReply[]): ComingReply[] | undefined {
  if (!list?.length) return undefined;
  const clean = list.filter(
    (row) =>
      row.memberId &&
      row.name.trim() &&
      (row.mark === "coming" || row.mark === "cant"),
  );
  if (clean.length === 0) return undefined;
  return clean.map((row) => ({
    memberId: row.memberId,
    name: row.name.trim(),
    mark: row.mark,
  }));
}

function remember(
  held: HeldMeetingDate[],
  day: string,
  startTime?: string,
  coming?: ComingReply[],
): void {
  const entry: HeldMeetingDate = { date: day };
  const time = normalizeStartTime(startTime);
  if (time) entry.startTime = time;
  const marks = copyComing(coming);
  if (marks) entry.coming = marks;
  const key = heldKey(entry);
  if (held.some((row) => heldKey(row) === key)) return;
  held.push(entry);
}

/** Freeze dates that already passed and point `date` at the next one. */
export function rollSession<T extends Session>(session: T, now = new Date()): T {
  const kind = repeatOf(session);
  if (kind === "once") return session;
  const time = normalizeStartTime(session.startTime);
  let day = calendarDay(session.date);
  if (!day) return session;
  const anchor =
    kind === "month" &&
    session.repeatDay != null &&
    session.repeatDay >= 1 &&
    session.repeatDay <= 31
      ? session.repeatDay
      : Number(day.slice(8, 10));

  const held: HeldMeetingDate[] = [...(session.heldDates ?? [])];
  let guard = 0;
  let rolled = 0;
  while (isOccurrencePast(day, time, now) && guard < ROLL_GUARD) {
    // Only the date that just passed keeps this meeting’s marks.
    remember(held, day, time, rolled === 0 ? session.coming : undefined);
    day =
      kind === "week"
        ? addDays(day, 7)
        : kind === "biweek"
          ? addDays(day, 14)
          : addMonth(day, anchor);
    rolled += 1;
    guard += 1;
  }
  const trimmed = held.slice(-HELD_CAP);
  const sameDay = day === calendarDay(session.date);
  const sameTime = time === normalizeStartTime(session.startTime);
  const sameHeld =
    JSON.stringify(trimmed) === JSON.stringify(session.heldDates ?? []);
  if (sameDay && sameTime && sameHeld) return session;

  return {
    ...session,
    date: new Date(`${day}T12:00:00`).toISOString(),
    startTime: time,
    weekly: kind === "week" ? true : undefined,
    repeat: kind === "week" ? session.repeat : kind,
    repeatDay: kind === "month" ? anchor : undefined,
    heldDates: trimmed.length > 0 ? trimmed : undefined,
    coming: rolled > 0 ? undefined : session.coming,
  };
}

export function meetingScheduleChanged(before: Session, after: Session): boolean {
  return (
    calendarDay(before.date) !== calendarDay(after.date) ||
    normalizeStartTime(before.startTime) !== normalizeStartTime(after.startTime) ||
    Boolean(before.weekly) !== Boolean(after.weekly) ||
    repeatOf(before) !== repeatOf(after) ||
    (before.repeatDay ?? 0) !== (after.repeatDay ?? 0) ||
    JSON.stringify(before.heldDates ?? []) !== JSON.stringify(after.heldDates ?? [])
  );
}

export interface MeetingFace {
  session: Session;
  /** yyyy-MM-dd shown on this row. */
  day: string;
  startTime?: string;
  /** Past row from a weekly plan. Opens the same meeting. */
  held: boolean;
}

export function splitMeetings(
  sessions: Session[],
  now = new Date(),
): { upcoming: MeetingFace[]; past: MeetingFace[] } {
  const upcoming: MeetingFace[] = [];
  const past: MeetingFace[] = [];

  for (const raw of sessions) {
    const session = rollSession(raw, now);
    const day = calendarDay(session.date);
    const startTime = normalizeStartTime(session.startTime);
    if (repeatOf(session) !== "once" && day) {
      upcoming.push({ session, day, startTime, held: false });
    } else if (day && !isOccurrencePast(day, startTime, now)) {
      upcoming.push({ session, day, startTime, held: false });
    } else if (day) {
      past.push({ session, day, startTime, held: false });
    }
    for (const held of session.heldDates ?? []) {
      past.push({
        session,
        day: held.date,
        startTime: normalizeStartTime(held.startTime),
        held: true,
      });
    }
  }

  upcoming.sort(
    (a, b) => occurrenceEndsAt(a.day, a.startTime) - occurrenceEndsAt(b.day, b.startTime),
  );
  past.sort(
    (a, b) => occurrenceEndsAt(b.day, b.startTime) - occurrenceEndsAt(a.day, a.startTime),
  );
  return { upcoming, past };
}

/** Soonest upcoming meeting across groups. */
export function comingForFace(face: MeetingFace): ComingReply[] {
  if (face.held) {
    const time = normalizeStartTime(face.startTime);
    const row = (face.session.heldDates ?? []).find(
      (held) =>
        held.date === face.day &&
        normalizeStartTime(held.startTime) === time,
    );
    return row?.coming ?? [];
  }
  return face.session.coming ?? [];
}

export interface MonthMeeting {
  day: string;
  startTime?: string;
  sessionId: string;
  spaceId: string;
  spaceName: string;
}

/**
 * Meetings that fall in one month.
 * Repeats are shown on each date in that month. Nothing is saved.
 */
export function meetingsInMonth(
  groups: Array<{ id: string; name: string; sessions?: Session[] }>,
  year: number,
  month: number,
  now = new Date(),
): MonthMeeting[] {
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDate = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDate).padStart(2, "0")}`;
  const marks: MonthMeeting[] = [];

  for (const group of groups) {
    for (const raw of group.sessions ?? []) {
      const session = rollSession(raw, now);
      const kind = repeatOf(session);
      const time = normalizeStartTime(session.startTime);
      const anchor =
        kind === "month" &&
        session.repeatDay != null &&
        session.repeatDay >= 1 &&
        session.repeatDay <= 31
          ? session.repeatDay
          : Number(calendarDay(session.date).slice(8, 10)) || 1;

      const push = (day: string) => {
        if (day < monthStart || day > monthEnd) return;
        if (marks.some((row) => row.day === day && row.sessionId === session.id)) return;
        marks.push({
          day,
          startTime: time,
          sessionId: session.id,
          spaceId: group.id,
          spaceName: group.name,
        });
      };

      for (const held of session.heldDates ?? []) push(held.date);

      let day = calendarDay(session.date);
      let guard = 0;
      while (day && day <= monthEnd && guard < 80) {
        push(day);
        if (kind === "once") break;
        day =
          kind === "week"
            ? addDays(day, 7)
            : kind === "biweek"
              ? addDays(day, 14)
              : addMonth(day, anchor);
        guard += 1;
      }
    }
  }

  marks.sort((a, b) => a.day.localeCompare(b.day) || a.spaceName.localeCompare(b.spaceName));
  return marks;
}

export function soonestUpcoming(
  groups: Array<{ id: string; name: string; place?: string; sessions?: Session[] }>,
  now = new Date(),
): { spaceId: string; spaceName: string; place?: string; face: MeetingFace } | null {
  let best: { spaceId: string; spaceName: string; place?: string; face: MeetingFace } | null = null;
  let bestEnds = Infinity;
  for (const group of groups) {
    const { upcoming } = splitMeetings(group.sessions ?? [], now);
    const face = upcoming[0];
    if (!face) continue;
    const ends = occurrenceEndsAt(face.day, face.startTime);
    if (ends < bestEnds) {
      bestEnds = ends;
      best = {
        spaceId: group.id,
        spaceName: group.name,
        place: group.place?.trim() || undefined,
        face,
      };
    }
  }
  return best;
}

/** “Wednesday, Oct 7, 7:00 PM” or the day alone when no time was set. */
export function formatMeetingWhen(day: string, startTime?: string): string {
  const date = calendarDay(day);
  if (!date) return day;
  let dayLabel = date;
  try {
    dayLabel = format(parseISO(date), "EEEE, MMM d");
  } catch {
    dayLabel = date;
  }
  const time = normalizeStartTime(startTime);
  if (!time) return dayLabel;
  const [hh, mm] = time.split(":").map(Number);
  const clock = new Date(2000, 0, 1, hh, mm);
  return `${dayLabel}, ${format(clock, "h:mm a")}`;
}
