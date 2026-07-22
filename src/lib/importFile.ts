/**
 * Read a DiscipleSpaces backup from plain text, JSON, or a Zip wrapper.
 * Zip is not a first-class format — only a container for DSX1./DSP1. text/JSON.
 */

import { unzipSync, strFromU8 } from "fflate";
import { EXPORT_KIND, EXPORT_PREFIX } from "./share";
import { PERSONAL_BACKUP_KIND, PERSONAL_BACKUP_PREFIX } from "./keys/personalBackup";

export const IMPORT_FILE_ACCEPT =
  ".txt,.zip,.json,text/plain,application/zip,application/json,application/x-zip-compressed";

const ZIP_LOCAL_SIG = [0x50, 0x4b, 0x03, 0x04]; // PK\x03\x04
const MAX_ZIP_BYTES = 25 * 1024 * 1024; // 25 MB safety cap
const MAX_ENTRY_TEXT_CHARS = 8 * 1024 * 1024;

export interface ImportFileResult {
  /** Full text to feed existing parsers (may include human preamble). */
  text: string;
  /** Short label for toasts (filename or zip entry path). */
  sourceLabel: string;
  /** True when content was pulled out of a Zip. */
  fromZip: boolean;
}

function isZipMagic(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  return (
    bytes[0] === ZIP_LOCAL_SIG[0] &&
    bytes[1] === ZIP_LOCAL_SIG[1] &&
    bytes[2] === ZIP_LOCAL_SIG[2] &&
    bytes[3] === ZIP_LOCAL_SIG[3]
  );
}

function looksLikeZipFile(file: File, head: Uint8Array): boolean {
  if (isZipMagic(head)) return true;
  const name = file.name.toLowerCase();
  if (name.endsWith(".zip")) return true;
  const type = (file.type || "").toLowerCase();
  return (
    type === "application/zip" ||
    type === "application/x-zip-compressed" ||
    type === "multipart/x-zip"
  );
}

/** Higher score = better DiscipleSpaces backup candidate. */
export function scoreBackupText(text: string): number {
  const t = text.trim();
  if (!t) return 0;

  let score = 0;
  if (t.includes(PERSONAL_BACKUP_PREFIX) || t.includes(PERSONAL_BACKUP_KIND)) {
    score += 100;
  }
  if (t.includes(EXPORT_PREFIX) || t.includes(EXPORT_KIND)) {
    score += 80;
  }
  if (t.startsWith("{")) {
    try {
      const parsed = JSON.parse(t) as {
        kind?: string;
        v?: number;
        spaces?: unknown;
        space?: unknown;
        sessions?: unknown;
      };
      if (parsed.kind === PERSONAL_BACKUP_KIND && Array.isArray(parsed.spaces)) {
        score += 95;
      } else if (
        parsed.kind === EXPORT_KIND &&
        parsed.space &&
        Array.isArray(parsed.sessions)
      ) {
        score += 85;
      } else if (Array.isArray(parsed.spaces) || Array.isArray(parsed.sessions)) {
        score += 20;
      }
    } catch {
      // not JSON
    }
  }
  // Prefer shorter human-share messages over huge dumps with coincidental tokens
  if (score > 0 && t.length < 500_000) score += 5;
  return score;
}

function decodeBytesAsText(bytes: Uint8Array): string {
  // Strip UTF-8 BOM if present
  let start = 0;
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    start = 3;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(start));
}

function isSkippableZipPath(path: string): boolean {
  const p = path.replace(/\\/g, "/");
  if (!p || p.endsWith("/")) return true;
  const base = p.split("/").pop() ?? p;
  if (base.startsWith(".")) return true;
  if (p.includes("__MACOSX/")) return true;
  // Skip obvious binaries by extension
  if (/\.(png|jpe?g|gif|webp|pdf|mp[34]|mov|heic|ico|woff2?|ttf|otf|exe|dmg)$/i.test(base)) {
    return true;
  }
  return false;
}

/**
 * Extract the best DiscipleSpaces package text from Zip bytes.
 */
export function extractBackupTextFromZip(
  zipBytes: Uint8Array,
  zipName = "archive.zip",
): ImportFileResult {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zipBytes, {
      filter: (file) => {
        if (file.originalSize > MAX_ENTRY_TEXT_CHARS) return false;
        return !isSkippableZipPath(file.name);
      },
    });
  } catch {
    throw new Error(
      "Could not open this Zip. It may be damaged, password-protected, or not a standard Zip.",
    );
  }

  const names = Object.keys(entries);
  if (names.length === 0) {
    throw new Error(
      "This Zip is empty or only has folders/binaries. Unzip and look for a .txt backup that starts with DSX1. or DSP1.",
    );
  }

  let best: { text: string; path: string; score: number } | null = null;

  for (const path of names) {
    if (isSkippableZipPath(path)) continue;
    const data = entries[path];
    if (!data || data.length === 0) continue;
    // Skip binary-looking payloads (high null-byte ratio)
    let nulls = 0;
    const sample = Math.min(data.length, 512);
    for (let i = 0; i < sample; i++) {
      if (data[i] === 0) nulls += 1;
    }
    if (nulls > sample * 0.05) continue;

    let text: string;
    try {
      text = strFromU8(data);
    } catch {
      text = decodeBytesAsText(data);
    }
    if (text.length > MAX_ENTRY_TEXT_CHARS) continue;

    const score = scoreBackupText(text);
    // Filename hints
    const lower = path.toLowerCase();
    let nameBonus = 0;
    if (lower.includes("disciple") || lower.includes("dsp1") || lower.includes("dsx1")) {
      nameBonus += 10;
    }
    if (lower.endsWith(".txt") || lower.endsWith(".json")) nameBonus += 5;

    const total = score + nameBonus;
    if (total <= 0) continue;
    if (!best || total > best.score) {
      best = { text, path, score: total };
    }
  }

  if (!best || best.score < 20) {
    throw new Error(
      "This Zip has no DiscipleSpaces backup. Look inside for a text file starting with DSX1. (group) or DSP1. (personal), then Restore that file — or re-export from Settings → Back up.",
    );
  }

  return {
    text: best.text,
    sourceLabel: `${zipName} → ${best.path}`,
    fromZip: true,
  };
}

function looksLikeBinaryGarbage(text: string): boolean {
  if (!text) return false;
  // Zip/binary mis-read as text often has lots of replacement/control chars
  const sample = text.slice(0, 400);
  let bad = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample.charCodeAt(i);
    if (c === 0xfffd || c < 9 || (c > 13 && c < 32)) bad += 1;
  }
  return bad > sample.length * 0.15;
}

/**
 * Read a user-chosen file for Restore/Import.
 * Accepts .txt / .json text, or a Zip containing a DSX1./DSP1. package.
 */
export async function readBackupImportFile(file: File): Promise<ImportFileResult> {
  if (!file || file.size === 0) {
    throw new Error("That file is empty.");
  }
  if (file.size > MAX_ZIP_BYTES) {
    throw new Error(
      "This file is too large to import in the browser (max 25 MB). Use a smaller backup or unzip and import the .txt only.",
    );
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (looksLikeZipFile(file, bytes)) {
    if (!isZipMagic(bytes)) {
      throw new Error(
        "This looks like a Zip by name, but the contents are not a standard Zip. Try renaming or re-zipping the backup .txt, or paste the DSX1./DSP1. package.",
      );
    }
    return extractBackupTextFromZip(bytes, file.name || "backup.zip");
  }

  const text = decodeBytesAsText(bytes);
  if (looksLikeBinaryGarbage(text) && scoreBackupText(text) < 20) {
    throw new Error(
      "Could not read this file as a DiscipleSpaces backup. Use a .txt group file (DSX1.), personal backup (DSP1.), or a Zip that contains one of those.",
    );
  }

  if (scoreBackupText(text) < 20 && !text.includes(EXPORT_PREFIX) && !text.includes(PERSONAL_BACKUP_PREFIX)) {
    // Still allow paste-through of weird-but-valid content; import parsers will throw clearly
    if (!text.trim().startsWith("{") && !/DS[MXP]?1\./i.test(text)) {
      throw new Error(
        "This file is not a DiscipleSpaces backup. Need a package starting with DSX1. (group) or DSP1. (personal), optional JSON export, or a Zip wrapping one of those.",
      );
    }
  }

  return {
    text,
    sourceLabel: file.name || "file",
    fromZip: false,
  };
}
