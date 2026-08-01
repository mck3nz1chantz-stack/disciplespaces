/** In-session gather ritual state (Meet → Study → Prayer). Device-only. */

export type GatherStepId = "meet" | "study" | "prayer";

export interface GatherState {
  active: boolean;
  step: GatherStepId;
  sessionId: string | null;
  done: Partial<Record<GatherStepId, boolean>>;
}

export const GATHER_STEPS: readonly {
  id: GatherStepId;
  label: string;
  short: string;
}[] = [
  { id: "meet", label: "Meet", short: "1" },
  { id: "study", label: "Study", short: "2" },
  { id: "prayer", label: "Prayer", short: "3" },
] as const;

export const EMPTY_GATHER: GatherState = {
  active: false,
  step: "meet",
  sessionId: null,
  done: {},
};

const PREFIX = "ds-gather-v1:";

function key(spaceId: string): string {
  return `${PREFIX}${spaceId}`;
}

export function loadGather(spaceId: string): GatherState {
  try {
    const raw = sessionStorage.getItem(key(spaceId));
    if (!raw) return { ...EMPTY_GATHER };
    const parsed = JSON.parse(raw) as Partial<GatherState>;
    if (!parsed || typeof parsed !== "object") return { ...EMPTY_GATHER };
    const step =
      parsed.step === "study" || parsed.step === "prayer" || parsed.step === "meet"
        ? parsed.step
        : "meet";
    return {
      active: parsed.active === true,
      step,
      sessionId:
        typeof parsed.sessionId === "string" && parsed.sessionId
          ? parsed.sessionId
          : null,
      done:
        parsed.done && typeof parsed.done === "object" ? { ...parsed.done } : {},
    };
  } catch {
    return { ...EMPTY_GATHER };
  }
}

export function saveGather(spaceId: string, state: GatherState): void {
  try {
    if (!state.active) {
      sessionStorage.removeItem(key(spaceId));
      return;
    }
    sessionStorage.setItem(key(spaceId), JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}

export function clearGather(spaceId: string): void {
  try {
    sessionStorage.removeItem(key(spaceId));
  } catch {
    // ignore
  }
}

export function gatherStepIndex(step: GatherStepId): number {
  return GATHER_STEPS.findIndex((s) => s.id === step);
}

export function nextGatherStep(step: GatherStepId): GatherStepId | null {
  const i = gatherStepIndex(step);
  if (i < 0 || i >= GATHER_STEPS.length - 1) return null;
  return GATHER_STEPS[i + 1]!.id;
}

export function primaryGatherLabel(step: GatherStepId, hasSession: boolean): string {
  switch (step) {
    case "meet":
      return hasSession ? "Open meeting" : "Start meeting";
    case "study":
      return "Open Bible";
    case "prayer":
      return "Open prayer board";
    default:
      return "Continue";
  }
}
