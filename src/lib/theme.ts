/**
 * Light / dark / system appearance for DiscipleSpaces.
 * Preference is device-local (localStorage). Applied as `html.dark` + color-scheme.
 */

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "ds-theme-v1";

const LIGHT_THEME_COLOR = "#1e3a2f";
const DARK_THEME_COLOR = "#0c1210";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function getStoredThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(raw)) return raw;
  } catch {
    // ignore
  }
  return "system";
}

export function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === "light") return "light";
  if (pref === "dark") return "dark";
  return systemPrefersDark() ? "dark" : "light";
}

export function applyTheme(pref: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(pref);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute(
      "content",
      resolved === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR,
    );
  }

  // iOS status bar: black-translucent reads better in dark
  const statusBar = document.querySelector(
    'meta[name="apple-mobile-web-app-status-bar-style"]',
  );
  if (statusBar) {
    statusBar.setAttribute(
      "content",
      resolved === "dark" ? "black-translucent" : "default",
    );
  }

  return resolved;
}

export function setThemePreference(pref: ThemePreference): ResolvedTheme {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // ignore
  }
  return applyTheme(pref);
}

/** Cycle light → dark → system → light (header control). */
export function nextThemePreference(current: ThemePreference): ThemePreference {
  if (current === "light") return "dark";
  if (current === "dark") return "system";
  return "light";
}

export function themePreferenceLabel(pref: ThemePreference): string {
  if (pref === "light") return "Light";
  if (pref === "dark") return "Dark";
  return "System";
}
