import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Calendar, ChevronDown } from "lucide-react";
import {
  formatMeetingWhen,
  isOccurrencePast,
  meetingsInMonth,
  type MonthMeeting,
} from "../lib/meetingCalendar";
import type { Session } from "../types";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
type CalendarFilter = "coming" | "done" | "today";

const FILTERS: { id: CalendarFilter; label: string }[] = [
  { id: "coming", label: "Coming" },
  { id: "done", label: "Done" },
  { id: "today", label: "Today" },
];

export function MonthCalendar({
  groups,
}: {
  groups: Array<{ id: string; name: string; sessions?: Session[] }>;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<CalendarFilter>("coming");
  const [open, setOpen] = useState(false);

  const marks = useMemo(() => {
    const now = new Date();
    const todayKey = format(now, "yyyy-MM-dd");
    return meetingsInMonth(groups, cursor.year, cursor.month).filter((mark) => {
      if (filter === "today") return mark.day === todayKey;
      const past = isOccurrencePast(mark.day, mark.startTime, now);
      return filter === "done" ? past : !past;
    });
  }, [groups, cursor.year, cursor.month, filter]);
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
  const selectedMarks = selected ? byDay.get(selected) ?? [] : [];
  const countWord = marks.length === 1 ? "1 meeting" : `${marks.length} meetings`;
  const countLabel =
    filter === "today"
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
      <div className="grid grid-cols-3 gap-1" role="group" aria-label="Show meetings">
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
                } else {
                  setSelected(null);
                }
              }}
              className={[
                "rounded-lg py-2 text-xs font-medium touch-manipulation",
                on ? "bg-primary text-on-primary" : "border border-border text-muted",
              ].join(" ")}
            >
              {item.label}
            </button>
          );
        })}
      </div>
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
                  ? `${dayNum}, ${dayMarks.length} meeting${dayMarks.length === 1 ? "" : "s"}`
                  : String(dayNum)
              }
            >
              <span className="block leading-none">{dayNum}</span>
              {dayMarks.length > 0 && (
                <span className="mt-1 flex justify-center gap-0.5" aria-hidden>
                  {dayMarks.slice(0, 3).map((mark) => (
                    <span
                      key={mark.sessionId}
                      className={[
                        "h-1 w-1 rounded-full",
                        isSelected ? "bg-on-primary" : "bg-primary",
                      ].join(" ")}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {(selected || filter === "today") && (
        <div className="space-y-1">
          {(filter === "today" ? marks : selectedMarks).length === 0 ? (
            <p className="text-sm text-muted">
              {filter === "today"
                ? "Nothing today."
                : filter === "done"
                  ? "Nothing done this day."
                  : "Nothing coming this day."}
            </p>
          ) : (
            (filter === "today" ? marks : selectedMarks).map((mark) => (
              <Link
                key={`${mark.sessionId}-${mark.day}`}
                to={`/space/${mark.spaceId}`}
                className="block text-sm text-primary touch-manipulation"
              >
                {formatMeetingWhen(mark.day, mark.startTime)}
                {groups.length > 1 ? ` · ${mark.spaceName}` : ""}
              </Link>
            ))
          )}
        </div>
      )}
      </div>
      )}
    </section>
  );
}
