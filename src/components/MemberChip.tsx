import { X } from "lucide-react";

/** A person on this phone’s list, with a one-tap remove. */
export function MemberChip({
  name,
  onRemove,
}: {
  name: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex max-w-full min-h-11 items-center rounded-full border border-border bg-surface pl-3.5 text-sm font-medium text-primary">
      <span className="truncate">{name}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${name}`}
        className="ml-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted touch-manipulation hover:text-danger"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </span>
  );
}
