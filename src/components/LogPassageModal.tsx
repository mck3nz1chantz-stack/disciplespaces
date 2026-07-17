import { useEffect, useMemo, useState, type FormEvent } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import type { Passage, Session, Space, Template } from "../types";
import {
  formatPassageRef,
  isValidPassage,
  passageFromSelection,
} from "../lib/passages";
import { sessionDisplayTitle } from "../lib/sessionTitle";
import { useAppStore } from "../stores/useAppStore";
import { useBibleStore } from "../stores/useBibleStore";
import { Modal } from "./Modal";
import { Button } from "./Button";

export interface PassageDraft {
  bookName: string;
  startChapter: number;
  startVerse: number;
  endChapter: number;
  endVerse: number;
}

interface LogPassageModalProps {
  open: boolean;
  onClose: () => void;
  draft: PassageDraft;
  /** Called after successful log with the session that received the passage. */
  onLogged?: (session: Session, passage: Passage) => void;
}

/**
 * Choose space + session and save a structured Passage into passagesStudied.
 */
export function LogPassageModal({
  open,
  onClose,
  draft,
  onLogged,
}: LogPassageModalProps) {
  const spaces = useAppStore((s) => s.spaces);
  const templates = useAppStore((s) => s.templates);
  const initialize = useAppStore((s) => s.initialize);
  const loadSessionsForSpace = useAppStore((s) => s.loadSessionsForSpace);
  const sessions = useAppStore((s) => s.sessions);
  const createSession = useAppStore((s) => s.createSession);
  const addPassageToSession = useAppStore((s) => s.addPassageToSession);
  const logContext = useBibleStore((s) => s.logContext);
  const setLogContext = useBibleStore((s) => s.setLogContext);

  const [spaceId, setSpaceId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [createNew, setCreateNew] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [spaceSessions, setSpaceSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Range editable within modal (user can tweak)
  const [startChapter, setStartChapter] = useState(draft.startChapter);
  const [startVerse, setStartVerse] = useState(draft.startVerse);
  const [endChapter, setEndChapter] = useState(draft.endChapter);
  const [endVerse, setEndVerse] = useState(draft.endVerse);

  // Reset range/note when modal opens or draft changes — never on spaces reload
  // (spaces identity changes after initialize and would wipe mid-edit input).
  useEffect(() => {
    if (!open) return;
    void initialize();
    setStartChapter(draft.startChapter);
    setStartVerse(draft.startVerse);
    setEndChapter(draft.endChapter);
    setEndVerse(draft.endVerse);
    setNote("");
    setCreateNew(false);
  }, [
    open,
    draft.startChapter,
    draft.startVerse,
    draft.endChapter,
    draft.endVerse,
    draft.bookName,
    initialize,
  ]);

  // Seed preferred space once when empty or when current choice vanishes.
  useEffect(() => {
    if (!open || spaces.length === 0) return;
    setSpaceId((current) => {
      if (current && spaces.some((s) => s.id === current)) return current;
      if (
        logContext.spaceId &&
        spaces.some((s) => s.id === logContext.spaceId)
      ) {
        return logContext.spaceId;
      }
      return spaces[0]?.id ?? "";
    });
  }, [open, spaces, logContext.spaceId]);

  useEffect(() => {
    if (!open || !spaceId) {
      setSpaceSessions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingSessions(true);
      try {
        await loadSessionsForSpace(spaceId);
        if (cancelled) return;
        // sessions in store are for this space after load
        const list = useAppStore
          .getState()
          .sessions.filter((s) => s.spaceId === spaceId);
        setSpaceSessions(list);

        const preferred =
          logContext.sessionId &&
          list.some((s) => s.id === logContext.sessionId)
            ? logContext.sessionId
            : (list[0]?.id ?? "");

        if (list.length === 0) {
          setCreateNew(true);
          setSessionId("");
        } else {
          setCreateNew(false);
          setSessionId(preferred);
        }
      } finally {
        if (!cancelled) setLoadingSessions(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, spaceId, loadSessionsForSpace, logContext.sessionId]);

  // Keep local list in sync if store sessions change
  useEffect(() => {
    if (!spaceId) return;
    setSpaceSessions(sessions.filter((s) => s.spaceId === spaceId));
  }, [sessions, spaceId]);

  const selectedSpace: Space | undefined = useMemo(
    () => spaces.find((s) => s.id === spaceId),
    [spaces, spaceId],
  );

  const previewPassage = passageFromSelection({
    bookName: draft.bookName,
    startChapter,
    startVerse,
    endChapter,
    endVerse,
    contextNote: note,
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!spaceId) {
      toast.error("Choose a space");
      return;
    }
    if (!isValidPassage(previewPassage)) {
      toast.error("Check the verse range");
      return;
    }

    setSaving(true);
    try {
      let targetSessionId = sessionId;

      if (createNew || !targetSessionId) {
        const space = await useAppStore.getState().getSpace(spaceId);
        let templateList = templates;
        if (templateList.length === 0) {
          await useAppStore.getState().loadTemplates();
          templateList = useAppStore.getState().templates;
        }
        const preferredId = space?.defaultSessionTemplateId;
        const template: Template | undefined =
          (preferredId
            ? templateList.find((t) => t.id === preferredId)
            : undefined) ||
          templateList.find((t) => t.id === "tpl-freeform") ||
          templateList[0];
        if (!template) {
          toast.error("No templates available to create a session");
          setSaving(false);
          return;
        }
        const created = await createSession({
          spaceId,
          templateId: template.id,
          attendees: space?.members.map((m) => m.id) ?? [],
          passagesStudied: [previewPassage],
        });
        targetSessionId = created.id;
        const spaceName =
          spaces.find((s) => s.id === spaceId)?.name ?? logContext.spaceName;
        setLogContext({
          spaceId,
          spaceName,
          sessionId: created.id,
        });
        onLogged?.(created, previewPassage);
        onClose();
        return;
      }

      const updated = await addPassageToSession(
        targetSessionId,
        previewPassage,
      );
      const spaceName =
        spaces.find((s) => s.id === spaceId)?.name ?? logContext.spaceName;
      setLogContext({
        spaceId,
        spaceName,
        sessionId: targetSessionId,
      });
      onLogged?.(updated, previewPassage);
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not log passage",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Log passage" onClose={() => !saving && onClose()}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted -mt-1">
          Save this scripture to a session in one of your spaces.
        </p>

        <div className="rounded-xl border border-border bg-surface-muted/40 px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Passage
          </p>
          <p className="font-medium text-primary mt-0.5">
            {formatPassageRef(previewPassage)}
          </p>
          <p className="text-xs text-muted mt-0.5">{draft.bookName} · KJV</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Start ch"
            value={startChapter}
            onChange={setStartChapter}
            disabled={saving}
          />
          <NumberField
            label="Start verse"
            value={startVerse}
            onChange={setStartVerse}
            disabled={saving}
          />
          <NumberField
            label="End ch"
            value={endChapter}
            onChange={setEndChapter}
            disabled={saving}
          />
          <NumberField
            label="End verse"
            value={endVerse}
            onChange={setEndVerse}
            disabled={saving}
          />
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Space</span>
          {spaces.length === 0 ? (
            <p className="text-sm text-muted rounded-xl bg-surface-muted/50 px-3 py-3">
              Create a space first, then log passages into its sessions.
            </p>
          ) : (
            <select
              value={spaceId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSpaceId(nextId);
                const spaceName =
                  spaces.find((s) => s.id === nextId)?.name ?? null;
                setLogContext({
                  spaceId: nextId,
                  spaceName,
                  sessionId: null,
                });
              }}
              className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
              disabled={saving}
              required
            >
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </label>

        {spaceId && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Session</legend>
            {logContext.sessionId &&
              !createNew &&
              sessionId === logContext.sessionId && (
                <p className="text-xs text-primary bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
                  A session was pre-selected from this Space. You can change it
                  below.
                </p>
              )}
            {loadingSessions ? (
              <p className="text-sm text-muted">Loading sessions…</p>
            ) : (
              <>
                <label className="flex items-center gap-3 rounded-xl border border-border bg-bg px-3 py-3 touch-manipulation tap-target cursor-pointer">
                  <input
                    type="radio"
                    name="session-mode"
                    checked={createNew}
                    onChange={() => setCreateNew(true)}
                    disabled={saving}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm font-medium">
                    Create new session (today)
                  </span>
                </label>

                {spaceSessions.length > 0 && (
                  <label className="flex flex-col gap-2 rounded-xl border border-border bg-bg px-3 py-3">
                    <span className="flex items-center gap-3 touch-manipulation">
                      <input
                        type="radio"
                        name="session-mode"
                        checked={!createNew}
                        onChange={() => setCreateNew(false)}
                        disabled={saving}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="text-sm font-medium">
                        Existing session
                      </span>
                    </span>
                    {!createNew && (
                      <select
                        value={sessionId}
                        onChange={(e) => setSessionId(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface px-2.5 py-2.5 text-sm"
                        disabled={saving}
                      >
                        {spaceSessions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {sessionLabel(s, templates)}
                          </option>
                        ))}
                      </select>
                    )}
                  </label>
                )}
              </>
            )}
            {selectedSpace && (
              <p className="text-xs text-muted">
                Logging to <strong>{selectedSpace.name}</strong>
                {selectedSpace.members.length > 0
                  ? ` · ${selectedSpace.members.map((m) => m.name).join(", ")}`
                  : null}
              </p>
            )}
          </fieldset>
        )}

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Context note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base min-h-[72px] resize-y"
            placeholder="What stood out? How might we apply this?"
            maxLength={500}
            disabled={saving}
          />
        </label>

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            fullWidth
            disabled={saving || spaces.length === 0}
          >
            {saving ? "Saving…" : "Log passage"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  // text + inputMode keeps mobile keyboard open and allows clearing with backspace
  const display =
    value === 0 || !Number.isFinite(value) ? "" : String(value);

  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={display}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d]/g, "");
          if (raw === "") {
            onChange(0);
            return;
          }
          const n = parseInt(raw, 10);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        onBlur={() => {
          if (!value || value < 1) onChange(1);
        }}
        className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-base tabular-nums"
        disabled={disabled}
        autoComplete="off"
      />
    </label>
  );
}

function sessionLabel(session: Session, templates: Template[]): string {
  let date = session.date.slice(0, 10);
  try {
    date = format(parseISO(session.date), "MMM d, yyyy");
  } catch {
    // keep
  }
  const tpl = templates.find((t) => t.id === session.templateId);
  const title = sessionDisplayTitle(session, tpl);
  const n = session.passagesStudied?.length ?? 0;
  return `${date} · ${title}${n ? ` · ${n} passage${n === 1 ? "" : "s"}` : ""}`;
}
