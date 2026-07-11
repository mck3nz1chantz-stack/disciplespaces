import { useEffect, type RefObject } from "react";
import { normalizeSectionKey } from "../lib/sessionSections";

/**
 * Tracks which [data-session-section] is “in view” inside a scroll container
 * (scroll + focus). Used to lock Private notes to the same step as Session.
 */
export function useSessionSectionSpy(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  onSectionChange: (sectionKey: string) => void,
) {
  useEffect(() => {
    if (!enabled) return;
    const root = containerRef.current;
    if (!root) return;

    let raf = 0;

    function pickSection() {
      const el = containerRef.current;
      if (!el) return;
      const nodes = el.querySelectorAll<HTMLElement>("[data-session-section]");
      if (nodes.length === 0) return;

      const rootRect = el.getBoundingClientRect();
      // Prefer the section whose top is nearest the upper third of the viewport.
      const targetY = rootRect.top + rootRect.height * 0.28;
      let best: HTMLElement | null = null;
      let bestDist = Infinity;

      nodes.forEach((node) => {
        const rect = node.getBoundingClientRect();
        // Skip if completely below or above container
        if (rect.bottom < rootRect.top || rect.top > rootRect.bottom) return;
        const dist = Math.abs(rect.top - targetY);
        // Prefer sections that have started (top above mid) slightly
        const score =
          rect.top <= targetY && rect.bottom > rootRect.top
            ? dist * 0.85
            : dist;
        if (score < bestDist) {
          bestDist = score;
          best = node;
        }
      });

      if (!best) {
        // Fallback: first section that intersects
        for (const node of nodes) {
          const rect = node.getBoundingClientRect();
          if (rect.bottom > rootRect.top && rect.top < rootRect.bottom) {
            best = node;
            break;
          }
        }
      }

      if (best) {
        const key = normalizeSectionKey(
          (best as HTMLElement).getAttribute("data-session-section"),
        );
        onSectionChange(key);
      }
    }

    function onScrollOrResize() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(pickSection);
    }

    function onFocusIn(e: FocusEvent) {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const host = t.closest<HTMLElement>("[data-session-section]");
      if (!host) return;
      onSectionChange(
        normalizeSectionKey(host.getAttribute("data-session-section")),
      );
    }

    root.addEventListener("scroll", onScrollOrResize, { passive: true });
    root.addEventListener("focusin", onFocusIn);
    // Initial
    pickSection();

    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener("scroll", onScrollOrResize);
      root.removeEventListener("focusin", onFocusIn);
    };
  }, [containerRef, enabled, onSectionChange]);
}
