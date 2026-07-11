import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { BookOpen, CircleHelp, Home, Settings } from "lucide-react";
import { OfflineIndicator } from "./OfflineIndicator";
import { OfflineBanner } from "./OfflineBanner";
import { LegalDisclaimerModal } from "./LegalDisclaimer";
import { Onboarding } from "./Onboarding";
import { ThemeCycleButton } from "./ThemeToggle";
import { useAppStore } from "../stores/useAppStore";
import {
  ONBOARDING_DONE_KEY,
  readFlag,
} from "../lib/onboarding";

const PENDING_ACTION_KEY = "ds-pending-home-action";

const tabs = [
  { to: "/", label: "Spaces", icon: Home, end: true },
  { to: "/bible", label: "Bible", icon: BookOpen, end: false },
  { to: "/settings", label: "Settings", icon: Settings, end: false },
] as const;

export function Layout() {
  const navigate = useNavigate();
  const hasAcknowledgedLegal = useAppStore((s) => s.hasAcknowledgedLegal);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!hasAcknowledgedLegal) {
      setShowOnboarding(false);
      return;
    }
    setShowOnboarding(!readFlag(ONBOARDING_DONE_KEY));
  }, [hasAcknowledgedLegal]);

  function handleOnboardingFinished(action?: "create" | "join" | "skip") {
    setShowOnboarding(false);
    if (action === "create" || action === "join") {
      try {
        sessionStorage.setItem(PENDING_ACTION_KEY, action);
      } catch {
        // ignore
      }
      navigate("/");
    }
  }

  return (
    <div className="min-h-dvh flex flex-col bg-bg text-text">
      <header className="safe-top sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur-sm">
        <div className="mx-auto max-w-lg px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              ChantzMedia
            </p>
            <h1 className="text-lg leading-tight">DiscipleSpaces</h1>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <OfflineIndicator />
            <ThemeCycleButton />
            <Link
              to="/help"
              className="inline-flex items-center justify-center rounded-xl p-2.5 text-primary touch-manipulation tap-target hover:bg-surface-muted transition-colors"
              aria-label="Help and tutorial"
              title="Help"
            >
              <CircleHelp className="h-5 w-5" aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <OfflineBanner />

      <main className="flex-1 mx-auto w-full max-w-lg px-4 py-4 pb-28">
        <Outlet />
      </main>

      <nav
        className="fixed bottom-0 inset-x-0 z-20 border-t border-border bg-surface/95 backdrop-blur-sm safe-bottom"
        aria-label="Main"
      >
        <ul className="mx-auto max-w-lg grid grid-cols-3">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  [
                    "flex flex-col items-center justify-center gap-0.5 py-2.5 px-2",
                    "text-xs font-medium touch-manipulation tap-target",
                    isActive ? "text-primary" : "text-muted",
                  ].join(" ")
                }
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <LegalDisclaimerModal />
      <Onboarding open={showOnboarding} onFinished={handleOnboardingFinished} />
    </div>
  );
}

/** Used by Dashboard to consume onboarding CTA. */
export function consumePendingHomeAction(): "create" | "join" | null {
  try {
    const v = sessionStorage.getItem(PENDING_ACTION_KEY);
    sessionStorage.removeItem(PENDING_ACTION_KEY);
    if (v === "create" || v === "join") return v;
  } catch {
    // ignore
  }
  return null;
}
