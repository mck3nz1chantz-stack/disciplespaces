/**
 * Shared-layer merge helpers for room pull/push and vault restore.
 * Whole-entity last-write-wins by updatedAt (ISO). Missing timestamps lose.
 */

/** Parse ISO updatedAt; invalid/missing → 0 (loses to any real stamp). */
export function entityUpdatedAtMs(row: { updatedAt?: string } | null | undefined): number {
  const raw = row?.updatedAt;
  if (!raw || typeof raw !== "string") return 0;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Prefer the newer entity by updatedAt.
 * On equal timestamps (or both missing), prefer `incoming` (remote/pull wins ties).
 */
export function pickLwwEntity<T extends { id?: string; updatedAt?: string }>(
  local: T | null | undefined,
  incoming: T,
): T {
  if (!local) return incoming;
  const a = entityUpdatedAtMs(local);
  const b = entityUpdatedAtMs(incoming);
  if (b >= a) return { ...local, ...incoming, id: local.id ?? incoming.id };
  return local;
}

/** True when incoming should replace local for replace-shared pulls. */
export function incomingIsNewerOrEqual(
  local: { updatedAt?: string } | null | undefined,
  incoming: { updatedAt?: string },
): boolean {
  if (!local) return true;
  return entityUpdatedAtMs(incoming) >= entityUpdatedAtMs(local);
}

/** Stamp now as ISO updatedAt. */
export function nowUpdatedAt(): string {
  return new Date().toISOString();
}
