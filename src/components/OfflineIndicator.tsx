import { Wifi, WifiOff } from "lucide-react";
import { useOnlineMode } from "../hooks/useOnlineMode";
import { toast } from "sonner";

/**
 * Header pill: network + Online/Offline preference.
 * Tap toggles app Online/Offline mode (affects group sync).
 * Compact on narrow phones (icon-first) for header thumb density.
 */
export function OfflineIndicator() {
  const { mode, networkOnline, setOnlineMode } = useOnlineMode();

  function handleClick() {
    const next = mode === "online" ? "offline" : "online";
    setOnlineMode(next);
    toast.message(next === "online" ? "Online mode" : "Offline mode", {
      description:
        next === "online"
          ? "Connected groups may refresh when you have network."
          : "Staying on this phone — no group sync until Online.",
      duration: 3000,
    });
  }

  const offlineLook = mode === "offline" || !networkOnline;
  const label = !networkOnline
    ? "No network"
    : mode === "offline"
      ? "Offline"
      : "Online";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={[
        "inline-flex items-center justify-center gap-1 text-xs font-medium rounded-full border touch-manipulation tap-target transition-colors",
        "min-h-11 min-w-11 px-2.5 sm:gap-1.5",
        offlineLook
          ? "text-amber-900 bg-amber-100 border-amber-200 dark:text-amber-50 dark:bg-amber-950/60 dark:border-amber-800"
          : "text-primary bg-primary/10 border-primary/25",
      ].join(" ")}
      title={
        offlineLook
          ? "Offline mode or no network — tap to set Online"
          : "Online — tap to work offline only"
      }
      aria-label={
        offlineLook
          ? "Offline. Tap to switch to Online mode"
          : "Online. Tap to switch to Offline mode"
      }
    >
      {offlineLook ? (
        <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <Wifi className="h-4 w-4 shrink-0" aria-hidden />
      )}
      <span className="hidden min-[380px]:inline">{label}</span>
    </button>
  );
}
