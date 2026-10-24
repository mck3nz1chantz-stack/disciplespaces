import { Link } from "react-router-dom";
import { BookOpen, CalendarPlus, HandHeart, Lock } from "lucide-react";
import { Button } from "../Button";
import { Card } from "../Card";
import type { NextNight } from "../../lib/nextNight";
import {
  formatMeetingWhen,
  localTodayKey,
  repeatLabel,
} from "../../lib/meetingCalendar";
import { normalizeHue, PERSONAL_HUE, studyColor } from "../../lib/study";
import { formatAimLine, formatQueueLabel } from "../../lib/studyQueue";
import { useLiveStudyQueue } from "../../hooks/useLiveDb";
import { formatWeekReading } from "../../lib/passages";
import { spaceKindLabel, type Space } from "../../types";
import type { ReactNode } from "react";

export function TonightPanel({
  space,
  isGuest,
  nextNight,
  showGather,
  gatherActive,
  saving,
  hasSession,
  prayerCount,
  people,
  onOpenRead,
  onEditStudied,
  onEditWhatsNext,
  onOpenNight,
  onPlan,
  onGather,
  onStudy,
  onPrayer,
  onPrivate,
  showOfflineNote,
  sharingError,
  onOpenSharing,
}: {
  space: Space;
  isGuest: boolean;
  nextNight: NextNight | null;
  showGather: boolean;
  gatherActive: boolean;
  saving: boolean;
  hasSession: boolean;
  prayerCount?: number;
  people: ReactNode;
  onOpenRead: () => void;
  onEditStudied: () => void;
  onEditWhatsNext: () => void;
  onOpenNight: () => void;
  onPlan: () => void;
  onGather: () => void;
  onStudy: () => void;
  onPrayer: () => void;
  onPrivate: () => void;
  showOfflineNote: boolean;
  sharingError: boolean;
  onOpenSharing: () => void;
}) {
  const queue = useLiveStudyQueue(space.id);
  const nextReading = (queue ?? [])[0];
  const color = studyColor(normalizeHue(space.colorHue) ?? PERSONAL_HUE);
  const leftOff = space.readingPlace?.bookId
    ? formatQueueLabel({
        bookName: space.readingPlace.bookName || space.readingPlace.bookId,
        chapter: space.readingPlace.chapter,
      })
    : "Not opened yet";
  const week = nextNight?.session.weekPassage;

  return (
    <div
      className="space-y-5"
      role="tabpanel"
      id="group-panel-tonight"
      aria-labelledby="group-tab-tonight"
    >
      <Card padding="lg" className="border-primary/15 space-y-3" aria-label="Group overview">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
          {spaceKindLabel(space.spaceKind)}
          {isGuest ? " · Guest on this phone" : " · Your group"}
        </p>
        <h2 className="flex items-center gap-2 text-2xl sm:text-3xl leading-tight tracking-tight">
          <span
            className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10"
            style={{ background: color.fill }}
            aria-hidden
          />
          <span className="min-w-0">{space.name}</span>
        </h2>
        <p className="text-sm text-primary">
          <Link
            to="/bible"
            onClick={onOpenRead}
            className="underline-offset-2 hover:underline"
          >
            Left off · {leftOff}
          </Link>
        </p>
        {nextReading ? (
          <p className="text-sm text-primary">
            Next · {formatQueueLabel(nextReading)}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <button
            type="button"
            onClick={onEditStudied}
            className="min-h-11 text-sm font-medium text-primary underline-offset-2 hover:underline touch-manipulation"
          >
            Edit studied
          </button>
          <button
            type="button"
            onClick={onEditWhatsNext}
            className="min-h-11 text-sm font-medium text-primary underline-offset-2 hover:underline touch-manipulation"
          >
            Edit what’s next
          </button>
        </div>
        {space.studyAim ? (
          <p className="text-sm text-muted">{formatAimLine(space.studyAim)}</p>
        ) : null}
      </Card>

      {nextNight ? (
        <Card className="border-primary/30 bg-primary/5 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {nextNight.day === localTodayKey() ? "Today" : "Next meeting"}
          </p>
          <button
            type="button"
            onClick={onOpenNight}
            className="block w-full text-left touch-manipulation"
          >
            <p className="text-base font-medium text-primary">
              {formatMeetingWhen(nextNight.day, nextNight.startTime)}
              {repeatLabel(nextNight.session)
                ? ` · ${repeatLabel(nextNight.session)}`
                : ""}
            </p>
            {space.place ? (
              <p className="text-sm text-primary mt-0.5">{space.place}</p>
            ) : null}
          </button>
          {week ? (
            <p className="text-sm">
              <Link
                to={weekHref(week)}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                {formatWeekReading(week)}
              </Link>
            </p>
          ) : null}
          {nextNight.session.weekQuestion ? (
            <p className="text-sm text-primary">{nextNight.session.weekQuestion}</p>
          ) : null}
        </Card>
      ) : (
        <Card className="space-y-3 text-center">
          <p className="text-sm text-muted">No meeting planned</p>
          <Button onClick={onPlan} disabled={saving}>
            <CalendarPlus className="h-5 w-5" aria-hidden />
            Plan a meeting
          </Button>
        </Card>
      )}

      {showGather && !gatherActive ? (
        <div className="space-y-2">
          <Button
            fullWidth
            className="!py-4 text-base shadow-md border border-primary/20"
            onClick={onGather}
            disabled={saving}
          >
            <CalendarPlus className="h-5 w-5" aria-hidden />
            {saving ? "Starting…" : hasSession ? "Gather tonight" : "Gather · first meeting"}
          </Button>
          <p className="text-[11px] text-muted text-center leading-snug">
            One path: Meet · Study · Prayer
          </p>
        </div>
      ) : null}

      {showOfflineNote ? (
        <p className="text-[11px] text-amber-800 dark:text-amber-200 text-center">
          App is Offline. Switch it under Group sharing or More. Meetings still save on this phone.
        </p>
      ) : null}

      {sharingError ? (
        <button
          type="button"
          onClick={onOpenSharing}
          className="w-full rounded-xl border border-danger/30 bg-danger/10 px-3 py-3 text-left text-sm font-medium text-danger touch-manipulation"
        >
          Group sharing needs a look
        </button>
      ) : null}

      <section className="space-y-2" aria-label="While you meet">
        <h3 className="text-sm font-semibold text-primary">While you meet</h3>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onStudy}
            className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-surface/95 px-2 py-3.5 text-center touch-manipulation active:scale-[0.98] hover:border-primary/30"
          >
            <BookOpen className="h-6 w-6 text-primary" aria-hidden />
            <span className="text-xs font-medium text-primary leading-tight">
              {hasSession ? "Study" : "Bible"}
            </span>
          </button>
          <button
            type="button"
            onClick={onPrayer}
            className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-surface/95 px-2 py-3.5 text-center touch-manipulation active:scale-[0.98] hover:border-primary/30"
          >
            <HandHeart className="h-6 w-6 text-primary" aria-hidden />
            <span className="text-xs font-medium text-primary leading-tight">
              Prayer
              {typeof prayerCount === "number" && prayerCount > 0
                ? ` (${prayerCount})`
                : ""}
            </span>
          </button>
          <button
            type="button"
            onClick={onPrivate}
            className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-surface/95 px-2 py-3.5 text-center touch-manipulation active:scale-[0.98] hover:border-primary/30"
          >
            <Lock className="h-6 w-6 text-primary" aria-hidden />
            <span className="text-xs font-medium text-primary leading-tight">
              Just for me
            </span>
          </button>
        </div>
      </section>

      {people}
    </div>
  );
}

function weekHref(week: {
  bookId: string;
  chapter: number;
  startVerse?: number;
  endVerse?: number;
}): string {
  const params = new URLSearchParams({
    b: week.bookId,
    c: String(week.chapter),
  });
  if (week.startVerse) {
    params.set("sv", String(week.startVerse));
    params.set("ev", String(week.endVerse ?? week.startVerse));
  }
  return `/bible?${params.toString()}`;
}
