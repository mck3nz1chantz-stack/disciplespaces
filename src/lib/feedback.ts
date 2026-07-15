/**
 * In-app pilot feedback → Space relay Worker.
 * Never includes private notes or Scripture study text.
 */

import { getDeviceId } from "./sync/deviceIdentity";
import { getSpaceRelayBaseUrl, isSpaceRelayConfigured } from "./sync/config";
import { readOnlineMode } from "./onlineMode";
import { APP_NAME } from "./legal";

export type FeedbackKind = "bug" | "confusing" | "idea" | "other";

export interface FeedbackDiagnostics {
  appVersion: string;
  appName: string;
  href: string;
  userAgent: string;
  language: string;
  onlineMode: string;
  networkOnline: boolean;
  viewport: string;
  timezone: string;
  deviceIdPrefix: string;
  spaceCount?: number;
  connectedSpaceCount?: number;
}

export interface FeedbackPayload {
  v: 1;
  kind: FeedbackKind;
  message: string;
  contact?: string;
  diagnostics?: FeedbackDiagnostics;
  createdAt: string;
  clientId: string;
}

const QUEUE_KEY = "ds-feedback-queue-v1";
const MAX_QUEUE = 20;
const MAX_MESSAGE = 4000;

export function buildDiagnostics(input?: {
  spaceCount?: number;
  connectedSpaceCount?: number;
}): FeedbackDiagnostics {
  const deviceId = getDeviceId();
  return {
    appVersion:
      (typeof import.meta !== "undefined" &&
        (import.meta.env?.VITE_APP_VERSION as string | undefined)) ||
      "0.10.0",
    appName: APP_NAME,
    href: typeof window !== "undefined" ? window.location.href : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    language: typeof navigator !== "undefined" ? navigator.language : "",
    onlineMode: readOnlineMode(),
    networkOnline:
      typeof navigator !== "undefined" ? navigator.onLine : true,
    viewport:
      typeof window !== "undefined"
        ? `${window.innerWidth}x${window.innerHeight}`
        : "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    deviceIdPrefix: deviceId.slice(0, 8),
    spaceCount: input?.spaceCount,
    connectedSpaceCount: input?.connectedSpaceCount,
  };
}

function readQueue(): FeedbackPayload[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FeedbackPayload[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items: FeedbackPayload[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-MAX_QUEUE)));
  } catch {
    // ignore
  }
}

export function queuedFeedbackCount(): number {
  return readQueue().length;
}

async function postFeedback(payload: FeedbackPayload): Promise<void> {
  if (!isSpaceRelayConfigured()) {
    throw new Error(
      "Feedback service isn’t on this build. Tell the host who invited you, or try again later.",
    );
  }
  const base = getSpaceRelayBaseUrl();
  const res = await fetch(`${base}/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Device-Id": getDeviceId(),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let msg = `Could not send (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) msg = data.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
}

/**
 * Send feedback now, or queue on this device if offline / network fails.
 * Returns { queued: true } if saved locally for later flush.
 */
export async function submitFeedback(input: {
  kind: FeedbackKind;
  message: string;
  contact?: string;
  includeDiagnostics: boolean;
  spaceCount?: number;
  connectedSpaceCount?: number;
}): Promise<{ queued: boolean; id?: string }> {
  const message = input.message.trim().slice(0, MAX_MESSAGE);
  if (message.length < 5) {
    throw new Error("Please write a little more so we can help.");
  }

  const payload: FeedbackPayload = {
    v: 1,
    kind: input.kind,
    message,
    contact: input.contact?.trim().slice(0, 120) || undefined,
    diagnostics: input.includeDiagnostics
      ? buildDiagnostics({
          spaceCount: input.spaceCount,
          connectedSpaceCount: input.connectedSpaceCount,
        })
      : undefined,
    createdAt: new Date().toISOString(),
    clientId: crypto.randomUUID(),
  };

  // Refuse accidental private-note dumps in free text (soft check)
  if (/"privateNotes?"\s*:/i.test(message)) {
    throw new Error(
      "Please don’t paste private notes. Describe the problem in your own words.",
    );
  }

  const offline =
    typeof navigator !== "undefined" && !navigator.onLine;

  if (offline || !isSpaceRelayConfigured()) {
    const q = readQueue();
    q.push(payload);
    writeQueue(q);
    return { queued: true };
  }

  try {
    await postFeedback(payload);
    return { queued: false, id: payload.clientId };
  } catch (err) {
    const q = readQueue();
    q.push(payload);
    writeQueue(q);
    // Still surface as queued so UI can reassure
    if (q.length > 0) {
      return { queued: true };
    }
    throw err;
  }
}

/** Flush any feedback saved while offline. */
export async function flushFeedbackQueue(): Promise<number> {
  if (!isSpaceRelayConfigured()) return 0;
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;

  const q = readQueue();
  if (q.length === 0) return 0;

  const remaining: FeedbackPayload[] = [];
  let sent = 0;
  for (const item of q) {
    try {
      await postFeedback(item);
      sent += 1;
    } catch {
      remaining.push(item);
    }
  }
  writeQueue(remaining);
  return sent;
}
