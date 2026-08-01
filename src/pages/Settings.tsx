import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CircleHelp, MessageSquareWarning, Moon, UserPlus } from "lucide-react";
import { useAppStore } from "../stores/useAppStore";
import { LegalDisclaimerText } from "../components/LegalDisclaimer";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { InviteModal } from "../components/InviteModal";
import { ShareUpdateModal } from "../components/ShareUpdateModal";
import { InstallAppCard } from "../components/InstallAppCard";
import { StorageUsageCard } from "../components/StorageUsageCard";
import { YourDataBundle } from "../components/YourDataBundle";
import { AccountKeyCard } from "../components/AccountKeyCard";
import { TestingGuideCard } from "../components/TestingPhaseNotice";
import { FeedbackModal } from "../components/FeedbackModal";
import { ThemePreferencePicker } from "../components/ThemeToggle";
import {
  APP_MISSION,
  BIBLE_EDITIONS_NOTICE,
  BIBLE_OFFLINE_TIP,
  INVITE_PRIVACY_NOTE,
  PRIVACY_SUMMARY,
} from "../lib/legal";
import { isSpaceRelayConfigured } from "../lib/sync";

const SETTINGS_TOC = [
  { id: "settings-appearance", label: "Appearance" },
  { id: "settings-groups", label: "Groups" },
  { id: "settings-backup", label: "Backup" },
  { id: "settings-account", label: "Account Key" },
  { id: "settings-install", label: "Install" },
  { id: "settings-about", label: "About" },
] as const;

function scrollToSettingsSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  // Keep hash for shareable deep links without fighting React Router
  try {
    window.history.replaceState(null, "", `#${id}`);
  } catch {
    // ignore
  }
}

export function Settings() {
  const navigate = useNavigate();
  const location = useLocation();
  const offlineReady = useAppStore((s) => s.offlineReady);
  const spaces = useAppStore((s) => s.spaces);
  const templates = useAppStore((s) => s.templates);
  const initialize = useAppStore((s) => s.initialize);

  const [shareOpen, setShareOpen] = useState(false);
  const [shareMode, setShareMode] = useState<"export" | "import">("export");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSpaceId, setInviteSpaceId] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  // Honor /settings#settings-backup style deep links
  useEffect(() => {
    const hash = (location.hash || window.location.hash || "").replace(
      /^#/,
      "",
    );
    if (!hash || !SETTINGS_TOC.some((t) => t.id === hash)) return;
    const t = window.setTimeout(() => scrollToSettingsSection(hash), 80);
    return () => window.clearTimeout(t);
  }, [location.hash, location.pathname]);

  function openInviteFor(spaceId: string) {
    setInviteSpaceId(spaceId);
    setInviteOpen(true);
  }

  function openShare(mode: "export" | "import") {
    setShareMode(mode);
    setShareOpen(true);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl">Settings</h2>
        <p className="text-sm text-muted mt-1">{PRIVACY_SUMMARY}</p>
      </div>

      <nav
        className="-mx-0.5 overflow-x-auto pb-0.5"
        aria-label="Settings sections"
      >
        <ul className="flex gap-1.5 min-w-min px-0.5">
          {SETTINGS_TOC.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => scrollToSettingsSection(item.id)}
                className={[
                  "inline-flex items-center rounded-full border border-border/90",
                  "bg-surface/95 px-3 py-2 text-xs font-semibold text-primary",
                  "touch-manipulation tap-target whitespace-nowrap",
                  "hover:border-primary/35 hover:bg-primary/8 active:scale-[0.98]",
                  "transition-colors",
                ].join(" ")}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <Link to="/help" className="block touch-manipulation">
        <Card className="hover:border-primary/30 transition-colors flex items-center gap-3 active:scale-[0.99]">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CircleHelp className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-primary">Help & tutorial</p>
            <p className="text-sm text-muted mt-0.5">
              Modes, prayer, private notes, Bible, your data — full walkthrough
            </p>
          </div>
        </Card>
      </Link>

      <section
        id="settings-appearance"
        className="scroll-mt-24 space-y-3"
        aria-labelledby="settings-appearance-title"
      >
        <Card className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Moon className="h-6 w-6" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h3
                id="settings-appearance-title"
                className="text-base font-semibold text-primary"
              >
                Appearance
              </h3>
              <p className="text-sm text-muted mt-0.5">
                Light, dark, or match your device. Saved on this device only.
              </p>
            </div>
          </div>
          <ThemePreferencePicker />
        </Card>
      </section>

      <section
        id="settings-install"
        className="scroll-mt-24 space-y-3"
        aria-labelledby="settings-install-title"
      >
        <h3 id="settings-install-title" className="sr-only">
          Install
        </h3>
        <InstallAppCard />
      </section>

      <TestingGuideCard
        variant="full"
        onBackup={() => openShare("export")}
      />

      <Card className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-primary">
            <MessageSquareWarning className="h-6 w-6" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-primary">
              Report a problem
            </h3>
            <p className="text-sm text-muted mt-0.5">
              Send a bug or “this confuses me” note to the builders. Optional
              device info helps us fix faster — private notes are never included.
            </p>
          </div>
        </div>
        <Button fullWidth variant="secondary" onClick={() => setFeedbackOpen(true)}>
          Open report form
        </Button>
      </Card>

      <section
        id="settings-backup"
        className="scroll-mt-24 space-y-3"
        aria-labelledby="settings-backup-title"
      >
        <h3 id="settings-backup-title" className="sr-only">
          Backup
        </h3>
        <YourDataBundle
          spaceCount={spaces.length}
          onBackup={() => openShare("export")}
          onImport={() => openShare("import")}
        />
      </section>

      <section
        id="settings-account"
        className="scroll-mt-24 space-y-3"
        aria-labelledby="settings-account-title"
      >
        <h3 id="settings-account-title" className="sr-only">
          Account Key
        </h3>
        <AccountKeyCard />
      </section>

      <StorageUsageCard />

      <section
        id="settings-groups"
        className="scroll-mt-24 space-y-3"
        aria-labelledby="settings-groups-title"
      >
        <Card className="space-y-3">
          <h3
            id="settings-groups-title"
            className="text-base font-semibold text-primary"
          >
            Groups
          </h3>
          <p className="text-sm text-muted">
            Join with a code or QR. Hosts invite from a group. Back up and Connect
            live in{" "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-2 hover:underline"
              onClick={() => scrollToSettingsSection("settings-backup")}
            >
              Backup
            </button>{" "}
            above.
          </p>
          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => navigate("/join")}
            >
              <UserPlus className="h-5 w-5" aria-hidden />
              Join a group
            </Button>
            <Button
              variant="ghost"
              fullWidth
              onClick={() => navigate("/new")}
            >
              New group
            </Button>
          </div>
          {spaces.length > 0 && (
            <div className="space-y-2 pt-1 border-t border-border">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Invite someone (opens group invite)
              </p>
              <ul className="space-y-1.5">
                {spaces.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => openInviteFor(s.id)}
                      className="w-full text-left rounded-xl border border-border bg-bg px-3 py-3 text-sm font-medium text-primary touch-manipulation tap-target hover:border-primary/30"
                    >
                      {s.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-muted">{INVITE_PRIVACY_NOTE}</p>
        </Card>
      </section>

      <section
        id="settings-about"
        className="scroll-mt-24 space-y-4"
        aria-labelledby="settings-about-title"
      >
        <Card className="space-y-2">
          <h3
            id="settings-about-title"
            className="text-base font-semibold text-primary"
          >
            About · on this device
          </h3>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted">Groups</dt>
            <dd className="text-right font-medium">{spaces.length}</dd>
            <dt className="text-muted">Templates</dt>
            <dd className="text-right font-medium">{templates.length}</dd>
            <dt className="text-muted">Bible text</dt>
            <dd className="text-right font-medium">KJV + WEB (free)</dd>
            <dt className="text-muted">Offline shell</dt>
            <dd className="text-right font-medium">
              {offlineReady ? "Ready" : "Pending install"}
            </dd>
            <dt className="text-muted">Storage</dt>
            <dd className="text-right font-medium">IndexedDB (local)</dd>
            <dt className="text-muted">Easy join service</dt>
            <dd className="text-right font-medium">
              {isSpaceRelayConfigured() ? "Configured" : "Not on this build"}
            </dd>
          </dl>
        </Card>

        <Card className="space-y-2">
          <h3 className="text-base font-semibold text-primary">
            Data boundaries
          </h3>
          <ul className="text-sm text-muted space-y-1.5 list-disc pl-5">
            <li>
              <strong className="text-primary font-medium">Account Key</strong> is
              the home for <em>your</em> groups (encrypted vault when Online).
              Private notes stay on this device unless you opt into encrypted
              personal backup under that key.
            </li>
            <li>
              A <strong className="text-primary font-medium">room key</strong>{" "}
              only shares group-facing meetings, people, and prayer with invitees —
              never private notes. It is not your personal backup.
            </li>
            <li>
              File backups (DSX1. group / DSP1. personal) remain the hard safety
              net. Account Key and Group Key are optional — never required to use
              the app offline.
            </li>
            <li>
              Prefer one stable URL. Preview links are separate storage buckets —
              fine until full product domain.
            </li>
            <li>{BIBLE_EDITIONS_NOTICE}</li>
            <li>{BIBLE_OFFLINE_TIP}</li>
            <li>{APP_MISSION}</li>
          </ul>
        </Card>

        <LegalDisclaimerText />

        <p className="text-xs text-muted text-center pb-2">
          DiscipleSpaces · v0.10.0 · ChantzMedia
        </p>
      </section>

      <ShareUpdateModal
        open={shareOpen}
        defaultMode={shareMode}
        onClose={() => setShareOpen(false)}
      />
      <InviteModal
        open={inviteOpen}
        spaceId={inviteSpaceId}
        onClose={() => {
          setInviteOpen(false);
          setInviteSpaceId(null);
        }}
      />
      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
    </div>
  );
}
