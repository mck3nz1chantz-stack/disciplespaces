import { useState, type FormEvent, type KeyboardEvent } from "react";
import { format, parseISO } from "date-fns";
import { Pencil, Plus, Trash2, UserPlus, X } from "lucide-react";
import type { Member } from "../types";
import { MAX_MEMBERS_GROUP } from "../types";
import { createMember } from "../lib/db";
import { Button } from "./Button";

interface MemberEditorProps {
  members: Member[];
  onChange: (members: Member[]) => void;
  /** Show joined dates (edit flow). Hidden for brand-new members in create. */
  showJoinedDates?: boolean;
  disabled?: boolean;
  /** Capacity — 5 for Group, 10 for Family. */
  maxMembers?: number;
  /** Optional capacity context label (e.g. "Family"). */
  kindLabel?: string;
}

/**
 * Guided list editor for Space members.
 * Supports add, rename, remove with clear capacity messaging.
 */
export function MemberEditor({
  members,
  onChange,
  showJoinedDates = false,
  disabled = false,
  maxMembers = MAX_MEMBERS_GROUP,
  kindLabel,
}: MemberEditorProps) {
  const [draftName, setDraftName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const atCapacity = members.length >= maxMembers;
  const remaining = maxMembers - members.length;

  function handleAdd(e?: FormEvent) {
    e?.preventDefault();
    const name = draftName.trim();
    if (!name || atCapacity || disabled) return;
    onChange([...members, createMember(name)]);
    setDraftName("");
  }

  function handleAddKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  function startEdit(member: Member) {
    setEditingId(member.id);
    setEditName(member.name);
  }

  function commitEdit() {
    if (!editingId) return;
    const name = editName.trim();
    if (!name) {
      setEditingId(null);
      return;
    }
    onChange(
      members.map((m) => (m.id === editingId ? { ...m, name } : m)),
    );
    setEditingId(null);
    setEditName("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  function remove(id: string) {
    onChange(members.filter((m) => m.id !== id));
    if (editingId === id) cancelEdit();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">Members</span>
        <span className="text-xs text-muted">
          {members.length}/{maxMembers}
          {remaining > 0
            ? ` · ${remaining} slot${remaining === 1 ? "" : "s"} left`
            : " · full"}
        </span>
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-muted rounded-xl bg-surface-muted/60 px-3 py-3">
          Add the people in this space (up to {maxMembers}
          {kindLabel ? ` for ${kindLabel}` : ""}). Names only — no accounts
          needed.
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Current members">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2"
            >
              {editingId === member.id ? (
                <>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitEdit();
                      }
                      if (e.key === "Escape") cancelEdit();
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-2 text-base"
                    maxLength={60}
                    autoFocus
                    aria-label="Edit member name"
                    disabled={disabled}
                  />
                  <Button
                    type="button"
                    variant="primary"
                    className="!px-3 !py-2 shrink-0"
                    onClick={commitEdit}
                    disabled={disabled || !editName.trim()}
                  >
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="!p-2 shrink-0"
                    onClick={cancelEdit}
                    aria-label="Cancel edit"
                    disabled={disabled}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </Button>
                </>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{member.name}</p>
                    {showJoinedDates && (
                      <p className="text-xs text-muted">
                        Joined {formatJoined(member.joinedAt)}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="!p-2 shrink-0"
                    onClick={() => startEdit(member)}
                    aria-label={`Edit ${member.name}`}
                    disabled={disabled}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="!p-2 shrink-0 text-danger"
                    onClick={() => remove(member.id)}
                    aria-label={`Remove ${member.name}`}
                    disabled={disabled}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {atCapacity ? (
        <p className="text-sm text-muted rounded-xl border border-border bg-surface-muted/50 px-3 py-3">
          {kindLabel === "Family"
            ? `Family spaces hold up to ${maxMembers} people. Remove someone to add another.`
            : `Spaces stay personal on purpose — max ${maxMembers} members. Remove someone to add another.`}
        </p>
      ) : (
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="member-add-input">
            Add member name
          </label>
          <input
            id="member-add-input"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={handleAddKey}
            className="min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 py-3 text-base"
            placeholder="Member name"
            maxLength={60}
            disabled={disabled}
            autoComplete="name"
          />
          <Button
            type="button"
            variant="secondary"
            className="shrink-0"
            onClick={() => handleAdd()}
            disabled={disabled || !draftName.trim()}
            aria-label="Add member"
          >
            <UserPlus className="h-5 w-5 sm:hidden" aria-hidden />
            <Plus className="h-4 w-4 hidden sm:inline" aria-hidden />
            <span className="hidden sm:inline">Add</span>
          </Button>
        </div>
      )}
    </div>
  );
}

function formatJoined(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d, yyyy");
  } catch {
    return iso.slice(0, 10);
  }
}
