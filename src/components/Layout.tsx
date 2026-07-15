import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { BookOpen, CircleHelp, Home, Settings } from "lucide-react";
import { OfflineIndicator } from "./OfflineIndicator";
import { OfflineBanner } from "./OfflineBanner";
import { TestingPhaseRibbon } from "./TestingPhaseNotice";
import { FeedbackLauncher } from "./FeedbackLauncher";
import { LegalDisclaimerModal } from "./LegalDisclaimer";
import { Onboarding } from "./Onboarding";
import { ThemeCycleButton } from "./ThemeToggle";
import { useAppStore } from "../stores/useAppStore";
import { consumeInviteFromLocation } from "../lib/invite";
import {
  ONBOARDING_DONE_KEY,
  readFlag,
} from "../lib/onboarding";
import { useForegroundSpaceSync } from "../hooks/useForegroundSpaceSync";
import { TESTING_PHASE_BADGE } from "../lib/legal";

const PENDING_ACTION_KEY = "ds-pending-home-action";
const PENDING_JOIN_RAW_KEY = "ds-pending-join-raw";

const tabs = [
  { to: "/", label: "Groups", icon: Home, end: true },
  { to: "/bible", label: "Bible", icon: BookOpen, end: false },
  { to: "/settings", label: "Settings", icon: Settings, end: false },
] as const;

export function Layout() {
  const navigate = useNavigate();
  const hasAcknowledgedLegal = useAppStore((s) => s.hasAcknowledgedLegal);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Soft catch-up for connected Spaces only (no-op if relay URL unset)
  useForegroundSpaceSync();

  useEffect(() => {
    if (!hasAcknowledgedLegal) {
      setShowOnboarding(false);
      return;
    }
    setShowOnboarding(!readFlag(ONBOARDING_DONE_KEY));
  }, [hasAcknowledgedLegal]);

  // Deep links from text messages: #invite= / #joinconfirm= / #export=
  useEffect(() => {
    const fromLink = consumeInviteFromLocation();
    if (!fromLink) return;
    try {
      sessionStorage.setItem(PENDING_JOIN_RAW_KEY, fromLink.raw);
      sessionStorage.setItem(PENDING_ACTION_KEY, "join");
    } catch {
      // ignore
    }
    navigate("/");
    // Dashboard may already be mounted (same route) — notify it
    window.dispatchEvent(new Event("ds-pending-join"));
  }, [navigate]);

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
        <div className="mx-auto max-w-lg safe-x py-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted flex items-center gap-1.5 flex-wrap">
              ChantzMedia
              <span className="inline-flex items-center rounded-full bg-amber-200 text-amber-950 dark:bg-amber-800 dark:text-amber-50 px-1.5 py-0.5 text-[10px] font-bold tracking-wide normal-case">
                {TESTING_PHASE_BADGE}
              </span>
            </p>
            <h1 className="text-lg leading-tight">DiscipleSpaces</h1>
          </div>
          {/* Header is weak thumb zone — keep controls compact, ≥44px hits */}
          <div className="flex items-center gap-0.5 shrink-0 -mr-1">
            <OfflineIndicator />
            <FeedbackLauncher />
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

      <TestingPhaseRibbon />
      <OfflineBanner />

      <main className="flex-1 mx-auto w-full max-w-lg safe-x py-4 pb-nav">
        <Outlet />
      </main>

      <nav
        className="fixed bottom-0 inset-x-0 z-20 border-t border-border bg-surface/95 backdrop-blur-sm safe-bottom safe-x"
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
                    "flex flex-col items-center justify-center gap-0.5 py-3 px-2",
                    "text-xs font-medium touch-manipulation tap-target cursor-pointer",
                    "transition-colors duration-150 rounded-lg",
                    isActive
                      ? "text-primary"
                      : "text-muted hover:text-primary hover:bg-surface-muted/80",
                  ].join(" ")
                }
              >
                <Icon className="h-6 w-6" aria-hidden />
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

/** Prefill for Join modal (deep link or cross-route handoff). */
export function consumePendingJoinRaw(): string | null {
  try {
    const v = sessionStorage.getItem(PENDING_JOIN_RAW_KEY);
    sessionStorage.removeItem(PENDING_JOIN_RAW_KEY);
    return v?.trim() ? v : null;
  } catch {
    return null;
  }
}
