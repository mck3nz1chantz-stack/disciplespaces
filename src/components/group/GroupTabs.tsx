import { useRef, type KeyboardEvent } from "react";
import { GROUP_TABS, type GroupTab } from "../../lib/groupTab";

export function GroupTabs({
  tab,
  onChange,
}: {
  tab: GroupTab;
  onChange: (tab: GroupTab) => void;
}) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  function move(index: number, event: KeyboardEvent<HTMLButtonElement>) {
    const last = GROUP_TABS.length - 1;
    let next = index;
    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    const id = GROUP_TABS[next]!.id;
    onChange(id);
    buttons.current[next]?.focus();
  }

  return (
    <div
      className="grid grid-cols-4 gap-1 rounded-2xl border border-border bg-surface/95 p-1"
      role="tablist"
      aria-label="This study"
    >
      {GROUP_TABS.map((item, index) => {
        const selected = tab === item.id;
        return (
          <button
            key={item.id}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`group-tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`group-panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => move(index, event)}
            className={[
              "min-h-11 rounded-xl px-1 text-sm font-semibold touch-manipulation",
              selected
                ? "bg-primary text-on-primary"
                : "text-muted hover:text-primary",
            ].join(" ")}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
