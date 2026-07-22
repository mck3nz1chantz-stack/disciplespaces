/**
 * Persisted Bible reader preferences (this device only).
 * Focus mode, font scale, and soft UI state for immersive study.
 */

const FOCUS_KEY = "ds-bible-focus-v1";
const FONT_KEY = "ds-bible-font-scale-v1";

/** 0 = smaller … 3 = largest. Default 1 (comfortable). */
export type ReaderFontScale = 0 | 1 | 2 | 3;

export const READER_FONT_SCALES: readonly ReaderFontScale[] = [0, 1, 2, 3];

/** Multipliers applied to base sanctuary prose size. */
export const READER_FONT_MULTIPLIERS: Record<ReaderFontScale, number> = {
  0: 0.92,
  1: 1,
  2: 1.12,
  3: 1.28,
};

export function loadReaderFocus(): boolean {
  try {
    return localStorage.getItem(FOCUS_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveReaderFocus(on: boolean): void {
  try {
    localStorage.setItem(FOCUS_KEY, on ? "1" : "0");
  } catch {
    // ignore
  }
}

export function loadReaderFontScale(): ReaderFontScale {
  try {
    const n = Number(localStorage.getItem(FONT_KEY));
    if (n === 0 || n === 1 || n === 2 || n === 3) return n;
  } catch {
    // ignore
  }
  return 1;
}

export function saveReaderFontScale(scale: ReaderFontScale): void {
  try {
    localStorage.setItem(FONT_KEY, String(scale));
  } catch {
    // ignore
  }
}

export function clampFontScale(n: number): ReaderFontScale {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  if (n === 2) return 2;
  return 3;
}
