import { useCallback, useEffect, useState } from "react";

/** Minimal BeforeInstallPromptEvent (not in all TS lib DOM types). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const ios =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || ios;
}

/** Call once at app bootstrap to capture the browser install event. */
export function initPwaInstallListeners(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

export type InstallCapability =
  | "installed"
  | "prompt"
  | "ios-manual"
  | "unsupported";

export function getInstallCapability(): InstallCapability {
  if (isStandalone()) return "installed";
  if (deferredPrompt) return "prompt";

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios-manual";

  // Desktop/Android without event yet — still show install guidance
  return "unsupported";
}

export async function promptPwaInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";
  const event = deferredPrompt;
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === "accepted") {
    deferredPrompt = null;
    notify();
  }
  return outcome;
}

export function usePwaInstall() {
  const [capability, setCapability] = useState<InstallCapability>(() =>
    typeof window !== "undefined" ? getInstallCapability() : "unsupported",
  );
  const [standalone, setStandalone] = useState(() =>
    typeof window !== "undefined" ? isStandalone() : false,
  );

  useEffect(() => {
    const refresh = () => {
      setCapability(getInstallCapability());
      setStandalone(isStandalone());
    };
    listeners.add(refresh);
    refresh();

    const mq = window.matchMedia("(display-mode: standalone)");
    const onMq = () => refresh();
    mq.addEventListener?.("change", onMq);

    return () => {
      listeners.delete(refresh);
      mq.removeEventListener?.("change", onMq);
    };
  }, []);

  const install = useCallback(async () => {
    return promptPwaInstall();
  }, []);

  return {
    capability,
    standalone,
    canPrompt: capability === "prompt",
    install,
  };
}
