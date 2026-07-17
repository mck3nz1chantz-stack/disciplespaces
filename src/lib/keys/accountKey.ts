/**
 * Personal Account Key — optional multi-device identity without email/password.
 * Stored on this device only. Regenerating replaces the verifier; old key fails.
 */

import {
  fingerprint8,
  randomSecretString,
  sha256Hex,
} from "./crypto";

export const ACCOUNT_KEY_PREFIX = "DS-ACC-";

const STORAGE_SECRET = "ds-account-key-secret-v1";
const STORAGE_META = "ds-account-key-meta-v1";
const STORAGE_PREFS = "ds-account-key-prefs-v1";

export interface AccountKeyMeta {
  keyId: string;
  createdAt: string;
  /** SHA-256 hex of normalized secret — never reverse to key. */
  verifier: string;
  fingerprint: string;
}

export interface AccountKeyPrefs {
  /** Opt-in: include private notes (encrypted) in personal backups. */
  includePrivateNotesInPersonalBackup: boolean;
}

const DEFAULT_PREFS: AccountKeyPrefs = {
  includePrivateNotesInPersonalBackup: false,
};

function normalizeSecret(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

/** Accept with or without DS-ACC- prefix; hyphens optional in body. */
export function normalizeAccountKeyInput(raw: string): string {
  let s = normalizeSecret(raw);
  if (s.startsWith("DS-ACC-")) {
    s = s.slice("DS-ACC-".length);
  } else if (s.startsWith("DSACC")) {
    s = s.slice(5);
  }
  // Re-chunk if user pasted without hyphens
  const alnum = s.replace(/[^A-Z0-9]/g, "");
  if (alnum.length >= 16 && !s.includes("-")) {
    const parts: string[] = [];
    for (let i = 0; i < alnum.length; i += 4) {
      parts.push(alnum.slice(i, i + 4));
    }
    s = parts.join("-");
  }
  return `${ACCOUNT_KEY_PREFIX}${s.replace(/^DS-ACC-/, "")}`;
}

export function formatAccountKeyDisplay(fullKey: string): string {
  return normalizeAccountKeyInput(fullKey);
}

export async function generateAccountKey(): Promise<{
  secret: string;
  meta: AccountKeyMeta;
}> {
  // 5 groups × 4 = 20 chars entropy-ish + prefix
  const body = randomSecretString(5, 4);
  const secret = `${ACCOUNT_KEY_PREFIX}${body}`;
  const verifier = await sha256Hex(secret);
  const fingerprint = await fingerprint8(secret);
  const meta: AccountKeyMeta = {
    keyId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    verifier,
    fingerprint,
  };
  return { secret, meta };
}

export function getAccountKeyMeta(): AccountKeyMeta | null {
  try {
    const raw = localStorage.getItem(STORAGE_META);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AccountKeyMeta;
    if (!parsed?.keyId || !parsed?.verifier) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Full secret if this device already created/linked an Account Key. */
export function getStoredAccountKey(): string | null {
  try {
    const secret = localStorage.getItem(STORAGE_SECRET);
    if (!secret || !secret.startsWith(ACCOUNT_KEY_PREFIX)) return null;
    return secret;
  } catch {
    return null;
  }
}

export function hasAccountKey(): boolean {
  return getAccountKeyMeta() != null && getStoredAccountKey() != null;
}

export async function persistAccountKey(
  secret: string,
  meta: AccountKeyMeta,
): Promise<void> {
  const normalized = normalizeAccountKeyInput(secret);
  const verifier = await sha256Hex(normalized);
  if (verifier !== meta.verifier) {
    // Recompute meta if caller passed fresh secret
    meta = {
      ...meta,
      verifier,
      fingerprint: await fingerprint8(normalized),
    };
  }
  localStorage.setItem(STORAGE_SECRET, normalized);
  localStorage.setItem(STORAGE_META, JSON.stringify(meta));
}

/**
 * Link this device with an existing Account Key (other phone / written down).
 * Replaces any previous key on this device — does not wipe Spaces/notes.
 */
export async function linkAccountKey(raw: string): Promise<AccountKeyMeta> {
  const secret = normalizeAccountKeyInput(raw);
  if (secret.length < ACCOUNT_KEY_PREFIX.length + 12) {
    throw new Error("That Account Key looks too short. Paste the full key.");
  }
  const verifier = await sha256Hex(secret);
  const fingerprint = await fingerprint8(secret);
  const existing = getAccountKeyMeta();
  // If already have same key, keep keyId
  if (existing && existing.verifier === verifier) {
    localStorage.setItem(STORAGE_SECRET, secret);
    return existing;
  }
  const meta: AccountKeyMeta = {
    keyId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    verifier,
    fingerprint,
  };
  await persistAccountKey(secret, meta);
  return meta;
}

/** Create brand-new key on this device (or after regenerate). */
export async function createAndStoreAccountKey(): Promise<{
  secret: string;
  meta: AccountKeyMeta;
}> {
  const { secret, meta } = await generateAccountKey();
  await persistAccountKey(secret, meta);
  return { secret, meta };
}

/**
 * Regenerate: new secret, old one no longer verifies.
 * Caller must show save gate. Does not delete Spaces or private notes.
 */
export async function regenerateAccountKey(): Promise<{
  secret: string;
  meta: AccountKeyMeta;
  previousFingerprint: string | null;
}> {
  const prev = getAccountKeyMeta();
  const { secret, meta } = await generateAccountKey();
  await persistAccountKey(secret, meta);
  return {
    secret,
    meta,
    previousFingerprint: prev?.fingerprint ?? null,
  };
}

export async function verifyAccountKey(raw: string): Promise<boolean> {
  const meta = getAccountKeyMeta();
  if (!meta) return false;
  const secret = normalizeAccountKeyInput(raw);
  const verifier = await sha256Hex(secret);
  return verifier === meta.verifier;
}

export function getAccountKeyPrefs(): AccountKeyPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_PREFS);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<AccountKeyPrefs>;
    return {
      includePrivateNotesInPersonalBackup:
        parsed.includePrivateNotesInPersonalBackup === true,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function setAccountKeyPrefs(prefs: Partial<AccountKeyPrefs>): AccountKeyPrefs {
  const next = { ...getAccountKeyPrefs(), ...prefs };
  localStorage.setItem(STORAGE_PREFS, JSON.stringify(next));
  return next;
}

/** Clear key material only — never touches IndexedDB. */
export function clearAccountKeyFromDevice(): void {
  try {
    localStorage.removeItem(STORAGE_SECRET);
    localStorage.removeItem(STORAGE_META);
  } catch {
    // ignore
  }
}
