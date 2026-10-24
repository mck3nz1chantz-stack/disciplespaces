import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarPlus, ChevronRight, Layers } from "lucide-react";
import { Button } from "../Button";
import { Card } from "../Card";
import { MonthCalendar } from "../MonthCalendar";
import { CurrentStudyList, PastStudyList } from "../CurrentStudyList";
import { CopyReview } from "./CopyReview";
import { useLivePrayerBoard } from "../../hooks/useLiveDb";
import {
  copyGroupFor,
  isCopyLead,
  sessionCopyGroups,
} from "../../lib/sessionCopies";
import { sessionPreview, countFilledSteps } from "../../lib/sessionResponses";
import { sessionDisplayTitle, sessionTitleSubtitle } from "../../lib/sessionTitle";
import { formatPassageRef, formatWeekReading } from "../../lib/passages";
import {
  calendarDay,
  comingForFace,
  formatMeetingWhen,
  repeatLabel,
  type MeetingFace,
} from "../../lib/meetingCalendar";
import type { StudyGroup } from "../../lib/currentStudy";
import type {
  ComingMark,
  Member,
  SavedGroupDate,
  Session,
  Template,
} from "../../types";

export function MeetingsPanel({
  spaceId,
  spaceName,
  colorHue,
  sessions,
  savedDates,
  onRemoveDate,
  focusDay,
  studies,
  saving,
  onOpenSession,
  onCompleteSession,
  onAddPast,
  onFinishStudy,
  focusDoneKey,
  showLoose,
  todayMeetings,
  laterMeetings,
  visiblePast,
  pastCount,
  hiddenPastCount,
  onLoadMore,
  filteredEmpty,
  noMeetings,
  onShowAll,
  onPlan,
  onPlanDay,
  onLogPrevious,
  templates,
  place,
  isHost,
  members,
  onMark,
  onRemoveHeld,
  onRemoveCopy,
}: {
  spaceId: string;
  spaceName: string;
  colorHue?: number;
  sessions: Session[];
  savedDates: SavedGroupDate[];
  onRemoveDate: (date: string) => Promise<void>;
  focusDay?: string | null;
  studies: { current: StudyGroup[]; past: StudyGroup[] };
  saving: boolean;
  onOpenSession: (session: Session, day: string) => void;
  onCompleteSession: (session: Session) => void;
  onAddPast: (study: StudyGroup) => void;
  onFinishStudy: (study: StudyGroup) => void;
  focusDoneKey: string | null;
  showLoose: boolean;
  todayMeetings: MeetingFace[];
  laterMeetings: MeetingFace[];
  visiblePast: MeetingFace[];
  pastCount: number;
  hiddenPastCount: number;
  onLoadMore: () => void;
  filteredEmpty: boolean;
  noMeetings: boolean;
  onShowAll: () => void;
  onPlan: () => void;
  onPlanDay: (day: string) => void;
  onLogPrevious: (day?: string, startTime?: string, held?: { sessionId: string; day: string }) => void;
  templates: Template[];
  place?: string;
  isHost: boolean;
  members: Member[];
  onMark: (session: Session, memberId: string, name: string, mark: ComingMark) => void;
  onRemoveHeld: (sessionId: string, day: string) => Promise<void>;
  onRemoveCopy: (session: Session) => Promise<void>;
}) {
  const prayers = useLivePrayerBoard(spaceId, "all") ?? [];
  const copyGroups = useMemo(() => sessionCopyGroups(sessions), [sessions]);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const reviewSession = sessions.find((session) => session.id === reviewId);
  const reviewGroup = reviewSession
    ? copyGroupFor(reviewSession, copyGroups)
    : undefined;

  function collapseCopyFaces(faces: MeetingFace[]): MeetingFace[] {
    const seen = new Set<string>();
    const out: MeetingFace[] = [];
    for (const face of faces) {
      if (face.held) {
        out.push(face);
        continue;
      }
      const group = copyGroupFor(face.session, copyGroups);
      if (!group) {
        out.push(face);
        continue;
      }
      if (seen.has(group.key) || !isCopyLead(face.session, copyGroups)) continue;
      seen.add(group.key);
      out.push(face);
    }
    return out;
  }

  function copyProps(session: Session) {
    const group = copyGroupFor(session, copyGroups);
    const count = group?.sessions.length ?? 1;
    if (count < 2) return {};
    return {
      copyCount: count,
      onReviewCopies: () => setReviewId(session.id),
    };
  }
  return (
    <div
      className="space-y-5"
      role="tabpanel"
      id="group-panel-meetings"
      aria-labelledby="group-tab-meetings"
    >
      <MonthCalendar
        groups={[
          {
            id: spaceId,
            name: spaceName,
            colorHue,
            sessions,
            savedDates,
          },
        ]}
        focusDay={focusDay}
        dayActions={{
          onOpen: (sessionId, day) => {
            const session = sessions.find((row) => row.id === sessionId);
            if (session) onOpenSession(session, day);
          },
          onPlan: onPlanDay,
          onLog: (day, startTime, held) => onLogPrevious(day, startTime, held),
          onRemoveMark: (day) => void onRemoveDate(day),
          copyKey: (sessionId) => {
            const session = sessions.find((row) => row.id === sessionId);
            return session ? copyGroupFor(session, copyGroups)?.key ?? null : null;
          },
          copyCount: (sessionId) => {
            const session = sessions.find((row) => row.id === sessionId);
            return session
              ? copyGroupFor(session, copyGroups)?.sessions.length ?? 1
              : 1;
          },
          onReviewCopies: (sessionId) => setReviewId(sessionId),
          onRemoveHeld: (sessionId, day) => void onRemoveHeld(sessionId, day),
        }}
      />

      {reviewGroup ? (
        <CopyReview
          sessions={reviewGroup.sessions}
          prayers={prayers}
          saving={saving}
          onOpen={(session) =>
            onOpenSession(session, calendarDay(session.date))
          }
          onRemove={async (session) => {
            await onRemoveCopy(session);
            setReviewId(session.id);
          }}
          onClose={() => setReviewId(null)}
        />
      ) : null}

      <CurrentStudyList
        studies={studies.current}
        saving={saving}
        onOpen={(session) => onOpenSession(session, calendarDay(session.date))}
        onComplete={onCompleteSession}
        onAddPast={onAddPast}
        onFinish={onFinishStudy}
        focusDoneKey={focusDoneKey}
        copyGroups={copyGroups}
        onReviewCopies={(session) => setReviewId(session.id)}
      />
      <PastStudyList
        studies={studies.past}
        onOpen={(session) => onOpenSession(session, calendarDay(session.date))}
        copyGroups={copyGroups}
        onReviewCopies={(session) => setReviewId(session.id)}
      />

      {showLoose && (
        <div id="group-past" className="space-y-5 scroll-mt-24">
          {todayMeetings.length > 0 && (
            <section className="space-y-2.5" aria-label="Today">
              <div>
                <h3 className="text-lg">Today</h3>
                <p className="text-sm text-muted">
                  Current session. Later dates stay under Upcoming.
                </p>
              </div>
              <ul className="space-y-2.5">
                {collapseCopyFaces(todayMeetings).map((face) => (
                  <SessionRow
                    key={`${face.session.id}-today`}
                    kicker="Current"
                    session={face.session}
                    whenLabel={formatMeetingWhen(face.day, face.startTime)}
                    repeatNote={repeatLabel(face.session) ?? undefined}
                    template={templates.find((t) => t.id === face.session.templateId)}
                    onOpen={() => onOpenSession(face.session, face.day)}
                    showWeek
                    place={place}
                    coming={comingForFace(face)}
                    members={isHost ? members : undefined}
                    onMark={
                      isHost
                        ? (memberId, name, mark) =>
                            onMark(face.session, memberId, name, mark)
                        : undefined
                    }
                    {...copyProps(face.session)}
                  />
                ))}
              </ul>
            </section>
          )}
          <section className="space-y-2.5" aria-label="Upcoming">
            <h3 className="text-lg">Upcoming</h3>
            {filteredEmpty ? (
              <Card className="text-center py-6 space-y-3">
                <Layers className="h-9 w-9 mx-auto text-muted" aria-hidden />
                <p className="font-medium text-primary">Nothing in this filter</p>
                <Button variant="secondary" onClick={onShowAll}>
                  Show all meetings
                </Button>
              </Card>
            ) : noMeetings ? (
              <Card className="text-center py-6 space-y-3">
                <p className="text-sm text-muted">No meeting planned</p>
                <Button onClick={onPlan} disabled={saving}>
                  <CalendarPlus className="h-5 w-5" aria-hidden />
                  Plan a meeting
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => onLogPrevious()}
                  disabled={saving}
                >
                  Log a previous date
                </Button>
              </Card>
            ) : laterMeetings.length === 0 ? (
              <p className="text-sm text-muted">No later meeting scheduled.</p>
            ) : (
              <ul className="space-y-2.5">
                {collapseCopyFaces(laterMeetings).map((face, index) => (
                  <SessionRow
                    key={`${face.session.id}-up`}
                    session={face.session}
                    whenLabel={formatMeetingWhen(face.day, face.startTime)}
                    repeatNote={repeatLabel(face.session) ?? undefined}
                    template={templates.find((t) => t.id === face.session.templateId)}
                    onOpen={() => onOpenSession(face.session, face.day)}
                    showWeek
                    place={index === 0 ? place : undefined}
                    coming={comingForFace(face)}
                    members={isHost ? members : undefined}
                    onMark={
                      isHost
                        ? (memberId, name, mark) =>
                            onMark(face.session, memberId, name, mark)
                        : undefined
                    }
                    {...copyProps(face.session)}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2.5" aria-label="Past">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg">Past</h3>
              <Button
                variant="secondary"
                className="!py-2"
                onClick={() => onLogPrevious()}
                disabled={saving}
              >
                Log a previous date
              </Button>
            </div>
            {pastCount === 0 ? (
              <p className="text-sm text-muted">
                No past meetings yet. Log a Wednesday you already met.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {collapseCopyFaces(visiblePast).map((face) => (
                  <SessionRow
                    key={`${face.session.id}-${face.day}-${face.startTime ?? ""}-${face.held ? "h" : "p"}`}
                    session={face.session}
                    whenLabel={formatMeetingWhen(face.day, face.startTime)}
                    template={templates.find((t) => t.id === face.session.templateId)}
                    onOpen={() =>
                      face.held
                        ? onLogPrevious(face.day, face.startTime, {
                            sessionId: face.session.id,
                            day: face.day,
                          })
                        : onOpenSession(face.session, face.day)
                    }
                    showWeek={!face.held}
                    held={face.held}
                    coming={comingForFace(face)}
                    onConfirmPrevious={
                      face.held
                        ? () =>
                            onLogPrevious(face.day, face.startTime, {
                              sessionId: face.session.id,
                              day: face.day,
                            })
                        : undefined
                    }
                    {...copyProps(face.session)}
                    onRemoveWeekday={
                      face.held
                        ? () => void onRemoveHeld(face.session.id, face.day)
                        : undefined
                    }
                  />
                ))}
              </ul>
            )}
            {hiddenPastCount > 0 && (
              <Button variant="secondary" fullWidth onClick={onLoadMore}>
                Load more
                <span className="text-xs text-muted font-normal">
                  ({hiddenPastCount} left)
                </span>
              </Button>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function SessionRow({
  session,
  template,
  onOpen,
  whenLabel,
  repeatNote,
  showWeek = false,
  place,
  coming = [],
  members,
  onMark,
  onConfirmPrevious,
  held = false,
  kicker,
  copyCount,
  onReviewCopies,
  onRemoveWeekday,
}: {
  session: Session;
  template?: Template;
  onOpen: () => void;
  whenLabel: string;
  repeatNote?: string;
  showWeek?: boolean;
  place?: string;
  coming?: { memberId: string; name: string; mark: ComingMark }[];
  members?: Member[];
  onMark?: (memberId: string, name: string, mark: ComingMark) => void;
  onConfirmPrevious?: () => void;
  held?: boolean;
  kicker?: string;
  copyCount?: number;
  onReviewCopies?: () => void;
  onRemoveWeekday?: () => void;
}) {
  const [dropHeld, setDropHeld] = useState(false);
  const dateLabel = repeatNote ? `${whenLabel} · ${repeatNote}` : whenLabel;
  const attendeeCount = session.attendees?.length ?? 0;
  const preview = sessionPreview(session, template);
  const progress = template
    ? countFilledSteps(template, session.responses)
    : null;
  const covered = (session.passagesStudied ?? [])
    .map((row) => formatPassageRef(row))
    .filter(Boolean);
  const heading = held ? "Not logged yet" : sessionDisplayTitle(session, template);
  const subtitle = sessionTitleSubtitle(session, template);
  const week = showWeek ? session.weekPassage : undefined;
  const question = showWeek ? session.weekQuestion?.trim() : "";
  const passageHref = week
    ? (() => {
        const params = new URLSearchParams({
          b: week.bookId,
          c: String(week.chapter),
        });
        if (week.startVerse) {
          params.set("sv", String(week.startVerse));
          params.set("ev", String(week.endVerse ?? week.startVerse));
        }
        return `/bible?${params.toString()}`;
      })()
    : null;

  return (
    <li>
      <Card padding="sm" className="hover:border-primary/30 transition-colors">
        <button
          type="button"
          onClick={onOpen}
          className="w-full text-left touch-manipulation active:scale-[0.99] transition-transform"
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {kicker ? (
                    <p className="text-xs font-semibold text-success">{kicker}</p>
                  ) : null}
                  <p className="font-medium text-primary truncate">{heading}</p>
                  <p className="text-xs text-muted">
                    {dateLabel}
                    {place ? ` · ${place}` : ""}
                    {subtitle ? ` · ${subtitle}` : ""}
                  </p>
                </div>
                <ChevronRight
                  className="h-5 w-5 shrink-0 text-muted mt-0.5"
                  aria-hidden
                />
              </div>
              <p className="text-xs text-muted">
                {attendeeCount === 0
                  ? "No attendees"
                  : `${attendeeCount} attended`}
                {progress && progress.total > 0
                  ? ` · ${progress.filled}/${progress.total} steps noted`
                  : null}
                {(session.passagesStudied?.length ?? 0) > 0
                  ? ` · ${session.passagesStudied.length} passage${session.passagesStudied.length === 1 ? "" : "s"}`
                  : null}
              </p>
              {covered.length > 0 ? (
                <p className="text-sm text-primary pt-0.5">{covered.join(" · ")}</p>
              ) : null}
              {preview ? (
                <p className="text-sm text-muted line-clamp-2 pt-0.5">{preview}</p>
              ) : !week && !question ? (
                <p className="text-sm text-muted/70 italic pt-0.5">
                  No notes yet — tap to open
                </p>
              ) : null}
            </div>
          </div>
        </button>
        {week && passageHref && (
          <p className="text-sm pt-1">
            <Link
              to={passageHref}
              className="font-medium text-primary underline-offset-2 hover:underline touch-manipulation"
            >
              {formatWeekReading(week)}
            </Link>
          </p>
        )}
        {question ? <p className="text-sm text-primary pt-0.5">{question}</p> : null}
        {onConfirmPrevious ? (
          <Button
            type="button"
            variant="secondary"
            className="mt-2"
            fullWidth
            onClick={onConfirmPrevious}
          >
            Confirm previous date
          </Button>
        ) : null}
        {copyCount && copyCount > 1 && onReviewCopies ? (
          <Button
            type="button"
            variant="secondary"
            className="mt-2"
            fullWidth
            onClick={onReviewCopies}
          >
            {copyCount} copies
          </Button>
        ) : null}
        {onRemoveWeekday ? (
          dropHeld ? (
            <div className="mt-2 space-y-2">
              <p className="text-sm text-primary">
                This drops the date. The meeting plan stays.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  onClick={() => setDropHeld(false)}
                >
                  Keep
                </Button>
                <Button type="button" fullWidth onClick={onRemoveWeekday}>
                  Remove weekday mark
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="mt-2"
              fullWidth
              onClick={() => setDropHeld(true)}
            >
              Remove weekday mark
            </Button>
          )
        ) : null}
        {members && members.length > 0 && onMark ? (
          <ul className="space-y-1.5 pt-2">
            {members.map((member) => {
              const mark = coming.find((row) => row.memberId === member.id)?.mark;
              return (
                <li
                  key={member.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-sm text-primary truncate">{member.name}</span>
                  <span className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => onMark(member.id, member.name, "coming")}
                      className={[
                        "rounded-full px-2.5 py-1 text-xs font-medium touch-manipulation",
                        mark === "coming"
                          ? "bg-primary text-on-primary"
                          : "border border-border text-muted",
                      ].join(" ")}
                      aria-pressed={mark === "coming"}
                    >
                      Coming
                    </button>
                    <button
                      type="button"
                      onClick={() => onMark(member.id, member.name, "cant")}
                      className={[
                        "rounded-full px-2.5 py-1 text-xs font-medium touch-manipulation",
                        mark === "cant"
                          ? "bg-primary text-on-primary"
                          : "border border-border text-muted",
                      ].join(" ")}
                      aria-pressed={mark === "cant"}
                    >
                      Can’t
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : coming.length > 0 ? (
          <p className="text-sm text-muted pt-1">
            {coming
              .map(
                (row) =>
                  `${row.name} · ${row.mark === "cant" ? "Can’t" : "Coming"}`,
              )
              .join(", ")}
          </p>
        ) : null}
      </Card>
    </li>
  );
}
