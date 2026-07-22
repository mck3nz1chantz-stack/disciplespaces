/**
 * Classify invite / key paste so Join never confuses room key vs Group Key vs Account Key.
 */

import { GROUP_KEY_PREFIX, normalizeGroupKeyInput } from "../keys/groupKey";
import { sha256Hex } from "../keys/crypto";
import { normalizeShortCode } from "./client";

export type InviteKeyKind =
  | "room"
  | "group"
  | "account"
  | "package"
  | "unknown";

export function classifyInviteKey(raw: string): InviteKeyKind {
  const text = raw.trim();
  if (!text) return "unknown";

  if (/DS[MX]?1\./i.test(text) || text.includes("DSX1.") || text.includes("DSP1.")) {
    return "package";
  }

  const upper = text.toUpperCase().replace(/\s+/g, "");
  if (
    upper.startsWith("DS-GRP-") ||
    upper.startsWith("DSGRP") ||
    upper.includes("DS-GRP-")
  ) {
    return "group";
  }
  if (
    upper.startsWith("DS-ACC-") ||
    upper.startsWith("DSACC") ||
    upper.includes("DS-ACC-")
  ) {
    return "account";
  }

  // Compact group key body (long alnum, not short room form)
  const alnum = upper.replace(/[^A-Z0-9]/g, "");
  if (alnum.length >= 16 && !looksLikeRoomShortCode(text)) {
    // Could be group key without prefix — treat as group if user likely pasted secret body
    if (alnum.length >= 20) return "group";
  }

  if (looksLikeRoomShortCode(text)) return "room";
  return "unknown";
}

/** Room join codes: ABCD-EF / ABCDEF (6–8 chars typical). */
export function looksLikeRoomShortCode(text: string): boolean {
  const t = text.trim().toUpperCase().replace(/\s+/g, "");
  if (/DS[MX]?1\./i.test(text)) return false;
  if (t.startsWith("DS-GRP") || t.startsWith("DSGRP")) return false;
  if (t.startsWith("DS-ACC") || t.startsWith("DSACC")) return false;
  // 4-2 with hyphen, or 6–8 continuous
  return /^[A-Z0-9]{3,8}-?[A-Z0-9]{2,6}$/.test(t) && normalizeShortCode(t).length >= 5 && normalizeShortCode(t).length <= 10;
}

export function wrongKeyHelp(kind: InviteKeyKind): string | null {
  switch (kind) {
    case "group":
      return (
        "That looks like a Group Key (DS-GRP-…), not the short room key. " +
        "Ask the host for the room key on their group card (like ABCD-EF). " +
        "If they shared the Group Key on purpose, we can try it as a trusted re-link."
      );
    case "account":
      return (
        "That is an Account Key (personal backup), not a group invite. " +
        "Use Settings → Account Key to restore your Spaces. " +
        "To join a friend’s group, paste their short room key (like ABCD-EF)."
      );
    case "package":
      return (
        "That is a group/personal backup file package, not a room key. " +
        "Use Join a group → paste the whole package, or Settings → Restore."
      );
    default:
      return null;
  }
}

export async function groupKeyHashFromInput(raw: string): Promise<string> {
  const normalized = normalizeGroupKeyInput(raw);
  if (!normalized.startsWith(GROUP_KEY_PREFIX)) {
    throw new Error("Invalid Group Key");
  }
  return sha256Hex(normalized);
}

/**
 * Turn a paste (room key or Group Key) into join/preview credentials.
 * Never sends raw Group Key — only hash when kind is group.
 */
export async function resolveJoinCredentials(raw: string): Promise<{
  shortCode?: string;
  groupKeyHash?: string;
  kind: InviteKeyKind;
}> {
  const kind = classifyInviteKey(raw);
  if (kind === "account") {
    throw new Error(wrongKeyHelp("account")!);
  }
  if (kind === "package") {
    throw new Error(wrongKeyHelp("package")!);
  }
  if (kind === "group") {
    // Long body without prefix still normalized by normalizeGroupKeyInput
    let hash: string;
    try {
      hash = await groupKeyHashFromInput(raw);
    } catch {
      throw new Error(
        "Could not read that Group Key. Prefer the short room key (ABCD-EF) from the host’s group card.",
      );
    }
    return { groupKeyHash: hash, kind: "group" };
  }
  if (kind === "room" || looksLikeRoomShortCode(raw)) {
    const shortCode = normalizeShortCode(raw);
    if (shortCode.length < 5) {
      throw new Error("Enter the full room key from your host (like ABCD-EF).");
    }
    return { shortCode, kind: "room" };
  }
  // Last resort: treat compact alnum as room key
  const shortCode = normalizeShortCode(raw);
  if (shortCode.length >= 5 && shortCode.length <= 10) {
    return { shortCode, kind: "room" };
  }
  throw new Error(
    "Couldn’t recognize that code. Paste the host’s room key (like ABCD-EF). Group Key starts with DS-GRP-; Account Key with DS-ACC-.",
  );
}

