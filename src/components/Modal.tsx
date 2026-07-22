import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "./Button";

export interface ModalTab {
  id: string;
  label: string;
  badge?: number;
}

interface ModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  /** When true, only close via primary actions (e.g. legal ack). */
  dismissible?: boolean;
  /** Optional tab strip under the title (e.g. Session | Private). */
  tabs?: ModalTab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  /**
   * Session-style shell: sticky header/tabs, scrollable body (flex + min-h-0).
   * Prefer this over absolute-positioned panes that collapse to zero height.
   */
  containBody?: boolean;
}

/**
 * Full-screen dialog. Always portaled to document.body so it stacks above the
 * fixed bottom nav (Layout creates a lower stacking context that would trap
 * in-tree fixed layers under the tab bar).
 */
export function Modal({
  open,
  title,
  children,
  onClose,
  dismissible = true,
  tabs,
  activeTab,
  onTabChange,
  containBody = false,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Signal layout chrome (optional) that a dialog is up
    document.documentElement.dataset.modalOpen = "1";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      delete document.documentElement.dataset.modalOpen;
    };
  }, [open, dismissible, onClose]);

  // Reset scroll only when the modal opens — not on tab switches (preserve flow).
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const body = bodyRef.current;
    if (panel) panel.scrollTop = 0;
    if (body) body.scrollTop = 0;
    const id = requestAnimationFrame(() => {
      if (panel) panel.scrollTop = 0;
      if (body) body.scrollTop = 0;
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  if (!open) return null;

  const node = (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label={dismissible ? "Close dialog" : undefined}
        className="absolute inset-0 bg-black/45"
        onClick={dismissible ? onClose : undefined}
        tabIndex={dismissible ? 0 : -1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={[
          // pb uses safe-area only — tab bar is under the scrim, not beside the sheet
          "relative z-10 w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-surface border border-border shadow-xl p-5",
          "pb-[max(1.25rem,env(safe-area-inset-bottom))]",
          containBody
            ? // Bounded height so body flex-1 + overflow-y-auto can scroll on phones
              "flex flex-col max-h-[92dvh] overflow-hidden min-h-0 sm:max-h-[90dvh]"
            : "max-h-[92dvh] overflow-y-auto overscroll-contain sm:max-h-[90dvh] [-webkit-overflow-scrolling:touch]",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-3 mb-3 shrink-0">
          <h2 id="modal-title" className="text-xl pr-2">
            {title}
          </h2>
          {dismissible && (
            <Button
              variant="ghost"
              className="!p-2 shrink-0"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden />
            </Button>
          )}
        </div>

        {tabs && tabs.length > 0 && onTabChange && (
          <div
            className="grid grid-cols-2 gap-1 rounded-xl bg-surface-muted/70 p-1 mb-3 shrink-0"
            role="tablist"
            aria-label="Modal sections"
          >
            {tabs.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => onTabChange(tab.id)}
                  className={[
                    "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-semibold touch-manipulation tap-target transition-colors",
                    selected
                      ? "bg-surface text-primary shadow-sm"
                      : "text-muted hover:text-text",
                  ].join(" ")}
                >
                  {tab.label}
                  {typeof tab.badge === "number" && tab.badge > 0 ? (
                    <span className="tabular-nums text-[10px] opacity-80">
                      ({tab.badge})
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}

        {containBody ? (
          <div
            ref={bodyRef}
            // Scrollable by default so long forms (Fix link, etc.) work.
            // Session panes still use absolute + their own overflow-y-auto.
            className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
          >
            {children}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );

  // Portal out of Layout stacking context so z-index beats the bottom nav
  if (typeof document !== "undefined") {
    return createPortal(node, document.body);
  }
  return node;
}
