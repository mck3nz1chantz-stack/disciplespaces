import { useEffect, useId, useRef, type ReactNode } from "react";
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
  /**
   * The body fills the shell and does not scroll. A child pane is the only scroller.
   * Use this when the dialog content already has its own scroll, so two bars do not stack.
   */
  nestedScroll?: boolean;
  /** Sticky footer under body (e.g. Done / Back to session). */
  footer?: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  nestedScroll = false,
  footer,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  const baseId = useId();

  // Latest callbacks without restarting the focus trap on each parent render.
  // Rename (and other dialog fields) pass a fresh onClose every keystroke.
  onCloseRef.current = onClose;
  dismissibleRef.current = dismissible;

  // Capture the trigger before commit. autoFocus on a field runs before
  // effects, so saving activeElement later would restore a detached input.
  if (open && !wasOpenRef.current) {
    const active = document.activeElement;
    previousFocusRef.current =
      active instanceof HTMLElement && active !== document.body ? active : null;
  }
  wasOpenRef.current = open;

  // Focus trap + Escape + body scroll lock. Depends only on `open` so typing
  // inside the dialog does not blur the field and move focus to Close.
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.dataset.modalOpen = "1";

    // Move focus into the dialog after paint, unless a field already has it
    // (autoFocus on the name input must survive this).
    const focusTimer = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        panel.contains(active) &&
        active !== panel
      ) {
        return;
      }
      const preferred = panel.querySelector<HTMLElement>(
        "input[autofocus], textarea[autofocus], select[autofocus], [data-autofocus]",
      );
      const first = panel.querySelector<HTMLElement>(FOCUSABLE);
      (preferred ?? first ?? titleRef.current ?? panel).focus();
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissibleRef.current) {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const nodes = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
      if (nodes.length === 0) {
        e.preventDefault();
        titleRef.current?.focus();
        return;
      }
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !panelRef.current.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);

    // Safari drops a focused field to the document (relatedTarget null) when
    // the dialog is position:fixed. Put the caret back. A real click on Close
    // or the backdrop has a target, so that still dismisses.
    const panel = panelRef.current;
    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget;
      if (next instanceof Node && panel?.contains(next)) return;
      if (next instanceof HTMLElement) return;
      const from = e.target;
      if (
        !(from instanceof HTMLInputElement) &&
        !(from instanceof HTMLTextAreaElement) &&
        !(from instanceof HTMLSelectElement)
      ) {
        return;
      }
      if (!panel?.contains(from)) return;
      // Two frames: a real Tab/click lands on the next control before we
      // decide the browser dropped the caret onto the document.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (!document.contains(from)) return;
          const active = document.activeElement;
          if (
            active === document.body ||
            active === document.documentElement ||
            active == null
          ) {
            try {
              from.focus();
            } catch {
              // ignore
            }
          }
        });
      });
    };
    panel?.addEventListener("focusout", onFocusOut);

    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.removeEventListener("keydown", onKey);
      panel?.removeEventListener("focusout", onFocusOut);
      document.body.style.overflow = prevOverflow;
      delete document.documentElement.dataset.modalOpen;
      // Strict Mode replays this effect while the dialog node is still mounted.
      // Restoring then would pull focus out of the field and drop the trigger.
      const stillMounted = panelRef.current;
      if (stillMounted && document.contains(stillMounted)) return;
      const prev = previousFocusRef.current;
      previousFocusRef.current = null;
      if (prev && document.contains(prev) && typeof prev.focus === "function") {
        try {
          prev.focus();
        } catch {
          // ignore
        }
      }
    };
  }, [open]);

  // Reset scroll only when the modal opens — not on tab switches (preserve flow).
  useEffect(() => {
    if (!open) return;
    const reset = () => {
      const panel = panelRef.current;
      const body = bodyRef.current;
      const active = document.activeElement;
      // Setting scrollTop while a field is focused blurs it in Safari.
      if (
        active instanceof HTMLElement &&
        active !== panel &&
        active !== body &&
        (panel?.contains(active) || body?.contains(active))
      ) {
        return;
      }
      if (panel) panel.scrollTop = 0;
      if (body) body.scrollTop = 0;
    };
    reset();
    const id = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(id);
  }, [open]);

  if (!open) return null;

  const hasTabs = Boolean(tabs && tabs.length > 0 && onTabChange);

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
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${baseId}-title`}
        className={[
          "relative z-10 w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-surface border border-border shadow-xl p-5",
          "pb-[max(1.25rem,env(safe-area-inset-bottom))]",
          containBody
            ? "flex flex-col h-[min(92dvh,100%)] max-h-[92dvh] overflow-hidden min-h-0 sm:h-[min(90dvh,100%)] sm:max-h-[90dvh]"
            : "max-h-[92dvh] overflow-y-auto overscroll-contain sm:max-h-[90dvh]",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-3 mb-3 shrink-0">
          <h2
            id={`${baseId}-title`}
            ref={titleRef}
            tabIndex={-1}
            className="text-xl pr-2 outline-none"
          >
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

        {hasTabs && (
          <div
            className="grid grid-cols-2 gap-1 rounded-xl bg-surface-muted/70 p-1 mb-3 shrink-0"
            role="tablist"
            aria-label="Modal sections"
            onKeyDown={(e) => {
              if (!tabs || !onTabChange) return;
              const idx = tabs.findIndex((t) => t.id === activeTab);
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                const next = tabs[(idx + 1 + tabs.length) % tabs.length];
                if (next) onTabChange(next.id);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                const next = tabs[(idx - 1 + tabs.length) % tabs.length];
                if (next) onTabChange(next.id);
              } else if (e.key === "Home") {
                e.preventDefault();
                if (tabs[0]) onTabChange(tabs[0].id);
              } else if (e.key === "End") {
                e.preventDefault();
                const last = tabs[tabs.length - 1];
                if (last) onTabChange(last.id);
              }
            }}
          >
            {tabs!.map((tab) => {
              const selected = activeTab === tab.id;
              const panelId = `${baseId}-panel-${tab.id}`;
              const tabId = `${baseId}-tab-${tab.id}`;
              return (
                <button
                  key={tab.id}
                  id={tabId}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={panelId}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => onTabChange!(tab.id)}
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
            id={
              hasTabs && activeTab
                ? `${baseId}-panel-${activeTab}`
                : undefined
            }
            role={hasTabs ? "tabpanel" : undefined}
            aria-labelledby={
              hasTabs && activeTab
                ? `${baseId}-tab-${activeTab}`
                : undefined
            }
            className={
              nestedScroll
                ? "relative flex-1 min-h-0 overflow-hidden"
                : "relative flex-1 min-h-0 overflow-y-auto overscroll-contain"
            }
          >
            {children}
          </div>
        ) : (
          <div
            id={
              hasTabs && activeTab
                ? `${baseId}-panel-${activeTab}`
                : undefined
            }
            role={hasTabs ? "tabpanel" : undefined}
            aria-labelledby={
              hasTabs && activeTab
                ? `${baseId}-tab-${activeTab}`
                : undefined
            }
          >
            {children}
          </div>
        )}

        {footer ? (
          <div className="shrink-0 border-t border-border pt-3 mt-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(node, document.body);
  }
  return node;
}
