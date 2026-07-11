/**
 * Session section keys for Private notes + scroll-lock between Session/Private tabs.
 */

import type { TemplateStep } from "../types";
import { PRIVATE_SECTION } from "../types";

/** data-session-section attribute value for General (unscoped). */
export const SECTION_GENERAL = "section:general";

export interface SessionSectionMeta {
  key: string;
  label: string;
  hint?: string;
  /** Stored as PrivateNote.sectionKey (undefined for general). */
  privateSectionKey?: string;
}

export function buildSessionSectionList(
  steps: TemplateStep[] = [],
): SessionSectionMeta[] {
  return [
    {
      key: PRIVATE_SECTION.notes,
      label: "Shared notes",
      hint: "Private thoughts next to group-visible notes",
      privateSectionKey: PRIVATE_SECTION.notes,
    },
    {
      key: PRIVATE_SECTION.passages,
      label: "Passages",
      hint: "Personal notes while studying Scripture",
      privateSectionKey: PRIVATE_SECTION.passages,
    },
    ...steps.map((step) => ({
      key: step.id,
      label: step.title,
      hint: step.prompt || undefined,
      privateSectionKey: step.id,
    })),
  ];
}

export function resolveSessionSection(
  key: string | null | undefined,
  steps: TemplateStep[] = [],
): SessionSectionMeta {
  const list = buildSessionSectionList(steps);
  if (!key || key === SECTION_GENERAL) {
    return {
      key: SECTION_GENERAL,
      label: "General",
      hint: "Anything for this meeting — not tied to a step",
      privateSectionKey: undefined,
    };
  }
  return (
    list.find((s) => s.key === key) ?? {
      key,
      label: "This section",
      privateSectionKey: key,
    }
  );
}

/** Normalize a data-session-section value for state. */
export function normalizeSectionKey(raw: string | null | undefined): string {
  if (!raw || raw === SECTION_GENERAL) return SECTION_GENERAL;
  return raw;
}
