/**
 * Space relay configuration.
 *
 * Preview / pages.dev is fine until full product deployment.
 * Override with VITE_SPACE_RELAY_URL only if needed (see .env.example).
 * Public defaults live here so the repo does not need secret-like .env* filenames
 * (project-health secrets-smoke is a name check, not a content scan).
 */

/** Production relay Worker (public URL; not a secret). Override via VITE_SPACE_RELAY_URL. */
const DEFAULT_SPACE_RELAY_URL =
  "https://disciple-spaces-relay.mck3nz1-chantz.workers.dev";

/** Canonical app origin users should bookmark (IndexedDB is per-origin). */
export const CANONICAL_APP_ORIGIN =
  (typeof import.meta !== "undefined" &&
    import.meta.env?.VITE_CANONICAL_ORIGIN) ||
  "https://disciple-spaces.pages.dev";

/**
 * Base URL for the light Space room Worker (no trailing slash).
 * Empty string only if explicitly disabled via VITE_SPACE_RELAY_URL="".
 */
export function getSpaceRelayBaseUrl(): string {
  const envRaw =
    typeof import.meta !== "undefined"
      ? import.meta.env?.VITE_SPACE_RELAY_URL
      : undefined;
  // Explicit empty string disables relay; undefined/null → production default
  if (envRaw !== undefined && envRaw !== null) {
    return String(envRaw).trim().replace(/\/+$/, "");
  }
  return DEFAULT_SPACE_RELAY_URL.replace(/\/+$/, "");
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
