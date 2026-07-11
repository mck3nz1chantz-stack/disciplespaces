import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CircleHelp, Download, Moon, Upload, UserPlus } from "lucide-react";
import { useAppStore } from "../stores/useAppStore";
import { LegalDisclaimerText } from "../components/LegalDisclaimer";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { JoinSpaceModal } from "../components/JoinSpaceModal";
import { InviteModal } from "../components/InviteModal";
import { ShareUpdateModal } from "../components/ShareUpdateModal";
import { InstallAppCard } from "../components/InstallAppCard";
import { StorageUsageCard } from "../components/StorageUsageCard";
import { DataBackupCard } from "../components/DataBackupCard";
import { ThemePreferencePicker } from "../components/ThemeToggle";
import { INVITE_PRIVACY_NOTE, PRIVACY_SUMMARY } from "../lib/legal";

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
              Modes, prayer board, private notes, Bible, backup — full walkthrough
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

      <DataBackupCard
        spaceCount={spaces.length}
        onBackup={() => openShare("export")}
        onImport={() => openShare("import")}
      />

      <StorageUsageCard />

      <Card className="space-y-3">
        <h3 className="text-base font-semibold text-primary">
          Sharing & invites
        </h3>
        <p className="text-sm text-muted">
          Fully local. Invite packages join a space without past sessions.
          Space Updates transfer session history manually — also your backup
          format.
        </p>
        <div className="flex flex-col gap-2">
          <Button variant="secondary" fullWidth onClick={() => setJoinOpen(true)}>
            <UserPlus className="h-5 w-5" aria-hidden />
            Join a Space
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => openShare("export")}
              disabled={spaces.length === 0}
            >
              <Download className="h-4 w-4" aria-hidden />
              Export
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => openShare("import")}
            >
              <Upload className="h-4 w-4" aria-hidden />
              Import
            </Button>
          </div>
          <p className="text-xs text-muted text-center">
            Import restores a DSX1. backup file from another device or earlier
            export.
          </p>
        </div>
        {spaces.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-border">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Invite to a space
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
          <dd className="text-right font-medium">KJV (offline)</dd>
          <dt className="text-muted">Offline shell</dt>
          <dd className="text-right font-medium">
            {offlineReady ? "Ready" : "Pending install"}
          </dd>
          <dt className="text-muted">Storage</dt>
          <dd className="text-right font-medium">IndexedDB (local)</dd>
        </dl>
      </Card>

      <Card className="space-y-2">
        <h3 className="text-base font-semibold text-primary">Data boundaries</h3>
        <ul className="text-sm text-muted space-y-1.5 list-disc pl-5">
          <li>Personal notes never leave this device.</li>
          <li>No server accounts or cloud sync — Cloudflare only hosts the app files.</li>
          <li>Invites share space metadata only — not past sessions.</li>
          <li>
            Space Updates (DSX1. files) are your backup and how you move data
            between devices or recover after a wipe.
          </li>
          <li>
            Prefer one stable URL (production). Random preview links are separate
            storage buckets.
          </li>
          <li>Bible text is public domain KJV.</li>
        </ul>
      </Card>

      <LegalDisclaimerText />

      <p className="text-xs text-muted text-center pb-2">
        DiscipleSpaces · v0.9.2 · ChantzMedia
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
    </div>
  );
}
