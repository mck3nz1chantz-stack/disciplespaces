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
        className="inline-flex items-center justify-center rounded-xl p-2.5 text-amber-900 dark:text-amber-100 touch-manipulation tap-target hover:bg-amber-100/80 dark:hover:bg-amber-900/40 transition-colors"
        aria-label="Report a problem"
        title="Report a problem"
      >
        <MessageSquareWarning className="h-5 w-5" aria-hidden />
      </button>
      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
