import type { Session } from "../types";
import {
  calendarDay,
  occurrenceEndsAt,
  type MeetingFace,
} from "./meetingCalendar";

export interface NextNight {
  day: string;
  startTime?: string;
  session: Session;
}

/**
 * Soonest night still ahead: the next night inside a current study,
 * or a loose meeting that is not already filed in a study.
 */
export function pickNextNight(
  studyNext: Session[],
  looseUpcoming: MeetingFace[],
): NextNight | null {
  let best: NextNight | null = null;
  const consider = (
    day: string,
    startTime: string | undefined,
    session: Session,
  ) => {
    if (!day) return;
    const pick = { day, startTime, session };
    if (
      !best ||
      occurrenceEndsAt(day, startTime) < occurrenceEndsAt(best.day, best.startTime)
    ) {
      best = pick;
    }
  };
  for (const session of studyNext) {
    consider(calendarDay(session.date), session.startTime, session);
  }
  for (const face of looseUpcoming) {
    consider(face.day, face.startTime, face.session);
  }
  return best;
}
