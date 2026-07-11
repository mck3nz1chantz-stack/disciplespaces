import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { WifiOff } from "lucide-react";

/**
 * Calm persistent banner when the network is offline.
 * Complements the header OfflineIndicator pill.
 */
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      className="border-b border-amber-200 bg-amber-50 text-amber-950"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto max-w-lg px-4 py-2 flex items-start gap-2 text-sm">
        <WifiOff className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
        <p className="min-w-0 flex-1">
          <span className="font-medium">You’re offline. </span>
          Spaces, sessions, and the cached KJV Bible still work on this device.{" "}
          <Link
            to="/help"
            className="font-medium underline underline-offset-2"
          >
            Help
          </Link>
          {" · "}
          <Link
            to="/offline"
            className="font-medium underline underline-offset-2"
          >
            Offline tips
          </Link>
        </p>
      </div>
    </div>
  );
}
