import { Lock } from "lucide-react";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { PrivateNotesEditor } from "./PrivateNotesEditor";

interface PrivateNotesModalProps {
  open: boolean;
  onClose: () => void;
  spaceId: string;
  /** When set, notes are scoped to this session. */
  sessionId?: string;
  /** Optional template step / section id. */
  sectionKey?: string;
  title?: string;
  description?: string;
}

/**
 * Device-local private note log (timestamped entries).
 * Never exported with Space Update packages.
 * Prefer SessionPrivateDrawer inside session modals; this remains for Space-level notes.
 */
export function PrivateNotesModal({
  open,
  onClose,
  spaceId,
  sessionId,
  sectionKey,
  title = "Private notes",
  description,
}: PrivateNotesModalProps) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="space-y-4">
        <PrivateNotesEditor
          spaceId={spaceId}
          sessionId={sessionId}
          sectionKey={sectionKey}
          description={
            description ??
            "Only on this device. Private notes are never included when you share a Space Update."
          }
        />
        <Button variant="secondary" fullWidth onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}

/** Compact trigger button for opening private notes. */
export function PrivateNotesButton({
  count,
  onClick,
  disabled,
  label = "Private",
}: {
  count?: number;
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={onClick}
      disabled={disabled}
      aria-label={
        count && count > 0
          ? `${label} notes, ${count} saved`
          : `${label} notes`
      }
    >
      <Lock className="h-4 w-4" aria-hidden />
      {label}
      {typeof count === "number" && count > 0 ? (
        <span className="ml-0.5 tabular-nums text-xs text-muted">
          ({count})
        </span>
      ) : null}
    </Button>
  );
}
