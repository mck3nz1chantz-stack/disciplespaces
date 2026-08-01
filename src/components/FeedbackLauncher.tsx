import { useEffect, useState } from "react";
import { MessageSquareWarning } from "lucide-react";
import { FeedbackModal } from "./FeedbackModal";
import { flushFeedbackQueue } from "../lib/feedback";

/** Header button + modal host. Also flushes offline queue when back online. */
export function FeedbackLauncher() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onOnline() {
      void flushFeedbackQueue();
    }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={[
          "inline-flex items-center justify-center rounded-xl p-2.5 shrink-0",
          "touch-manipulation tap-target transition-colors",
          /* Quiet chrome on parchment — no amber fill, no high-luminance chip */
          "border border-border/70 bg-transparent text-muted",
          "hover:bg-surface-muted/80 hover:text-primary hover:border-border",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        ].join(" ")}
        aria-label="Report a problem"
        title="Report a problem"
      >
        <MessageSquareWarning
          className="h-5 w-5 text-current"
          strokeWidth={1.75}
          aria-hidden
        />
      </button>
      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
