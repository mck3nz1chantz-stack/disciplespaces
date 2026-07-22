/**
 * Automatic Account Key vault: personal Spaces home under the key.
 * Server stores ciphertext only. Debounced upload after local changes;
 * on boot/foreground, pull+merge when cloud is newer than last local vault sync.
 */

import { db } from "../db";
import { isOnlineModeEnabled } from "../onlineMode";
import { isSpaceRelayConfigured } from "../sync/config";
import {
  getStoredAccountKey,
  hasAccountKey,
} from "./accountKey";
import {
  downloadAccountVault,
  peekAccountVault,
  uploadAccountVault,
} from "./accountVault";
import { decryptPersonalNotes } from "./personalBackup";

const UPLOAD_DEBOUNCE_MS = 4_000;
const VAULT_SYNCED_AT_KEY = "ds-vault-synced-at";

let uploadTimer: number | null = null;
let uploadInFlight = false;
let bootCheckDone = false;

export function getVaultSyncedAt(): string | null {
  try {
    return localStorage.getItem(VAULT_SYNCED_AT_KEY);
  } catch {
    return null;
  }
}

export function setVaultSyncedAt(iso: string): void {
  try {
    localStorage.setItem(VAULT_SYNCED_AT_KEY, iso);
  } catch {
    // ignore quota / private mode
  }
}

async function gatherBackupInput() {
  const { useAppStore } = await import("../../stores/useAppStore");
  const spaces = useAppStore.getState().spaces;
  const sessions = await db.sessions.toArray();
  const prayers = await db.prayerBoard.toArray();
  const notes = await db.privateNotes.toArray();
  const sessionsBySpace = new Map<string, typeof sessions>();
  const prayerBySpace = new Map<string, typeof prayers>();
  for (const s of sessions) {
    const list = sessionsBySpace.get(s.spaceId) ?? [];
    list.push(s);
    sessionsBySpace.set(s.spaceId, list);
  }
  for (const p of prayers) {
    const list = prayerBySpace.get(p.spaceId) ?? [];
    list.push(p);
    prayerBySpace.set(p.spaceId, list);
  }
  return { spaces, sessionsBySpace, prayerBySpace, privateNotes: notes };
}

/** Debounced encrypted vault upload when Account Key + relay exist. */
export function scheduleAccountVaultUpload(): void {
  if (!hasAccountKey() || !getStoredAccountKey()) return;
  if (!isSpaceRelayConfigured()) return;
  if (typeof window === "undefined") return;
  if (!isOnlineModeEnabled()) return;

  if (uploadTimer != null) window.clearTimeout(uploadTimer);
  uploadTimer = window.setTimeout(() => {
    uploadTimer = null;
    void runVaultUpload();
  }, UPLOAD_DEBOUNCE_MS);
}

export async function runVaultUpload(): Promise<boolean> {
  if (uploadInFlight) return false;
  if (!hasAccountKey() || !getStoredAccountKey()) return false;
  if (!isSpaceRelayConfigured() || !isOnlineModeEnabled()) return false;

  uploadInFlight = true;
  try {
    const input = await gatherBackupInput();
    if (input.spaces.length === 0) {
      // Still allow empty vault seed
    }
    const meta = await uploadAccountVault(input);
    setVaultSyncedAt(meta.updatedAt);
    window.dispatchEvent(
      new CustomEvent("ds-vault-synced", { detail: meta }),
    );
    return true;
  } catch {
    return false;
  } finally {
    uploadInFlight = false;
  }
}

/**
 * If cloud vault is newer than last local vault sync, download and merge
 * (replace-shared LWW). Then schedule upload so local-only newer rows push back.
 */
export async function checkAccountVaultOnForeground(): Promise<{
  restored: boolean;
  spaces: number;
  sessions: number;
}> {
  if (!hasAccountKey() || !getStoredAccountKey()) {
    return { restored: false, spaces: 0, sessions: 0 };
  }
  if (!isSpaceRelayConfigured() || !isOnlineModeEnabled()) {
    return { restored: false, spaces: 0, sessions: 0 };
  }

  try {
    const meta = await peekAccountVault();
    if (!meta?.updatedAt) return { restored: false, spaces: 0, sessions: 0 };

    const localSynced = getVaultSyncedAt();
    if (localSynced && meta.updatedAt <= localSynced) {
      return { restored: false, spaces: 0, sessions: 0 };
    }

    const personal = await downloadAccountVault();
    if (!personal) {
      setVaultSyncedAt(meta.updatedAt);
      return { restored: false, spaces: 0, sessions: 0 };
    }

    const { useAppStore } = await import("../../stores/useAppStore");
    const importSpaceExport = useAppStore.getState().importSpaceExport;
    let sessionTotal = 0;
    for (const pack of personal.spaces) {
      const result = await importSpaceExport(pack, {
        mergeStrategy: "replace-shared",
      });
      sessionTotal += result.addedSessions;
    }

    if (personal.privateNotesIncluded && personal.privateNotesEnc) {
      const key = getStoredAccountKey();
      if (key) {
        const notes = await decryptPersonalNotes(personal, key);
        for (const n of notes) {
          const exists = await db.privateNotes.get(n.id);
          if (!exists) {
            await db.privateNotes.put(n);
          } else if (
            (n.updatedAt || n.createdAt) >=
            (exists.updatedAt || exists.createdAt)
          ) {
            await db.privateNotes.put({ ...exists, ...n, id: exists.id });
          }
        }
      }
    }

    await useAppStore.getState().loadSpaces();
    setVaultSyncedAt(meta.updatedAt);
    // Push any local rows that were newer than the vault snapshot
    scheduleAccountVaultUpload();
    window.dispatchEvent(new Event("ds-vault-restored"));

    return {
      restored: true,
      spaces: personal.spaces.length,
      sessions: sessionTotal,
    };
  } catch {
    return { restored: false, spaces: 0, sessions: 0 };
  }
}

/** One soft boot check after initialize (idempotent per page load). */
export async function maybeBootVaultCheck(): Promise<void> {
  if (bootCheckDone) return;
  bootCheckDone = true;
  await checkAccountVaultOnForeground();
}
