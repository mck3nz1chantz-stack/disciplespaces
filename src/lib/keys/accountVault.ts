/**
 * Account Key cloud vault — encrypted personal backup on the light relay.
 * Server stores only ciphertext + vault id (hash of Account Key). Never raw key.
 * Linking an Account Key on a new device can restore Spaces without a file.
 */

import type { PrivateNote, Session, Space } from "../../types";
import {
  getAccountKeyMeta,
  getStoredAccountKey,
  normalizeAccountKeyInput,
} from "./accountKey";
import {
  buildPersonalBackup,
  decryptPersonalNotes,
  type PersonalBackupPayload,
} from "./personalBackup";
import {
  encryptJson,
  decryptJson,
  sha256Hex,
  type EncryptedBlob,
} from "./crypto";
import { getSpaceRelayBaseUrl, isSpaceRelayConfigured } from "../sync/config";
import { getDeviceId, getDeviceSecret } from "../sync/deviceIdentity";

const VAULT_PURPOSE = "account-vault-v1";

export interface VaultMeta {
  updatedAt: string;
  spaceCount: number;
  fingerprint?: string;
}

function vaultIdFromSecret(secret: string): Promise<string> {
  // Stable id derived from key — not reversible to the secret
  return sha256Hex(`ds-vault-id-v1:${normalizeAccountKeyInput(secret)}`);
}

async function vaultFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!isSpaceRelayConfigured()) {
    throw new Error(
      "Cloud restore is not available on this build. Download a personal backup file instead.",
    );
  }
  const base = getSpaceRelayBaseUrl();
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("X-Device-Id", getDeviceId());
  headers.set("Authorization", `Bearer ${getDeviceSecret()}`);
  return fetch(`${base}${path}`, {
    ...init,
    headers,
    cache: "no-store",
    mode: "cors",
    credentials: "omit",
  });
}

export async function getLocalVaultId(): Promise<string | null> {
  const secret = getStoredAccountKey();
  if (!secret) return null;
  return vaultIdFromSecret(secret);
}

/**
 * Upload encrypted personal backup for this Account Key.
 * Safe to call often — last write wins on the vault.
 */
export async function uploadAccountVault(input: {
  spaces: Space[];
  sessionsBySpace: Map<string, Session[]>;
  prayerBySpace: Map<string, import("../../types").PrayerBoardEntry[]>;
  privateNotes: PrivateNote[];
}): Promise<VaultMeta> {
  const secret = getStoredAccountKey();
  const meta = getAccountKeyMeta();
  if (!secret || !meta) {
    throw new Error("Create or link an Account Key before cloud backup.");
  }

  const payload = await buildPersonalBackup({
    spaces: input.spaces,
    sessionsBySpace: input.sessionsBySpace,
    prayerBySpace: input.prayerBySpace,
    privateNotes: input.privateNotes,
  });

  const blob = await encryptJson(
    normalizeAccountKeyInput(secret),
    VAULT_PURPOSE,
    payload,
  );
  const vaultId = await vaultIdFromSecret(secret);
  const updatedAt = new Date().toISOString();

  const res = await vaultFetch(`/vault/${encodeURIComponent(vaultId)}`, {
    method: "PUT",
    body: JSON.stringify({
      v: 1,
      kind: "ds-account-vault",
      updatedAt,
      spaceCount: payload.spaces.length,
      fingerprint: meta.fingerprint,
      blob,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || `Could not upload cloud backup (${res.status})`);
  }
  return {
    updatedAt,
    spaceCount: payload.spaces.length,
    fingerprint: meta.fingerprint,
  };
}

/**
 * Download and decrypt personal backup for the Account Key on this device.
 * Returns null when no vault exists yet (first device / never uploaded).
 */
export async function downloadAccountVault(
  accountKeyRaw?: string,
): Promise<PersonalBackupPayload | null> {
  const secret = accountKeyRaw
    ? normalizeAccountKeyInput(accountKeyRaw)
    : getStoredAccountKey();
  if (!secret) {
    throw new Error("Account Key required to restore cloud backup.");
  }
  const vaultId = await vaultIdFromSecret(secret);
  const res = await vaultFetch(`/vault/${encodeURIComponent(vaultId)}`, {
    method: "GET",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || `Could not download cloud backup (${res.status})`);
  }
  const data = (await res.json()) as {
    blob?: EncryptedBlob;
    spaceCount?: number;
    updatedAt?: string;
  };
  if (!data.blob) return null;
  return decryptJson<PersonalBackupPayload>(
    secret,
    VAULT_PURPOSE,
    data.blob,
  );
}

/** Peek vault metadata without decrypting (still needs vault id from key). */
export async function peekAccountVault(
  accountKeyRaw?: string,
): Promise<VaultMeta | null> {
  const secret = accountKeyRaw
    ? normalizeAccountKeyInput(accountKeyRaw)
    : getStoredAccountKey();
  if (!secret) return null;
  if (!isSpaceRelayConfigured()) return null;
  try {
    const vaultId = await vaultIdFromSecret(secret);
    const res = await vaultFetch(
      `/vault/${encodeURIComponent(vaultId)}?meta=1`,
      { method: "GET" },
    );
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = (await res.json()) as VaultMeta;
    return {
      updatedAt: data.updatedAt,
      spaceCount: data.spaceCount ?? 0,
      fingerprint: data.fingerprint,
    };
  } catch {
    return null;
  }
}

export { decryptPersonalNotes };
