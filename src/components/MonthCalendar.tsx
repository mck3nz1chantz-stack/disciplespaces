import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Calendar, ChevronDown } from "lucide-react";
import { Button } from "./Button";
import {
  formatMeetingWhen,
  isOccurrencePast,
  localTodayKey,
  meetingsInMonth,
  savedDateLabel,
  type MonthMeeting,
} from "../lib/meetingCalendar";
import type { SavedGroupDate, Session } from "../types";
import { normalizeHue, PERSONAL_HUE, studyColor } from "../lib/study";

export interface CalendarDayActions {
  onOpen: (sessionId: string, day: string) => void;
  onPlan: (day: string) => void;
  onLog: (
    day: string,
    startTime?: string,
    held?: { sessionId: string; day: string },
  ) => void;
  onRemoveMark: (day: string) => void;
  /** Group key when this session is one of several copies. */
  copyKey?: (sessionId: string) => string | null;
  copyCount?: (sessionId: string) => number;
  onReviewCopies?: (sessionId: string) => void;
  onRemoveHeld?: (sessionId: string, day: string) => void;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
type CalendarFilter = "all" | "coming" | "done" | "today";

const FILTERS: { id: CalendarFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "coming", label: "Coming" },
  { id: "done", label: "Done" },
  { id: "today", label: "Today" },
];

export function MonthCalendar({
  groups,
  dayActions,
  focusDay,
}: {
  groups: Array<{
    id: string;
    name: string;
    colorHue?: number;
    sessions?: Session[];
    savedDates?: SavedGroupDate[];
  }>;
  /** Inside one study, a day opens, plans, or logs. Studies home leaves this unset. */
  dayActions?: CalendarDayActions;
  /** Open the calendar on this yyyy-MM-dd. */
  focusDay?: string | null;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  });
  const [selected, setSelected] = useState<string | null>(
    format(today, "yyyy-MM-dd"),
  );
  const [filter, setFilter] = useState<CalendarFilter>("all");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!focusDay || !/^\d{4}-\d{2}-\d{2}$/.test(focusDay)) return;
    const year = Number(focusDay.slice(0, 4));
    const month = Number(focusDay.slice(5, 7));
    if (!year || !month) return;
    setOpen(true);
    setSelected(focusDay);
    setCursor({ year, month });
  }, [focusDay]);

  const monthMarks = useMemo(
    () => meetingsInMonth(groups, cursor.year, cursor.month),
    [groups, cursor.year, cursor.month],
  );
  const marks = useMemo(() => {
    const now = new Date();
    const todayKey = format(now, "yyyy-MM-dd");
    return monthMarks.filter((mark) => {
      if (filter === "all") return true;
      if (filter === "today") return mark.day === todayKey;
      if (mark.savedKind === "completed") return filter === "done";
      if (mark.savedKind === "upcoming") return filter === "coming";
      const past = isOccurrencePast(mark.day, mark.startTime, now);
      return filter === "done" ? past : !past;
    });
  }, [monthMarks, filter]);
  const byDay = useMemo(() => {
    const map = new Map<string, MonthMeeting[]>();
    for (const mark of marks) {
      const list = map.get(mark.day) ?? [];
      list.push(mark);
      map.set(mark.day, list);
    }
    return map;
  }, [marks]);

  const firstWeekday = new Date(cursor.year, cursor.month - 1, 1).getDay();
  const dayCount = new Date(cursor.year, cursor.month, 0).getDate();
  const title = format(new Date(cursor.year, cursor.month - 1, 1), "MMMM yyyy");
  const todayKey = format(today, "yyyy-MM-dd");
  const hueBySpace = useMemo(() => {
    const map = new Map<string, number>();
    for (const group of groups) {
      map.set(group.id, normalizeHue(group.colorHue) ?? PERSONAL_HUE);
    }
    return map;
  }, [groups]);
  const allByDay = useMemo(() => {
    const map = new Map<string, MonthMeeting[]>();
    for (const mark of monthMarks) {
      const list = map.get(mark.day) ?? [];
      list.push(mark);
      map.set(mark.day, list);
    }
    return map;
  }, [monthMarks]);
  const selectedMarks = selected ? byDay.get(selected) ?? [] : [];
  const panelDay = selected ?? (filter === "today" ? todayKey : null);
  const countWord = marks.length === 1 ? "1 date" : `${marks.length} dates`;
  const countLabel =
    filter === "all"
      ? `${countWord} this month`
      : filter === "today"
        ? `${countWord} today`
        : filter === "done"
          ? `${countWord} done this month`
          : `${countWord} coming this month`;

  function shift(delta: number) {
    setSelected(null);
    setCursor((current) => {
      const next = new Date(current.year, current.month - 1 + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() + 1 };
    });
  }

  return (
    <section className="space-y-2" aria-label="Calendar">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl border border-border bg-surface/95 px-3 py-2.5 text-left touch-manipulation"
      >
        <Calendar className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-primary">Calendar</span>
          <span className="block text-xs text-muted truncate">{countLabel}</span>
        </span>
        <ChevronDown
          className={[
            "h-5 w-5 shrink-0 text-muted transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
          aria-hidden
        />
      </button>
      {open && (
      <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg text-primary">{title}</h3>
          <p className="text-xs text-muted">{countLabel}</p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="rounded-lg border border-border px-3 py-2 text-sm text-primary touch-manipulation"
            aria-label="Previous month"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            className="rounded-lg border border-border px-3 py-2 text-sm text-primary touch-manipulation"
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1" role="group" aria-label="Show dates">
        {FILTERS.map((item) => {
          const on = filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setFilter(item.id);
                if (item.id === "today") {
                  setCursor({ year: today.getFullYear(), month: today.getMonth() + 1 });
                  setSelected(todayKey);
                } else if (
                  item.id === "all" &&
                  cursor.year === today.getFullYear() &&
                  cursor.month === today.getMonth() + 1
                ) {
                  setSelected(todayKey);
                } else {
                  setSelected(null);
                }
              }}
              className={[
                "min-h-11 rounded-lg px-1 py-2 text-xs font-medium touch-manipulation",
                on ? "bg-primary text-on-primary" : "border border-border text-muted",
              ].join(" ")}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
          Completed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-upcoming" aria-hidden />
          Upcoming
        </span>
      </p>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((label, index) => (
          <div key={`${label}-${index}`} className="text-[11px] text-muted py-1">
            {label}
          </div>
        ))}
        {Array.from({ length: firstWeekday }, (_, index) => (
          <div key={`pad-${index}`} />
        ))}
        {Array.from({ length: dayCount }, (_, index) => {
          const dayNum = index + 1;
          const key = `${cursor.year}-${String(cursor.month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
          const dayMarks = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          const isSelected = key === selected;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(isSelected ? null : key)}
              className={[
                "min-h-11 rounded-lg text-sm touch-manipulation",
                isSelected
                  ? "bg-primary text-on-primary"
                  : isToday
                    ? "border border-primary text-primary"
                    : "text-primary",
              ].join(" ")}
              aria-pressed={isSelected}
              aria-label={
                dayMarks.length
                  ? `${dayNum}, ${dayMarks
                      .map((mark) =>
                        [
                          mark.savedKind
                            ? savedDateLabel(
                                { date: mark.day, kind: mark.savedKind },
                                todayKey,
                              )
                            : "meeting",
                          mark.note,
                        ]
                          .filter(Boolean)
                          .join(", "),
                      )
                      .join("; ")}`
                  : String(dayNum)
              }
            >
              <span className="block leading-none">{dayNum}</span>
              {dayMarks.length > 1 ? (
                <span className="mt-0.5 block text-[10px] leading-tight text-muted">
                  {dayMarks.length} items
                </span>
              ) : dayMarks.length === 1 ? (
                <span className="mt-0.5 flex items-center justify-center gap-1 text-[10px] leading-tight">
                  <span
                    className="h-1.5 w-1.5 shrink-0"
                    data-study-dot={dayMarks[0]!.spaceId}
                    style={{
                      background:
                        dayMarks[0]!.savedKind === "completed"
                          ? "var(--color-success)"
                          : dayMarks[0]!.savedKind === "upcoming"
                            ? "var(--color-upcoming)"
                            : studyColor(
                                hueBySpace.get(dayMarks[0]!.spaceId) ?? PERSONAL_HUE,
                              ).fill,
                      borderRadius:
                        dayMarks[0]!.savedKind === "upcoming" ? "2px" : "999px",
                    }}
                    aria-hidden
                  />
                  <span className={isSelected ? "text-on-primary" : "text-muted"}>
                    {(dayMarks[0]!.detail?.split(" · ").pop() || "Item").slice(0, 8)}
                  </span>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {dayActions && panelDay ? (
        <StudyDayPanel day={panelDay} marks={actionMarksFor(allByDay, panelDay)} actions={dayActions} />
      ) : null}
      {!dayActions && (selected || filter === "today") && (
        <div className="space-y-1">
          {(filter === "today" ? marks : selectedMarks).length === 0 ? (
            <p className="text-sm text-muted">
              {filter === "all"
                ? "Nothing on this day."
                : filter === "today"
                  ? "Nothing today."
                  : filter === "done"
                    ? "Nothing done this day."
                    : "Nothing coming this day."}
            </p>
          ) : (
            <>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              On this day
            </p>
            {(filter === "today" ? marks : selectedMarks).map((mark) => {
              const kindLabel = mark.savedKind
                ? savedDateLabel(
                    { date: mark.day, kind: mark.savedKind },
                    localTodayKey(),
                  )
                : "";
              const when = formatMeetingWhen(mark.day, mark.startTime);
              const groupName = groups.length > 1 ? ` · ${mark.spaceName}` : "";
              const title = mark.detail || (kindLabel ? `${kindLabel} · ${when}` : when);
              return (
              <Link
                key={`${mark.sessionId}-${mark.day}-${mark.source}`}
                to={`/space/${mark.spaceId}`}
                state={{ groupTab: "meetings", day: mark.day }}
                className="block min-h-11 py-2 text-sm text-primary touch-manipulation"
              >
                <span className="inline-flex items-center gap-1.5 font-medium">
                  {mark.savedKind === "completed" ? (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-success" aria-hidden />
                  ) : mark.savedKind === "upcoming" ? (
                    <span className="h-2 w-2 shrink-0 rounded-sm bg-upcoming" aria-hidden />
                  ) : null}
                  <span className={mark.savedKind === "completed" ? "text-success" : undefined}>
                    {title}
                    {groupName}
                  </span>
                </span>
                {mark.note && mark.note !== title ? (
                  <span className="mt-0.5 block text-primary">{mark.note}</span>
                ) : null}
              </Link>
              );
            })}
            </>
          )}
        </div>
      )}
      </div>
      )}
    </section>
  );
}

function visibleMarks(
  marks: MonthMeeting[],
  actions: CalendarDayActions,
): MonthMeeting[] {
  const seen = new Set<string>();
  const shown: MonthMeeting[] = [];
  for (const mark of marks) {
    const key =
      mark.source === "session" || mark.source === "repeat"
        ? actions.copyKey?.(mark.sessionId) ?? null
        : null;
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    shown.push(mark);
  }
  return shown;
}

function RemoveWeekdayMark({ onRemove }: { onRemove: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button type="button" variant="secondary" fullWidth onClick={() => setConfirming(true)}>
        Remove weekday mark
      </Button>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-primary">This drops the date. The meeting plan stays.</p>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" fullWidth onClick={() => setConfirming(false)}>
          Keep
        </Button>
        <Button type="button" fullWidth onClick={onRemove}>
          Remove weekday mark
        </Button>
      </div>
    </div>
  );
}

function actionMarksFor(
  byDay: Map<string, MonthMeeting[]>,
  day: string,
): MonthMeeting[] {
  return byDay.get(day) ?? [];
}

function StudyDayPanel({
  day,
  marks,
  actions,
}: {
  day: string;
  marks: MonthMeeting[];
  actions: CalendarDayActions;
}) {
  if (marks.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted">Nothing on this day.</p>
        <Button type="button" fullWidth onClick={() => actions.onPlan(day)}>
          Plan this day
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        On this day
      </p>
      {visibleMarks(marks, actions).map((mark) => {
        const when = formatMeetingWhen(mark.day, mark.startTime);
        const title = mark.detail || when;
        const copies =
          mark.source === "session" || mark.source === "repeat"
            ? actions.copyCount?.(mark.sessionId) ?? 1
            : 1;
        return (
          <div
            key={`${mark.sessionId}-${mark.day}-${mark.source}`}
            className="space-y-2 rounded-xl border border-border px-3 py-3"
          >
            <p
              className={[
                "text-sm font-medium",
                mark.savedKind === "completed" ? "text-success" : "text-primary",
              ].join(" ")}
            >
              {title}
            </p>
            {mark.note && mark.note !== title ? (
              <p className="text-sm text-primary">{mark.note}</p>
            ) : null}
            {copies > 1 && actions.onReviewCopies ? (
              <Button
                type="button"
                fullWidth
                onClick={() => actions.onReviewCopies?.(mark.sessionId)}
              >
                {copies} copies
              </Button>
            ) : null}
            {copies > 1 && mark.hasSavedMark ? (
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => actions.onRemoveMark(mark.day)}
              >
                Remove mark
              </Button>
            ) : null}
            {mark.source === "held" ? (
              <>
                <Button
                  type="button"
                  fullWidth
                  onClick={() =>
                    actions.onLog(mark.day, mark.startTime, {
                      sessionId: mark.sessionId,
                      day: mark.day,
                    })
                  }
                >
                  Log this night
                </Button>
                {actions.onRemoveHeld ? (
                  <RemoveWeekdayMark
                    onRemove={() => actions.onRemoveHeld?.(mark.sessionId, mark.day)}
                  />
                ) : null}
              </>
            ) : mark.source === "saved" ? (
              <>
                <Button
                  type="button"
                  fullWidth
                  onClick={() =>
                    mark.savedKind === "completed"
                      ? actions.onLog(mark.day, mark.startTime)
                      : actions.onPlan(mark.day)
                  }
                >
                  {mark.savedKind === "completed" ? "Log this night" : "Plan this day"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  onClick={() => actions.onRemoveMark(mark.day)}
                >
                  Remove mark
                </Button>
              </>
            ) : copies > 1 ? null : (
              <>
                <Button
                  type="button"
                  fullWidth
                  onClick={() => actions.onOpen(mark.sessionId, mark.day)}
                >
                  Open
                </Button>
                {mark.hasSavedMark ? (
                  <Button
                    type="button"
                    variant="secondary"
                    fullWidth
                    onClick={() => actions.onRemoveMark(mark.day)}
                  >
                    Remove mark
                  </Button>
                ) : null}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
