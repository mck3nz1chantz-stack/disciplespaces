import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { useLiveSessions, useLiveSpaces } from "../../hooks/useLiveDb";
import {
  buildPrayerScope,
  completedPrayerNights,
  pastPrayerScope,
} from "../../lib/prayerScope";
import { groupedSessionIds, groupStudies, studyLabel } from "../../lib/currentStudy";
import { splitMeetings, localTodayKey, calendarDay } from "../../lib/meetingCalendar";
import { pickNextNight, type NextNight } from "../../lib/nextNight";
import {
  normalizeHue,
  orderedStudies,
  PERSONAL_HUE,
  studyColor,
} from "../../lib/study";
import type { Session } from "../../types";
import type { Member } from "../../types";
import { PrayerBoard } from "../PrayerBoard";

function nightLabel(session: Session): string {
  const day = calendarDay(session.date);
  let when = day;
  try {
    if (day) when = format(parseISO(day), "EEE, MMM d");
  } catch {
    when = day;
  }
  const name = studyLabel(session);
  const number = session.sessionNumber ? `Session ${session.sessionNumber}` : "";
  return [when, name, number].filter(Boolean).join(" · ");
}

function shortDay(day: string): string {
  try {
    return format(parseISO(day), "EEE, MMM d");
  } catch {
    return day;
  }
}

export function PrayerPanel({
  spaceId,
  members,
  focusSessionId,
}: {
  spaceId: string;
  members: Member[];
  /** Gather opens the prayer tab on this session. */
  focusSessionId?: string | null;
}) {
  const navigate = useNavigate();
  const spaces = useLiveSpaces();
  const liveSessions = useLiveSessions(spaceId);
  const sessions = liveSessions ?? [];
  const today = localTodayKey();
  const [choice, setChoice] = useState<string | null>(null);

  const nextNight = useMemo(() => {
    const tonight = sessionOnDay(sessions, today);
    if (tonight) return tonight;
    const studies = groupStudies(sessions, today);
    const loose = sessions.filter(
      (session) => !groupedSessionIds(sessions, today).has(session.id),
    );
    return pickNextNight(
      studies.current.flatMap((study) => (study.next ? [study.next] : [])),
      splitMeetings(loose).upcoming,
    );
  }, [sessions, today]);

  const completed = useMemo(
    () => completedPrayerNights(sessions, today, nextNight?.session.id),
    [sessions, today, nextNight?.session.id],
  );

  useEffect(() => {
    setChoice(null);
  }, [spaceId]);

  useEffect(() => {
    if (!focusSessionId) return;
    if (nextNight?.session.id === focusSessionId) {
      setChoice("this");
      return;
    }
    if (completed.some((session) => session.id === focusSessionId)) {
      setChoice(focusSessionId);
    }
  }, [focusSessionId, spaceId, nextNight?.session.id, completed]);

  const resolved = resolveChoice(choice, Boolean(nextNight), completed);

  const scope =
    resolved === "all"
      ? undefined
      : resolved === "this" && nextNight
        ? buildPrayerScope({
            session: nextNight.session,
            openedDay: nextNight.day,
            sessions,
            today,
          })
        : (() => {
            const session = completed.find((row) => row.id === resolved);
            return session ? pastPrayerScope(session, sessions, today) : undefined;
          })();

  const saveOn = nextNight ? `Saves on ${shortDay(nextNight.day)}` : "Saves on this group";

  return (
    <div
      className="space-y-4"
      role="tabpanel"
      id="group-panel-prayer"
      aria-labelledby="group-tab-prayer"
    >
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Studies"
      >
        {orderedStudies(spaces ?? []).map((study) => {
          const color = studyColor(normalizeHue(study.colorHue) ?? PERSONAL_HUE);
          const selected = study.id === spaceId;
          return (
            <button
              key={study.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                if (selected) return;
                navigate(`/space/${study.id}`, { state: { groupTab: "prayer" } });
              }}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium touch-manipulation"
              style={
                selected
                  ? {
                      background: color.fill,
                      borderColor: color.stroke,
                      color: color.ink,
                    }
                  : {
                      background: "transparent",
                      borderColor: color.stroke,
                      color: color.stroke,
                    }
              }
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: selected ? color.ink : color.fill }}
                aria-hidden
              />
              {study.name}
            </button>
          );
        })}
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-primary">Night</span>
        <select
          id="prayer-night"
          value={resolved}
          onChange={(event) => setChoice(event.target.value)}
          className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-base text-primary"
        >
          {nextNight ? (
            <option value="this">This session · {shortDay(nextNight.day)}</option>
          ) : null}
          {completed.map((session) => (
            <option key={session.id} value={session.id}>
              {nightLabel(session)}
            </option>
          ))}
          <option value="all">All open</option>
        </select>
      </label>

      <PrayerBoard
        spaceId={spaceId}
        members={members}
        sessionId={
          resolved === "all" || resolved === "this"
            ? nextNight?.session.id
            : resolved
        }
        sessionScope={scope}
        openOnly={resolved === "all"}
        saveNote={resolved === "all" ? saveOn : undefined}
      />
    </div>
  );
}

function sessionOnDay(sessions: Session[], day: string): NextNight | null {
  const matches = sessions.filter((session) => calendarDay(session.date) === day);
  if (matches.length === 0) return null;
  const session = matches.find((row) => !row.meetingDone) ?? matches[0]!;
  return { day, startTime: session.startTime, session };
}

function resolveChoice(
  choice: string | null,
  hasCurrent: boolean,
  completed: Session[],
): string {
  if (choice === "this" && hasCurrent) return "this";
  if (choice === "all") return "all";
  if (choice && completed.some((session) => session.id === choice)) return choice;
  return hasCurrent ? "this" : "all";
}
