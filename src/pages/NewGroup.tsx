import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { MemberEditor } from "../components/MemberEditor";
import { NavBreadcrumb } from "../components/NavBreadcrumb";
import {
  FIRST_SPACE_TIP_KEY,
  readFlag,
  writeFlag,
} from "../lib/onboarding";
import {
  SPACE_TEMPLATES,
  type SpaceTemplateId,
} from "../lib/spaceTemplates";
import { useAppStore } from "../stores/useAppStore";
import type { Member, SpaceKind } from "../types";
import { maxMembersForSpace, spaceKindLabel } from "../types";

/**
 * Full-page create flow (/new) — deep-link friendly; lands on the new group.
 */
export function NewGroup() {
  const navigate = useNavigate();
  const createSpace = useAppStore((s) => s.createSpace);
  const spaces = useAppStore((s) => s.spaces);

  const [spaceTemplate, setSpaceTemplate] =
    useState<SpaceTemplateId>("guided");
  const [spaceKind, setSpaceKind] = useState<SpaceKind>("group");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [saving, setSaving] = useState(false);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);

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
      const roomKey = space.sync?.shortCode;
      toast.success(
        roomKey
          ? `Group ready · room key ${roomKey}`
          : isFirst
            ? "Your first group is ready"
            : "Group created",
        {
          description: roomKey
            ? "Share that key so friends can Join. Open the group to Sync and meet."
            : "Open the group → Open group room when Online to get a room key.",
          duration: 6500,
        },
      );
      if (isFirst && !readFlag(FIRST_SPACE_TIP_KEY)) {
        writeFlag(FIRST_SPACE_TIP_KEY, true);
      }
      navigate(`/space/${space.id}`, { replace: true });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not create group",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <NavBreadcrumb
        items={[{ label: "Groups", to: "/" }, { label: "New group" }]}
      />

      <div>
        <h2 className="text-2xl font-serif tracking-tight text-primary">
          New group
        </h2>
        <p className="text-sm text-muted mt-1 leading-relaxed">
          Just a name is enough. When Online, you’ll get a{" "}
          <strong className="text-text">room key</strong> to share — friends only
          Join with that key.
        </p>
      </div>

      <Card padding="lg" className="space-y-0">
        <form onSubmit={(e) => void handleCreate(e)} className="space-y-5">
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
                  <legend className="text-sm font-medium">Meeting style</legend>
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
              onClick={() => navigate("/")}
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
      </Card>

      <p className="text-center text-sm text-muted">
        Have a room key?{" "}
        <Link
          to="/join"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Join a group
        </Link>
      </p>
    </div>
  );
}
