import { useState } from "react";
import { formatMeetingWhen, calendarDay } from "../../lib/meetingCalendar";
import { studyLabel } from "../../lib/currentStudy";
import type { PrayerBoardEntry, Session } from "../../types";
import { Button } from "../Button";
import { Card } from "../Card";

export function CopyReview({
  sessions,
  prayers,
  saving,
  onOpen,
  onRemove,
  onClose,
}: {
  sessions: Session[];
  prayers: PrayerBoardEntry[];
  saving: boolean;
  onOpen: (session: Session) => void;
  onRemove: (session: Session) => Promise<void>;
  onClose: () => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const count = sessions.length;

  return (
    <section className="space-y-3" aria-label={`${count} copies`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg text-primary">{count} copies</h3>
          <p className="text-sm text-muted">
            Same study, same day. Keep the one you want.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 shrink-0 px-2 text-sm font-medium text-primary touch-manipulation"
        >
          Close
        </button>
      </div>
      <ul className="space-y-2">
        {sessions.map((session) => {
          const prayerCount = prayers.filter(
            (entry) => entry.sessionId === session.id,
          ).length;
          const passageCount = session.passagesStudied?.length ?? 0;
          const attended = session.attendees?.length ?? 0;
          const when = formatMeetingWhen(
            calendarDay(session.date),
            session.startTime,
          );
          const name = studyLabel(session);
          const confirming = confirmId === session.id;
          return (
            <li key={session.id}>
              <Card className="space-y-2">
                <button
                  type="button"
                  onClick={() => onOpen(session)}
                  className="w-full text-left touch-manipulation"
                >
                  <span className="block text-sm font-medium text-primary">
                    {when}
                    {name ? ` · ${name}` : ""}
                  </span>
                  <span className="block text-sm text-muted">
                    {attended} attended · {passageCount}{" "}
                    {passageCount === 1 ? "passage" : "passages"} · {prayerCount}{" "}
                    {prayerCount === 1 ? "prayer" : "prayers"}
                  </span>
                </button>
                {confirming ? (
                  <div className="space-y-2">
                    <p className="text-sm text-primary">
                      {prayerCount > 0
                        ? `This copy has ${prayerCount} ${prayerCount === 1 ? "prayer" : "prayers"}. Removing it removes ${prayerCount === 1 ? "that prayer" : "those prayers"}.`
                        : "Remove this copy?"}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        fullWidth
                        disabled={saving}
                        onClick={() => setConfirmId(null)}
                      >
                        Keep
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        fullWidth
                        disabled={saving}
                        onClick={() => void onRemove(session)}
                      >
                        {saving ? "Removing…" : "Remove this copy"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    fullWidth
                    disabled={saving}
                    onClick={() => setConfirmId(session.id)}
                  >
                    Remove this copy
                  </Button>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
