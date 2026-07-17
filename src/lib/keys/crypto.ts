/**
 * Web Crypto helpers for Account Key / personal backup encryption.
 * Browser-only; no server round-trip for key material.
 */

const PBKDF2_ITERATIONS = 120_000;
const SALT_PREFIX = "disciple-spaces-v1:";

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** Crockford-ish alphabet (no I,L,O,U) for human-readable secrets. */
const SECRET_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function randomSecretString(groups: number, groupLen = 4): string {
  const parts: string[] = [];
  for (let g = 0; g < groups; g++) {
    const bytes = randomBytes(groupLen);
    let chunk = "";
    for (let i = 0; i < groupLen; i++) {
      chunk += SECRET_ALPHABET[bytes[i]! % SECRET_ALPHABET.length];
    }
    parts.push(chunk);
  }
  return parts.join("-");
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export async function fingerprint8(input: string): Promise<string> {
  const hex = await sha256Hex(input);
  return hex.slice(0, 8).toUpperCase();
}

async function deriveAesKey(
  secret: string,
  purpose: string,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const salt = new TextEncoder().encode(SALT_PREFIX + purpose);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export interface EncryptedBlob {
  v: 1;
  alg: "AES-GCM";
  iv: string;
  ciphertext: string;
}

export async function encryptJson(
  secret: string,
  purpose: string,
  data: unknown,
): Promise<EncryptedBlob> {
  const key = await deriveAesKey(secret, purpose);
  const iv = randomBytes(12);
  const plain = new TextEncoder().encode(JSON.stringify(data));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    plain,
  );
  return {
    v: 1,
    alg: "AES-GCM",
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(cipher)),
  };
}

export async function decryptJson<T>(
  secret: string,
  purpose: string,
  blob: EncryptedBlob,
): Promise<T> {
  if (!blob || blob.v !== 1 || blob.alg !== "AES-GCM") {
    throw new Error("Unsupported encrypted payload.");
  }
  const key = await deriveAesKey(secret, purpose);
  const iv = base64UrlToBytes(blob.iv);
  const ciphertext = base64UrlToBytes(blob.ciphertext);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    );
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    throw new Error(
      "Could not decrypt — wrong Account Key, or the file is damaged.",
    );
  }
}
