import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CircleHelp, MessageSquareWarning, Moon, UserPlus } from "lucide-react";
import { useAppStore } from "../stores/useAppStore";
import { LegalDisclaimerText } from "../components/LegalDisclaimer";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { JoinSpaceModal } from "../components/JoinSpaceModal";
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

export function Settings() {
  const offlineReady = useAppStore((s) => s.offlineReady);
  const spaces = useAppStore((s) => s.spaces);
  const templates = useAppStore((s) => s.templates);
  const initialize = useAppStore((s) => s.initialize);

  const [joinOpen, setJoinOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareMode, setShareMode] = useState<"export" | "import">("export");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSpaceId, setInviteSpaceId] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    void initialize();
  }, [initialize]);

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

      <Card className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Moon className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-primary">Appearance</h3>
            <p className="text-sm text-muted mt-0.5">
              Light, dark, or match your device. Saved on this device only.
            </p>
          </div>
        </div>
        <ThemePreferencePicker />
      </Card>

      <InstallAppCard />

      <TestingGuideCard
        variant="full"
        onBackup={() => openShare("export")}
      />

      <Card className="space-y-3 border-amber-300/50">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-950 dark:bg-amber-900 dark:text-amber-50">
            <MessageSquareWarning className="h-6 w-6" aria-hidden />
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
        <Button fullWidth onClick={() => setFeedbackOpen(true)}>
          Open report form
        </Button>
      </Card>

      <YourDataBundle
        spaceCount={spaces.length}
        onBackup={() => openShare("export")}
        onImport={() => openShare("import")}
      />

      <AccountKeyCard />

      <StorageUsageCard />

      <Card className="space-y-3">
        <h3 className="text-base font-semibold text-primary">
          Join & invite
        </h3>
        <p className="text-sm text-muted">
          Join with a code or QR. Hosts invite from a group. Back up and Connect
          live in{" "}
          <span className="font-medium text-primary">Your Spaces &amp; data</span>{" "}
          above.
        </p>
        <div className="flex flex-col gap-2">
          <Button variant="secondary" fullWidth onClick={() => setJoinOpen(true)}>
            <UserPlus className="h-5 w-5" aria-hidden />
            Join a group
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

      <Card className="space-y-2">
        <h3 className="text-base font-semibold text-primary">On this device</h3>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted">Spaces</dt>
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
        <h3 className="text-base font-semibold text-primary">Data boundaries</h3>
        <ul className="text-sm text-muted space-y-1.5 list-disc pl-5">
          <li>
            Private notes stay on this device by default. Optional personal
            backups (DSP1.) can include them encrypted with your Account Key.
          </li>
          <li>
            By default Spaces are local-only. Connect (when available) shares
            only group-facing data for easy join and sync — never private notes.
          </li>
          <li>
            File backups (DSX1. group / DSP1. personal) are always available.
            Account Key and Group Key are optional — never required to use the
            app.
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

      <JoinSpaceModal open={joinOpen} onClose={() => setJoinOpen(false)} />
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
