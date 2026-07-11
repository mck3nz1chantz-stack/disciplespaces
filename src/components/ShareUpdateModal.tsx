import { useEffect, useRef, useState, type FormEvent } from "react";
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
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setPayload(null);
      setImportText("");
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
            "Private notes are never imported.",
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

  function onFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setImportText(text);
      toast.message("File loaded — review and import");
    };
    reader.onerror = () => toast.error("Could not read file");
    reader.readAsText(file);
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
              Restore Spaces from a backup or another device. Paste a Space
              Update package (starts with{" "}
              <code className="text-xs">DSX1.</code>) or choose a downloaded
              file. Private notes are never imported.
            </p>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Update package</span>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-sm min-h-[120px] resize-y font-mono"
                placeholder="Paste DSX1.… package here"
              />
            </label>

            <input
              ref={fileRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => fileRef.current?.click()}
            >
              <FileUp className="h-5 w-5" aria-hidden />
              Choose file
            </Button>

            <div className="rounded-xl bg-surface-muted/60 border border-border px-3 py-3 text-xs text-muted space-y-1">
              <p className="font-medium text-text text-sm">Conflict handling</p>
              <p>
                If this space already exists locally, matching session IDs are
                skipped so your device keeps its own notes. New sessions are
                added.
              </p>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="secondary" fullWidth onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                fullWidth
                disabled={importing || !importText.trim()}
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
