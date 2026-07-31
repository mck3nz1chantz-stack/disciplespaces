/**
 * Coordinate group-sync toasts so manual Sync and foreground auto-sync
 * don’t stack the same “Group updated” message.
 */

const MANUAL_SUPPRESS_MS = 14_000;
const QUIET_AUTO_MIN_MS = 90_000;

let lastManualSyncToastAt = 0;
let lastAutoSuccessToastAt = 0;

/** Call right after a user-driven Sync success toast. */
export function noteManualSyncToast(): void {
  lastManualSyncToastAt = Date.now();
  lastAutoSuccessToastAt = lastManualSyncToastAt;
}

/**
 * Whether foreground / background auto-sync should show a success toast.
 * @param notable true when meetings/people/prayers actually changed
 */
export function shouldShowAutoSyncSuccessToast(notable: boolean): boolean {
  const now = Date.now();
  // Always suppress shortly after a manual Sync toast
  if (now - lastManualSyncToastAt < MANUAL_SUPPRESS_MS) {
    return false;
  }
  // On a group detail screen, live/soft pull already refreshes UI — skip quiet “up to date”
  if (!notable && isOnSpaceDetail()) {
    return false;
  }
  // Notable changes: allow sooner; quiet success: throttle hard
  if (notable) {
    if (now - lastAutoSuccessToastAt < 8_000) return false;
    lastAutoSuccessToastAt = now;
    return true;
  }
  if (now - lastAutoSuccessToastAt < QUIET_AUTO_MIN_MS) return false;
  lastAutoSuccessToastAt = now;
  return true;
}

/** Shared toast id so sonner replaces instead of stacking. */
export const SYNC_SUCCESS_TOAST_ID = "ds-sync-success";
export const SYNC_FAIL_TOAST_ID = "ds-sync-fail";

function isOnSpaceDetail(): boolean {
  try {
    return /^\/space\//.test(window.location.pathname);
  } catch {
    return false;
  }
}
