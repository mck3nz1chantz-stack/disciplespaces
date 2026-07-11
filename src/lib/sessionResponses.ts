import type {
  ChecklistItem,
  Session,
  SessionResponses,
  StepResponseValue,
  Template,
  TemplateStep,
} from "../types";

/** Empty response value for a step based on field type. */
export function emptyResponseForStep(step: TemplateStep): StepResponseValue {
  if (step.fieldType === "checklist") return [];
  return "";
}

/** Build default responses for every step in a template. */
export function emptyResponses(template: Template): SessionResponses {
  const out: SessionResponses = {};
  for (const step of template.steps) {
    out[step.id] = emptyResponseForStep(step);
  }
  return out;
}

/** Merge saved responses onto template defaults (edit / view safety). */
export function mergeResponses(
  template: Template,
  saved?: SessionResponses | null,
): SessionResponses {
  const base = emptyResponses(template);
  if (!saved) return base;
  for (const step of template.steps) {
    const value = saved[step.id];
    if (value === undefined || value === null) continue;
    if (step.fieldType === "checklist") {
      base[step.id] = Array.isArray(value) ? value : [];
    } else {
      base[step.id] = typeof value === "string" ? value : String(value);
    }
  }
  return base;
}

export function createChecklistItem(text = ""): ChecklistItem {
  return {
    id: crypto.randomUUID(),
    text,
    checked: false,
  };
}

/** Whether a step response satisfies required validation. */
export function isStepFilled(
  step: TemplateStep,
  value: StepResponseValue | undefined,
): boolean {
  if (step.fieldType === "passage-log") {
    // Phase 4 — do not block save in Phase 2
    return true;
  }
  if (step.fieldType === "checklist") {
    const items = Array.isArray(value) ? value : [];
    return items.some((i) => i.text.trim().length > 0);
  }
  return typeof value === "string" && value.trim().length > 0;
}

/** Validate required steps; returns first missing step title or null. */
export function validateRequiredResponses(
  template: Template,
  responses: SessionResponses,
): string | null {
  for (const step of template.steps) {
    if (!step.required) continue;
    if (step.fieldType === "passage-log") continue;
    if (!isStepFilled(step, responses[step.id])) {
      return step.title;
    }
  }
  return null;
}

/** First non-empty text preview from responses for timeline cards. */
export function sessionPreview(
  session: Session,
  template?: Template | null,
  maxLen = 90,
): string {
  // Session-level notes first (available on every template, incl. Freeform)
  if (session.notes?.trim()) {
    return truncate(session.notes.trim(), maxLen);
  }

  const responses = session.responses ?? {};
  const steps = template?.steps ?? [];

  // Prefer template order
  for (const step of steps) {
    if (step.fieldType === "passage-log" || step.fieldType === "checklist") {
      continue;
    }
    const val = responses[step.id];
    if (typeof val === "string" && val.trim()) {
      return truncate(val.trim(), maxLen);
    }
  }

  // Fallback: any string response
  for (const val of Object.values(responses)) {
    if (typeof val === "string" && val.trim()) {
      return truncate(val.trim(), maxLen);
    }
    if (Array.isArray(val)) {
      const text = val
        .filter((i) => i.text.trim())
        .map((i) => (i.checked ? "✓ " : "") + i.text.trim())
        .join(" · ");
      if (text) return truncate(text, maxLen);
    }
  }

  if (session.sharedNotes?.trim()) {
    return truncate(session.sharedNotes.trim(), maxLen);
  }

  const passageCount = session.passagesStudied?.length ?? 0;
  if (passageCount > 0) {
    return `${passageCount} passage${passageCount === 1 ? "" : "s"} logged`;
  }

  return "";
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

/** Count filled steps for progress-ish display. */
export function countFilledSteps(
  template: Template,
  responses?: SessionResponses | null,
): { filled: number; total: number } {
  const total = template.steps.filter(
    (s) => s.fieldType !== "passage-log",
  ).length;
  if (!responses) return { filled: 0, total };
  let filled = 0;
  for (const step of template.steps) {
    if (step.fieldType === "passage-log") continue;
    if (isStepFilled(step, responses[step.id])) filled += 1;
  }
  return { filled, total };
}
