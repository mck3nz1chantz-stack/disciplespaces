/**
 * Stable device identity for room membership (no accounts).
 * Stored in localStorage; regenerated only if cleared.
 */

const DEVICE_ID_KEY = "ds-device-id-v1";
const DEVICE_SECRET_KEY = "ds-device-secret-v1";

function randomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `dev-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function randomSecret(): string {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return randomId();
  }
}

/** Per-device secret sent as Bearer for room mutations (MVP house-key model). */
export function getDeviceSecret(): string {
  try {
    let secret = localStorage.getItem(DEVICE_SECRET_KEY);
    if (!secret) {
      secret = randomSecret();
      localStorage.setItem(DEVICE_SECRET_KEY, secret);
    }
    return secret;
  } catch {
    return randomSecret();
  }
}
