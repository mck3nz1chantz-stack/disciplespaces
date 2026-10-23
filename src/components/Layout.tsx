import { useEffect, useState } from "react";
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { BookOpen, Menu, NotebookPen, Users } from "lucide-react";
import { OfflineBanner } from "./OfflineBanner";
import { TestingPhaseRibbon } from "./TestingPhaseNotice";
import { LegalDisclaimerModal } from "./LegalDisclaimer";
import { Onboarding } from "./Onboarding";
import { useAppStore } from "../stores/useAppStore";
import { consumeInviteFromLocation } from "../lib/invite";
import {
  ONBOARDING_DONE_KEY,
  readFlag,
} from "../lib/onboarding";
import { useForegroundSpaceSync } from "../hooks/useForegroundSpaceSync";
import { normalizeHue, PERSONAL_HUE, studyColor } from "../lib/study";

const PENDING_ACTION_KEY = "ds-pending-home-action";
const PENDING_JOIN_RAW_KEY = "ds-pending-join-raw";

const tabs = [
  {
    to: "/bible",
    label: "Read",
    icon: BookOpen,
    isActivePath: (path: string) =>
      path === "/" || path.startsWith("/bible"),
  },
  {
    to: "/studies",
    label: "Studies",
    icon: Users,
    /** Group detail, join, and create stay on this tab. */
    isActivePath: (path: string) =>
      path.startsWith("/studies") ||
      path.startsWith("/space/") ||
      path === "/join" ||
      path === "/new",
  },
  {
    to: "/notes",
    label: "Notes",
    icon: NotebookPen,
    isActivePath: (path: string) => path.startsWith("/notes"),
  },
  {
    to: "/settings",
    label: "More",
    icon: Menu,
    isActivePath: (path: string) =>
      path.startsWith("/settings") || path.startsWith("/help"),
  },
] as const;

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const isBibleRoute = location.pathname.startsWith("/bible");
  const hasAcknowledgedLegal = useAppStore((s) => s.hasAcknowledgedLegal);
  const spaces = useAppStore((s) => s.spaces);
  const activeStudyId = useAppStore((s) => s.activeStudyId);
  const activeStudy = spaces.find((space) => space.id === activeStudyId);
  const headerColor = studyColor(
    normalizeHue(activeStudy?.colorHue) ?? PERSONAL_HUE,
  );
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
    // Full-page join restores place (not a modal flash on home only)
    navigate("/join");
    window.dispatchEvent(new Event("ds-pending-join"));
  }, [navigate]);

  function handleOnboardingFinished(action?: "create" | "join" | "skip") {
    setShowOnboarding(false);
    if (action === "create") {
      navigate("/new");
      return;
    }
    if (action === "join") {
      navigate("/join");
    }
  }

  return (
    <div className="relative z-[1] min-h-dvh flex flex-col bg-transparent text-text">
      <header className="safe-top sticky top-0 z-20 border-b border-border/80 bg-surface/75 backdrop-blur-xl supports-[backdrop-filter]:bg-surface/60">
        <div className="mx-auto max-w-lg safe-x py-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              DiscipleSpaces
            </p>
            <h1 className="flex items-center gap-2 text-lg leading-tight tracking-tight font-serif text-primary">
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10"
                style={{ background: headerColor.fill }}
                aria-hidden
              />
              <span className="truncate">
                {activeStudy?.name ?? "Read"}
              </span>
            </h1>
          </div>
        </div>
      </header>

      {/* Single always-on testing strip (badge removed from title row) */}
      <TestingPhaseRibbon />
      <OfflineBanner />

      <main
        className={[
          "relative z-[1] flex-1 mx-auto w-full safe-x py-4 pb-nav",
          /* Bible gets a slightly wider measure for immersive reading */
          isBibleRoute ? "max-w-xl" : "max-w-lg",
        ].join(" ")}
      >
        <Outlet />
      </main>

      <nav
        className="fixed bottom-0 inset-x-0 z-20 border-t border-border/80 bg-surface/80 backdrop-blur-xl supports-[backdrop-filter]:bg-surface/65 safe-bottom safe-x"
        aria-label="Main"
      >
        <ul className="mx-auto max-w-lg grid grid-cols-4">
          {tabs.map(({ to, label, icon: Icon, isActivePath }) => {
            const isActive = isActivePath(location.pathname);
            return (
              <li key={to}>
                <NavLink
                  to={to}
                  aria-current={isActive ? "page" : undefined}
                  className={() =>
                    [
                      "flex flex-col items-center justify-center gap-0.5 py-3 px-2 mx-1 my-1",
                      "text-xs font-medium touch-manipulation tap-target cursor-pointer",
                      "transition-colors duration-150 rounded-xl",
                      isActive
                        ? "text-primary bg-primary/10"
                        : "text-muted hover:text-primary hover:bg-surface-muted/80",
                    ].join(" ")
                  }
                >
                  <Icon className="h-6 w-6" aria-hidden />
                  <span>{label}</span>
                </NavLink>
              </li>
            );
          })}
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
