import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

/**
 * All-I-frame web plate (scrub-safe). Query busts CDN/SW stale copies.
 * AnimateStudio job untitled-job-ms407yaf.
 *
 * SSOT recipe (do not regress without re-test):
 *   docs/final/bible-reader-scroll-video-plate.md
 */
export const BIBLE_CROSS_VIDEO_SRC = "/media/crossanimation1-web.mp4?v=scrub5";

type Props = {
  active?: boolean;
  /** Remount when chapter changes — `${version}-${bookId}-${chapter}`. */
  passageKey?: string;
};

function clamp01(n: number): number {
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

function chromeInsets(): { top: number; bottom: number } {
  const viewH = window.innerHeight || 1;
  let top = 56;
  let bottom = 72;
  try {
    const header = document.querySelector<HTMLElement>(
      "header.sticky, header[class*='sticky']",
    );
    if (header) {
      const b = header.getBoundingClientRect().bottom;
      if (b > 24 && b < viewH * 0.45) top = Math.round(b);
    }
    const nav = document.querySelector<HTMLElement>('nav[aria-label="Main"]');
    if (nav) {
      const t = nav.getBoundingClientRect().top;
      if (t > viewH * 0.5 && t < viewH) bottom = Math.round(viewH - t);
    }
  } catch {
    /* ignore */
  }
  return { top, bottom };
}

/**
 * Cross plate behind Bible reading text.
 *
 * Layout note (Chrome): sticky ONLY works if no ancestor has overflow:hidden.
 * The Bible <article> must use overflow-visible while this plate is active.
 *
 * Timeline: progress 0→1 is stretched across the content block height so the
 * full clip (ending on woodgrain) maps to scrolling the whole passage.
 */
export function BibleReaderVideoBg({ active = true, passageKey = "" }: Props) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const durationRef = useRef(0);
  const blobUrlRef = useRef<string | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!active || prefersReducedMotion) return;
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    setFailed(false);
    durationRef.current = 0;
    pendingSeekRef.current = null;

    video.muted = true;
    video.defaultMuted = true;
    video.loop = false;
    video.autoplay = false;
    try {
      video.volume = 0;
      video.pause();
    } catch {
      /* ignore */
    }

    const onError = () => {
      if (!cancelled) setFailed(true);
    };
    const onMeta = () => {
      const d = video.duration;
      if (Number.isFinite(d) && d > 0) {
        durationRef.current = d;
        // Apply any scroll progress that arrived before metadata
        const pending = pendingSeekRef.current;
        if (pending != null) {
          try {
            video.currentTime = pending;
          } catch {
            /* ignore */
          }
        }
      }
    };

    video.addEventListener("error", onError);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("durationchange", onMeta);

    (async () => {
      try {
        const res = await fetch(BIBLE_CROSS_VIDEO_SRC, { cache: "force-cache" });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        if (cancelled) return;
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        video.src = url;
        video.load();
      } catch {
        if (cancelled) return;
        video.src = BIBLE_CROSS_VIDEO_SRC;
        video.load();
      }
    })();

    const sectionEl = (): HTMLElement =>
      (rootRef.current?.closest(".bible-reader") as HTMLElement | null) ??
      (rootRef.current?.parentElement as HTMLElement | null) ??
      (rootRef.current as HTMLElement);

    /** 0 at start of passage in reading band → 1 when last content leaves bottom band. */
    const progressThroughPassage = (): number => {
      const section = sectionEl();
      const content =
        (section.querySelector(
          ".bible-reader__content",
        ) as HTMLElement | null) ??
        (section.querySelector(".bible-reader-prose") as HTMLElement | null) ??
        section;

      const viewH = window.innerHeight || 1;
      const { top: topInset, bottom: bottomInset } = chromeInsets();
      const usable = Math.max(viewH - topInset - bottomInset, 1);
      const rect = content.getBoundingClientRect();
      const height = Math.max(
        content.scrollHeight,
        content.offsetHeight,
        Math.round(rect.height),
        1,
      );
      const scrollable = height - usable;

      if (scrollable <= 16) {
        const travel = height + usable;
        return clamp01((usable - (rect.top - topInset)) / travel);
      }
      return clamp01((topInset - rect.top) / scrollable);
    };

    let raf = 0;
    let lastT = -1;
    let seeking = false;

    const apply = () => {
      raf = 0;
      const duration = durationRef.current;
      const p = progressThroughPassage();
      const t =
        !duration || duration <= 0
          ? 0
          : p >= 0.998
            ? Math.max(0, duration - 1 / 24)
            : Math.min(Math.max(0, p * duration), duration - 1 / 24);

      pendingSeekRef.current = t;
      if (!duration || video.readyState < 1) return;
      if (seeking) return;
      if (Math.abs(t - lastT) < 0.015 && lastT >= 0) return;

      lastT = t;
      seeking = true;
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        seeking = false;
        // If scroll moved during seek, catch up
        const next = pendingSeekRef.current;
        if (next != null && Math.abs(next - video.currentTime) > 0.03) {
          schedule();
        }
      };
      video.addEventListener("seeked", onSeeked, { once: true });
      // Safety: don't stall the seek queue forever
      window.setTimeout(() => {
        if (seeking) {
          seeking = false;
          video.removeEventListener("seeked", onSeeked);
        }
      }, 200);

      try {
        video.pause();
        video.currentTime = t;
      } catch {
        seeking = false;
      }
    };

    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(apply);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    document.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.addEventListener("resize", schedule, { passive: true });
    window.visualViewport?.addEventListener("scroll", schedule);
    window.visualViewport?.addEventListener("resize", schedule);

    const ro = new ResizeObserver(() => {
      lastT = -1;
      schedule();
    });
    ro.observe(sectionEl());
    const content = sectionEl().querySelector(".bible-reader__content");
    if (content) ro.observe(content);

    const mo = new MutationObserver(() => {
      lastT = -1;
      schedule();
    });
    mo.observe(sectionEl(), { childList: true, subtree: true });

    return () => {
      cancelled = true;
      window.removeEventListener("scroll", schedule, true);
      document.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      ro.disconnect();
      mo.disconnect();
      if (raf) window.cancelAnimationFrame(raf);
      video.removeEventListener("error", onError);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("durationchange", onMeta);
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {
        /* ignore */
      }
    };
  }, [active, prefersReducedMotion, passageKey]);

  if (!active || prefersReducedMotion || failed) return null;

  return (
    <div ref={rootRef} className="bible-reader-video-bg" aria-hidden="true">
      {/*
        Sticky pin lives on this wrapper (not the video). Parent article MUST
        NOT use overflow:hidden or sticky is dead in Chrome.
      */}
      <div className="bible-reader-video-bg__pin">
        <video
          key={passageKey || "cross"}
          ref={videoRef}
          className="bible-reader-video-bg__media"
          muted
          playsInline
          preload="auto"
          controls={false}
          disablePictureInPicture
          onError={() => setFailed(true)}
        />
        <div className="bible-reader-video-bg__scrim" />
      </div>
    </div>
  );
}
