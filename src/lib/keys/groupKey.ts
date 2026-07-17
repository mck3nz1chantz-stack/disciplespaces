/**
 * Group Key — space-level secret (optional).
 * Stored per-space on this device; relay keeps hash only when connected.
 */

import {
  fingerprint8,
  randomSecretString,
  sha256Hex,
} from "./crypto";

export const GROUP_KEY_PREFIX = "DS-GRP-";

const storageKey = (spaceId: string) => `ds-group-key-v1:${spaceId}`;
const storageMetaKey = (spaceId: string) => `ds-group-key-meta-v1:${spaceId}`;

export interface GroupKeyMeta {
  spaceId: string;
  keyId: string;
  createdAt: string;
  fingerprint: string;
  /** SHA-256 of normalized secret. */
  verifier: string;
}

export interface GroupKeyRotationProposal {
  id: string;
  spaceId: string;
  /** Hash of the *proposed* new key (server + local). */
  proposedKeyHash: string;
  proposedFingerprint: string;
  proposedByMemberId: string;
  proposedByName: string;
  proposedAt: string;
  /** All current member ids that must approve. */
  requiredMemberIds: string[];
  approvals: Array<{
    memberId: string;
    name: string;
    at: string;
    /** true if marked on someone else's device after in-person confirm */
    onBehalf?: boolean;
  }>;
  status: "pending" | "completed" | "cancelled";
  /** Set when completed — new short join code. */
  newShortCode?: string;
}

function normalizeSecret(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function normalizeGroupKeyInput(raw: string): string {
  let s = normalizeSecret(raw);
  if (s.startsWith("DS-GRP-")) {
    s = s.slice("DS-GRP-".length);
  } else if (s.startsWith("DSGRP")) {
    s = s.slice(5);
  }
  const alnum = s.replace(/[^A-Z0-9]/g, "");
  if (alnum.length >= 16 && !s.includes("-")) {
    const parts: string[] = [];
    for (let i = 0; i < alnum.length; i += 4) {
      parts.push(alnum.slice(i, i + 4));
    }
    s = parts.join("-");
  }
  return `${GROUP_KEY_PREFIX}${s.replace(/^DS-GRP-/, "")}`;
}

export async function generateGroupKey(): Promise<{
  secret: string;
  meta: Omit<GroupKeyMeta, "spaceId">;
}> {
  const body = randomSecretString(5, 4);
  const secret = `${GROUP_KEY_PREFIX}${body}`;
  const verifier = await sha256Hex(secret);
  const fingerprint = await fingerprint8(secret);
  return {
    secret,
    meta: {
      keyId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      fingerprint,
      verifier,
    },
  };
}

export function getStoredGroupKey(spaceId: string): string | null {
  try {
    const secret = localStorage.getItem(storageKey(spaceId));
    if (!secret || !secret.startsWith(GROUP_KEY_PREFIX)) return null;
    return secret;
  } catch {
    return null;
  }
}

export function getGroupKeyMeta(spaceId: string): GroupKeyMeta | null {
  try {
    const raw = localStorage.getItem(storageMetaKey(spaceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GroupKeyMeta;
    if (!parsed?.keyId || parsed.spaceId !== spaceId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function persistGroupKey(
  spaceId: string,
  secret: string,
  meta?: Partial<GroupKeyMeta>,
): Promise<GroupKeyMeta> {
  const normalized = normalizeGroupKeyInput(secret);
  const verifier = await sha256Hex(normalized);
  const fingerprint = await fingerprint8(normalized);
  const full: GroupKeyMeta = {
    spaceId,
    keyId: meta?.keyId || crypto.randomUUID(),
    createdAt: meta?.createdAt || new Date().toISOString(),
    fingerprint,
    verifier,
  };
  localStorage.setItem(storageKey(spaceId), normalized);
  localStorage.setItem(storageMetaKey(spaceId), JSON.stringify(full));
  return full;
}

export function clearGroupKey(spaceId: string): void {
  try {
    localStorage.removeItem(storageKey(spaceId));
    localStorage.removeItem(storageMetaKey(spaceId));
  } catch {
    // ignore
  }
}

/**
 * Pending new secret during unanimous rotation.
 * Kept in localStorage (not session) so the proposer can finish after reloads.
 * Only the proposing device should hold this; never put raw key on the relay.
 */
const pendingSecretKey = (spaceId: string) =>
  `ds-group-key-pending-v1:${spaceId}`;

export function setPendingGroupKeySecret(
  spaceId: string,
  secret: string,
): void {
  try {
    localStorage.setItem(
      pendingSecretKey(spaceId),
      normalizeGroupKeyInput(secret),
    );
  } catch {
    // ignore
  }
}

export function getPendingGroupKeySecret(spaceId: string): string | null {
  try {
    return localStorage.getItem(pendingSecretKey(spaceId));
  } catch {
    return null;
  }
}

export function clearPendingGroupKeySecret(spaceId: string): void {
  try {
    localStorage.removeItem(pendingSecretKey(spaceId));
  } catch {
    // ignore
  }
}

export function allMembersApproved(
  proposal: GroupKeyRotationProposal,
): boolean {
  if (proposal.status !== "pending") return false;
  const approved = new Set(proposal.approvals.map((a) => a.memberId));
  return proposal.requiredMemberIds.every((id) => approved.has(id));
}

export function createRotationProposal(input: {
  spaceId: string;
  proposedKeyHash: string;
  proposedFingerprint: string;
  proposedByMemberId: string;
  proposedByName: string;
  requiredMemberIds: string[];
}): GroupKeyRotationProposal {
  return {
    id: crypto.randomUUID(),
    spaceId: input.spaceId,
    proposedKeyHash: input.proposedKeyHash,
    proposedFingerprint: input.proposedFingerprint,
    proposedByMemberId: input.proposedByMemberId,
    proposedByName: input.proposedByName,
    proposedAt: new Date().toISOString(),
    requiredMemberIds: [...input.requiredMemberIds],
    approvals: [
      {
        memberId: input.proposedByMemberId,
        name: input.proposedByName,
        at: new Date().toISOString(),
      },
    ],
    status: "pending",
  };
}
