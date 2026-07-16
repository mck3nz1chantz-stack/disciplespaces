import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, CheckCircle2, Copy, Share2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { useAppStore } from "../stores/useAppStore";
import {
  buildMemberJoinPayload,
  detectJoinPackageKind,
  formatMemberJoinShareText,
  parseInviteInput,
  parseMemberJoinInput,
  type MemberJoinPayload,
  type SpaceInvitePayload,
} from "../lib/invite";
import { parseExportInput, type SpaceExportPayload } from "../lib/share";
import {
  INVITE_HISTORY_NOTE,
  INVITE_PRIVACY_NOTE,
  INVITE_SYNC_NOTE,
} from "../lib/legal";
import { ConnectSafelyDisclosure } from "./ConnectSafelyGuide";
import { previewRoom } from "../lib/sync";
import type { Member } from "../types";

interface JoinSpaceModalProps {
  open: boolean;
  onClose: () => void;
  /** Prefill from deep link / parent. */
  initialRaw?: string | null;
}

type Step = "input" | "confirm" | "done" | "host-confirm-done";

type ParsedPackage =
  | { kind: "invite"; payload: SpaceInvitePayload }
  | { kind: "export"; payload: SpaceExportPayload }
  | { kind: "member-join"; payload: MemberJoinPayload };

type IdentityChoice = "pick" | "new";

interface ListedPerson {
  id: string;
  name: string;
}

function uniquePeople(
  list: Array<{ id?: string; name: string }>,
): ListedPerson[] {
  const seen = new Set<string>();
  const out: ListedPerson[] = [];
  for (const m of list) {
    const name = m.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: m.id || key, name });
  }
  return out;
}

/**
 * “Who are you?” — pick an existing name or enter a new one.
 * Avoids duplicate people when the host misspelled a guest.
 */
function WhoAreYouPicker({
  people,
  groupLabel,
  identity,
  selectedName,
  newName,
  onPickExisting,
  onChooseNew,
  onNewNameChange,
}: {
  people: ListedPerson[];
  groupLabel?: string;
  identity: IdentityChoice;
  selectedName: string;
  newName: string;
  onPickExisting: (name: string) => void;
  onChooseNew: () => void;
  onNewNameChange: (value: string) => void;
}) {
  const hasPeople = people.length > 0;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-primary inline-flex items-center gap-2">
          <UserRound className="h-4 w-4 shrink-0" aria-hidden />
          Who are you?
        </p>
        <p className="text-xs text-muted leading-relaxed">
          {hasPeople
            ? `Pick your name if the host already added you${groupLabel ? ` to ${groupLabel}` : ""}. Spelling can differ — choose the row that is you, or add yourself as someone new.`
            : "Type how you want to appear on the people list. This is not a password."}
        </p>
      </div>

      {hasPeople && (
        <div
          className="rounded-xl border border-border bg-bg overflow-hidden divide-y divide-border"
          role="radiogroup"
          aria-label="People already on this group"
        >
          {people.map((p) => {
            const selected =
              identity === "pick" &&
              selectedName.toLowerCase() === p.name.toLowerCase();
            return (
              <button
                key={p.id + p.name}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onPickExisting(p.name)}
                className={[
                  "flex w-full items-center gap-3 px-3 py-3.5 text-left touch-manipulation min-h-12 transition-colors",
                  selected
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-surface-muted/60 text-text",
                ].join(" ")}
              >
                <span
                  className={[
                    "h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center",
                    selected
                      ? "border-primary bg-primary"
                      : "border-border bg-surface",
                  ].join(" ")}
                  aria-hidden
                >
                  {selected ? (
                    <span className="h-2 w-2 rounded-full bg-white" />
                  ) : null}
                </span>
                <span className="text-base font-medium">{p.name}</span>
              </button>
            );
          })}

          <button
            type="button"
            role="radio"
            aria-checked={identity === "new"}
            onClick={onChooseNew}
            className={[
              "flex w-full items-center gap-3 px-3 py-3.5 text-left touch-manipulation min-h-12 transition-colors",
              identity === "new"
                ? "bg-primary/10 text-primary"
                : "hover:bg-surface-muted/60 text-text",
            ].join(" ")}
          >
            <span
              className={[
                "h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center",
                identity === "new"
                  ? "border-primary bg-primary"
                  : "border-border bg-surface",
              ].join(" ")}
              aria-hidden
            >
              {identity === "new" ? (
                <span className="h-2 w-2 rounded-full bg-white" />
              ) : null}
            </span>
            <span className="text-base font-medium">Someone new…</span>
          </button>
        </div>
      )}

      {(identity === "new" || !hasPeople) && (
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">
            {hasPeople ? "Your name (new)" : "Your name"}
          </span>
          <input
            value={newName}
            onChange={(e) => onNewNameChange(e.target.value)}
            className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
            placeholder="How should the group see you?"
            maxLength={60}
            autoFocus
            autoComplete="name"
          />
          {hasPeople && (
            <p className="text-[11px] text-muted leading-relaxed">
              Use this if you are not on the list — or if every name is wrong
              and you want your correct spelling.
            </p>
          )}
        </label>
      )}
    </div>
  );
}

export function JoinSpaceModal({
  open,
  onClose,
  initialRaw = null,
}: JoinSpaceModalProps) {
  const navigate = useNavigate();
  const joinFromInvite = useAppStore((s) => s.joinFromInvite);
  const joinFromExport = useAppStore((s) => s.joinFromExport);
  const applyMemberJoin = useAppStore((s) => s.applyMemberJoin);
  const joinSpaceViaRelay = useAppStore((s) => s.joinSpaceViaRelay);

  const [step, setStep] = useState<Step>("input");
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<ParsedPackage | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [shortCodeJoin, setShortCodeJoin] = useState(false);
  const [resultSpaceId, setResultSpaceId] = useState<string | null>(null);
  const [alreadyHad, setAlreadyHad] = useState(false);
  const [historyImported, setHistoryImported] = useState(false);
  const [sessionsAdded, setSessionsAdded] = useState(0);
  const [joiner, setJoiner] = useState<Member | null>(null);
  const [confirmPayload, setConfirmPayload] =
    useState<MemberJoinPayload | null>(null);
  const [hostAddedName, setHostAddedName] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  /** People already on the group (from preview or invite package). */
  const [knownPeople, setKnownPeople] = useState<ListedPerson[]>([]);
  const [previewGroupName, setPreviewGroupName] = useState<string | null>(null);
  const [identity, setIdentity] = useState<IdentityChoice>("new");
  const [selectedExistingName, setSelectedExistingName] = useState("");
  const [newName, setNewName] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimer = useRef<number | null>(null);

  function resolvedJoinerName(): string {
    if (identity === "pick" && selectedExistingName.trim()) {
      return selectedExistingName.trim();
    }
    return newName.trim();
  }

  function resetIdentity(people: ListedPerson[] = []) {
    setKnownPeople(people);
    if (people.length > 0) {
      setIdentity("pick");
      setSelectedExistingName(people[0]!.name);
      setNewName("");
    } else {
      setIdentity("new");
      setSelectedExistingName("");
      setNewName("");
    }
  }

  function reset() {
    stopScan();
    setStep("input");
    setRaw("");
    setParsed(null);
    setSaving(false);
    setPreviewLoading(false);
    setShortCodeJoin(false);
    setResultSpaceId(null);
    setAlreadyHad(false);
    setHistoryImported(false);
    setSessionsAdded(0);
    setJoiner(null);
    setConfirmPayload(null);
    setHostAddedName(null);
    setPreviewGroupName(null);
    resetIdentity([]);
  }

  /** FAITH-7K2 style short codes (relay) — not a full offline package. */
  function looksLikeShortCode(text: string): boolean {
    const t = text.trim().toUpperCase().replace(/\s+/g, "");
    return /^[A-Z0-9]{3,8}-?[A-Z0-9]{2,6}$/.test(t) && !/DS[MX]?1\./i.test(text);
  }

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    if (initialRaw?.trim()) {
      setRaw(initialRaw);
      tryParse(initialRaw);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when opened / initialRaw changes
  }, [open, initialRaw]);

  function stopScan() {
    if (scanTimer.current != null) {
      window.clearInterval(scanTimer.current);
      scanTimer.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  async function startScan() {
    const Detector = (
      window as unknown as {
        BarcodeDetector?: new (opts: {
          formats: string[];
        }) => {
          detect: (
            source: ImageBitmapSource,
          ) => Promise<Array<{ rawValue: string }>>;
        };
      }
    ).BarcodeDetector;

    if (!Detector) {
      toast.message("Camera scan not available on this device", {
        description: "Paste the invite they sent or open their link instead.",
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setScanning(true);
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      const detector = new Detector({ formats: ["qr_code"] });
      scanTimer.current = window.setInterval(() => {
        const v = videoRef.current;
        if (!v || v.readyState < 2) return;
        void detector.detect(v).then((codes) => {
          const value = codes[0]?.rawValue?.trim();
          if (value) {
            stopScan();
            setRaw(value);
            tryParse(value);
          }
        });
      }, 500);
    } catch {
      toast.error("Could not open camera. Paste the invite message instead.");
      stopScan();
    }
  }

  function tryParse(text: string) {
    const kind = detectJoinPackageKind(text);
    try {
      if (kind === "member-join" || text.includes("DSM1.")) {
        const p = parseMemberJoinInput(text);
        setParsed({ kind: "member-join", payload: p });
        setShortCodeJoin(false);
        setPreviewGroupName(p.spaceName);
        resetIdentity([]);
        setStep("confirm");
        return;
      }
      if (kind === "export" || text.includes("DSX1.")) {
        const p = parseExportInput(text);
        setParsed({ kind: "export", payload: p });
        setShortCodeJoin(false);
        setPreviewGroupName(p.space.name);
        resetIdentity(uniquePeople(p.space.members ?? []));
        setStep("confirm");
        return;
      }
      const p = parseInviteInput(text);
      setParsed({ kind: "invite", payload: p });
      setShortCodeJoin(false);
      setPreviewGroupName(p.name);
      resetIdentity(uniquePeople(p.members ?? []));
      setStep("confirm");
    } catch (err) {
      try {
        const p = parseMemberJoinInput(text);
        setParsed({ kind: "member-join", payload: p });
        setShortCodeJoin(false);
        setPreviewGroupName(p.spaceName);
        resetIdentity([]);
        setStep("confirm");
        return;
      } catch {
        // continue
      }
      toast.error(err instanceof Error ? err.message : "Invalid invite");
    }
  }

  async function handleContinue(e: FormEvent) {
    e.preventDefault();
    const text = raw.trim();
    if (looksLikeShortCode(text) && !/DS1\.|DSX1\.|DSM1\./i.test(text)) {
      setShortCodeJoin(true);
      setParsed(null);
      setPreviewLoading(true);
      try {
        const preview = await previewRoom({ shortCode: text });
        setPreviewGroupName(preview.name);
        resetIdentity(uniquePeople(preview.members));
        setStep("confirm");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not find group");
        // Still allow free-name join if preview fails (older relay)
        setPreviewGroupName(null);
        resetIdentity([]);
        setStep("confirm");
      } finally {
        setPreviewLoading(false);
      }
      return;
    }
    setShortCodeJoin(false);
    tryParse(raw);
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();

    if (shortCodeJoin) {
      const name = resolvedJoinerName();
      if (!name) {
        toast.error(
          identity === "pick"
            ? "Choose your name on the list"
            : "Enter your name for the member list",
        );
        return;
      }
      setSaving(true);
      try {
        const { space, alreadyHad: had } = await joinSpaceViaRelay({
          shortCode: raw.trim(),
          displayName: name,
        });
        setResultSpaceId(space.id);
        setAlreadyHad(had);
        setHistoryImported(true);
        setSessionsAdded(space.sessions?.length ?? 0);
        setJoiner(null);
        setConfirmPayload(null);
        setStep("done");
        toast.success(had ? "Space updated from cloud join" : "Joined space");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not join");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!parsed) return;

    if (parsed.kind === "member-join") {
      setSaving(true);
      try {
        const { space, added } = await applyMemberJoin(parsed.payload);
        setResultSpaceId(space.id);
        setHostAddedName(parsed.payload.member.name);
        setStep("host-confirm-done");
        toast.success(
          added
            ? `Added ${parsed.payload.member.name} — member count updated`
            : `${parsed.payload.member.name} was already on this space`,
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not apply join");
      } finally {
        setSaving(false);
      }
      return;
    }

    const joinerName = resolvedJoinerName();
    if (!joinerName) {
      toast.error(
        identity === "pick"
          ? "Choose your name on the list"
          : "Enter your name for the member list",
      );
      return;
    }

    setSaving(true);
    try {
      if (parsed.kind === "invite") {
        const { space, alreadyHad: had, joiner: j } = await joinFromInvite({
          payload: parsed.payload,
          joinerName,
        });
        setResultSpaceId(space.id);
        setAlreadyHad(had);
        setHistoryImported(false);
        setSessionsAdded(0);
        setJoiner(j);
        if (j) {
          setConfirmPayload(
            buildMemberJoinPayload({
              spaceId: space.id,
              code: space.inviteCode || parsed.payload.code,
              spaceName: space.name,
              member: j,
            }),
          );
        }
        setStep("done");
        if (had) {
          toast.message("You already have this space", {
            description:
              "Opened your local copy — past sessions stay as they were.",
          });
        } else {
          toast.success("Joined space");
        }
      } else {
        const result = await joinFromExport({
          payload: parsed.payload,
          joinerName,
        });
        setResultSpaceId(result.space.id);
        setAlreadyHad(result.alreadyHad);
        setHistoryImported(true);
        setSessionsAdded(result.addedSessions);
        setJoiner(result.joiner);
        if (result.joiner) {
          setConfirmPayload(
            buildMemberJoinPayload({
              spaceId: result.space.id,
              code:
                result.space.inviteCode ||
                parsed.payload.space.inviteCode ||
                "",
              spaceName: result.space.name,
              member: result.joiner,
            }),
          );
        }
        setStep("done");
        toast.success(
          result.addedSessions > 0
            ? `Joined with ${result.addedSessions} session${result.addedSessions === 1 ? "" : "s"} imported`
            : result.alreadyHad
              ? "Space updated"
              : "Joined space",
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not join");
    } finally {
      setSaving(false);
    }
  }

  async function shareJoinConfirm() {
    if (!confirmPayload) return;
    const text = formatMemberJoinShareText(confirmPayload);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `I'm in — ${confirmPayload.spaceName}`,
          text,
        });
        return;
      } catch {
        // fall through
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Join confirmation copied — send it to the host");
    } catch {
      toast.error("Could not copy confirmation");
    }
  }

  function handleClose() {
    stopScan();
    onClose();
  }

  const confirmTitle = shortCodeJoin
    ? "Join with code"
    : parsed?.kind === "member-join"
      ? "Add member on this device"
      : parsed?.kind === "export"
        ? "Join with history"
        : "You are joining";

  const needsWhoAreYou =
    shortCodeJoin ||
    parsed?.kind === "invite" ||
    parsed?.kind === "export";

  return (
    <Modal open={open} title="Join a group" onClose={handleClose}>
      {step === "input" && (
        <form onSubmit={(e) => void handleContinue(e)} className="space-y-4">
          <p className="text-sm text-muted -mt-1">
            Enter the code your host shared, open their invite link, or scan
            their QR. Same website they use — usually disciple-spaces.pages.dev.
          </p>

          <ConnectSafelyDisclosure
            audience="guest"
            label="How to join safely (won’t touch your other groups)"
          />

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Code or invite</span>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-sm min-h-[120px] resize-y font-mono"
              placeholder="Join code, or paste the invite they sent"
              autoFocus
            />
          </label>

          {scanning ? (
            <div className="space-y-2">
              <video
                ref={videoRef}
                className="w-full rounded-xl border border-border bg-black aspect-square object-cover"
                muted
                playsInline
              />
              <Button type="button" variant="secondary" fullWidth onClick={stopScan}>
                Stop camera
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => void startScan()}
            >
              <Camera className="h-5 w-5" aria-hidden />
              Scan QR code
            </Button>
          )}

          <p className="text-xs text-muted">{INVITE_PRIVACY_NOTE}</p>

          <div className="flex gap-2">
            <Button type="button" variant="secondary" fullWidth onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              fullWidth
              disabled={!raw.trim() || previewLoading}
            >
              {previewLoading ? "Looking up group…" : "Continue"}
            </Button>
          </div>
        </form>
      )}

      {step === "confirm" && (shortCodeJoin || parsed) && (
        <form onSubmit={(e) => void handleJoin(e)} className="space-y-4">
          <div className="rounded-xl border border-border bg-bg px-3 py-3 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {confirmTitle}
            </p>
            {shortCodeJoin ? (
              <>
                <p className="text-lg font-semibold text-primary">
                  {previewGroupName || "Connected group"}
                </p>
                <p className="text-sm font-mono tracking-wide text-muted">
                  Code {raw.trim().toUpperCase()}
                </p>
                <p className="text-sm text-muted">
                  You’ll join this group only. Other Spaces on your phone stay
                  as they are. Private notes never come with a join — and you
                  should not tap Connect after this (your host already did).
                </p>
              </>
            ) : parsed?.kind === "member-join" ? (
              <>
                <p className="text-lg font-semibold text-primary">
                  {parsed.payload.member.name}
                </p>
                <p className="text-sm text-muted">
                  wants to join{" "}
                  <strong className="text-text">{parsed.payload.spaceName}</strong>
                </p>
                <p className="text-xs text-muted">Code {parsed.payload.code}</p>
              </>
            ) : parsed?.kind === "invite" ? (
              <>
                <p className="text-lg font-semibold text-primary">
                  {parsed.payload.name}
                </p>
                {parsed.payload.description && (
                  <p className="text-sm text-muted">{parsed.payload.description}</p>
                )}
                <p className="text-xs text-muted">Code {parsed.payload.code}</p>
              </>
            ) : parsed?.kind === "export" ? (
              <>
                <p className="text-lg font-semibold text-primary">
                  {parsed.payload.space.name}
                </p>
                <p className="text-sm text-muted">
                  {parsed.payload.sessions.length} session
                  {parsed.payload.sessions.length === 1 ? "" : "s"}
                  {(parsed.payload.prayerBoard?.length ?? 0) > 0
                    ? ` · ${parsed.payload.prayerBoard!.length} prayer board entr${parsed.payload.prayerBoard!.length === 1 ? "y" : "ies"}`
                    : ""}
                </p>
              </>
            ) : null}
          </div>

          {needsWhoAreYou && (
            <WhoAreYouPicker
              people={knownPeople}
              groupLabel={previewGroupName || undefined}
              identity={identity}
              selectedName={selectedExistingName}
              newName={newName}
              onPickExisting={(name) => {
                setIdentity("pick");
                setSelectedExistingName(name);
              }}
              onChooseNew={() => {
                setIdentity("new");
                setSelectedExistingName("");
              }}
              onNewNameChange={setNewName}
            />
          )}

          <div className="rounded-xl bg-surface-muted/60 border border-border px-3 py-3 text-sm text-muted space-y-2">
            {shortCodeJoin ? (
              <p>
                You’ll join when Online and the host has Connect turned on. If
                that fails, ask them to show the QR instead.
              </p>
            ) : parsed?.kind === "member-join" ? (
              <p>
                This only updates the people list on <em>this</em> phone (the
                host). It doesn’t re-send past meetings.
              </p>
            ) : parsed?.kind === "export" ? (
              <p>
                This includes past shared meetings and prayer notes. Notes
                marked “Just for me” are never imported.
              </p>
            ) : (
              <p>{INVITE_HISTORY_NOTE}</p>
            )}
            <p className="text-xs">{INVITE_SYNC_NOTE}</p>
            <p className="text-xs">{INVITE_PRIVACY_NOTE}</p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => setStep("input")}
              disabled={saving}
            >
              Back
            </Button>
            <Button type="submit" fullWidth disabled={saving}>
              {saving
                ? "Working…"
                : shortCodeJoin
                  ? "Join with code"
                  : parsed?.kind === "member-join"
                    ? "Add to my list"
                    : parsed?.kind === "export"
                      ? "Join & import meetings"
                      : "Join group"}
            </Button>
          </div>
        </form>
      )}

      {step === "done" && resultSpaceId && (
        <div className="space-y-4 text-center">
          <CheckCircle2
            className="h-12 w-12 mx-auto text-success"
            aria-hidden
          />
          <div className="space-y-2">
            <p className="font-medium text-primary text-lg">
              {alreadyHad ? "Space already on this device" : "You're in"}
            </p>
            <p className="text-sm text-muted">
              {historyImported
                ? sessionsAdded > 0
                  ? `Imported ${sessionsAdded} session${sessionsAdded === 1 ? "" : "s"}. You can take part going forward on this device.`
                  : "History package applied. Sessions already on this device were kept."
                : alreadyHad
                  ? "We opened your existing local copy. Past sessions were not overwritten."
                  : "You can take part in current and future sessions on this device."}
            </p>
            {!historyImported && (
              <p className="text-xs text-muted">
                Past history can still be imported if someone shares a Space
                Update (DSX1.) with you.
              </p>
            )}
          </div>

          {confirmPayload && joiner && (
            <div className="rounded-xl border border-border bg-bg px-3 py-3 text-left space-y-2">
              <p className="text-sm font-medium text-text">
                Tell the host you joined
              </p>
              <p className="text-xs text-muted">
                Their phone will not update automatically. Send this so their
                Attendees count shows you (e.g. 2/5).
              </p>
              <div className="flex flex-col gap-2">
                <Button fullWidth onClick={() => void shareJoinConfirm()}>
                  <Share2 className="h-5 w-5" aria-hidden />
                  Send “I&apos;m in” to host
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        formatMemberJoinShareText(confirmPayload),
                      );
                      toast.success("Confirmation copied");
                    } catch {
                      toast.error("Could not copy");
                    }
                  }}
                >
                  <Copy className="h-5 w-5" aria-hidden />
                  Copy confirmation
                </Button>
              </div>
            </div>
          )}

          <Button
            fullWidth
            onClick={() => {
              handleClose();
              navigate(`/spaces/${resultSpaceId}`);
            }}
          >
            Open group
          </Button>
          <Button variant="secondary" fullWidth onClick={handleClose}>
            Done
          </Button>
        </div>
      )}

      {step === "host-confirm-done" && (
        <div className="space-y-4 text-center">
          <CheckCircle2
            className="h-12 w-12 mx-auto text-success"
            aria-hidden
          />
          <p className="font-medium text-primary text-lg">
            {hostAddedName
              ? `${hostAddedName} is on your list`
              : "Member list updated"}
          </p>
          <p className="text-sm text-muted">
            Headcount on this phone is up to date. Share meetings with Sync or a
            group file when you want history on their device.
          </p>
          {resultSpaceId && (
            <Button
              fullWidth
              onClick={() => {
                handleClose();
                navigate(`/spaces/${resultSpaceId}`);
              }}
            >
              Open group
            </Button>
          )}
          <Button variant="secondary" fullWidth onClick={handleClose}>
            Done
          </Button>
        </div>
      )}
    </Modal>
  );
}
