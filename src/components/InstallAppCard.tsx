import { useState } from "react";
import { Check, Download, Share } from "lucide-react";
import { toast } from "sonner";
import { Card } from "./Card";
import { Button } from "./Button";
import { usePwaInstall } from "../hooks/usePwaInstall";

/**
 * Settings (or elsewhere): install guidance that stays calm and non-intrusive.
 */
export function InstallAppCard() {
  const { capability, standalone, canPrompt, install } = usePwaInstall();
  const [busy, setBusy] = useState(false);

  async function handleInstall() {
    setBusy(true);
    try {
      const result = await install();
      if (result === "accepted") {
        toast.success("App installed", {
          description: "You can open DiscipleSpaces from your home screen.",
        });
      } else if (result === "dismissed") {
        toast.message("Install cancelled", {
          description: "You can install anytime from Settings.",
        });
      } else {
        toast.message("Install not available right now", {
          description:
            "Use your browser’s menu: Install app / Add to Home Screen. See INSTALL.md tips below.",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  if (standalone || capability === "installed") {
    return (
      <Card className="space-y-2">
        <div className="flex items-center gap-2">
          <Check className="h-5 w-5 text-success shrink-0" aria-hidden />
          <h3 className="text-base font-semibold text-primary">App installed</h3>
        </div>
        <p className="text-sm text-muted">
          You’re using DiscipleSpaces as an installed app. Offline reading and
          local data work on this device.
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Download className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-primary">Install app</h3>
          <p className="text-sm text-muted mt-0.5">
            Add DiscipleSpaces to your home screen for full-screen use and a
            smoother offline experience.
          </p>
        </div>
      </div>

      {canPrompt && (
        <Button fullWidth disabled={busy} onClick={() => void handleInstall()}>
          <Download className="h-5 w-5" aria-hidden />
          {busy ? "Opening install…" : "Install DiscipleSpaces"}
        </Button>
      )}

      {capability === "ios-manual" && (
        <div className="rounded-xl bg-surface-muted/60 border border-border px-3 py-3 text-sm text-muted space-y-2">
          <p className="font-medium text-primary text-sm inline-flex items-center gap-1.5">
            <Share className="h-4 w-4" aria-hidden />
            Install on iPhone / iPad
          </p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Tap the Share button in Safari.</li>
            <li>Choose <strong className="text-text">Add to Home Screen</strong>.</li>
            <li>Confirm the name, then Add.</li>
          </ol>
        </div>
      )}

      {capability === "unsupported" && !canPrompt && (
        <div className="rounded-xl bg-surface-muted/60 border border-border px-3 py-3 text-sm text-muted space-y-2">
          <p>
            Your browser may support install from the address bar or menu
            (look for <strong className="text-text">Install app</strong> or{" "}
            <strong className="text-text">Add to Home Screen</strong>).
          </p>
          <p className="text-xs">
            Use a production build or HTTPS host for the full install prompt.
            See INSTALL.md in the project for device-specific steps.
          </p>
        </div>
      )}
    </Card>
  );
}
