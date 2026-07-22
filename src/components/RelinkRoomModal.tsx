/**
 * Guided repair: re-link this Space to the host’s current room key.
 * Preserves all local meetings, people, prayer, and private notes.
 */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { useAppStore } from "../stores/useAppStore";
import { useOnlineMode } from "../hooks/useOnlineMode";
import {
  downloadTextFile,
  exportFilename,
  formatExportShareText,
} from "../lib/share";
import { scheduleAccountVaultUpload } from "../lib/keys/vaultAuto";
import { hasAccountKey } from "../lib/keys";
import {
  normalizeSpaceSync,
  previewRoom,
  resolveJoinCredentials,
} from "../lib/sync";
import type { Space } from "../types";

interface RelinkRoomModalProps {
  open: boolean;
  space: Space;
  onClose: () => void;
}

export function RelinkRoomModal({ open, space, onClose }: RelinkRoomModalProps) {
  const relinkSpaceWithRoomKey = useAppStore((s) => s.relinkSpaceWithRoomKey);
  const buildSpaceExportPayload = useAppStore((s) => s.buildSpaceExportPayload);
  const { mode, setOnlineMode } = useOnlineMode();

  const members = space.members ?? [];
  const defaultName = members[0]?.name ?? "";

  const [shortCode, setShortCode] = useState("");
  const [displayName, setDisplayName] = useState(defaultName);
  const [pickId, setPickId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [backedUp, setBackedUp] = useState(false);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [previewSessions, setPreviewSessions] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setShortCode("");
    setDisplayName(defaultName);
    setPickId(members[0]?.id ?? "");
    setBackedUp(false);
    setPreviewName(null);
    setPreviewSessions(null);
    setPreviewError(null);
  }, [open, space.id, defaultName, members]);

  const resolvedName = useMemo(() => {
    if (pickId) {
      const m = members.find((x) => x.id === pickId);
      if (m?.name) return m.name;
    }
    return displayName.trim();
  }, [pickId, members, displayName]);

  async function handleBackup() {
    setBusy(true);
    try {
      const payload = await buildSpaceExportPayload(space.id);
      downloadTextFile(
        exportFilename(payload.space.name),
        formatExportShareText(payload),
      );
      if (hasAccountKey()) {
        scheduleAccountVaultUpload();
      }
      setBackedUp(true);
      toast.success("Backup saved on this phone", {
        description:
          "Group file (DSX1.) has your shared meetings and people. Private notes stay in the app" +
          (hasAccountKey() ? " and under your Account Key when Online." : "."),
        duration: 6000,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save backup");
    } finally {
      setBusy(false);
    }
  }

  async function peekCode() {
    const code = shortCode.trim();
    if (code.length < 4) {
      setPreviewName(null);
      setPreviewSessions(null);
      setPreviewError(null);
      return;
    }
    setPreviewError(null);
    try {
      const creds = await resolveJoinCredentials(code);
      const p = await previewRoom(creds);
      if (p.spaceId && p.spaceId !== space.id) {
        setPreviewName(p.name);
        setPreviewSessions(
          typeof p.sessionCount === "number" ? p.sessionCount : null,
        );
        setPreviewError(
          `This key is for “${p.name}”, not this Space. Your data here is safe — use Home → Join a group for that other group.`,
        );
        return;
      }
      setPreviewName(p.name);
      setPreviewSessions(
        typeof p.sessionCount === "number" ? p.sessionCount : null,
      );
      setPreviewError(null);
      if (p.members?.length) {
        const match = p.members.find((m) =>
          members.some(
            (local) => local.name.toLowerCase() === m.name.toLowerCase(),
          ),
        );
        if (match) {
          const local = members.find(
            (m) => m.name.toLowerCase() === match.name.toLowerCase(),
          );
          if (local) {
            setPickId(local.id);
            setDisplayName(local.name);
          }
        }
      }
    } catch (err) {
      setPreviewName(null);
      setPreviewSessions(null);
      setPreviewError(
        err instanceof Error
          ? err.message
          : "Could not check that code yet — you can still try Re-link.",
      );
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!resolvedName) {
      toast.error("Choose or enter your name");
      return;
    }
    if (shortCode.trim().length < 4) {
      toast.error("Paste the host’s current room key");
      return;
    }
    if (previewError && /not this Space/i.test(previewError)) {
      toast.error(previewError);
      return;
    }
    if (mode === "offline") {
      setOnlineMode("online");
    }

    setBusy(true);
    try {
      // Always soft-backup first when possible (non-blocking if user skipped UI button)
      if (!backedUp) {
        try {
          const payload = await buildSpaceExportPayload(space.id);
          downloadTextFile(
            exportFilename(payload.space.name),
            formatExportShareText(payload),
          );
          if (hasAccountKey()) scheduleAccountVaultUpload();
          setBackedUp(true);
        } catch {
          // Proceed — data stays on device regardless
        }
      }

      const result = await relinkSpaceWithRoomKey({
        spaceId: space.id,
        shortCode: shortCode.trim(),
        displayName: resolvedName,
      });

      toast.success("Linked again — your data stayed put", {
        description:
          result.sessionCount > 0
            ? `Shared room “${result.roomName}” · ${result.sessionCount} meeting${result.sessionCount === 1 ? "" : "s"} in room` +
              (result.addedSessions > 0
                ? ` (${result.addedSessions} new on this phone)`
                : "") +
              ". People and private notes on this phone were kept."
            : `Linked to “${result.roomName}”. Ask the host to Sync if the room is still empty. Your people and meetings stayed on this phone.`,
        duration: 9000,
      });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not re-link", {
        duration: 10000,
      });
    } finally {
      setBusy(false);
    }
  }

  const sync = normalizeSpaceSync(space.sync);

  return (
    <Modal open={open} onClose={onClose} title="Fix group link">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-4 pb-1"
      >
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 space-y-1.5">
          <p className="text-sm font-medium text-primary flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
            Safe repair — nothing is deleted
          </p>
          <p className="text-xs text-muted leading-relaxed">
            Re-links <strong className="text-text">{space.name}</strong> to the
            host’s <em>current</em> room key. Meetings, people, prayer board,
            and private notes on this phone stay. Only the broken cloud link is
            refreshed.
          </p>
          {sync.lastError && (
            <p className="text-xs text-danger leading-snug">{sync.lastError}</p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            1 · Backup (recommended)
          </p>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            disabled={busy}
            onClick={() => void handleBackup()}
          >
            {backedUp ? "Backup saved ✓" : "Save group file now"}
          </Button>
          <p className="text-[11px] text-muted leading-relaxed">
            If you skip this, we still try a quick file save when you re-link.
            Account Key auto-save runs when Online.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted block">
            2 · Host’s current room key
          </label>
          <p className="text-[11px] text-muted leading-relaxed">
            Short code on their group card (like{" "}
            <span className="font-mono text-primary">ABCD-EF</span>). Not your
            Account Key. Group Key (DS-GRP-…) only if the host registered one.
          </p>
          <input
            className="w-full rounded-xl border border-border bg-bg px-3 py-3 font-mono text-sm tracking-wide text-primary text-center"
            value={shortCode}
            onChange={(e) => setShortCode(e.target.value)}
            onBlur={() => void peekCode()}
            placeholder="ABCD-EF"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            disabled={busy}
            aria-label="Room key from host"
          />
          {previewName && !previewError && (
            <p className="text-xs text-success text-center">
              Found “{previewName}”
              {previewSessions != null
                ? ` · ${previewSessions} shared meeting${previewSessions === 1 ? "" : "s"}`
                : ""}
            </p>
          )}
          {previewError && (
            <p className="text-xs text-danger leading-snug" role="alert">
              {previewError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            3 · Who are you on this group?
          </p>
          {members.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {members.map((m) => (
                <label
                  key={m.id}
                  className={[
                    "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm cursor-pointer touch-manipulation",
                    pickId === m.id
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border bg-bg text-text",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="relink-member"
                    className="sr-only"
                    checked={pickId === m.id}
                    onChange={() => {
                      setPickId(m.id);
                      setDisplayName(m.name);
                    }}
                  />
                  {m.name}
                </label>
              ))}
              <label
                className={[
                  "flex flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-sm cursor-pointer",
                  !pickId
                    ? "border-primary bg-primary/10"
                    : "border-border bg-bg",
                ].join(" ")}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="relink-member"
                    className="sr-only"
                    checked={!pickId}
                    onChange={() => setPickId("")}
                  />
                  <span className="font-medium">Different name</span>
                </span>
                {!pickId && (
                  <input
                    className="w-full rounded-lg border border-border bg-bg px-2.5 py-2 text-sm"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    disabled={busy}
                  />
                )}
              </label>
            </div>
          ) : (
            <input
              className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-sm"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              disabled={busy}
            />
          )}
        </div>

        <Button
          type="submit"
          fullWidth
          disabled={
            busy ||
            shortCode.trim().length < 4 ||
            !resolvedName ||
            Boolean(previewError && /not this Space/i.test(previewError))
          }
          className="!py-3.5"
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : (
            <Link2 className="h-5 w-5" aria-hidden />
          )}
          {busy ? "Re-linking…" : "Re-link — keep my data"}
        </Button>

        <Button
          type="button"
          variant="ghost"
          fullWidth
          className="!py-2"
          disabled={busy}
          onClick={onClose}
        >
          Cancel
        </Button>
      </form>
    </Modal>
  );
}
