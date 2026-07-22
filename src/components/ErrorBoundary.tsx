import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./Button";
import { CANONICAL_APP_ORIGIN } from "../lib/sync/config";
import { PRODUCTION_URL } from "../lib/legal";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  clearing: boolean;
}

/**
 * Last-resort UI when React throws. Prevents a full white-screen “brick.”
 * Recovery: soft reload, hard PWA shell refresh (SW + caches).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, clearing: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[DiscipleSpaces] render crash", error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  private hardRefresh = async () => {
    this.setState({ clearing: true });
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // still reload
    }
    window.location.reload();
  };

  render() {
    const { error, clearing } = this.state;
    if (!error) return this.props.children;

    const bookmark = CANONICAL_APP_ORIGIN || PRODUCTION_URL;

    return (
      <div className="min-h-dvh flex flex-col items-center justify-center safe-x safe-top safe-bottom px-4 py-10 bg-bg text-text">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
            Something broke
          </p>
          <h1 className="text-xl font-serif text-primary leading-tight">
            DiscipleSpaces hit an error
          </h1>
          <p className="text-sm text-muted leading-relaxed">
            Your Spaces are usually still on this phone (browser storage). A
            bad update, offline shell, or a single screen crash can look
            “bricked.” Try reload first — then a full refresh of the app shell.
          </p>
          <p className="text-xs font-mono text-danger/90 break-words rounded-lg bg-danger/10 border border-danger/20 px-2.5 py-2">
            {error.message || "Unknown error"}
          </p>
          <div className="flex flex-col gap-2 pt-1">
            <Button fullWidth onClick={this.reload} disabled={clearing}>
              Reload
            </Button>
            <Button
              fullWidth
              variant="secondary"
              onClick={() => void this.hardRefresh()}
              disabled={clearing}
            >
              {clearing ? "Clearing shell…" : "Full refresh (clear cache)"}
            </Button>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            Bookmark{" "}
            <span className="font-medium text-text break-all">{bookmark}</span>
            . If the list is empty after an update, restore a DSX1./DSP1. file
            from Settings → Restore (Zip OK). Do not clear browser site data
            unless you have a backup.
          </p>
        </div>
      </div>
    );
  }
}
