import { useState, type FormEvent } from "react";
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
import {
  SESSION_TITLE_MAX,
  suggestTitleFromPassages,
} from "../lib/sessionTitle";
import { formatPassageRef, passageFromCoveredText } from "../lib/passages";
import { formatMeetingWhen } from "../lib/meetingCalendar";
import { Button } from "./Button";
import { PassageList } from "./PassageList";
import { PrayerBoard } from "./PrayerBoard";
import { PrivateNotesButton } from "./PrivateNotesModal";

export interface SessionFormValues {
  meetingDate: string; // yyyy-MM-dd
  /** "HH:mm" or empty when the day has no time. */
  startTime: string;
  /** Same weekday and time each week. Kept in step with `repeat === "week"`. */
  weekly: boolean;
  /** once, every week, every two weeks, or once a month. */
  repeat: "once" | "week" | "biweek" | "month";
  templateId: string;
  /**
   * Optional custom meeting title (e.g. "Romans 13").
   * Empty string means “use smart fallback” (passage / template) in the list.
   */
  title: string;
  attendees: string[];
  responses: SessionResponses;
  passagesStudied: Passage[];
  /** Free-form shared notes for every session template (exportable). */
  notes: string;
  /** Plain reference, e.g. John 3:16–18. Empty means no passage. */
  weekPassageText: string;
  /** One short question. Empty means none. */
  weekQuestion: string;
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
  /** Save this day as its own past meeting. */
  onConfirmPrevious?: () => void;
  /** Date, passages, and recap only. */
  variant?: "full" | "past";
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
  onConfirmPrevious,
  variant = "full",
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

  const suggestedTitle = suggestTitleFromPassages(values.passagesStudied);
  const titleLooksSuggested =
    values.title.trim() !== "" &&
    values.title.trim() === suggestedTitle;

  function applySuggestedTitle() {
    if (!suggestedTitle) return;
    patch({ title: suggestedTitle });
  }

  if (variant === "past") {
    return (
      <PastSessionForm
        values={values}
        onChange={onChange}
        onSubmit={onSubmit}
        onCancel={onCancel}
        saving={saving}
      />
    );
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

      {/* Meta: date + title + template */}
      <section className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Session date</span>
          <input
            id="session-date"
            type="date"
            value={values.meetingDate}
            onChange={(e) => patch({ meetingDate: e.target.value })}
            className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
            required
            disabled={saving}
          />
          <span className="text-xs text-muted">
            {values.repeat === "once"
              ? "Edit session date to move this meeting, including a day that already passed."
              : "This is the next date. A day that already passed is confirmed on its own."}
          </span>
        </label>
        {onConfirmPrevious && values.meetingDate < localToday() && (
          <div className="rounded-xl border border-border bg-bg px-3 py-3 space-y-2">
            <p className="text-sm text-primary">
              {values.meetingDate} already passed. Confirm it to keep this study in Past.
            </p>
            <Button
              type="button"
              fullWidth
              onClick={onConfirmPrevious}
              disabled={saving || !values.templateId}
            >
              Confirm previous date
            </Button>
          </div>
        )}

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Time</span>
          <input
            type="time"
            value={values.startTime}
            onChange={(e) => patch({ startTime: e.target.value })}
            className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
            disabled={saving}
          />
          <span className="text-xs text-muted">
            Leave blank to keep the day with no time.
          </span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Repeat</span>
          <select
            value={values.repeat}
            disabled={saving}
            onChange={(e) => {
              const repeat = e.target.value as SessionFormValues["repeat"];
              patch({ repeat, weekly: repeat === "week" });
            }}
            className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
          >
            <option value="once">Once</option>
            <option value="week">Every week</option>
            <option value="biweek">Every two weeks</option>
            <option value="month">Once a month</option>
          </select>
          <span className="text-xs text-muted">
            One meeting. The next date stays here. Passed dates move to Past.
          </span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">This week’s passage</span>
          <input
            type="text"
            value={values.weekPassageText}
            onChange={(e) => patch({ weekPassageText: e.target.value })}
            placeholder="John 3:16–18"
            className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
            disabled={saving}
            autoComplete="off"
          />
          <span className="text-xs text-muted">
            Optional. Book and chapter, and verses if you want them.
          </span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">One question</span>
          <input
            type="text"
            value={values.weekQuestion}
            onChange={(e) => patch({ weekQuestion: e.target.value })}
            maxLength={160}
            className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
            disabled={saving}
          />
        </label>

        <div className="space-y-1.5">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Meeting title</span>
            <input
              type="text"
              value={values.title}
              onChange={(e) => patch({ title: e.target.value })}
              maxLength={SESSION_TITLE_MAX}
              placeholder={
                suggestedTitle ||
                template?.name ||
                "e.g. Romans 13 – living under authority"
              }
              className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
              disabled={saving}
              autoComplete="off"
            />
          </label>
          <p className="text-xs text-muted leading-relaxed">
            Shown in Past meetings so you can find this study later. Leave blank
            to use the main passage (or template name) automatically.
          </p>
          {suggestedTitle && !titleLooksSuggested && (
            <button
              type="button"
              onClick={applySuggestedTitle}
              disabled={saving}
              className="text-xs font-medium text-primary underline-offset-2 hover:underline touch-manipulation"
            >
              Use passage: {suggestedTitle}
            </button>
          )}
        </div>

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
          onChange={(passagesStudied) => {
            const nextSuggest = suggestTitleFromPassages(passagesStudied);
            const prevSuggest = suggestTitleFromPassages(values.passagesStudied);
            const current = values.title.trim();
            // Auto-fill when empty, or keep title in sync if it still matches the
            // previous passage suggestion (user has not customized it).
            const shouldAuto =
              !current || (prevSuggest !== "" && current === prevSuggest);
            patch({
              passagesStudied,
              ...(shouldAuto && nextSuggest ? { title: nextSuggest } : {}),
            });
          }}
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

function PastSessionForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  saving,
}: {
  values: SessionFormValues;
  onChange: (values: SessionFormValues) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [passageError, setPassageError] = useState("");

  function patch(partial: Partial<SessionFormValues>) {
    onChange({ ...values, ...partial });
  }

  function addCovered() {
    const next = passageFromCoveredText(draft);
    if (!next) {
      setPassageError("Use a reading like Daniel 1–2 or Daniel 3 and 4.");
      return;
    }
    setPassageError("");
    setDraft("");
    const passagesStudied = [...values.passagesStudied, next];
    const suggested = suggestTitleFromPassages(passagesStudied);
    patch({
      passagesStudied,
      title: values.title.trim() ? values.title : suggested,
    });
  }

  function removeCovered(id: string | undefined, index: number) {
    const passagesStudied = values.passagesStudied.filter((row, i) =>
      id ? row.id !== id : i !== index,
    );
    patch({ passagesStudied });
  }

  const covered = values.passagesStudied
    .map((row) => formatPassageRef(row))
    .filter(Boolean);
  const when = values.meetingDate
    ? formatMeetingWhen(values.meetingDate, values.startTime)
    : "Pick a date";
  const recap = values.title.trim();
  const savedAs = [when, covered.join(", "), recap].filter(Boolean).join(" · ");

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-muted">
        One screen for a meeting you already had. This is what Past will show.
      </p>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Date</span>
        <input
          id="session-date"
          type="date"
          value={values.meetingDate}
          onChange={(e) => patch({ meetingDate: e.target.value })}
          className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
          required
          disabled={saving}
        />
      </label>

      <div className="space-y-1.5">
        <label className="block space-y-1.5" htmlFor="covered-passage">
          <span className="text-sm font-medium">Passages covered</span>
          <span className="flex gap-2">
            <input
              id="covered-passage"
              type="text"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (passageError) setPassageError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCovered();
                }
              }}
              placeholder="Daniel 1–2"
              className="min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 py-3 text-base"
              disabled={saving}
              autoComplete="off"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={addCovered}
              disabled={saving || !draft.trim()}
            >
              Add
            </Button>
          </span>
        </label>
        <p className="text-xs text-muted">
          Add each reading, such as Daniel 1–2, then Daniel 3 and 4.
        </p>
        {passageError ? (
          <p className="text-sm text-primary">{passageError}</p>
        ) : null}
        {covered.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Passages on this date">
            {values.passagesStudied.map((row, index) => (
              <li key={row.id ?? index}>
                <button
                  type="button"
                  onClick={() => removeCovered(row.id, index)}
                  disabled={saving}
                  className="rounded-full border border-border bg-bg px-3 py-1.5 text-sm text-primary touch-manipulation"
                >
                  {formatPassageRef(row)} · remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No passages on this date yet.</p>
        )}
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Short recap</span>
        <input
          type="text"
          value={values.title}
          onChange={(e) => patch({ title: e.target.value })}
          maxLength={SESSION_TITLE_MAX}
          placeholder="Daniel 1 and 2"
          className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
          disabled={saving}
          autoComplete="off"
        />
        <span className="text-xs text-muted">
          This line is the name Past uses for this date.
        </span>
      </label>

      <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-3 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Saved as
        </p>
        <p className="text-sm text-primary">{savedAs}</p>
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="secondary"
          fullWidth
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="submit" fullWidth disabled={saving || !values.meetingDate}>
          {saving ? "Saving…" : "Save past session"}
        </Button>
      </div>
    </form>
  );
}

function localToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Build initial form values for create or edit. */
export function buildSessionFormValues(opts: {
  mode: "create" | "edit";
  templates: Template[];
  members: Member[];
  meetingDate: string;
  startTime?: string;
  weekly?: boolean;
  repeat?: "once" | "week" | "biweek" | "month";
  templateId?: string;
  title?: string;
  attendees?: string[];
  responses?: SessionResponses;
  passagesStudied?: Passage[];
  notes?: string;
  weekPassageText?: string;
  weekQuestion?: string;
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

  const passages = opts.passagesStudied ?? [];
  // Prefer stored title; for new meetings with passages, pre-fill suggestion
  const title =
    opts.title?.trim() ||
    (opts.mode === "create" ? suggestTitleFromPassages(passages) : "") ||
    "";

  return {
    meetingDate: opts.meetingDate,
    startTime: opts.startTime ?? "",
    weekly: Boolean(opts.weekly) || opts.repeat === "week",
    repeat:
      opts.repeat ??
      (opts.weekly ? "week" : "once"),
    templateId,
    title,
    attendees:
      opts.attendees ??
      (opts.mode === "create" ? opts.members.map((m) => m.id) : []),
    responses,
    passagesStudied: passages,
    notes: opts.notes ?? "",
    weekPassageText: opts.weekPassageText ?? "",
    weekQuestion: opts.weekQuestion ?? "",
  };
}
