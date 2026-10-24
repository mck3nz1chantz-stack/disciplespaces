export const GROUP_TABS = [
  { id: "tonight", label: "Tonight" },
  { id: "meetings", label: "Meetings" },
  { id: "prayer", label: "Prayer" },
  { id: "group", label: "Group" },
] as const;

export type GroupTab = (typeof GROUP_TABS)[number]["id"];

const STORAGE_PREFIX = "ds-group-tab:";

export function isGroupTab(value: unknown): value is GroupTab {
  return (
    value === "tonight" ||
    value === "meetings" ||
    value === "prayer" ||
    value === "group"
  );
}

export function readGroupTab(spaceId: string): GroupTab {
  try {
    const value = sessionStorage.getItem(STORAGE_PREFIX + spaceId);
    if (isGroupTab(value)) return value;
  } catch {
    // Private mode or a full store. Tonight is the safe landing.
  }
  return "tonight";
}

export function writeGroupTab(spaceId: string, tab: GroupTab): void {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + spaceId, tab);
  } catch {
    // Ignore quota and private mode.
  }
}

export interface GroupLanding {
  openCreateSession?: boolean;
  openInvite?: boolean;
  openPrayer?: boolean;
  openRename?: boolean;
  groupTab?: string;
  /** yyyy-MM-dd to open on the Meetings calendar. */
  day?: string;
}

export function landingDay(state: GroupLanding | null | undefined): string | null {
  if (state?.day && /^\d{4}-\d{2}-\d{2}$/.test(state.day)) return state.day;
  return null;
}

export function landingHasIntent(state: GroupLanding | null | undefined): boolean {
  if (!state) return false;
  return Boolean(
    state.openPrayer ||
      state.openInvite ||
      state.openRename ||
      state.openCreateSession ||
      isGroupTab(state.groupTab) ||
      landingDay(state),
  );
}

/** Landing flags win over the remembered tab. A plain visit uses the remembered tab. */
export function tabFromLanding(
  state: GroupLanding | null | undefined,
  spaceId: string,
): GroupTab {
  if (state?.openPrayer) return "prayer";
  if (state?.openInvite || state?.openRename) return "group";
  if (state?.openCreateSession) return "meetings";
  if (isGroupTab(state?.groupTab)) return state.groupTab;
  if (landingDay(state)) return "meetings";
  return readGroupTab(spaceId);
}
