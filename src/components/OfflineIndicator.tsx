import { WifiOff, CloudOff } from "lucide-react";
import { useAppStore } from "../stores/useAppStore";
import { useEffect, useState } from "react";

export function OfflineIndicator() {
  const offlineReady = useAppStore((s) => s.offlineReady);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
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

  if (!isOnline) {
    return (
      <div
        className="flex items-center gap-1.5 text-xs font-medium text-amber-900 bg-amber-100 border border-amber-200 rounded-full px-2.5 py-1"
        title="You are offline. Local data still works."
      >
        <WifiOff className="h-3.5 w-3.5" aria-hidden />
        <span>Offline</span>
      </div>
    );
  }

  if (offlineReady) {
    return (
      <div
        className="flex items-center gap-1.5 text-xs font-medium text-success bg-success/10 border border-success/25 rounded-full px-2.5 py-1"
        title="App shell cached for offline use"
      >
        <CloudOff className="h-3.5 w-3.5" aria-hidden />
        <span>Offline ready</span>
      </div>
    );
  }

  return null;
}
