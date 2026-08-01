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
          "border border-border/90 bg-surface/90 text-text",
          "hover:bg-surface-muted hover:border-primary/30",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        ].join(" ")}
        aria-label="Report a problem"
        title="Report a problem"
      >
        <MessageSquareWarning
          className="h-5 w-5 text-primary"
          strokeWidth={2}
          aria-hidden
        />
      </button>
      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
