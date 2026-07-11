import { useNavigate } from "react-router-dom";
import { BookOpen, CalendarPlus, CircleHelp, Plus, X } from "lucide-react";
import { Card } from "./Card";
import { Button } from "./Button";
import {
  QUICKSTART_BIBLE_KEY,
  QUICKSTART_DISMISS_KEY,
  QUICKSTART_HELP_KEY,
  QUICKSTART_ITEMS,
  readFlag,
  writeFlag,
} from "../lib/onboarding";

interface QuickStartChecklistProps {
  hasSpaces: boolean;
  hasSessions: boolean;
  /** First space id when available — used to open it for “start a session”. */
  firstSpaceId?: string | null;
  onCreateSpace: () => void;
  onDismiss: () => void;
}

/**
 * Lightweight guided checklist for brand-new users (dismissible).
 * Each row is tappable and routes to the matching part of the app.
 */
export function QuickStartChecklist({
  hasSpaces,
  hasSessions,
  firstSpaceId,
  onCreateSpace,
  onDismiss,
}: QuickStartChecklistProps) {
  const navigate = useNavigate();

  function dismiss() {
    writeFlag(QUICKSTART_DISMISS_KEY, true);
    onDismiss();
  }

  const done: Record<string, boolean> = {
    space: hasSpaces,
    session: hasSessions,
    bible: readFlag(QUICKSTART_BIBLE_KEY),
    help: readFlag(QUICKSTART_HELP_KEY),
  };

  function handleItem(id: string) {
    switch (id) {
      case "space":
        if (hasSpaces && firstSpaceId) {
          navigate(`/space/${firstSpaceId}`);
        } else {
          onCreateSpace();
        }
        break;
      case "session":
        if (firstSpaceId) {
          navigate(`/space/${firstSpaceId}`, {
            state: { openCreateSession: true },
          });
        } else {
          onCreateSpace();
        }
        break;
      case "bible":
        writeFlag(QUICKSTART_BIBLE_KEY, true);
        navigate(
          firstSpaceId ? `/bible?space=${firstSpaceId}` : "/bible",
        );
        break;
      case "help":
        writeFlag(QUICKSTART_HELP_KEY, true);
        navigate("/help");
        break;
      default:
        break;
    }
  }

  return (
    <Card className="space-y-3 border-primary/20 bg-primary/[0.03]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-primary">Quick start</p>
          <p className="text-sm text-muted mt-0.5">
            Tap any step to go there — dismiss anytime.
          </p>
        </div>
        <Button
          variant="ghost"
          className="!p-2 shrink-0"
          onClick={dismiss}
          aria-label="Dismiss quick start"
        >
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      <ul className="space-y-2">
        {QUICKSTART_ITEMS.map((item) => {
          const complete = done[item.id];
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => handleItem(item.id)}
                className={[
                  "flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left touch-manipulation tap-target transition-colors",
                  complete
                    ? "border-success/30 bg-success/10"
                    : "border-border bg-bg hover:border-primary/30 active:scale-[0.99]",
                ].join(" ")}
              >
                <span
                  className={[
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                    complete
                      ? "bg-success text-white"
                      : "border border-border text-muted",
                  ].join(" ")}
                  aria-hidden
                >
                  {complete ? "✓" : ""}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={[
                      "text-sm font-medium",
                      complete ? "text-success" : "text-primary",
                    ].join(" ")}
                  >
                    {item.label}
                  </p>
                  <p className="text-xs text-muted mt-0.5">{item.hint}</p>
                </div>
                <span className="text-xs text-primary font-medium shrink-0 mt-0.5">
                  Open
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2">
        {!hasSpaces && (
          <Button fullWidth onClick={onCreateSpace}>
            <Plus className="h-5 w-5" aria-hidden />
            Create a Space
          </Button>
        )}
        {hasSpaces && !hasSessions && firstSpaceId && (
          <Button
            fullWidth
            variant="secondary"
            onClick={() =>
              navigate(`/space/${firstSpaceId}`, {
                state: { openCreateSession: true },
              })
            }
          >
            <CalendarPlus className="h-5 w-5" aria-hidden />
            Start a session
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            fullWidth
            onClick={() => handleItem("bible")}
          >
            <BookOpen className="h-4 w-4" aria-hidden />
            Bible
          </Button>
          <Button variant="ghost" fullWidth onClick={() => handleItem("help")}>
            <CircleHelp className="h-4 w-4" aria-hidden />
            Help
          </Button>
        </div>
      </div>
    </Card>
  );
}
