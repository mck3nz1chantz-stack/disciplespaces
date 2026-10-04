import { useState } from "react";
import { FileDown, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./Button";
import { friendlyError, notifyError, notifyMessage } from "../lib/notify";
import { formatRoomKeyShareText } from "../lib/invite";
import {
  downloadTextFile,
  exportFilename,
  formatExportShareText,
} from "../lib/share";
import { isSpaceRelayConfigured, normalizeSpaceSync } from "../lib/sync";
import { useAppStore } from "../stores/useAppStore";
import { useOnlineMode } from "../hooks/useOnlineMode";
import type { Space } from "../types";

/**
 * Two share actions on the group screen.
 * The file always works. The live link is copied only after meetings upload.
 */
export function GroupShareActions({
  space,
  isHost,
}: {
  space: Space;
  isHost: boolean;
}) {
  const connectSpaceToRelay = useAppStore((s) => s.connectSpaceToRelay);
  const syncSpaceNow = useAppStore((s) => s.syncSpaceNow);
  const buildSpaceExportPayload = useAppStore((s) => s.buildSpaceExportPayload);
  const { mode } = useOnlineMode();
  const [fileBusy, setFileBusy] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);

  async function sendGroupFile() {
    setFileBusy(true);
    try {
      const payload = await buildSpaceExportPayload(space.id);
      const text = formatExportShareText(payload);
      const filename = exportFilename(payload.space.name);
      const file = new File([text], filename, { type: "text/plain" });
      const canFileShare =
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });
      if (canFileShare) {
        try {
          await navigator.share({
            title: `${space.name} group file`,
            text: `Open this file in DiscipleSpaces to get ${space.name}. Notes stay on the sender's phone.`,
            files: [file],
          });
          return;
        } catch (err) {
          if (err instanceof Error && /abort|cancel/i.test(err.name + err.message)) {
            return;
          }
        }
      }
      downloadTextFile(filename, text);
      toast.success("Group file saved", {
        description: "Send that file. The other person opens it in the app. Notes stay here.",
      });
    } catch (err) {
      notifyError("Could not make the group file", friendlyError(err));
    } finally {
      setFileBusy(false);
    }
  }

  async function shareLiveLink() {
    if (mode === "offline") {
      notifyMessage(
        "Turn Online in the header to share a live link",
        "Or send the group file. That works either way.",
      );
      return;
    }
    if (!isSpaceRelayConfigured()) {
      notifyMessage(
        "Live links are not on this build",
        "Send the group file instead.",
      );
      return;
    }
    setLinkBusy(true);
    try {
      const opened = await connectSpaceToRelay(space.id);
      const sync = normalizeSpaceSync(opened.sync);
      if (sync.lastError || !sync.shortCode) {
        notifyError(
          "Meetings did not upload",
          "The live link was not copied. Send the group file, or try the link again.",
        );
        return;
      }
      // connect already syncs; one more push so a meeting saved mid-open is on the room.
      try {
        await syncSpaceNow(space.id);
      } catch (err) {
        notifyError(
          "Meetings did not upload",
          `${friendlyError(err)} The live link was not copied. Send the group file.`,
        );
        return;
      }
      const text = formatRoomKeyShareText(space.name, sync.shortCode);
      try {
        if (typeof navigator.share === "function") {
          await navigator.share({
            title: `${space.name} · DiscipleSpaces`,
            text,
          });
          toast.success("Live link ready", {
            description: "Meetings are on the link. The other person opens it and joins.",
          });
          return;
        }
      } catch (err) {
        if (err instanceof Error && /abort|cancel/i.test(err.name + err.message)) {
          return;
        }
      }
      await navigator.clipboard.writeText(text);
      toast.success("Live link copied", {
        description: "Paste it in a message. Meetings are already on that link.",
      });
    } catch (err) {
      notifyError(
        "Could not share a live link",
        `${friendlyError(err)} Send the group file instead.`,
      );
    } finally {
      setLinkBusy(false);
    }
  }

  if (!isHost) {
    return (
      <p className="text-sm text-primary">
        Ask the host to send the group file or a live link.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-primary">
        Send the group file any time. A live link works after the header says Online.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="secondary"
          onClick={() => void sendGroupFile()}
          disabled={fileBusy || linkBusy}
        >
          <FileDown className="h-5 w-5" aria-hidden />
          {fileBusy ? "Preparing file…" : "Send the group file"}
        </Button>
        <Button onClick={() => void shareLiveLink()} disabled={fileBusy || linkBusy}>
          <Link2 className="h-5 w-5" aria-hidden />
          {linkBusy ? "Putting meetings on the link…" : "Share a live link"}
        </Button>
      </div>
    </div>
  );
}
