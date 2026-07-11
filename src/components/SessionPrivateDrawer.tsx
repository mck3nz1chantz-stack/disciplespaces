import { Lock } from "lucide-react";
import type { Template } from "../types";
import {
  resolveSessionSection,
  SECTION_GENERAL,
} from "../lib/sessionSections";
import { Button } from "./Button";
import { PrivateNotesEditor } from "./PrivateNotesEditor";

interface SessionPrivateDrawerProps {
  open: boolean;
  onClose: () => void;
  spaceId: string;
  sessionId: string | undefined;
  template?: Template | null;
  /**
   * Locked to the Session section the user is on (scroll/focus spy).
   * Not a picker — mirrors Session pace.
   */
  lockedSectionKey: string;
  needsSave?: boolean;
}

/**
 * Private notes for the scroll-locked session section only.
 * No section list — switch tabs to keep pace with Session.
 */
export function SessionPrivateDrawer({
  open,
  onClose,
  spaceId,
  sessionId,
  template,
  lockedSectionKey,
  needsSave = false,
}: SessionPrivateDrawerProps) {
  const section = resolveSessionSection(
    lockedSectionKey,
    template?.steps ?? [],
  );

  if (!open) return null;

  return (
    <div
      className="flex flex-col bg-surface pb-2"
      role="region"
      aria-label={`Private notes for ${section.label}`}
    >
      <div className="flex items-start justify-between gap-2 border-b border-border pb-3 mb-3 shrink-0">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary flex items-center gap-1.5">
            <Lock className="h-4 w-4 shrink-0" aria-hidden />
            Private · {section.label}
          </p>
          <p className="text-xs text-muted mt-0.5">
            Locked to the same place as Session. Device-only · never exported.
            Switch tabs anytime to keep going.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="!px-2.5 !py-2 shrink-0 text-xs"
          onClick={onClose}
        >
          Session
        </Button>
      </div>

      {needsSave || !sessionId ? (
        <div className="rounded-xl border border-border bg-surface-muted/50 px-3 py-4 text-sm text-muted space-y-2">
          <p className="font-medium text-primary">Starting meeting…</p>
          <p className="text-xs leading-relaxed">
            Private notes unlock as soon as this session is ready.
          </p>
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>
            Back to session
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {section.hint && (
            <p className="text-sm text-muted rounded-xl bg-primary/5 border border-primary/10 px-3 py-2.5">
              {section.hint}
            </p>
          )}
          <PrivateNotesEditor
            key={section.key}
            spaceId={spaceId}
            sessionId={sessionId}
            sectionKey={section.privateSectionKey}
            generalOnly={
              section.key === SECTION_GENERAL || !section.privateSectionKey
            }
            compact
            description="Only on this device. Never included in Space Updates."
            placeholder={
              section.key === SECTION_GENERAL
                ? 'e.g. "Prayed for John today"'
                : `Private note for ${section.label}…`
            }
          />
        </div>
      )}
    </div>
  );
}
