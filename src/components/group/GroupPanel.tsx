import type { ReactNode } from "react";
import { ChevronDown, Layers, Pencil, Share2, Trash2 } from "lucide-react";
import { Button } from "../Button";
import { InlineRename } from "../InlineRename";
import { StudyColorControl } from "../StudyColorControl";
import { GroupLinkBadge } from "../GroupLinkBadge";
import { OfflineIndicator } from "../OfflineIndicator";
import { GroupShareActions } from "../GroupShareActions";
import { SpaceConnectionBar } from "../SpaceConnectionBar";
import { YourDataBundle } from "../YourDataBundle";
import {
  SPACE_TEMPLATES,
  type SpaceTemplateId,
} from "../../lib/spaceTemplates";
import type { OnlineMode } from "../../lib/onlineMode";
import type { Space } from "../../types";

export function GroupPanel({
  space,
  isGuest,
  isHost,
  allowDelete,
  onlineMode,
  sharingOpen,
  onToggleSharing,
  moreOpen,
  onToggleMore,
  viewMode,
  onSwitchMode,
  modeCounts,
  sessionCount,
  passageCount,
  renaming,
  onStartRename,
  onSaveName,
  onCancelRename,
  onEditDetails,
  onAboutStyles,
  onDelete,
  sharingStartsOpen,
  people,
  onBackup,
}: {
  space: Space;
  isGuest: boolean;
  isHost: boolean;
  allowDelete: boolean;
  onlineMode: OnlineMode;
  sharingOpen: boolean;
  onToggleSharing: () => void;
  moreOpen: boolean;
  onToggleMore: () => void;
  viewMode: SpaceTemplateId | "all";
  onSwitchMode: (mode: SpaceTemplateId | "all") => void;
  modeCounts: Record<SpaceTemplateId, number>;
  sessionCount: number;
  passageCount: number;
  renaming: boolean;
  onStartRename: () => void;
  onSaveName: (name: string) => Promise<void> | void;
  onCancelRename: () => void;
  onEditDetails: () => void;
  onAboutStyles: () => void;
  onDelete: () => void;
  sharingStartsOpen: boolean;
  people: ReactNode;
  onBackup: () => void;
}) {
  return (
    <div
      className="space-y-5"
      role="tabpanel"
      id="group-panel-group"
      aria-labelledby="group-tab-group"
    >
      <div className="space-y-2">
        {renaming ? (
          <InlineRename
            name={space.name}
            onSave={onSaveName}
            onCancel={onCancelRename}
          />
        ) : (
          <h2 className="text-2xl leading-tight tracking-tight">{space.name}</h2>
        )}
        {space.description ? (
          <p className="text-sm text-muted">{space.description}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <StudyColorControl space={space} />
          <Button
            id="group-rename-button"
            variant="secondary"
            className="!py-2 !px-3 text-sm"
            onClick={onStartRename}
          >
            <Pencil className="h-4 w-4" aria-hidden />
            Rename
          </Button>
          {isHost && (
            <Button
              variant="secondary"
              className="!py-2 !px-3 text-sm"
              onClick={onEditDetails}
            >
              Edit details
            </Button>
          )}
          {allowDelete && (
            <Button
              variant="ghost"
              className="!p-2 text-danger"
              onClick={onDelete}
              aria-label={isGuest ? "Remove group from this device" : "Delete group"}
            >
              <Trash2 className="h-5 w-5" aria-hidden />
            </Button>
          )}
        </div>
      </div>

      {people}

      <section
        id="group-sync"
        className="scroll-mt-24 rounded-2xl border border-border bg-surface px-3 py-2"
      >
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 py-2 text-left touch-manipulation"
          aria-expanded={sharingOpen}
          onClick={onToggleSharing}
        >
          <span className="text-sm font-semibold text-primary">Group sharing</span>
          <ChevronDown
            className={[
              "h-4 w-4 text-muted transition-transform",
              sharingOpen ? "rotate-180" : "",
            ].join(" ")}
            aria-hidden
          />
        </button>
        {sharingOpen && (
          <div className="space-y-3 border-t border-border/70 pt-3 pb-2">
            <p className="text-xs text-muted leading-relaxed">
              Online or Offline applies to every group. A group that is already
              connected still syncs.
            </p>
            <GroupLinkBadge sync={space.sync} onlineMode={onlineMode} size="md" />
            <OfflineIndicator />
            <GroupShareActions space={space} isHost={isHost} />
            <SpaceConnectionBar
              space={space}
              defaultExpanded={sharingStartsOpen}
              expandSignal={0}
            />
          </div>
        )}
      </section>

      <section id="group-more" className="border-t border-border pt-3 space-y-3 scroll-mt-24">
        <button
          type="button"
          onClick={onToggleMore}
          className="flex w-full items-center justify-between gap-2 rounded-xl px-1 py-2 text-left touch-manipulation tap-target"
          aria-expanded={moreOpen}
        >
          <span className="text-sm font-semibold text-muted">
            More · meeting style, save, invite tools
          </span>
          <ChevronDown
            className={[
              "h-5 w-5 shrink-0 text-muted transition-transform",
              moreOpen ? "rotate-180" : "",
            ].join(" ")}
            aria-hidden
          />
        </button>
        {moreOpen && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-1.5">
                  <Layers className="h-4 w-4" aria-hidden />
                  Meeting style filter
                </h4>
                <button
                  type="button"
                  onClick={onAboutStyles}
                  className="text-xs text-primary font-medium touch-manipulation"
                >
                  About styles
                </button>
              </div>
              <p className="text-xs text-muted">
                Optional: filter past meetings. New meetings use your group’s
                default style.
              </p>
              <div
                className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5"
                role="tablist"
                aria-label="Filter meetings by style"
              >
                <ModeChip
                  label="All"
                  count={sessionCount}
                  selected={viewMode === "all"}
                  onClick={() => onSwitchMode("all")}
                />
                {SPACE_TEMPLATES.map((tpl) => (
                  <ModeChip
                    key={tpl.id}
                    label={tpl.shortLabel}
                    count={modeCounts[tpl.id]}
                    selected={viewMode === tpl.id}
                    onClick={() => onSwitchMode(tpl.id)}
                  />
                ))}
              </div>
              <p className="text-xs text-muted tabular-nums">
                {sessionCount} meeting
                {sessionCount === 1 ? "" : "s"}
                {passageCount > 0
                  ? ` · ${passageCount} passage${passageCount === 1 ? "" : "s"} logged`
                  : ""}
              </p>
            </div>
            <Button variant="secondary" fullWidth onClick={onBackup}>
              <Share2 className="h-4 w-4" aria-hidden />
              Save a copy is under More
            </Button>
            <YourDataBundle
              focusSpaceId={space.id}
              spaceCount={1}
              onBackup={onBackup}
              onImport={onBackup}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function ModeChip({
  label,
  count,
  selected,
  onClick,
}: {
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={[
        "shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-semibold touch-manipulation tap-target border transition-colors",
        selected
          ? "border-primary bg-primary text-on-primary"
          : "border-border bg-bg text-primary hover:border-primary/40",
      ].join(" ")}
    >
      {label}
      {count > 0 && (
        <span
          className={[
            "tabular-nums text-[10px] font-medium",
            selected ? "text-on-primary/80" : "text-muted",
          ].join(" ")}
        >
          {count}
        </span>
      )}
    </button>
  );
}
