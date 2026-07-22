import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Copy,
  Download,
  FileUp,
  Share2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { useAppStore } from "../stores/useAppStore";
import {
  downloadTextFile,
  exportFilename,
  formatExportShareText,
  parseExportInput,
  type SpaceExportPayload,
} from "../lib/share";
import {
  decryptPersonalNotes,
  parsePersonalBackupInput,
} from "../lib/keys/personalBackup";
import { getStoredAccountKey } from "../lib/keys/accountKey";
import { db } from "../lib/db";
import {
  IMPORT_FILE_ACCEPT,
  readBackupImportFile,
} from "../lib/importFile";

interface ShareUpdateModalProps {
  open: boolean;
  /** When set, open in export mode for this space. */
  spaceId?: string | null;
  /** Prefer import tab when true (Settings). */
  defaultMode?: "export" | "import";
  onClose: () => void;
}

export function ShareUpdateModal({
  open,
  spaceId = null,
  defaultMode = "export",
  onClose,
}: ShareUpdateModalProps) {
  const navigate = useNavigate();
  const spaces = useAppStore((s) => s.spaces);
  const buildSpaceExportPayload = useAppStore((s) => s.buildSpaceExportPayload);
  const importSpaceExport = useAppStore((s) => s.importSpaceExport);

  const [mode, setMode] = useState<"export" | "import">(defaultMode);
  const [selectedSpaceId, setSelectedSpaceId] = useState(spaceId ?? "");
  const [payload, setPayload] = useState<SpaceExportPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [importText, setImportText] = useState("");
  const [importSourceLabel, setImportSourceLabel] = useState<string | null>(
    null,
  );
  const [importing, setImporting] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setPayload(null);
      setImportText("");
      setImportSourceLabel(null);
      setDragOver(false);
      setLoadingFile(false);
      setMode(defaultMode);
      return;
    }
    setMode(spaceId ? "export" : defaultMode);
    setSelectedSpaceId(spaceId ?? spaces[0]?.id ?? "");
  }, [open, spaceId, defaultMode, spaces]);

  useEffect(() => {
    if (!open || mode !== "export" || !selectedSpaceId) {
      setPayload(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const p = await buildSpaceExportPayload(selectedSpaceId);
        if (!cancelled) setPayload(p);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not prepare export",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, mode, selectedSpaceId, buildSpaceExportPayload]);

  async function copyExport() {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(formatExportShareText(payload));
      toast.success("Update package copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  function downloadExport() {
    if (!payload) return;
    downloadTextFile(
      exportFilename(payload.space.name),
      formatExportShareText(payload),
    );
    toast.success("Download started");
  }

  async function shareExport() {
    if (!payload) return;
    const text = formatExportShareText(payload);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `DiscipleSpaces update · ${payload.space.name}`,
          text,
        });
        return;
      } catch {
        // cancelled
      }
    }
    await copyExport();
  }

  async function handleImport(e: FormEvent) {
    e.preventDefault();
    setImporting(true);
    try {
      const text = importText.trim();

      // Personal backup (DSP1.) — multi-space + optional encrypted notes
      if (text.includes("DSP1.") || text.includes("ds-personal-backup")) {
        const personal = parsePersonalBackupInput(text);
        let sessionTotal = 0;
        let lastSpaceId: string | null = null;
        for (const pack of personal.spaces) {
          const result = await importSpaceExport(pack);
          sessionTotal += result.addedSessions;
          lastSpaceId = result.space.id;
        }
        let notesRestored = 0;
        if (personal.privateNotesIncluded && personal.privateNotesEnc) {
          const key = getStoredAccountKey();
          if (!key) {
            toast.message("Spaces restored", {
              description:
                "Encrypted private notes need your Account Key on this device (Settings → Account Key → link key), then import again.",
            });
          } else {
            const notes = await decryptPersonalNotes(personal, key);
            for (const n of notes) {
              const exists = await db.privateNotes.get(n.id);
              if (!exists) {
                await db.privateNotes.put(n);
                notesRestored += 1;
              }
            }
          }
        }
        toast.success(
          `Restored ${personal.spaces.length} space${personal.spaces.length === 1 ? "" : "s"}`,
          {
            description: [
              `${sessionTotal} new session${sessionTotal === 1 ? "" : "s"}`,
              notesRestored > 0
                ? `${notesRestored} private note${notesRestored === 1 ? "" : "s"}`
                : personal.privateNotesIncluded
                  ? "private notes encrypted in file"
                  : "private notes not in this file",
            ].join(" · "),
          },
        );
        onClose();
        if (lastSpaceId) navigate(`/space/${lastSpaceId}`);
        return;
      }

      const parsed = parseExportInput(importText);
      const result = await importSpaceExport(parsed);
      const prayerBits: string[] = [];
      if (result.addedPrayers > 0) {
        prayerBits.push(
          `${result.addedPrayers} prayer board entr${result.addedPrayers === 1 ? "y" : "ies"}`,
        );
      }
      if (result.skippedPrayers > 0) {
        prayerBits.push(
          `${result.skippedPrayers} prayer entr${result.skippedPrayers === 1 ? "y" : "ies"} already here`,
        );
      }
      toast.success(
        `Imported ${result.addedSessions} session${result.addedSessions === 1 ? "" : "s"}`,
        {
          description: [
            result.skippedSessions > 0
              ? `${result.skippedSessions} sessions already on this device (skipped)`
              : null,
            prayerBits.length > 0 ? prayerBits.join(" · ") : null,
            "Private notes are never in DSX1. group files.",
          ]
            .filter(Boolean)
            .join(". "),
        },
      );
      onClose();
      navigate(`/space/${result.space.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setLoadingFile(true);
    try {
      const result = await readBackupImportFile(file);
      setImportText(result.text);
      setImportSourceLabel(result.sourceLabel);
      toast.message(
        result.fromZip
          ? "Zip opened — backup package loaded"
          : "File loaded — review and import",
        {
          description: result.fromZip
            ? result.sourceLabel
            : "Tap Import when ready",
        },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read file", {
        duration: 10000,
      });
    } finally {
      setLoadingFile(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onDragEnter(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    setDragOver(false);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    void onFile(file);
  }

  return (
    <Modal
      open={open}
      title={
        mode === "export"
          ? "Back up / export Space"
          : "Import previous data"
      }
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1">
          <button
            type="button"
            onClick={() => setMode("export")}
            className={[
              "rounded-lg py-2.5 text-sm font-medium touch-manipulation tap-target",
              mode === "export"
                ? "bg-surface text-primary shadow-sm"
                : "text-muted",
            ].join(" ")}
          >
            Export
          </button>
          <button
            type="button"
            onClick={() => setMode("import")}
            className={[
              "rounded-lg py-2.5 text-sm font-medium touch-manipulation tap-target",
              mode === "import"
                ? "bg-surface text-primary shadow-sm"
                : "text-muted",
            ].join(" ")}
          >
            Import
          </button>
        </div>

        {mode === "export" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted -mt-1">
              Export is how you <strong className="text-text">back up</strong> a
              Space or send history to another device. Download the file and keep
              a copy somewhere safe (Files, email, cloud drive).{" "}
              <strong className="text-text">Shared prayer board is included.</strong>{" "}
              Private notes are never included.
            </p>

            {!spaceId && (
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Space</span>
                <select
                  value={selectedSpaceId}
                  onChange={(e) => setSelectedSpaceId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
                >
                  {spaces.length === 0 && (
                    <option value="">No spaces yet</option>
                  )}
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {loading && (
              <p className="text-sm text-muted">Preparing package…</p>
            )}

            {payload && !loading && (
              <>
                <div className="rounded-xl border border-border bg-bg px-3 py-3 text-sm space-y-1">
                  <p className="font-medium text-primary">{payload.space.name}</p>
                  <p className="text-muted">
                    {payload.sessions.length} session
                    {payload.sessions.length === 1 ? "" : "s"} ·{" "}
                    {payload.space.members.length} member
                    {payload.space.members.length === 1 ? "" : "s"}
                  </p>
                </div>

                <ol className="text-sm text-muted space-y-1.5 list-decimal pl-5">
                  <li>Download (recommended backup) or copy the package below.</li>
                  <li>
                    Save it off this browser, or send it via message, email, or
                    AirDrop.
                  </li>
                  <li>
                    To restore or move devices: Settings → Export / Import →
                    Import → paste or open the file.
                  </li>
                  <li>
                    Sessions already on that device are skipped (no overwrite of
                    local private notes). Export each Space you care about.
                  </li>
                </ol>

                <div className="flex flex-col gap-2">
                  <Button fullWidth onClick={() => void shareExport()}>
                    <Share2 className="h-5 w-5" aria-hidden />
                    Share update
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" fullWidth onClick={() => void copyExport()}>
                      <Copy className="h-4 w-4" aria-hidden />
                      Copy
                    </Button>
                    <Button variant="secondary" fullWidth onClick={downloadExport}>
                      <Download className="h-4 w-4" aria-hidden />
                      Download
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <form onSubmit={handleImport} className="space-y-4">
            <p className="text-sm text-muted -mt-1">
              Restore from a group file (<code className="text-xs">DSX1.</code>
              ), personal backup (<code className="text-xs">DSP1.</code>), or a{" "}
              <strong className="text-text font-medium">Zip</strong> that wraps
              one of those. Private notes only restore from DSP1. when encrypted
              with your Account Key — never from group files or the cloud room.
            </p>

            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileRef.current?.click();
                }
              }}
              onDragEnter={onDragEnter}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={[
                "rounded-xl border-2 border-dashed px-3 py-5 text-center touch-manipulation cursor-pointer transition-colors",
                dragOver
                  ? "border-primary bg-primary/10"
                  : "border-border bg-bg/80 hover:border-primary/40",
              ].join(" ")}
            >
              <FileUp
                className={[
                  "h-6 w-6 mx-auto mb-2",
                  dragOver ? "text-primary" : "text-muted",
                ].join(" ")}
                aria-hidden
              />
              <p className="text-sm font-medium text-primary">
                {loadingFile
                  ? "Reading file…"
                  : dragOver
                    ? "Drop to load"
                    : "Drag & drop backup here"}
              </p>
              <p className="text-xs text-muted mt-1">
                .txt · .zip · .json — or tap to choose
              </p>
              {importSourceLabel && (
                <p className="text-xs text-primary mt-2 font-medium truncate px-2">
                  Loaded: {importSourceLabel}
                </p>
              )}
            </div>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Update package</span>
              <textarea
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  if (importSourceLabel) setImportSourceLabel(null);
                }}
                className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-sm min-h-[120px] resize-y font-mono"
                placeholder="Paste DSX1.… or DSP1.… package here"
              />
            </label>

            <input
              ref={fileRef}
              type="file"
              accept={IMPORT_FILE_ACCEPT}
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="secondary"
              fullWidth
              disabled={loadingFile}
              onClick={() => fileRef.current?.click()}
            >
              <FileUp className="h-5 w-5" aria-hidden />
              {loadingFile ? "Reading…" : "Choose file"}
            </Button>

            <div className="rounded-xl bg-surface-muted/60 border border-border px-3 py-3 text-xs text-muted space-y-1">
              <p className="font-medium text-text text-sm">Conflict handling</p>
              <p>
                If this space already exists locally, matching session IDs are
                skipped so your device keeps its own notes. New sessions are
                added. Zip is only a wrapper — Spaces still import into the
                current app structure (local-only until you Connect).
              </p>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="secondary" fullWidth onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                fullWidth
                disabled={importing || loadingFile || !importText.trim()}
              >
                <Upload className="h-4 w-4" aria-hidden />
                {importing ? "Importing…" : "Import"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
