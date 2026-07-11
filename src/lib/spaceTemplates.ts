/**
 * Space modes — living lenses inside a Space (not separate Spaces).
 * Switch Custom / Guided / Advanced / Freeform anytime; sessions of every
 * mode stay in the same Space container (Group or Family).
 */

import type { SpaceTemplateId } from "../types";

export type { SpaceTemplateId };

export const SPACE_TEMPLATE_IDS: SpaceTemplateId[] = [
  "custom",
  "guided",
  "advanced",
  "freeform",
];

export interface SpaceTemplateMeta {
  id: SpaceTemplateId;
  name: string;
  shortLabel: string;
  description: string;
  /** Session template id used when starting a session in this mode. */
  firstSessionTemplateId: string;
  /** Human label for that session template. */
  firstSessionLabel: string;
}

/** Known session template ids (seeded in db.ts). */
export const SESSION_TEMPLATE_IDS = {
  discipleshipStart: "tpl-discipleship-start",
  weeklyStudy: "tpl-weekly-study",
  bookStudy: "tpl-book-study",
  freeform: "tpl-freeform",
  advancedJourney: "tpl-advanced-journey",
} as const;

export const SPACE_TEMPLATES: SpaceTemplateMeta[] = [
  {
    id: "custom",
    name: "Custom",
    shortLabel: "Custom",
    description:
      "Study-focused rhythm — Weekly Study, Book Study, and other flexible sessions.",
    firstSessionTemplateId: SESSION_TEMPLATE_IDS.weeklyStudy,
    firstSessionLabel: "Weekly Study",
  },
  {
    id: "guided",
    name: "Guided",
    shortLabel: "Guided",
    description:
      "Structured discipleship start with Scripture — ideal for early seasons together.",
    firstSessionTemplateId: SESSION_TEMPLATE_IDS.discipleshipStart,
    firstSessionLabel: "Discipleship Start",
  },
  {
    id: "advanced",
    name: "Advanced",
    shortLabel: "Advanced",
    description:
      "Deeper journey sessions — observation, interpretation, application, accountability.",
    firstSessionTemplateId: SESSION_TEMPLATE_IDS.advancedJourney,
    firstSessionLabel: "Advanced Journey",
  },
  {
    id: "freeform",
    name: "Freeform",
    shortLabel: "Freeform",
    description:
      "Open notes and manual passage logging without heavy structure.",
    firstSessionTemplateId: SESSION_TEMPLATE_IDS.freeform,
    firstSessionLabel: "Freeform",
  },
];

/** Session template ids that “belong” to each mode for filtering. */
export function sessionTemplateIdsForMode(
  mode: SpaceTemplateId | string | undefined | null,
): string[] {
  switch (normalizeSpaceTemplate(mode)) {
    case "guided":
      return [SESSION_TEMPLATE_IDS.discipleshipStart];
    case "advanced":
      return [SESSION_TEMPLATE_IDS.advancedJourney];
    case "freeform":
      return [SESSION_TEMPLATE_IDS.freeform];
    case "custom":
    default:
      return [
        SESSION_TEMPLATE_IDS.weeklyStudy,
        SESSION_TEMPLATE_IDS.bookStudy,
      ];
  }
}

/**
 * Does this session belong under the given mode’s lens?
 * Custom also catches any template not claimed by Guided/Advanced/Freeform
 * so older or custom-added templates still have a home.
 */
export function sessionMatchesMode(
  sessionTemplateId: string | undefined | null,
  mode: SpaceTemplateId | string | undefined | null,
): boolean {
  const id = sessionTemplateId || "";
  const m = normalizeSpaceTemplate(mode);
  const owned = sessionTemplateIdsForMode(m);

  if (m === "custom") {
    const claimedByOther = new Set([
      ...sessionTemplateIdsForMode("guided"),
      ...sessionTemplateIdsForMode("advanced"),
      ...sessionTemplateIdsForMode("freeform"),
    ]);
    return owned.includes(id) || !claimedByOther.has(id);
  }

  return owned.includes(id);
}

/** Count sessions per mode (for badges). */
export function countSessionsByMode(
  sessions: Array<{ templateId: string }>,
): Record<SpaceTemplateId, number> {
  const counts: Record<SpaceTemplateId, number> = {
    custom: 0,
    guided: 0,
    advanced: 0,
    freeform: 0,
  };
  for (const s of sessions) {
    for (const mode of SPACE_TEMPLATE_IDS) {
      if (sessionMatchesMode(s.templateId, mode)) {
        counts[mode] += 1;
      }
    }
  }
  return counts;
}

export function getSpaceTemplateMeta(
  id: SpaceTemplateId | string | undefined | null,
): SpaceTemplateMeta {
  const found = SPACE_TEMPLATES.find((t) => t.id === id);
  return found ?? SPACE_TEMPLATES[0]!;
}

export function isSpaceTemplateId(value: unknown): value is SpaceTemplateId {
  return (
    typeof value === "string" &&
    (SPACE_TEMPLATE_IDS as string[]).includes(value)
  );
}

export function normalizeSpaceTemplate(
  value: unknown,
): SpaceTemplateId {
  return isSpaceTemplateId(value) ? value : "custom";
}

export function defaultSessionTemplateForSpace(
  spaceTemplate: SpaceTemplateId | string | undefined | null,
): string {
  return getSpaceTemplateMeta(spaceTemplate).firstSessionTemplateId;
}
