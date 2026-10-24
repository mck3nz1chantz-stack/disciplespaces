import { Plus, UserPlus, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { Member } from "../../types";
import { MemberChip } from "../MemberChip";

export function PeopleRow({
  members,
  canAdd,
  onAdd,
  onRemove,
  onEdit,
  onShare,
  adding,
}: {
  members: Member[];
  canAdd: boolean;
  onAdd: () => void;
  onRemove: (memberId: string) => void;
  onEdit?: () => void;
  onShare?: () => void;
  adding?: ReactNode;
}) {
  return (
    <section className="space-y-2.5" aria-label="Who is here">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-primary flex items-center gap-1.5">
          <Users className="h-4 w-4" aria-hidden />
          Who’s here
        </h3>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs font-medium text-primary touch-manipulation tap-target px-2"
          >
            Edit list
          </button>
        ) : null}
      </div>
      {adding}
      <div className="flex flex-wrap gap-2">
        {members.map((member) => (
          <MemberChip
            key={member.id}
            name={member.name}
            onRemove={() => onRemove(member.id)}
          />
        ))}
        {canAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-dashed border-primary/40 bg-primary/5 px-3.5 py-2.5 text-sm font-medium text-primary touch-manipulation"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add person
          </button>
        )}
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-primary/30 bg-primary text-on-primary px-3.5 py-2.5 text-sm font-medium touch-manipulation active:scale-[0.98]"
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            Share the group
          </button>
        )}
      </div>
    </section>
  );
}
