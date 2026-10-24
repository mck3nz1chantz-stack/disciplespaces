import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { MemberEditor } from "../components/MemberEditor";
import { NavBreadcrumb } from "../components/NavBreadcrumb";
import {
  FIRST_SPACE_TIP_KEY,
  readFlag,
  writeFlag,
} from "../lib/onboarding";
import {
  SPACE_TEMPLATES,
  type SpaceTemplateId,
} from "../lib/spaceTemplates";
import { useAppStore } from "../stores/useAppStore";
import type { Member } from "../types";
import { MAX_MEMBERS } from "../types";
import { HueWheel } from "../components/StudyColorControl";
import {
  closestOtherStudy,
  nextFreeHue,
  normalizeHue,
} from "../lib/study";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Full-page create flow (/new) — deep-link friendly; lands on the new group.
 */
export function NewGroup() {
  const navigate = useNavigate();
  const createSpace = useAppStore((s) => s.createSpace);
  const spaces = useAppStore((s) => s.spaces);

  const [spaceTemplate, setSpaceTemplate] =
    useState<SpaceTemplateId>("guided");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [saving, setSaving] = useState(false);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [weekday, setWeekday] = useState("");
  const [startTime, setStartTime] = useState("");
  const [hueTouched, setHueTouched] = useState(false);
  const [hue, setHue] = useState(0);
  const suggestedHue = useMemo(
    () =>
      nextFreeHue(
        spaces
          .map((space) => normalizeHue(space.colorHue))
          .filter((value): value is number => value != null),
      ),
    [spaces],
  );
  const hueValue = hueTouched ? hue : suggestedHue;
  const near = closestOtherStudy(
    hueValue,
    spaces.map((space) => ({ name: space.name, colorHue: space.colorHue })),
  );

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Give this group a name");
      return;
    }

    const isFirst = spaces.length === 0;
    setSaving(true);
    try {
      const space = await createSpace({
        name,
        description,
        members,
        spaceTemplate,
        spaceKind: "group",
        createFirstSession: false,
        colorHue: hueValue,
        firstMeeting:
          weekday === ""
            ? undefined
            : {
                weekday: Number(weekday),
                startTime: startTime || undefined,
              },
      });
      const roomKey = space.sync?.shortCode;
      toast.success(
        roomKey
          ? `Group ready · room key ${roomKey}`
          : isFirst
            ? "Your first group is ready"
            : "Group created",
        {
          description: roomKey
            ? "Share that key so friends can Join. Open the group to Sync and meet."
            : "Open the group → Open group room when Online to get a room key.",
          duration: 6500,
        },
      );
      if (isFirst && !readFlag(FIRST_SPACE_TIP_KEY)) {
        writeFlag(FIRST_SPACE_TIP_KEY, true);
      }
      navigate(`/space/${space.id}`, { replace: true });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not create group",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <NavBreadcrumb
        items={[{ label: "Studies", to: "/studies" }, { label: "New study" }]}
      />

      <div>
        <h2 className="text-2xl font-serif tracking-tight text-primary">
          New study
        </h2>
        <p className="text-sm text-muted mt-1 leading-relaxed">
          A name, a color, and an optional day. People and meeting style are
          under More options.
        </p>
      </div>

      <Card padding="lg" className="space-y-0">
        <form onSubmit={(e) => void handleCreate(e)} className="space-y-5">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
              placeholder="e.g. Wednesday Bible Study"
              maxLength={80}
              required
              autoFocus
            />
          </label>

          <div className="space-y-2">
            <p className="text-sm font-medium">Color</p>
            <HueWheel
              hue={hueValue}
              className="h-44 w-44"
              onChange={(next) => {
                setHueTouched(true);
                setHue(next);
              }}
            />
            <div className="flex justify-center">
              <Button
                type="button"
                variant="secondary"
                className="!py-2 !px-3 text-sm"
                onClick={() => {
                  setHueTouched(true);
                  setHue(suggestedHue);
                }}
              >
                Next free color
              </Button>
            </div>
            {near ? (
              <p className="text-sm text-primary text-center">
                This is close to {near.name}. The name still shows which study
                it is.
              </p>
            ) : (
              <p className="text-sm text-muted text-center">
                Drag the wheel. The name stays next to the color.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm font-medium text-primary">
              Day
              <select
                value={weekday}
                onChange={(event) => setWeekday(event.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
              >
                <option value="">No meeting</option>
                {WEEKDAYS.map((label, index) => (
                  <option key={label} value={String(index)}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-primary">
              Time
              <input
                type="time"
                value={startTime}
                disabled={weekday === ""}
                onChange={(event) => setStartTime(event.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-3 text-base disabled:opacity-40"
              />
            </label>
          </div>
          <p className="text-xs text-muted -mt-3">
            Optional. A weekly meeting on that day. Leave the day blank if this
            study has none.
          </p>

          <div className="border-t border-border pt-2 space-y-3">
            <button
              type="button"
              onClick={() => setMoreOptionsOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 py-1 text-left touch-manipulation tap-target"
              aria-expanded={moreOptionsOpen}
            >
              <span className="text-sm font-semibold text-muted">
                More options · people, meeting style
              </span>
              <ChevronDown
                className={[
                  "h-5 w-5 text-muted transition-transform",
                  moreOptionsOpen ? "rotate-180" : "",
                ].join(" ")}
                aria-hidden
              />
            </button>

            {moreOptionsOpen && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Who’s in it{" "}
                    <span className="text-muted font-normal">(optional)</span>
                  </p>
                  <MemberEditor
                    members={members}
                    onChange={setMembers}
                    maxMembers={MAX_MEMBERS}
                  />
                  <p className="text-xs text-muted">
                    Up to {MAX_MEMBERS} people on this phone.
                  </p>
                </div>

                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Meeting style</legend>
                  <p className="text-xs text-muted -mt-0.5">
                    Default is Guided. You can change this anytime inside the
                    group.
                  </p>
                  <ul className="space-y-2">
                    {SPACE_TEMPLATES.map((tpl) => {
                      const selected = spaceTemplate === tpl.id;
                      return (
                        <li key={tpl.id}>
                          <label
                            className={[
                              "flex items-start gap-3 rounded-xl border px-3 py-3 touch-manipulation tap-target cursor-pointer transition-colors",
                              selected
                                ? "border-primary bg-primary/5"
                                : "border-border bg-bg hover:border-primary/30",
                            ].join(" ")}
                          >
                            <input
                              type="radio"
                              name="space-template"
                              value={tpl.id}
                              checked={selected}
                              onChange={() => setSpaceTemplate(tpl.id)}
                              className="mt-1 h-4 w-4 accent-primary shrink-0"
                              disabled={saving}
                            />
                            <span className="min-w-0">
                              <span className="font-medium text-primary block">
                                {tpl.name}
                              </span>
                              <span className="text-xs text-muted block mt-0.5">
                                {tpl.description}
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>

                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">
                    Note{" "}
                    <span className="text-muted font-normal">(optional)</span>
                  </span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base min-h-[72px] resize-y"
                    placeholder="What is this group about?"
                    maxLength={280}
                  />
                </label>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => navigate("/studies")}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" fullWidth disabled={saving}>
              {saving ? "Saving…" : "Create study"}
            </Button>
          </div>
        </form>
      </Card>

      <p className="text-center text-sm text-muted">
        Invited to a group?{" "}
        <Link
          to="/join"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Join a group
        </Link>
      </p>
    </div>
  );
}
