import { useEffect, useState } from "react";
import { formatPassageRef } from "../lib/passages";
import {
  sessionNumberLabel,
  type StudyGroup,
} from "../lib/currentStudy";
import { calendarDay, formatMeetingWhen } from "../lib/meetingCalendar";
import {
  copyGroupFor,
  isCopyLead,
  type SessionCopyGroup,
} from "../lib/sessionCopies";
import type { Session } from "../types";
import { Button } from "./Button";
import { Card } from "./Card";

function nightLine(session: Session): string {
  const when = formatMeetingWhen(
    calendarDay(session.date),
    session.startTime,
  );
  const passages = (session.passagesStudied ?? [])
    .map((row) => formatPassageRef(row))
    .filter(Boolean);
  const lesson = passages.slice(0, 2).join(", ");
  const attended = `${session.attendees?.length ?? 0} attended`;
  return [when, lesson, attended].filter(Boolean).join(" · ");
}

/** Completed nights and the next night inside one current study. */
export function CurrentStudyList({
  studies,
  onOpen,
  onComplete,
  onAddPast,
  onFinish,
  saving,
  focusDoneKey,
  copyGroups = [],
  onReviewCopies,
}: {
  studies: StudyGroup[];
  onOpen: (session: Session) => void;
  onComplete: (session: Session) => void;
  onAddPast: (study: StudyGroup) => void;
  onFinish: (study: StudyGroup) => void;
  saving: boolean;
  copyGroups?: SessionCopyGroup[];
  onReviewCopies?: (session: Session) => void;
  /** Switch this study to Completed after a night is added. */
  focusDoneKey?: string | null;
}) {
  const [lens, setLens] = useState<Record<string, "done" | "next">>({});
  const [confirmFinish, setConfirmFinish] = useState<string | null>(null);

  useEffect(() => {
    if (!focusDoneKey) return;
    setLens((current) => ({ ...current, [focusDoneKey]: "done" }));
  }, [focusDoneKey]);

  if (studies.length === 0) return null;

  return (
    <div className="space-y-4">
      {studies.map((study) => {
        const mode = lens[study.key] ?? (study.next ? "next" : "done");
        const showingDone = mode === "done";
        return (
          <section key={study.key} className="space-y-2.5" aria-label={`Current study ${study.name}`}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Current study
              </p>
              <h3 className="text-lg text-primary">{study.name}</h3>
              <p className="text-sm text-muted">
                Completed nights stay part of {study.name}. Complete the study only when the whole book is finished.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1" role="group" aria-label={`${study.name} sessions`}>
              <button
                type="button"
                aria-pressed={showingDone}
                onClick={() => setLens((current) => ({ ...current, [study.key]: "done" }))}
                className={[
                  "min-h-11 rounded-lg px-2 text-sm font-medium touch-manipulation",
                  showingDone
                    ? "bg-primary text-on-primary"
                    : "border border-border text-primary",
                ].join(" ")}
              >
                Completed ({study.done.length})
              </button>
              <button
                type="button"
                aria-pressed={!showingDone}
                onClick={() => setLens((current) => ({ ...current, [study.key]: "next" }))}
                className={[
                  "min-h-11 rounded-lg px-2 text-sm font-medium touch-manipulation",
                  !showingDone
                    ? "bg-primary text-on-primary"
                    : "border border-border text-primary",
                ].join(" ")}
              >
                Upcoming ({study.next ? 1 : 0})
              </button>
            </div>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => onAddPast(study)}
              disabled={saving}
            >
              Add a completed session
            </Button>
            {showingDone ? (
              study.done.length === 0 ? (
                <p className="text-sm text-muted">No completed sessions yet.</p>
              ) : (
                <ul className="space-y-2">
                  {study.done.map((session, index) => {
                    if (!isCopyLead(session, copyGroups)) return null;
                    const copies = copyGroupFor(session, copyGroups);
                    return (
                    <li key={session.id}>
                      <button
                        type="button"
                        onClick={() => onOpen(session)}
                        className="w-full min-h-11 rounded-xl border border-success/40 bg-surface px-3 py-2.5 text-left touch-manipulation"
                      >
                        <span className="block text-sm font-medium text-success">
                          {sessionNumberLabel(session, index + 1)} completed
                        </span>
                        <span className="block text-xs text-muted">Part of {study.name}</span>
                        <span className="block text-sm text-primary">{nightLine(session)}</span>
                      </button>
                      {copies && onReviewCopies ? (
                        <Button
                          type="button"
                          variant="secondary"
                          fullWidth
                          className="mt-2"
                          onClick={() => onReviewCopies(session)}
                        >
                          {copies.sessions.length} copies
                        </Button>
                      ) : null}
                    </li>
                    );
                  })}
                </ul>
              )
            ) : study.next ? (
              <Card className="space-y-2">
                <button
                  type="button"
                  onClick={() => onOpen(study.next!)}
                  className="w-full text-left touch-manipulation"
                >
                  <span className="block text-sm font-medium text-primary">
                    {sessionNumberLabel(study.next, study.done.length + 1)}
                  </span>
                  <span className="block text-sm text-muted">{nightLine(study.next)}</span>
                </button>
                <Button
                  type="button"
                  fullWidth
                  onClick={() => onComplete(study.next!)}
                  disabled={saving}
                >
                  Complete session
                </Button>
              </Card>
            ) : (
              <p className="text-sm text-muted">No upcoming session.</p>
            )}
            {confirmFinish === study.key ? (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  onClick={() => setConfirmFinish(null)}
                  disabled={saving}
                >
                  Keep study
                </Button>
                <Button
                  type="button"
                  fullWidth
                  onClick={() => {
                    onFinish(study);
                    setConfirmFinish(null);
                  }}
                  disabled={saving}
                >
                  Complete study
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => setConfirmFinish(study.key)}
                disabled={saving}
              >
                Complete study
              </Button>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** A finished study. Its nights are the record, not the living plan. */
export function PastStudyList({
  studies,
  onOpen,
  copyGroups = [],
  onReviewCopies,
}: {
  studies: StudyGroup[];
  onOpen: (session: Session) => void;
  copyGroups?: SessionCopyGroup[];
  onReviewCopies?: (session: Session) => void;
}) {
  if (studies.length === 0) return null;
  return (
    <div className="space-y-4">
      {studies.map((study) => (
        <section key={study.key} className="space-y-2" aria-label={`Past study ${study.name}`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Completed study
            </p>
            <h3 className="text-lg text-primary">{study.name}</h3>
          </div>
          <ul className="space-y-2">
            {study.done.map((session, index) => {
              if (!isCopyLead(session, copyGroups)) return null;
              const copies = copyGroupFor(session, copyGroups);
              return (
              <li key={session.id}>
                <button
                  type="button"
                  onClick={() => onOpen(session)}
                  className="w-full min-h-11 rounded-xl border border-border bg-surface px-3 py-2.5 text-left touch-manipulation"
                >
                  <span className="block text-sm font-medium text-primary">
                    {sessionNumberLabel(session, index + 1)}
                  </span>
                  <span className="block text-sm text-muted">{nightLine(session)}</span>
                </button>
                {copies && onReviewCopies ? (
                  <Button
                    type="button"
                    variant="secondary"
                    fullWidth
                    className="mt-2"
                    onClick={() => onReviewCopies(session)}
                  >
                    {copies.sessions.length} copies
                  </Button>
                ) : null}
              </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
