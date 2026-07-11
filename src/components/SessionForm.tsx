import type { FormEvent } from "react";
import { BookOpen, Lock, Plus, Trash2 } from "lucide-react";
import type {
  ChecklistItem,
  Member,
  Passage,
  SessionResponses,
  StepResponseValue,
  Template,
  TemplateStep,
} from "../types";
import { PRIVATE_SECTION } from "../types";
import {
  createChecklistItem,
  emptyResponses,
  mergeResponses,
} from "../lib/sessionResponses";
import { Button } from "./Button";
import { PassageList } from "./PassageList";
import { PrayerBoard } from "./PrayerBoard";
import { PrivateNotesButton } from "./PrivateNotesModal";

export interface SessionFormValues {
  meetingDate: string; // yyyy-MM-dd
  templateId: string;
  attendees: string[];
  responses: SessionResponses;
  passagesStudied: Passage[];
  /** Free-form shared notes for every session template (exportable). */
  notes: string;
}

interface SessionFormProps {
  mode: "create" | "edit";
  members: Member[];
  templates: Template[];
  values: SessionFormValues;
  onChange: (values: SessionFormValues) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
  saving?: boolean;
  /** When editing, template select is locked so responses stay aligned. */
  lockTemplate?: boolean;
  onManageMembers?: () => void;
  /**
   * Open device-local private notes.
   * Pass sectionKey for section-scoped notes (step id or PRIVATE_SECTION.*).
   */
  onOpenPrivateNotes?: (sectionKey?: string) => void;
  privateNoteCount?: number;
  /** Space id for shared prayer board (all templates). */
  spaceId?: string;
  /** Session id when editing — links prayer posts to this session. */
  sessionId?: string;
}

/**
 * Guided, template-driven session form.
 * Renders date + attendees + notes + passages + dynamic steps for the selected template.
 */
export function SessionForm({
  mode,
  members,
  templates,
  values,
  onChange,
  onSubmit,
  onCancel,
  saving = false,
  lockTemplate = false,
  onManageMembers,
  onOpenPrivateNotes,
  privateNoteCount,
  spaceId,
  sessionId,
}: SessionFormProps) {
  const template = templates.find((t) => t.id === values.templateId);
  const isFreeform =
    template?.id === "tpl-freeform" ||
    (template != null && template.steps.length === 0);

  function patch(partial: Partial<SessionFormValues>) {
    onChange({ ...values, ...partial });
  }

  function handleTemplateChange(templateId: string) {
    const next = templates.find((t) => t.id === templateId);
    patch({
      templateId,
      responses: next ? emptyResponses(next) : {},
    });
  }

  function setResponse(stepId: string, value: StepResponseValue) {
    patch({
      responses: { ...values.responses, [stepId]: value },
    });
  }

  function toggleAttendee(memberId: string) {
    const next = values.attendees.includes(memberId)
      ? values.attendees.filter((id) => id !== memberId)
      : [...values.attendees, memberId];
    patch({ attendees: next });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <p className="text-sm text-muted -mt-1">
        {mode === "create"
          ? isFreeform
            ? "Lightweight session — notes and passages only. Add structure later if you want."
            : "Walk through the template steps at your own pace. Required fields are marked."
          : "Update this meeting’s notes. Template stays the same so answers stay aligned."}
      </p>

      {/* Meta: date + template */}
      <section className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Date</span>
          <input
            type="date"
            value={values.meetingDate}
            onChange={(e) => patch({ meetingDate: e.target.value })}
            className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
            required
            disabled={saving}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Session template</span>
          <select
            value={values.templateId}
            onChange={(e) => handleTemplateChange(e.target.value)}
            className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base disabled:opacity-70"
            required
            disabled={saving || lockTemplate || mode === "edit"}
          >
            {templates.length === 0 && (
              <option value="">No templates yet</option>
            )}
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {template && (
            <span className="text-xs text-muted block mt-1">
              {template.description}
            </span>
          )}
        </label>
      </section>

      {/* Attendees */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Who attended?</legend>
        {members.length === 0 ? (
          <p className="text-sm text-muted rounded-xl bg-surface-muted/60 px-3 py-3">
            No members in this space yet. You can still save, or{" "}
            {onManageMembers ? (
              <button
                type="button"
                className="text-primary font-medium underline underline-offset-2"
                onClick={onManageMembers}
              >
                add members first
              </button>
            ) : (
              "add members from Manage Members"
            )}
            .
          </p>
        ) : (
          <ul className="space-y-2">
            {members.map((member) => {
              const checked = values.attendees.includes(member.id);
              return (
                <li key={member.id}>
                  <label className="flex items-center gap-3 rounded-xl border border-border bg-bg px-3 py-3 touch-manipulation tap-target cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAttendee(member.id)}
                      className="h-5 w-5 rounded border-border accent-primary"
                      disabled={saving}
                    />
                    <span className="font-medium">{member.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      {/* Shared notes — on every session (exportable) */}
      <section
        className="space-y-2 border-t border-border pt-4"
        data-session-section={PRIVATE_SECTION.notes}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-primary">Shared notes</h3>
          {onOpenPrivateNotes ? (
            <PrivateNotesButton
              count={privateNoteCount}
              onClick={() => onOpenPrivateNotes(PRIVATE_SECTION.notes)}
              disabled={saving}
              label="Private"
            />
          ) : null}
        </div>
        <p className="text-xs text-muted">
          Thoughts and reflections the group can share. Included in Space Update
          exports. Flip to the Private tab for a device-only note on this same
          section.
        </p>
        <textarea
          value={values.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base min-h-[120px] resize-y"
          placeholder="Write freely for the group…"
          disabled={saving}
          maxLength={8000}
        />
        <p className="text-xs text-muted rounded-lg bg-primary/5 border border-primary/10 px-2.5 py-2">
          <Lock className="inline h-3.5 w-3.5 mr-1 align-text-bottom" aria-hidden />
          Private stays locked to the step you’re on — e.g. public recap vs a
          private struggle. Tabs keep pace as you scroll.
        </p>
      </section>

      {/* Passages studied */}
      <section
        className="space-y-2 border-t border-border pt-4"
        data-session-section={PRIVATE_SECTION.passages}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-primary">
            Passages studied
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted tabular-nums">
              {values.passagesStudied.length}
            </span>
            {onOpenPrivateNotes && (
              <PrivateNotesButton
                onClick={() => onOpenPrivateNotes(PRIVATE_SECTION.passages)}
                disabled={saving}
                label="Private"
              />
            )}
          </div>
        </div>
        <p className="text-xs text-muted">
          Log book + chapter + verse range with optional study notes — or use
          the Bible reader while this space is selected.
        </p>
        <PassageList
          passages={values.passagesStudied}
          onChange={(passagesStudied) => patch({ passagesStudied })}
          disabled={saving}
          emphasizeManual={isFreeform}
        />
      </section>

      {/* Shared prayer board — every template */}
      {spaceId && (
        <div className="border-t border-border pt-4">
          {sessionId ? (
            <PrayerBoard
              spaceId={spaceId}
              members={members}
              sessionId={sessionId}
              compact
              disabled={saving}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-surface-muted/40 px-3 py-3 text-sm text-muted space-y-1">
              <p className="font-medium text-primary text-sm">Prayer board</p>
              <p className="text-xs">
                Save this session to post individual or group prayers (e.g.
                “John prayed for Jeff”). You can also open the board from the
                Space anytime.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Template steps (hidden for freeform / empty) */}
      {template && template.steps.length > 0 ? (
        <section className="space-y-4" aria-label="Template steps">
          <div className="flex items-baseline justify-between gap-2 border-t border-border pt-4">
            <h3 className="text-base font-semibold text-primary">
              {template.name}
            </h3>
            <span className="text-xs text-muted tabular-nums">
              {template.steps.length} step
              {template.steps.length === 1 ? "" : "s"}
            </span>
          </div>

          <ol className="space-y-4">
            {template.steps.map((step, index) => (
              <li key={step.id} data-session-section={step.id}>
                <StepField
                  step={step}
                  stepNumber={index + 1}
                  value={values.responses[step.id]}
                  onChange={(v) => setResponse(step.id, v)}
                  disabled={saving}
                  passages={values.passagesStudied}
                  onOpenPrivateNotes={
                    onOpenPrivateNotes
                      ? () => onOpenPrivateNotes(step.id)
                      : undefined
                  }
                />
              </li>
            ))}
          </ol>
        </section>
      ) : !template ? (
        <p className="text-sm text-muted rounded-xl border border-border px-3 py-3">
          Choose a template to load its guided steps.
        </p>
      ) : null}

      <div className="flex gap-2 pt-1 sticky bottom-0 bg-surface pb-1">
        <Button
          type="button"
          variant="secondary"
          fullWidth
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          fullWidth
          disabled={saving || !values.templateId}
        >
          {saving
            ? "Saving…"
            : mode === "edit"
              ? "Save changes"
              : "Save session"}
        </Button>
      </div>
    </form>
  );
}

function StepField({
  step,
  stepNumber,
  value,
  onChange,
  disabled,
  passages = [],
  onOpenPrivateNotes,
}: {
  step: TemplateStep;
  stepNumber: number;
  value: StepResponseValue | undefined;
  onChange: (value: StepResponseValue) => void;
  disabled?: boolean;
  passages?: Passage[];
  onOpenPrivateNotes?: () => void;
}) {
  const inputId = `step-${step.id}`;

  return (
    <div className="rounded-2xl border border-border bg-bg/80 p-3.5 space-y-2.5">
      <div className="flex items-start gap-2.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary tabular-nums"
          aria-hidden
        >
          {stepNumber}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <label htmlFor={inputId} className="block min-w-0">
              <span className="font-medium text-primary">
                {step.title}
                {step.required && step.fieldType !== "passage-log" && (
                  <span className="text-danger ml-0.5" aria-label="required">
                    *
                  </span>
                )}
              </span>
              {step.prompt && (
                <span className="block text-sm text-muted mt-0.5">
                  {step.prompt}
                </span>
              )}
            </label>
            {onOpenPrivateNotes && (
              <PrivateNotesButton
                onClick={onOpenPrivateNotes}
                disabled={disabled}
                label="Private"
              />
            )}
          </div>
        </div>
      </div>

      {step.fieldType === "passage-log" && (
        <div className="flex items-start gap-2.5 rounded-xl border border-dashed border-border bg-surface-muted/40 px-3 py-3 text-sm text-muted">
          <BookOpen className="h-4 w-4 shrink-0 mt-0.5 text-muted" aria-hidden />
          <p>
            {passages.length > 0
              ? `${passages.length} passage${passages.length === 1 ? "" : "s"} logged above. Use the Bible reader or the Passages section to add more.`
              : "Log scripture in Passages studied above, or open the Bible reader from this space."}
          </p>
        </div>
      )}

      {step.fieldType === "textarea" && (
        <textarea
          id={inputId}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-base min-h-[96px] resize-y"
          placeholder="Write a few notes…"
          disabled={disabled}
        />
      )}

      {step.fieldType === "text" && (
        <input
          id={inputId}
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-base"
          placeholder="Short answer…"
          disabled={disabled}
        />
      )}

      {step.fieldType === "checklist" && (
        <ChecklistEditor
          items={Array.isArray(value) ? value : []}
          onChange={onChange}
          disabled={disabled}
        />
      )}
    </div>
  );
}

function ChecklistEditor({
  items,
  onChange,
  disabled,
}: {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  disabled?: boolean;
}) {
  function updateItem(id: string, patch: Partial<ChecklistItem>) {
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function removeItem(id: string) {
    onChange(items.filter((i) => i.id !== id));
  }

  function addItem() {
    onChange([...items, createChecklistItem()]);
  }

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="text-xs text-muted px-0.5">
          Add items you want to track or commit to.
        </p>
      )}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={item.checked}
              onChange={(e) =>
                updateItem(item.id, { checked: e.target.checked })
              }
              className="h-5 w-5 shrink-0 rounded border-border accent-primary"
              disabled={disabled}
              aria-label={item.text ? `Done: ${item.text}` : "Mark done"}
            />
            <input
              type="text"
              value={item.text}
              onChange={(e) => updateItem(item.id, { text: e.target.value })}
              className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-base"
              placeholder="Action or commitment…"
              disabled={disabled}
            />
            <Button
              type="button"
              variant="ghost"
              className="!p-2 shrink-0 text-danger"
              onClick={() => removeItem(item.id)}
              disabled={disabled}
              aria-label="Remove item"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="secondary"
        className="!py-2.5"
        onClick={addItem}
        disabled={disabled}
      >
        <Plus className="h-4 w-4" aria-hidden />
        Add item
      </Button>
    </div>
  );
}

/** Build initial form values for create or edit. */
export function buildSessionFormValues(opts: {
  mode: "create" | "edit";
  templates: Template[];
  members: Member[];
  meetingDate: string;
  templateId?: string;
  attendees?: string[];
  responses?: SessionResponses;
  passagesStudied?: Passage[];
  notes?: string;
  /** Preferred template when creating (space default). */
  preferredTemplateId?: string;
}): SessionFormValues {
  const preferredOk =
    opts.mode === "create" &&
    opts.preferredTemplateId &&
    opts.templates.some((t) => t.id === opts.preferredTemplateId)
      ? opts.preferredTemplateId
      : undefined;

  const templateId =
    opts.templateId || preferredOk || opts.templates[0]?.id || "";
  const template = opts.templates.find((t) => t.id === templateId);
  const responses = template
    ? mergeResponses(template, opts.responses)
    : {};

  return {
    meetingDate: opts.meetingDate,
    templateId,
    attendees:
      opts.attendees ??
      (opts.mode === "create" ? opts.members.map((m) => m.id) : []),
    responses,
    passagesStudied: opts.passagesStudied ?? [],
    notes: opts.notes ?? "",
  };
}
