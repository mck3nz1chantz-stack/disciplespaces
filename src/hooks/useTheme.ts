import { useCallback, useEffect, useState } from "react";
import {
  applyTheme,
  getStoredThemePreference,
  nextThemePreference,
  resolveTheme,
  setThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from "../lib/theme";

/**
 * Theme preference + resolved light/dark, kept in sync with system when needed.
 */
export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    typeof window !== "undefined" ? getStoredThemePreference() : "system",
  );
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    typeof window !== "undefined"
      ? resolveTheme(getStoredThemePreference())
      : "light",
  );

  useEffect(() => {
    setResolved(applyTheme(preference));
  }, [preference]);

  // Follow OS when preference is system
  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(applyTheme("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((pref: ThemePreference) => {
    setThemePreference(pref);
    setPreferenceState(pref);
    setResolved(resolveTheme(pref));
  }, []);

  const cyclePreference = useCallback(() => {
    setPreference(nextThemePreference(preference));
  }, [preference, setPreference]);

  return {
    preference,
    resolved,
    setPreference,
    cyclePreference,
    isDark: resolved === "dark",
  };
}
