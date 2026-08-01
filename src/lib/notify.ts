/**
 * Stable, short user-facing toasts — prefer these over raw toast.error so
 * long exception strings don’t balloon and reflow the stack.
 */
import { toast, type ExternalToast } from "sonner";

const TITLE_MAX = 72;
const DESC_MAX = 140;

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function asMessage(err: unknown, fallback: string): string {
  if (typeof err === "string" && err.trim()) return err.trim();
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return fallback;
}

/** Soften technical failures for the group app audience. */
export function friendlyError(
  err: unknown,
  fallback = "Something went wrong",
): string {
  const raw = asMessage(err, fallback);
  const lower = raw.toLowerCase();

  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("load failed")
  ) {
    return "Couldn’t reach the server. Check connection, then try again.";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "That took too long. Try again in a moment.";
  }
  if (lower.includes("abort")) {
    return "Request was cancelled. Try again.";
  }
  if (lower.includes("401") || lower.includes("unauthorized")) {
    return "Not authorized for this action.";
  }
  if (lower.includes("403") || lower.includes("forbidden")) {
    return "You don’t have permission for that.";
  }
  if (lower.includes("404") || lower.includes("not found")) {
    return "That wasn’t found. It may have been removed.";
  }
  if (lower.includes("409") || lower.includes("conflict")) {
    return "This group changed on another phone. Sync and try again.";
  }
  if (lower.includes("500") || lower.includes("502") || lower.includes("503")) {
    return "The service had a problem. Try again shortly.";
  }
  // Strip common noisy prefixes
  return clip(
    raw
      .replace(/^Error:\s*/i, "")
      .replace(/^TypeError:\s*/i, "")
      .replace(/^SpaceRelay\w*Error:\s*/i, ""),
    DESC_MAX + 40,
  );
}

export function notifyError(
  title: string,
  description?: string | unknown,
  opts?: ExternalToast,
): string | number {
  const desc =
    description == null
      ? undefined
      : typeof description === "string"
        ? clip(description, DESC_MAX)
        : clip(friendlyError(description), DESC_MAX);

  return toast.error(clip(title, TITLE_MAX), {
    duration: 5200,
    ...opts,
    description: desc,
  });
}

export function notifySuccess(
  title: string,
  description?: string,
  opts?: ExternalToast,
): string | number {
  return toast.success(clip(title, TITLE_MAX), {
    duration: 3200,
    ...opts,
    description: description ? clip(description, DESC_MAX) : undefined,
  });
}

export function notifyMessage(
  title: string,
  description?: string,
  opts?: ExternalToast,
): string | number {
  return toast.message(clip(title, TITLE_MAX), {
    duration: 3600,
    ...opts,
    description: description ? clip(description, DESC_MAX) : undefined,
  });
}
