import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import {
  themePreferenceLabel,
  type ThemePreference,
} from "../lib/theme";

/**
 * Compact header control: cycles Light → Dark → System.
 * High-contrast chip on both themes (no gold/yellow ink on light parchment).
 */
export function ThemeCycleButton() {
  const { preference, cyclePreference, isDark } = useTheme();
  const label = themePreferenceLabel(preference);

  return (
    <button
      type="button"
      onClick={cyclePreference}
      className={[
        "inline-flex items-center justify-center rounded-xl p-2.5 shrink-0",
        "touch-manipulation tap-target transition-colors",
        "border border-border/90 bg-surface/90 text-text",
        "hover:bg-surface-muted hover:border-primary/30",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
      ].join(" ")}
      aria-label={`Appearance: ${label}. Tap to change.`}
      title={`Appearance: ${label}`}
    >
      {preference === "system" ? (
        <Monitor className="h-5 w-5 text-text" strokeWidth={2} aria-hidden />
      ) : isDark ? (
        <Moon className="h-5 w-5 text-primary" strokeWidth={2} aria-hidden />
      ) : (
        /* Light mode: use primary forest, never accent gold (unreadable on parchment) */
        <Sun className="h-5 w-5 text-primary" strokeWidth={2} aria-hidden />
      )}
    </button>
  );
}

/**
 * Full Light / Dark / System control for Settings.
 */
export function ThemePreferencePicker() {
  const { preference, setPreference, resolved } = useTheme();

  const options: Array<{
    id: ThemePreference;
    label: string;
    hint: string;
    icon: typeof Sun;
  }> = [
    {
      id: "light",
      label: "Light",
      hint: "Warm parchment day theme",
      icon: Sun,
    },
    {
      id: "dark",
      label: "Dark",
      hint: "Low-glare night reading",
      icon: Moon,
    },
    {
      id: "system",
      label: "System",
      hint: `Match device (${resolved === "dark" ? "dark" : "light"} now)`,
      icon: Monitor,
    },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Appearance">
        {options.map((opt) => {
          const selected = preference === opt.id;
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPreference(opt.id)}
              className={[
                "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center touch-manipulation tap-target transition-colors",
                selected
                  ? "border-primary bg-primary text-on-primary shadow-sm"
                  : "border-border bg-surface text-text hover:border-primary/40 hover:bg-surface-muted",
              ].join(" ")}
              aria-pressed={selected}
            >
              <Icon
                className={[
                  "h-5 w-5",
                  selected ? "text-on-primary" : "text-primary",
                ].join(" ")}
                strokeWidth={2}
                aria-hidden
              />
              <span
                className={[
                  "text-xs font-semibold",
                  selected ? "text-on-primary" : "text-text",
                ].join(" ")}
              >
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted text-center">
        {options.find((o) => o.id === preference)?.hint}
      </p>
    </div>
  );
}
