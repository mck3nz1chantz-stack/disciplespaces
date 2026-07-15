import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ChevronDown, Plus, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Modal } from "../components/Modal";
import { MemberEditor } from "../components/MemberEditor";
import { JoinSpaceModal } from "../components/JoinSpaceModal";
import { QuickStartChecklist } from "../components/QuickStartChecklist";
import { ShareUpdateModal } from "../components/ShareUpdateModal";
import { TestingGuideCard } from "../components/TestingPhaseNotice";
import {
  consumePendingHomeAction,
  consumePendingJoinRaw,
} from "../components/Layout";
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
  const [joinInitialRaw, setJoinInitialRaw] = useState<string | null>(null);
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
  /** Family / meeting style / description — collapsed by default (P2). */
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  // Honor onboarding CTAs + deep-link invites from text messages
  useEffect(() => {
    function openPendingFromHandoff() {
      const action = consumePendingHomeAction();
      if (action === "create") setOpen(true);
      if (action === "join") setJoinOpen(true);

      const pendingJoin = consumePendingJoinRaw();
      if (pendingJoin) {
        setJoinInitialRaw(pendingJoin);
        setJoinOpen(true);
      }
    }

    openPendingFromHandoff();
    window.addEventListener("ds-pending-join", openPendingFromHandoff);
    return () =>
      window.removeEventListener("ds-pending-join", openPendingFromHandoff);
  }, []);

  const hasAnySessions = useMemo(
    () => spaces.some((s) => (s.sessions?.length ?? 0) > 0),
    [spaces],
  );

  const showChecklist =
    showQuickStart && !isLoading && (spaces.length === 0 || !hasAnySessions);

  function resetForm() {
    setName("");
    setDescription("");
    setMembers([]);
    setSpaceTemplate("guided");
    setSpaceKind("group");
    setMoreOptionsOpen(false);
  }

  function closeModal() {
    if (saving) return;
    setOpen(false);
    resetForm();
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Give this group a name");
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
      toast.success(isFirst ? "Your first group is ready" : "Group created", {
        description:
          "Tap Start today’s meeting when you gather. You can invite people anytime.",
        duration: 5000,
      });
      if (isFirst && !readFlag(FIRST_SPACE_TIP_KEY)) {
        writeFlag(FIRST_SPACE_TIP_KEY, true);
      }
      setOpen(false);
      resetForm();
      navigate(`/space/${space.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not create group",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl">Your groups</h2>
        <p className="text-sm text-muted mt-1">
          Tap a group to meet. Invite friends. Notes stay on this phone.
        </p>
      </div>

      <TestingGuideCard
        variant="compact"
        onBackup={() => {
          setBackupMode("export");
          setBackupOpen(true);
        }}
      />

      <div className="grid grid-cols-2 gap-2">
        <Button fullWidth className="!py-3.5" onClick={() => setOpen(true)}>
          <Plus className="h-5 w-5" aria-hidden />
          New group
        </Button>
        <Button
          variant="secondary"
          fullWidth
          className="!py-3.5"
          onClick={() => setJoinOpen(true)}
        >
          <UserPlus className="h-5 w-5" aria-hidden />
          Join a group
        </Button>
      </div>

      {showChecklist && (
        <QuickStartChecklist
          hasSpaces={spaces.length > 0}
          hasSessions={hasAnySessions}
          firstSpaceId={spaces[0]?.id ?? null}
          onCreateSpace={() => setOpen(true)}
          onJoinSpace={() => setJoinOpen(true)}
          onDismiss={() => setShowQuickStart(false)}
        />
      )}

      {error && (
        <Card className="border-danger/30 bg-danger/10 text-danger text-sm">
          {error}
        </Card>
      )}

      {isLoading && spaces.length === 0 && (
        <p className="text-sm text-muted">Loading…</p>
      )}

      {!isLoading && spaces.length === 0 && !showChecklist && (
        <Card className="text-center py-10 space-y-4">
          <Users className="h-10 w-10 mx-auto text-muted" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium text-primary">No groups yet</p>
            <p className="text-sm text-muted max-w-xs mx-auto">
              Start a small group, or join one you were invited to.
            </p>
          </div>
          <div className="flex flex-col gap-2 max-w-xs mx-auto w-full">
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-5 w-5" aria-hidden />
              Start a group
            </Button>
            <Button variant="secondary" onClick={() => setJoinOpen(true)}>
              <UserPlus className="h-5 w-5" aria-hidden />
              I was invited
            </Button>
          </div>
        </Card>
      )}

      <ul className="space-y-3">
        {spaces.map((space) => {
          const n = space.members.length;
          const max = maxMembersForSpace(space.spaceKind);
          return (
            <li key={space.id}>
              <Link
                to={`/space/${space.id}`}
                className="block touch-manipulation"
              >
                <Card className="hover:border-primary/30 transition-colors active:scale-[0.99]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold truncate text-primary">
                        {space.name}
                      </h3>
                      <p className="text-sm text-muted mt-1">
                        {n === 0
                          ? "No people listed yet"
                          : `${n} of ${max} people`}
                        {space.sessions.length > 0
                          ? ` · ${space.sessions.length} meeting${space.sessions.length === 1 ? "" : "s"}`
                          : ""}
                      </p>
                      {n > 0 && (
                        <p className="text-xs text-muted mt-0.5 truncate">
                          {space.members.map((m) => m.name).join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted">
                        {formatIsoDay(lastActivityIso(space))}
                      </p>
                      <p className="text-[11px] text-muted/80 mt-0.5">
                        {activityLabel(space)}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>

      {spaces.length > 0 && (
        <p className="text-center text-xs text-muted pb-1">
          <button
            type="button"
            className="text-primary font-medium underline-offset-2 hover:underline touch-manipulation"
            onClick={() => {
              setBackupMode("export");
              setBackupOpen(true);
            }}
          >
            Save a copy of a group
          </button>
          <span className="mx-1.5">·</span>
          <Link
            to="/settings"
            className="text-primary font-medium underline-offset-2 hover:underline"
          >
            Settings
          </Link>
        </p>
      )}

      <Modal open={open} title="New group" onClose={closeModal}>
        <form onSubmit={handleCreate} className="space-y-5">
          <p className="text-sm text-muted -mt-1">
            Just a name is enough. Add people now or later.
          </p>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Group name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
              placeholder="e.g. Thursday morning"
              maxLength={80}
              required
              autoFocus
            />
          </label>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              Who’s in it{" "}
              <span className="text-muted font-normal">(optional)</span>
            </p>
            <MemberEditor
              members={members}
              onChange={setMembers}
              maxMembers={maxMembersForSpace(spaceKind)}
              kindLabel={spaceKindLabel(spaceKind)}
            />
          </div>

          <div className="border-t border-border pt-2 space-y-3">
            <button
              type="button"
              onClick={() => setMoreOptionsOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 py-1 text-left touch-manipulation tap-target"
              aria-expanded={moreOptionsOpen}
            >
              <span className="text-sm font-semibold text-muted">
                More options · family, meeting style
              </span>
              <ChevronDown
                className={[
                  "h-5 w-5 text-muted transition-transform",
                  moreOptionsOpen ? "rotate-180" : "",
                ].join(" ")}
                aria-hidden
              />
            </button>

            {moreOptionsOpen && (
              <div className="space-y-4">
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Size</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        {
                          id: "group" as const,
                          label: "Group",
                          description: `Up to ${maxMembersForSpace("group")} people`,
                        },
                        {
                          id: "family" as const,
                          label: "Family",
                          description: `Up to ${maxMembersForSpace("family")} people`,
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
                  <legend className="text-sm font-medium">
                    Meeting style
                  </legend>
                  <p className="text-xs text-muted -mt-0.5">
                    Default is Guided. You can change this anytime inside the
                    group.
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
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>

                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">
                    Note{" "}
                    <span className="text-muted font-normal">(optional)</span>
                  </span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base min-h-[72px] resize-y"
                    placeholder="What is this group about?"
                    maxLength={280}
                  />
                </label>
              </div>
            )}
          </div>

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
                  ? "Start first group"
                  : "Create group"}
            </Button>
          </div>
        </form>
      </Modal>

      <JoinSpaceModal
        open={joinOpen}
        initialRaw={joinInitialRaw}
        onClose={() => {
          setJoinOpen(false);
          setJoinInitialRaw(null);
        }}
      />
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
