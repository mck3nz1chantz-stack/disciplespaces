/**
 * Space relay configuration.
 *
 * Preview / pages.dev is fine until full product deployment.
 * Set VITE_SPACE_RELAY_URL when the Worker is deployed (e.g. https://ds-relay.example.workers.dev).
 * Leave unset → app stays fully local; Connect UI explains relay is not enabled yet.
 */

/** Canonical app origin users should bookmark (IndexedDB is per-origin). */
export const CANONICAL_APP_ORIGIN =
  (typeof import.meta !== "undefined" &&
    import.meta.env?.VITE_CANONICAL_ORIGIN) ||
  "https://disciple-spaces.pages.dev";

/**
 * Base URL for the light Space room Worker (no trailing slash).
 * Empty string = relay not configured; sync stays local-only path.
 */
export function getSpaceRelayBaseUrl(): string {
  const raw =
    (typeof import.meta !== "undefined" &&
      import.meta.env?.VITE_SPACE_RELAY_URL) ||
    "";
  return String(raw).trim().replace(/\/+$/, "");
}

/** True when a relay endpoint is configured (Connect can talk to the network). */
export function isSpaceRelayConfigured(): boolean {
  return getSpaceRelayBaseUrl().length > 0;
}

/**
 * Product flag: show Connect / Sync CTAs (always true once UI ships).
 * Actual network calls still require isSpaceRelayConfigured().
 */
export const SPACE_RELAY_UI_ENABLED = true;
