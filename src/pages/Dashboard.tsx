import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { CircleHelp, Plus, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Modal } from "../components/Modal";
import { MemberEditor } from "../components/MemberEditor";
import { JoinSpaceModal } from "../components/JoinSpaceModal";
import { QuickStartChecklist } from "../components/QuickStartChecklist";
import { ShareUpdateModal } from "../components/ShareUpdateModal";
import { DataBackupCard } from "../components/DataBackupCard";
import { consumePendingHomeAction } from "../components/Layout";
import { lastActivityIso, useAppStore } from "../stores/useAppStore";
import { useLiveSpaces } from "../hooks/useLiveDb";
import {
  FIRST_SPACE_TIP_KEY,
  QUICKSTART_DISMISS_KEY,
  readFlag,
  writeFlag,
} from "../lib/onboarding";
import {
  SPACE_TEMPLATES,
  getSpaceTemplateMeta,
  type SpaceTemplateId,
} from "../lib/spaceTemplates";
import type { Member, Space, SpaceKind } from "../types";
import {
  maxMembersForSpace,
  spaceKindLabel,
} from "../types";

export function Dashboard() {
  const navigate = useNavigate();
  const storeSpaces = useAppStore((s) => s.spaces);
  const liveSpaces = useLiveSpaces();
  /** Prefer live Dexie list when ready; fall back to store during first paint. */
  const spaces = liveSpaces ?? storeSpaces;
  const isLoading = useAppStore((s) => s.isLoading) && liveSpaces === undefined;
  const error = useAppStore((s) => s.error);
  const initialize = useAppStore((s) => s.initialize);
  const createSpace = useAppStore((s) => s.createSpace);

  const [open, setOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [backupMode, setBackupMode] = useState<"export" | "import">("export");
  const [spaceTemplate, setSpaceTemplate] =
    useState<SpaceTemplateId>("guided");
  const [spaceKind, setSpaceKind] = useState<SpaceKind>("group");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [saving, setSaving] = useState(false);
  const [showQuickStart, setShowQuickStart] = useState(
    () => !readFlag(QUICKSTART_DISMISS_KEY),
  );

  useEffect(() => {
    void initialize();
  }, [initialize]);

  // Honor onboarding CTAs
  useEffect(() => {
    const action = consumePendingHomeAction();
    if (action === "create") setOpen(true);
    if (action === "join") setJoinOpen(true);
  }, []);

  const hasAnySessions = useMemo(
    () => spaces.some((s) => (s.sessions?.length ?? 0) > 0),
    [spaces],
  );

  const showChecklist =
    showQuickStart && !isLoading && (spaces.length === 0 || !hasAnySessions);

  const selectedMeta = getSpaceTemplateMeta(spaceTemplate);

  function resetForm() {
    setName("");
    setDescription("");
    setMembers([]);
    setSpaceTemplate("guided");
    setSpaceKind("group");
  }

  function closeModal() {
    if (saving) return;
    setOpen(false);
    resetForm();
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Give this space a name");
      return;
    }

    const isFirst = spaces.length === 0;
    setSaving(true);
    try {
      const space = await createSpace({
        name,
        description,
        members,
        spaceTemplate,
        spaceKind,
        createFirstSession: true,
      });
      const firstLabel = getSpaceTemplateMeta(spaceTemplate).firstSessionLabel;
      toast.success(
        isFirst ? "Your first Space is ready" : "Space created",
        {
          description: `${spaceKindLabel(spaceKind)} space · first session with ${firstLabel}. Open it to add notes or passages.`,
          duration: 6000,
        },
      );
      if (isFirst && !readFlag(FIRST_SPACE_TIP_KEY)) {
        writeFlag(FIRST_SPACE_TIP_KEY, true);
      }
      setOpen(false);
      resetForm();
      navigate(`/space/${space.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not create space",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl">Your spaces</h2>
          <p className="text-sm text-muted mt-1">
            Living discipleship containers — Groups (up to 5) or Family (up to
            10). Notes stay on this device.
          </p>
        </div>
        <Button
          className="shrink-0"
          onClick={() => setOpen(true)}
          aria-label="Create space"
        >
          <Plus className="h-5 w-5" aria-hidden />
          <span className="hidden min-[380px]:inline">Create</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          fullWidth
          onClick={() => setJoinOpen(true)}
        >
          <UserPlus className="h-5 w-5" aria-hidden />
          Join
        </Button>
        <Button
          variant="ghost"
          fullWidth
          onClick={() => navigate("/help")}
        >
          <CircleHelp className="h-5 w-5" aria-hidden />
          Help
        </Button>
      </div>

      <DataBackupCard
        variant="compact"
        spaceCount={spaces.length}
        onBackup={() => {
          setBackupMode("export");
          setBackupOpen(true);
        }}
        onImport={() => {
          setBackupMode("import");
          setBackupOpen(true);
        }}
      />

      {showChecklist && (
        <QuickStartChecklist
          hasSpaces={spaces.length > 0}
          hasSessions={hasAnySessions}
          firstSpaceId={spaces[0]?.id ?? null}
          onCreateSpace={() => setOpen(true)}
          onDismiss={() => setShowQuickStart(false)}
        />
      )}

      {error && (
        <Card className="border-danger/30 bg-danger/10 text-danger text-sm">
          {error}
        </Card>
      )}

      {isLoading && spaces.length === 0 && (
        <p className="text-sm text-muted">Loading spaces…</p>
      )}

      {!isLoading && spaces.length === 0 && !showChecklist && (
        <Card className="text-center py-10 space-y-4">
          <Users className="h-10 w-10 mx-auto text-muted" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium text-primary">No spaces yet</p>
            <p className="text-sm text-muted max-w-xs mx-auto">
              Create a space for your group, or join with an invite package /
              QR. Need a map of the app? Open Help.
            </p>
          </div>
          <div className="flex flex-col gap-2 max-w-xs mx-auto w-full">
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-5 w-5" aria-hidden />
              Create your first space
            </Button>
            <Button variant="secondary" onClick={() => setJoinOpen(true)}>
              <UserPlus className="h-5 w-5" aria-hidden />
              Join with invite
            </Button>
            <Button variant="ghost" onClick={() => navigate("/help")}>
              <CircleHelp className="h-5 w-5" aria-hidden />
              Help & tutorial
            </Button>
          </div>
        </Card>
      )}

      <ul className="space-y-3">
        {spaces.map((space) => (
          <li key={space.id}>
            <Link to={`/space/${space.id}`} className="block touch-manipulation">
              <Card className="hover:border-primary/30 transition-colors active:scale-[0.99]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg truncate">{space.name}</h3>
                      <SpaceKindBadge kind={space.spaceKind} />
                      <SpaceTemplateBadge
                        templateId={space.spaceTemplate}
                        labelSuffix=" mode"
                      />
                    </div>
                    {space.description && (
                      <p className="text-sm text-muted mt-0.5 line-clamp-2">
                        {space.description}
                      </p>
                    )}
                    <p className="text-xs text-muted mt-2">
                      {space.members.length > 0
                        ? `${space.members.length}/${maxMembersForSpace(space.spaceKind)} · ${space.members.map((m) => m.name).join(", ")}`
                        : "No members yet"}
                    </p>
                    <p className="text-xs text-muted mt-1">
                      {space.sessions.length} session
                      {space.sessions.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-xs text-muted">
                      {formatIsoDay(lastActivityIso(space))}
                    </p>
                    <p className="text-[11px] text-muted/80">
                      {activityLabel(space)}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      <Modal open={open} title="Create space" onClose={closeModal}>
        <form onSubmit={handleCreate} className="space-y-5">
          <p className="text-sm text-muted -mt-1">
            Choose Group or Family, name your living Space, then pick a starting
            mode. You can switch Custom / Guided / Advanced / Freeform anytime
            inside the same Space — no need for a new Space per template.
          </p>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Space type</legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  {
                    id: "group" as const,
                    label: "Group",
                    description: `Small discipleship circle · up to ${maxMembersForSpace("group")}`,
                  },
                  {
                    id: "family" as const,
                    label: "Family",
                    description: `Household / relatives · up to ${maxMembersForSpace("family")}`,
                  },
                ] as const
              ).map((opt) => {
                const selected = spaceKind === opt.id;
                return (
                  <label
                    key={opt.id}
                    className={[
                      "rounded-xl border px-3 py-3 touch-manipulation cursor-pointer transition-colors",
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-bg hover:border-primary/30",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="space-kind"
                      className="sr-only"
                      checked={selected}
                      onChange={() => {
                        setSpaceKind(opt.id);
                        // Drop overflow members when switching to smaller cap
                        const max = maxMembersForSpace(opt.id);
                        setMembers((prev) => prev.slice(0, max));
                      }}
                      disabled={saving}
                    />
                    <span className="font-medium text-primary block text-sm">
                      {opt.label}
                    </span>
                    <span className="text-[11px] text-muted block mt-0.5 leading-snug">
                      {opt.description}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Starting mode</legend>
            <p className="text-xs text-muted -mt-0.5">
              Modes live inside this Space. Switch later to log Freeform one
              week and Advanced the next — both stay here.
            </p>
            <ul className="space-y-2">
              {SPACE_TEMPLATES.map((tpl) => {
                const selected = spaceTemplate === tpl.id;
                return (
                  <li key={tpl.id}>
                    <label
                      className={[
                        "flex items-start gap-3 rounded-xl border px-3 py-3 touch-manipulation tap-target cursor-pointer transition-colors",
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border bg-bg hover:border-primary/30",
                      ].join(" ")}
                    >
                      <input
                        type="radio"
                        name="space-template"
                        value={tpl.id}
                        checked={selected}
                        onChange={() => setSpaceTemplate(tpl.id)}
                        className="mt-1 h-4 w-4 accent-primary shrink-0"
                        disabled={saving}
                      />
                      <span className="min-w-0">
                        <span className="font-medium text-primary block">
                          {tpl.name}
                        </span>
                        <span className="text-xs text-muted block mt-0.5">
                          {tpl.description}
                        </span>
                        <span className="text-[11px] text-primary/80 block mt-1">
                          First session: {tpl.firstSessionLabel}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted">
              First session uses <strong>{selectedMeta.firstSessionLabel}</strong>
              . Flip modes inside the Space to see each mode’s history.
            </p>
          </fieldset>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
              placeholder="e.g. Thursday morning group"
              maxLength={80}
              required
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Description (optional)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base min-h-[72px] resize-y"
              placeholder="What is this group about?"
              maxLength={280}
            />
          </label>

          <MemberEditor
            members={members}
            onChange={setMembers}
            maxMembers={maxMembersForSpace(spaceKind)}
            kindLabel={spaceKindLabel(spaceKind)}
          />

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={closeModal}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" fullWidth disabled={saving}>
              {saving
                ? "Saving…"
                : spaces.length === 0
                  ? "Create first space"
                  : "Create space"}
            </Button>
          </div>
        </form>
      </Modal>

      <JoinSpaceModal open={joinOpen} onClose={() => setJoinOpen(false)} />
      <ShareUpdateModal
        open={backupOpen}
        defaultMode={backupMode}
        onClose={() => setBackupOpen(false)}
      />
    </div>
  );
}

export function SpaceTemplateBadge({
  templateId,
  labelSuffix = "",
}: {
  templateId?: string | null;
  /** e.g. " mode" for living-space lens. */
  labelSuffix?: string;
}) {
  const meta = getSpaceTemplateMeta(templateId);
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 text-primary text-[11px] font-semibold px-2 py-0.5 shrink-0">
      {meta.shortLabel}
      {labelSuffix}
    </span>
  );
}

export function SpaceKindBadge({
  kind,
}: {
  kind?: string | null;
}) {
  const family = kind === "family";
  return (
    <span
      className={[
        "inline-flex items-center rounded-full text-[11px] font-semibold px-2 py-0.5 shrink-0",
        family
          ? "bg-accent/20 text-primary"
          : "bg-surface-muted text-muted",
      ].join(" ")}
    >
      {spaceKindLabel(kind)}
    </span>
  );
}

function formatIsoDay(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d");
  } catch {
    return iso.slice(0, 10);
  }
}

function activityLabel(space: Space): string {
  const last = lastActivityIso(space);
  try {
    const d = parseISO(last);
    if (space.sessions.length === 0) {
      return "Created " + formatDistanceToNow(d, { addSuffix: true });
    }
    return "Active " + formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "";
  }
}
