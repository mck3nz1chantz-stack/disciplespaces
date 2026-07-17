import { Link } from "react-router-dom";
import { WifiOff } from "lucide-react";
import { OFFLINE_BANNER_HINT } from "../lib/legal";
import { useOnlineMode } from "../hooks/useOnlineMode";

/**
 * Banner when user chose Offline mode (intentional).
 * Browser navigator.onLine is too unreliable to banner on — it blocked Sync.
 */
export function OfflineBanner() {
  const { mode, setOnlineMode } = useOnlineMode();

  const preferOffline = mode === "offline";
  if (!preferOffline) return null;

  return (
    <div
      className="border-b border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-50"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto max-w-lg safe-x py-2 flex items-start gap-2 text-sm">
        <WifiOff className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
        <p className="min-w-0 flex-1">
          <span className="font-medium">Offline mode. </span>
          Groups stay on this phone — no sync until you turn Online on.{" "}
          <button
            type="button"
            className="font-medium underline underline-offset-2 touch-manipulation"
            onClick={() => setOnlineMode("online")}
          >
            Go Online
          </button>
          {" · "}
          <Link
            to="/bible"
            className="font-medium underline underline-offset-2"
          >
            Bible
          </Link>
          <span className="text-xs opacity-80"> · {OFFLINE_BANNER_HINT}</span>
        </p>
      </div>
    </div>
  );
}
