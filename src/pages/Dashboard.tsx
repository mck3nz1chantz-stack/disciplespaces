import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { AddPersonForm } from "../components/AddPersonForm";
import { InlineRename } from "../components/InlineRename";
import { MemberChip } from "../components/MemberChip";
import {
  consumePendingHomeAction,
  consumePendingJoinRaw,
} from "../components/Layout";
import { lastActivityIso, useAppStore } from "../stores/useAppStore";
import { useLiveSpaces, useLiveStudyNoteCount, useLiveStudyQueue } from "../hooks/useLiveDb";
import { getSpaceTemplateMeta } from "../lib/spaceTemplates";
import type { Space } from "../types";
import { maxMembersForSpace, spaceKindLabel } from "../types";
import { formatMeetingWhen, soonestUpcoming } from "../lib/meetingCalendar";
import { MonthCalendar } from "../components/MonthCalendar";
import { StudyColorControl } from "../components/StudyColorControl";
import { isPersonalStudy } from "../lib/study";
import { formatQueueLabel } from "../lib/studyQueue";

export function Dashboard() {
  const navigate = useNavigate();
  const storeSpaces = useAppStore((s) => s.spaces);
  const liveSpaces = useLiveSpaces();
  /** Prefer live Dexie list when ready; fall back to store during first paint. */
  const spaces = liveSpaces ?? storeSpaces;
  const isLoading = useAppStore((s) => s.isLoading) && liveSpaces === undefined;
  const error = useAppStore((s) => s.error);
  const initialize = useAppStore((s) => s.initialize);
  const setActiveStudy = useAppStore((s) => s.setActiveStudy);
  const updateSpace = useAppStore((s) => s.updateSpace);
  const addMember = useAppStore((s) => s.addMember);
  const removeMember = useAppStore((s) => s.removeMember);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  // Legacy home-action handoff → full-page routes (deep links restore a place)
  useEffect(() => {
    function openPendingFromHandoff() {
      const action = consumePendingHomeAction();
      if (action === "create") {
        navigate("/new");
        return;
      }
      if (action === "join") {
        navigate("/join");
        return;
      }

      const pendingJoin = consumePendingJoinRaw();
      if (pendingJoin) {
        try {
          sessionStorage.setItem("ds-pending-join-raw", pendingJoin);
        } catch {
          // ignore
        }
        navigate("/join");
      }
    }

    openPendingFromHandoff();
    window.addEventListener("ds-pending-join", openPendingFromHandoff);
    return () =>
      window.removeEventListener("ds-pending-join", openPendingFromHandoff);
  }, [navigate]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl">Your studies</h2>
        <p className="text-sm text-muted mt-1">
          Your own reading, plus each group. Notes stay on this phone.
        </p>
      </div>

      {spaces.length > 0 && <MonthCalendar groups={spaces} />}

      {(() => {
        const next = spaces.length > 0 ? soonestUpcoming(spaces) : null;
        if (!next) return null;
        return (
          <Link
            to={`/space/${next.spaceId}`}
            className="block touch-manipulation"
          >
            <Card className="border-primary/30 bg-primary/5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Next meeting
              </p>
              <p className="text-base font-medium text-primary mt-1">
                {formatMeetingWhen(next.face.day, next.face.startTime)}
              </p>
              <p className="text-sm text-muted mt-0.5">
                {next.spaceName}
                {next.place ? ` · ${next.place}` : ""}
              </p>
            </Card>
          </Link>
        );
      })()}

      {spaces.length > 0 && (
      <div className="grid grid-cols-2 gap-2">
        <Button
          fullWidth
          className="!py-3.5"
          onClick={() => navigate("/new")}
        >
          <Plus className="h-5 w-5" aria-hidden />
          New study
        </Button>
        <Button
          variant="secondary"
          fullWidth
          className="!py-3.5"
          onClick={() => navigate("/join")}
        >
          <UserPlus className="h-5 w-5" aria-hidden />
          Join a group
        </Button>
      </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/25 bg-danger/8 px-3 py-2.5 text-sm space-y-2"
        >
          <p className="font-medium text-danger leading-snug line-clamp-3">
            {error}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              className="text-sm font-semibold text-primary underline-offset-2 hover:underline touch-manipulation"
              onClick={() => {
                useAppStore.getState().clearError();
                void initialize();
              }}
            >
              Try again
            </button>
            <span className="text-xs text-muted">
              Or More → Open a copy.
            </span>
          </div>
        </div>
      )}

      {isLoading && spaces.length === 0 && (
        <p className="text-sm text-muted">Loading…</p>
      )}

      {!isLoading && spaces.length === 0 && (
        <Card className="text-center py-10 space-y-4">
          <Users className="h-10 w-10 mx-auto text-muted" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium text-primary">No groups yet</p>
            <p className="text-sm text-muted max-w-xs mx-auto">
              Start a small group, or join one you were invited to.
            </p>
          </div>
          <div className="flex flex-col gap-2 max-w-xs mx-auto w-full">
            <Button onClick={() => navigate("/new")}>
              <Plus className="h-5 w-5" aria-hidden />
              New study
            </Button>
            <Button variant="secondary" onClick={() => navigate("/join")}>
              <UserPlus className="h-5 w-5" aria-hidden />
              Join a group
            </Button>
          </div>
        </Card>
      )}

      <ul className="space-y-3">
        {[...spaces]
          .sort((a, b) => {
            const aPersonal = isPersonalStudy(a) ? 0 : 1;
            const bPersonal = isPersonalStudy(b) ? 0 : 1;
            if (aPersonal !== bPersonal) return aPersonal - bPersonal;
            return lastActivityIso(b).localeCompare(lastActivityIso(a));
          })
          .map((space) => (
            <li key={space.id}>
              <StudyCard
                space={space}
                renaming={renamingId === space.id}
                adding={addingId === space.id}
                onOpenRead={() => {
                  setActiveStudy(space.id);
                  navigate("/bible");
                }}
                onRename={() => {
                  setAddingId(null);
                  setRenamingId(space.id);
                }}
                onCancelRename={() => {
                  setRenamingId(null);
                  window.requestAnimationFrame(() => {
                    document.getElementById(`rename-${space.id}`)?.focus();
                  });
                }}
                onSaveName={async (name) => {
                  if (name === space.name) {
                    setRenamingId(null);
                    return;
                  }
                  try {
                    await updateSpace(space.id, { name });
                    toast.success("Name saved");
                    setRenamingId(null);
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "Could not update name",
                    );
                    throw err;
                  }
                }}
                onAddPerson={() => {
                  setRenamingId(null);
                  setAddingId(space.id);
                }}
                onCancelAdd={() => {
                  setAddingId(null);
                  window.requestAnimationFrame(() => {
                    document.getElementById(`add-person-${space.id}`)?.focus();
                  });
                }}
                onSavePerson={async (name) => {
                  if (
                    space.members.some(
                      (m) => m.name.toLowerCase() === name.toLowerCase(),
                    )
                  ) {
                    toast.message(`${name} is already on the list`);
                    setAddingId(null);
                    return;
                  }
                  try {
                    await addMember(space.id, name);
                    toast.success(`${name} added`);
                    setAddingId(null);
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "Could not add person",
                    );
                    throw err;
                  }
                }}
                onRemovePerson={async (memberId) => {
                  const member = space.members.find((m) => m.id === memberId);
                  try {
                    await removeMember(space.id, memberId);
                    toast.success(`${member?.name ?? "Person"} removed`);
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "Could not remove person",
                    );
                  }
                }}
              />
            </li>
          ))}
      </ul>

      {spaces.length > 0 && (
        <p className="text-center text-xs text-muted pb-1">
          <Link
            to="/settings"
            className="text-primary font-medium underline-offset-2 hover:underline"
          >
            Save a copy is under More
          </Link>
        </p>
      )}

    </div>
  );
}

export function SpaceTemplateBadge({
  templateId,
  labelSuffix = "",
}: {
  templateId?: string | null;
  /** e.g. " mode" for living-space lens. */
  labelSuffix?: string;
}) {
  const meta = getSpaceTemplateMeta(templateId);
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 text-primary text-[11px] font-semibold px-2 py-0.5 shrink-0">
      {meta.shortLabel}
      {labelSuffix}
    </span>
  );
}

export function SpaceKindBadge({
  kind,
}: {
  kind?: string | null;
}) {
  const family = kind === "family";
  return (
    <span
      className={[
        "inline-flex items-center rounded-full text-[11px] font-semibold px-2 py-0.5 shrink-0",
        family
          ? "bg-accent/20 text-primary"
          : "bg-surface-muted text-muted",
      ].join(" ")}
    >
      {spaceKindLabel(kind)}
    </span>
  );
}

function StudyCard({
  space,
  renaming,
  adding,
  onOpenRead,
  onRename,
  onCancelRename,
  onSaveName,
  onAddPerson,
  onCancelAdd,
  onSavePerson,
  onRemovePerson,
}: {
  space: Space;
  renaming: boolean;
  adding: boolean;
  onOpenRead: () => void;
  onRename: () => void;
  onCancelRename: () => void;
  onSaveName: (name: string) => Promise<void> | void;
  onAddPerson: () => void;
  onCancelAdd: () => void;
  onSavePerson: (name: string) => Promise<void> | void;
  onRemovePerson: (memberId: string) => Promise<void> | void;
}) {
  const personal = isPersonalStudy(space);
  const queue = useLiveStudyQueue(space.id);
  const noteCount = useLiveStudyNoteCount(space.id, personal);
  const nextReading = (queue ?? [])[0];
  const meeting = soonestUpcoming([space]);
  const leftOff = space.readingPlace?.bookId
    ? formatQueueLabel({
        bookName: space.readingPlace.bookName || space.readingPlace.bookId,
        chapter: space.readingPlace.chapter,
      })
    : null;
  const notesLabel =
    noteCount == null
      ? "Notes"
      : `${noteCount} note${noteCount === 1 ? "" : "s"}`;
  const canAddPerson = space.members.length < maxMembersForSpace(space.spaceKind);

  return (
    <Card className="transition-all duration-150 hover:border-primary/40 hover:shadow-md">
      <div className="flex items-start gap-3">
        <StudyColorControl space={space} compact />
        <div className="min-w-0 flex-1 space-y-1">
          {renaming ? (
            <InlineRename
              name={space.name}
              onSave={onSaveName}
              onCancel={onCancelRename}
            />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                to={`/space/${space.id}`}
                className="min-w-0 touch-manipulation"
              >
                <h3 className="text-lg font-semibold truncate text-primary">
                  {space.name}
                </h3>
              </Link>
              {!adding && (
                <div className="flex flex-wrap gap-2">
                  {canAddPerson && (
                    <Button
                      id={`add-person-${space.id}`}
                      className="!py-2 !px-3 text-sm"
                      onClick={onAddPerson}
                    >
                      <UserPlus className="h-4 w-4" aria-hidden />
                      Add person
                    </Button>
                  )}
                  <Button
                    id={`rename-${space.id}`}
                    variant="secondary"
                    className="!py-2 !px-3 text-sm"
                    onClick={onRename}
                  >
                    Rename
                  </Button>
                </div>
              )}
            </div>
          )}
          {adding && !renaming ? (
            <AddPersonForm onSave={onSavePerson} onCancel={onCancelAdd} />
          ) : null}
          {space.members.length > 0 && (
            <ul
              className="flex flex-wrap gap-1.5 pt-1"
              aria-label={`People in ${space.name}`}
            >
              {space.members.map((member) => (
                <li key={member.id}>
                  <MemberChip
                    name={member.name}
                    onRemove={() => void onRemovePerson(member.id)}
                  />
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={onOpenRead}
            className="block text-left text-sm text-primary underline-offset-2 hover:underline touch-manipulation"
            data-left-off={leftOff ?? "none"}
          >
            Left off · {leftOff ?? "Not opened yet"}
          </button>
          {nextReading ? (
            <p className="text-sm text-muted" data-next-reading={formatQueueLabel(nextReading)}>
              Next · {formatQueueLabel(nextReading)}
            </p>
          ) : null}
          {meeting ? (
            <Link
              to={`/space/${space.id}`}
              className="block text-sm text-muted touch-manipulation"
              data-next-meeting
            >
              {formatMeetingWhen(meeting.face.day, meeting.face.startTime)}
              {meeting.place ? ` · ${meeting.place}` : ""}
            </Link>
          ) : null}
          <Link
            to={`/notes?study=${space.id}`}
            className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-2 hover:underline touch-manipulation"
            data-note-count={noteCount ?? 0}
          >
            {notesLabel}
          </Link>
        </div>
      </div>
    </Card>
  );
}
