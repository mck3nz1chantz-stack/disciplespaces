import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import {
  themePreferenceLabel,
  type ThemePreference,
} from "../lib/theme";
import { Button } from "./Button";

/**
 * Compact header control: cycles Light → Dark → System.
 */
export function ThemeCycleButton() {
  const { preference, cyclePreference, isDark } = useTheme();
  const label = themePreferenceLabel(preference);

  return (
    <Button
      type="button"
      variant="ghost"
      className="!p-2.5 shrink-0"
      onClick={cyclePreference}
      aria-label={`Appearance: ${label}. Tap to change.`}
      title={`Appearance: ${label}`}
    >
      {preference === "system" ? (
        <Monitor className="h-5 w-5" aria-hidden />
      ) : isDark ? (
        <Moon className="h-5 w-5" aria-hidden />
      ) : (
        <Sun className="h-5 w-5" aria-hidden />
      )}
    </Button>
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
      <div className="grid grid-cols-3 gap-2">
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
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-bg text-muted hover:border-primary/30",
              ].join(" ")}
              aria-pressed={selected}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span className="text-xs font-semibold">{opt.label}</span>
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
