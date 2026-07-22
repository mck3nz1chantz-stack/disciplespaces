import { useEffect, useMemo, useState, type FormEvent } from "react";
import { HandHeart } from "lucide-react";
import { toast } from "sonner";
import type { Member, PrayerBoardScope } from "../types";
import { useAppStore } from "../stores/useAppStore";
import { Modal } from "./Modal";
import { Button } from "./Button";

export interface PrayFromVerseDraft {
  /** e.g. John 3:16–17 */
  reference: string;
  /** Optional verse text excerpt */
  excerpt?: string;
}

interface PrayFromVerseModalProps {
  open: boolean;
  onClose: () => void;
  spaceId: string;
  sessionId?: string | null;
  members: Member[];
  draft: PrayFromVerseDraft;
}

/**
 * Prayer board handoff from a selected verse range — keeps study → prayer one motion.
 */
export function PrayFromVerseModal({
  open,
  onClose,
  spaceId,
  sessionId,
  members,
  draft,
}: PrayFromVerseModalProps) {
  const addEntry = useAppStore((s) => s.addPrayerBoardEntry);
  const [scope, setScope] = useState<PrayerBoardScope>("individual");
  const [authorMemberId, setAuthorMemberId] = useState(
    () => members[0]?.id ?? "",
  );
  const [authorCustom, setAuthorCustom] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setScope("individual");
    setAuthorMemberId(members[0]?.id ?? "");
    setAuthorCustom("");
    const seed = draft.excerpt
      ? `${draft.reference}\n\n“${draft.excerpt.trim()}”\n\nLord, …`
      : `${draft.reference}\n\nLord, …`;
    setContent(seed);
  }, [open, draft.reference, draft.excerpt, members]);

  const authorName = useMemo(() => {
    if (authorMemberId === "__other__") return authorCustom.trim();
    const m = members.find((x) => x.id === authorMemberId);
    return m?.name?.trim() ?? authorCustom.trim();
  }, [authorMemberId, authorCustom, members]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!authorName) {
      toast.error("Choose who is posting");
      return;
    }
    if (!content.trim()) {
      toast.error("Add a short prayer");
      return;
    }
    setSaving(true);
    try {
      await addEntry({
        spaceId,
        sessionId: sessionId ?? undefined,
        scope,
        kind: "request",
        authorMemberId:
          authorMemberId && authorMemberId !== "__other__"
            ? authorMemberId
            : undefined,
        authorName,
        subject: draft.reference,
        content: content.trim(),
      });
      toast.success(
        scope === "group" ? "Added to group prayer board" : "Added to prayer board",
        {
          description: "Shared with this space · included in Space Updates",
        },
      );
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not add prayer",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Pray this"
      onClose={() => !saving && onClose()}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-3 flex items-start gap-2.5">
          <HandHeart className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              From the Word
            </p>
            <p className="font-serif font-medium text-primary mt-0.5">
              {draft.reference}
            </p>
            {draft.excerpt ? (
              <p className="text-sm text-muted mt-1 leading-relaxed line-clamp-3 font-serif italic">
                “{draft.excerpt}”
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1">
          <button
            type="button"
            onClick={() => setScope("individual")}
            className={[
              "rounded-lg py-2 text-xs font-medium touch-manipulation",
              scope === "individual"
                ? "bg-surface text-primary shadow-sm"
                : "text-muted",
            ].join(" ")}
          >
            Individual
          </button>
          <button
            type="button"
            onClick={() => setScope("group")}
            className={[
              "rounded-lg py-2 text-xs font-medium touch-manipulation",
              scope === "group"
                ? "bg-surface text-primary shadow-sm"
                : "text-muted",
            ].join(" ")}
          >
            Group
          </button>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Who is praying</span>
          <select
            value={authorMemberId || "__other__"}
            onChange={(e) => setAuthorMemberId(e.target.value)}
            className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
            disabled={saving}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
            <option value="__other__">Someone else…</option>
          </select>
          {(authorMemberId === "__other__" || members.length === 0) && (
            <input
              value={authorCustom}
              onChange={(e) => setAuthorCustom(e.target.value)}
              placeholder="Name"
              className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base mt-2"
              disabled={saving}
            />
          )}
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Prayer</span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base resize-y min-h-[120px]"
            disabled={saving}
            required
          />
        </label>

        <p className="text-xs text-muted -mt-1">
          Goes on the shared prayer board for this space
          {sessionId ? " · linked to tonight’s session" : ""}.
        </p>

        <div className="flex flex-col gap-2">
          <Button type="submit" fullWidth disabled={saving}>
            <HandHeart className="h-5 w-5" aria-hidden />
            {saving ? "Saving…" : "Add to prayer board"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            fullWidth
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
