import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { useAppStore } from "../stores/useAppStore";
import type { Space } from "../types";
import {
  closestOtherStudy,
  nextFreeHue,
  normalizeHue,
  PERSONAL_HUE,
  studyColor,
} from "../lib/study";

export function HueWheel({
  hue,
  onChange,
  className = "h-52 w-52",
}: {
  hue: number;
  onChange: (hue: number) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function pick(clientX: number, clientY: number) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - (rect.left + rect.width / 2);
    const y = clientY - (rect.top + rect.height / 2);
    let next = (Math.atan2(x, -y) * 180) / Math.PI;
    if (next < 0) next += 360;
    onChange(Math.round(next) % 360);
  }

  const markerHue = normalizeHue(hue) ?? PERSONAL_HUE;
  const rad = ((markerHue - 90) * Math.PI) / 180;
  const left = 50 + Math.cos(rad) * 42;
  const top = 50 + Math.sin(rad) * 42;

  return (
    <div
      ref={ref}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={359}
      aria-valuenow={markerHue}
      aria-label="Color wheel"
      tabIndex={0}
      className={`relative mx-auto touch-none rounded-full ${className}`}
      style={{
        background:
          "conic-gradient(from 0deg, hsl(0 75% 48%), hsl(60 75% 48%), hsl(120 70% 40%), hsl(180 70% 42%), hsl(220 75% 52%), hsl(280 70% 50%), hsl(330 75% 48%), hsl(360 75% 48%))",
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        pick(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (event.buttons !== 1) return;
        pick(event.clientX, event.clientY);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowUp") {
          event.preventDefault();
          onChange((markerHue + 4) % 360);
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
          event.preventDefault();
          onChange((markerHue + 356) % 360);
        }
      }}
    >
      <div className="absolute inset-[18%] rounded-full bg-surface" />
      <span
        className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
        style={{
          left: `${left}%`,
          top: `${top}%`,
          background: studyColor(markerHue).fill,
        }}
      />
    </div>
  );
}

export function StudyColorControl({
  space,
  compact = false,
}: {
  space: Space;
  compact?: boolean;
}) {
  const spaces = useAppStore((s) => s.spaces);
  const setStudyHue = useAppStore((s) => s.setStudyHue);
  const [open, setOpen] = useState(false);
  const [hue, setHue] = useState(
    () => normalizeHue(space.colorHue) ?? PERSONAL_HUE,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHue(normalizeHue(space.colorHue) ?? PERSONAL_HUE);
  }, [space.id, space.colorHue]);

  const color = studyColor(hue);
  const others = spaces.filter((item) => item.id !== space.id);
  const near = closestOtherStudy(
    hue,
    others.map((item) => ({ name: item.name, colorHue: item.colorHue })),
  );

  async function save() {
    setSaving(true);
    try {
      await setStudyHue(space.id, hue);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        className={
          compact
            ? "h-11 w-11 shrink-0 rounded-full border-2 touch-manipulation"
            : "inline-flex min-h-11 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium text-primary touch-manipulation"
        }
        style={
          compact
            ? { background: color.fill, borderColor: color.stroke }
            : { borderColor: color.stroke, background: color.soft }
        }
        aria-label={`Color for ${space.name}`}
      >
        {compact ? null : (
          <>
            <span
              className="h-4 w-4 rounded-full border border-black/10"
              style={{ background: color.fill }}
              aria-hidden
            />
            Color
          </>
        )}
      </button>
      <Modal
        open={open}
        title={`Color · ${space.name}`}
        onClose={() => setOpen(false)}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="secondary"
              fullWidth
              onClick={() =>
                setHue(
                  nextFreeHue(
                    others
                      .map((item) => normalizeHue(item.colorHue))
                      .filter((item): item is number => item != null),
                  ),
                )
              }
            >
              Next free color
            </Button>
            <Button fullWidth onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save color"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <HueWheel hue={hue} onChange={setHue} />
          <label className="block text-sm text-muted">
            Hue
            <input
              type="range"
              min={0}
              max={359}
              value={hue}
              onChange={(event) => setHue(Number(event.target.value))}
              className="mt-1 w-full"
              aria-valuetext={`${hue}`}
            />
          </label>
          {near ? (
            <p className="text-sm text-primary">
              This is close to {near.name}. The name on the chip still shows
              which study it is.
            </p>
          ) : (
            <p className="text-sm text-muted">
              Drag the wheel. Each study can have its own color.
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
