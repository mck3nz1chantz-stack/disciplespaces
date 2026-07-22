/**
 * Plain-language guide: how to Connect / Join / Sync without
 * double-connecting or worrying about other groups on the phone.
 */

import { useState, type ReactNode } from "react";
import {
  ChevronDown,
  CircleAlert,
  Cloud,
  HelpCircle,
  Lock,
  Smartphone,
  UserPlus,
  Users,
} from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";

export type ConnectGuideAudience = "host" | "guest" | "both";

export interface ConnectStep {
  n: number;
  title: string;
  detail: string;
  who: "host" | "guest" | "both";
}

/** Canonical steps — online-first room key model. */
export const CONNECT_SAFELY_STEPS: ConnectStep[] = [
  {
    n: 1,
    title: "Host opens the group room",
    detail:
      "Creating a group (or “Open group room”) gives you a room key (like ABCD-EF). You are the host. Only you open the room, rename the group, and manage who’s here — friends never create a second room.",
    who: "host",
  },
  {
    n: 2,
    title: "Share the room key",
    detail:
      "Copy or Invite with that key. Guests need the room key from the host’s group card — not a second “Open group room” on their phone.",
    who: "host",
  },
  {
    n: 3,
    title: "Guests only Join",
    detail:
      "Same website → Join a group → room key + name. One join links their phone to your room. Guests cannot edit the title or people list.",
    who: "guest",
  },
  {
    n: 4,
    title: "Sync when Online",
    detail:
      "After you’re linked, tap Sync (guests see a large Sync card on the group page). Host Syncs after changing people or meetings; guests Sync to pull those updates. Offline mode pauses refresh; Private notes stay on-device.",
    who: "both",
  },
];

export const CONNECT_SAFELY_DONT = [
  "Guests: only Join with the host’s room key — never open a second room.",
  "Guests: do not edit the people list or group title — ask the host, then Sync.",
  "One room per group. The server reuses the same room for the group id.",
  "Always use https://disciple-spaces.pages.dev (same site as the host).",
  "Joining one group does not delete or change your other Spaces.",
] as const;

/** Shown when explaining the “two rooms” failure mode. */
export const DOUBLE_ROOM_FIX = [
  "Symptom: you both “have the group” but Sync fails or data doesn’t match.",
  "Cause: two cloud rooms were opened for one group (old Connect-on-both-phones path).",
  "Now: one room key per group; host opens once; guests only Join + Sync; server reuses the room.",
  "Stuck now: host taps New room key (keep members) or Syncs, shares the current key; guest Joins that key again, then Sync.",
] as const;

function StepList({
  audience = "both",
  compact = false,
}: {
  audience?: ConnectGuideAudience;
  compact?: boolean;
}) {
  const steps =
    audience === "both"
      ? CONNECT_SAFELY_STEPS
      : CONNECT_SAFELY_STEPS.filter(
          (s) => s.who === audience || s.who === "both",
        );

  return (
    <ol className={compact ? "space-y-2.5" : "space-y-3"}>
      {steps.map((step) => (
        <li key={step.n} className="flex gap-3">
          <span
            className={[
              "shrink-0 flex items-center justify-center rounded-full bg-primary text-on-primary font-semibold tabular-nums",
              compact ? "h-7 w-7 text-xs" : "h-8 w-8 text-sm",
            ].join(" ")}
            aria-hidden
          >
            {step.n}
          </span>
          <div className="min-w-0 pt-0.5">
            <p
              className={
                compact
                  ? "text-sm font-semibold text-primary leading-snug"
                  : "text-base font-semibold text-primary leading-snug"
              }
            >
              {step.title}
            </p>
            <p
              className={
                compact
                  ? "text-xs text-muted mt-0.5 leading-relaxed"
                  : "text-sm text-muted mt-1 leading-relaxed"
              }
            >
              {step.detail}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function SafetyNotes({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={[
        "rounded-xl border border-border bg-bg space-y-2",
        compact ? "px-3 py-2.5" : "px-3 py-3",
      ].join(" ")}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted flex items-center gap-1.5">
        <Lock className="h-3.5 w-3.5" aria-hidden />
        Your other groups stay safe
      </p>
      <ul className="space-y-1.5">
        {CONNECT_SAFELY_DONT.map((line) => (
          <li
            key={line}
            className="text-xs text-muted leading-relaxed flex gap-2"
          >
            <CircleAlert
              className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-700 dark:text-amber-300"
              aria-hidden
            />
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted leading-relaxed pt-0.5 flex gap-2">
        <Smartphone className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
        <span>
          Private notes (“Just for me”) never leave this phone. Connect only
          shares meetings, people, and the prayer board for that one group.
        </span>
      </p>
    </div>
  );
}

/**
 * Full-screen modal with step-by-step connect guide.
 * Optional primary action (e.g. “Connect this group”).
 */
export function ConnectSafelyModal({
  open,
  onClose,
  audience = "both",
  title = "Connect safely",
  primaryLabel,
  onPrimary,
  primaryBusy = false,
}: {
  open: boolean;
  onClose: () => void;
  audience?: ConnectGuideAudience;
  title?: string;
  primaryLabel?: string;
  onPrimary?: () => void | Promise<void>;
  primaryBusy?: boolean;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted -mt-1 leading-relaxed">
          Simple way for two phones to share one group — without touching anyone
          else’s Spaces on the device.
        </p>

        <div className="flex flex-wrap gap-2 text-[11px] font-medium">
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-primary">
            <Users className="h-3 w-3" aria-hidden />
            Host opens room once
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-primary">
            <UserPlus className="h-3 w-3" aria-hidden />
            Friend joins with room key
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-primary">
            <Cloud className="h-3 w-3" aria-hidden />
            Both Sync when Online
          </span>
        </div>

        <StepList audience={audience} />
        <SafetyNotes />

        <div className="flex flex-col gap-2 pt-1">
          {primaryLabel && onPrimary ? (
            <Button
              fullWidth
              className="!py-3.5"
              disabled={primaryBusy}
              onClick={() => void onPrimary()}
            >
              {primaryBusy ? "Working…" : primaryLabel}
            </Button>
          ) : null}
          <Button
            fullWidth
            variant={primaryLabel ? "secondary" : "primary"}
            onClick={onClose}
          >
            {primaryLabel ? "Not now" : "Got it"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Collapsible “How this works” block for Invite / Join modals.
 */
export function ConnectSafelyDisclosure({
  audience = "both",
  defaultOpen = false,
  label = "How to connect safely",
}: {
  audience?: ConnectGuideAudience;
  defaultOpen?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-border bg-surface-muted/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left touch-manipulation min-h-11"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-primary inline-flex items-center gap-2">
          <HelpCircle className="h-4 w-4 shrink-0" aria-hidden />
          {label}
        </span>
        <ChevronDown
          className={[
            "h-5 w-5 text-muted transition-transform shrink-0",
            open ? "rotate-180" : "",
          ].join(" ")}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="px-3 pb-3 space-y-3 border-t border-border/60 pt-3">
          <StepList audience={audience} compact />
          <SafetyNotes compact />
        </div>
      ) : null}
    </div>
  );
}

/** Small text button that opens the full guide modal (parent owns open state). */
export function ConnectSafelyHelpButton({
  onClick,
  children = "How to connect safely",
}: {
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-semibold text-primary underline underline-offset-2 touch-manipulation inline-flex items-center gap-1 min-h-10 py-1"
    >
      <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {children}
    </button>
  );
}
