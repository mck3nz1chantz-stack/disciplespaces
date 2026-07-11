import { format, parseISO } from "date-fns";
import { Check, Square } from "lucide-react";
import type {
  ChecklistItem,
  Member,
  Passage,
  Session,
  Template,
  TemplateStep,
} from "../types";
import { PRIVATE_SECTION } from "../types";
import { mergeResponses } from "../lib/sessionResponses";
import { PassageList } from "./PassageList";
import { Button } from "./Button";
import { PrayerBoard } from "./PrayerBoard";
import { PrivateNotesButton } from "./PrivateNotesModal";

interface SessionViewProps {
  session: Session;
  template?: Template | null;
  members: Member[];
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  onOpenBible?: () => void;
  /**
   * Open device-local private notes for this session.
   * Optional sectionKey for step/section-scoped notes.
   */
  onOpenPrivateNotes?: (sectionKey?: string) => void;
  privateNoteCount?: number;
  spaceId?: string;
}

export function SessionView({
  session,
  template,
  members,
  onEdit,
  onDelete,
  onClose,
  onOpenBible,
  onOpenPrivateNotes,
  privateNoteCount,
  spaceId,
}: SessionViewProps) {
  const dateLabel = formatSessionDate(session.date);
  const attendeeNames = members
    .filter((m) => session.attendees.includes(m.id))
    .map((m) => m.name);

  const responses = template
    ? mergeResponses(template, session.responses)
    : session.responses ?? {};

  const steps = template?.steps ?? [];
  const passages: Passage[] = session.passagesStudied ?? [];
  const notes =
    session.notes?.trim() || session.sharedNotes?.trim() || "";

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-sm text-muted">{dateLabel}</p>
        <p className="font-medium text-primary">
          {template?.name ?? "Session"}
        </p>
        {template?.description && (
          <p className="text-xs text-muted">{template.description}</p>
        )}
      </div>

      <section className="space-y-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Attended
        </h3>
        <p className="text-sm">
          {attendeeNames.length > 0
            ? attendeeNames.join(" · ")
            : "No attendees recorded"}
        </p>
      </section>

      <section
        className="space-y-1.5"
        data-session-section={PRIVATE_SECTION.notes}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Shared notes
          </h3>
          {onOpenPrivateNotes && (
            <PrivateNotesButton
              count={privateNoteCount}
              onClick={() => onOpenPrivateNotes(PRIVATE_SECTION.notes)}
            />
          )}
        </div>
        <p className="text-[11px] text-muted">
          Included when you export a Space Update. Private tab locks to this
          section while you’re here.
        </p>
        {notes ? (
          <p className="text-sm whitespace-pre-wrap rounded-xl border border-border bg-bg/80 px-3 py-3">
            {notes}
          </p>
        ) : (
          <p className="text-sm text-muted italic">No shared notes yet</p>
        )}
      </section>

      <section
        className="space-y-2"
        data-session-section={PRIVATE_SECTION.passages}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Passages studied ({passages.length})
          </h3>
          {onOpenPrivateNotes && (
            <PrivateNotesButton
              onClick={() => onOpenPrivateNotes(PRIVATE_SECTION.passages)}
            />
          )}
        </div>
        <PassageList passages={passages} readOnly compact />
        {onOpenBible && (
          <Button variant="secondary" fullWidth onClick={onOpenBible}>
            Open Bible to log more
          </Button>
        )}
      </section>

      {(spaceId || session.spaceId) && (
        <PrayerBoard
          spaceId={spaceId || session.spaceId}
          members={members}
          sessionId={session.id}
          compact
        />
      )}

      {steps.length > 0 ? (
        <ol className="space-y-3">
          {steps.map((step, index) => (
            <li key={step.id} data-session-section={step.id}>
              <StepAnswer
                step={step}
                stepNumber={index + 1}
                value={responses[step.id]}
                passages={passages}
                onOpenPrivateNotes={
                  onOpenPrivateNotes
                    ? () => onOpenPrivateNotes(step.id)
                    : undefined
                }
              />
            </li>
          ))}
        </ol>
      ) : template?.id === "tpl-freeform" ||
        (template != null && template.steps.length === 0) ? null : (
        <p className="text-sm text-muted rounded-xl bg-surface-muted/50 px-3 py-3">
          No template steps found for this session.
        </p>
      )}

      <div className="flex flex-col gap-2 pt-1">
        <Button fullWidth onClick={onEdit}>
          Edit Session
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" fullWidth onClick={onClose}>
            Close
          </Button>
          <Button variant="danger" fullWidth onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

function StepAnswer({
  step,
  stepNumber,
  value,
  passages,
  onOpenPrivateNotes,
}: {
  step: TemplateStep;
  stepNumber: number;
  value: unknown;
  passages: Passage[];
  onOpenPrivateNotes?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-bg/80 p-3.5 space-y-2">
      <div className="flex items-start gap-2.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary tabular-nums"
          aria-hidden
        >
          {stepNumber}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-primary">{step.title}</p>
              {step.prompt && (
                <p className="text-xs text-muted mt-0.5">{step.prompt}</p>
              )}
            </div>
            {onOpenPrivateNotes && (
              <PrivateNotesButton onClick={onOpenPrivateNotes} />
            )}
          </div>
        </div>
      </div>

      <div className="pl-9">
        {step.fieldType === "passage-log" && (
          <div className="space-y-1.5">
            {passages.length > 0 ? (
              <PassageList passages={passages} readOnly compact />
            ) : (
              <p className="text-sm text-muted italic">
                No passages logged for this session yet. Use Open Bible or Edit
                Session to add them.
              </p>
            )}
          </div>
        )}

        {(step.fieldType === "text" || step.fieldType === "textarea") && (
          <p className="text-sm whitespace-pre-wrap">
            {typeof value === "string" && value.trim() ? (
              value
            ) : (
              <span className="text-muted italic">No notes</span>
            )}
          </p>
        )}

        {step.fieldType === "checklist" && (
          <ChecklistAnswer items={Array.isArray(value) ? value : []} />
        )}
      </div>
    </div>
  );
}

function ChecklistAnswer({ items }: { items: ChecklistItem[] }) {
  const meaningful = items.filter((i) => i.text.trim());
  if (meaningful.length === 0) {
    return <p className="text-sm text-muted italic">No items</p>;
  }
  return (
    <ul className="space-y-1.5">
      {meaningful.map((item) => (
        <li key={item.id} className="flex items-start gap-2 text-sm">
          {item.checked ? (
            <Check
              className="h-4 w-4 shrink-0 mt-0.5 text-success"
              aria-label="Done"
            />
          ) : (
            <Square
              className="h-4 w-4 shrink-0 mt-0.5 text-muted"
              aria-label="Not done"
            />
          )}
          <span className={item.checked ? "text-muted line-through" : ""}>
            {item.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

function formatSessionDate(iso: string): string {
  try {
    return format(parseISO(iso), "EEEE, MMM d, yyyy");
  } catch {
    return iso.slice(0, 10);
  }
}
