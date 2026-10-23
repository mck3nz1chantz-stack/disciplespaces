/**
 * Edit one study’s what’s-next list and optional aim.
 * Opening a reading on Read does not remove it.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getBooks, type BibleBookMeta } from "../lib/bible";
import {
  addQueueItem,
  formatAimLine,
  formatQueueLabel,
  moveQueueItem,
  removeQueueItems,
} from "../lib/studyQueue";
import { useLiveStudyQueue } from "../hooks/useLiveDb";
import { useAppStore } from "../stores/useAppStore";
import type { StudyAim } from "../types";
import { Modal } from "./Modal";
import { Button } from "./Button";

export function EditWhatsNext({
  open,
  onClose,
  spaceId,
  studyName,
  initialBookId,
  aim,
}: {
  open: boolean;
  onClose: () => void;
  spaceId: string;
  studyName: string;
  initialBookId?: string;
  aim?: StudyAim;
}) {
  const queue = useLiveStudyQueue(open ? spaceId : undefined);
  const setStudyAim = useAppStore((state) => state.setStudyAim);
  const [books, setBooks] = useState<BibleBookMeta[]>([]);
  const [bookId, setBookId] = useState(initialBookId || "john");
  const [chapterText, setChapterText] = useState("");
  const [startText, setStartText] = useState("");
  const [endText, setEndText] = useState("");
  const [aimBookId, setAimBookId] = useState(aim?.bookId || initialBookId || "john");
  const [aimChapterText, setAimChapterText] = useState(
    aim ? String(aim.chapter) : "",
  );
  const [aimDate, setAimDate] = useState(aim?.byDate ?? "");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingAim, setSavingAim] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBookId(initialBookId || "john");
    setChapterText("");
    setStartText("");
    setEndText("");
    setAimBookId(aim?.bookId || initialBookId || "john");
    setAimChapterText(aim ? String(aim.chapter) : "");
    setAimDate(aim?.byDate ?? "");
    setFormError(null);
    setLoadError(null);
    let cancelled = false;
    void getBooks("kjv")
      .then((list) => {
        if (!cancelled) setBooks(list);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not load the book list.");
      });
    return () => {
      cancelled = true;
    };
    // Seed once each time the dialog opens. Later aim saves must not wipe a chapter the user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const book = books.find((item) => item.id === bookId) ?? books[0];
  const aimBook = books.find((item) => item.id === aimBookId) ?? books[0];
  const items = queue ?? [];

  function parseOptionalVerse(text: string): number | undefined {
    const trimmed = text.trim();
    if (!trimmed) return undefined;
    const value = Number(trimmed);
    if (!Number.isInteger(value) || value < 1) return undefined;
    return value;
  }

  async function addReading() {
    if (!book) return;
    const chapter = Number(chapterText.trim());
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > book.chapterCount) {
      setFormError(`Pick a chapter from 1 to ${book.chapterCount}.`);
      return;
    }
    const startVerse = parseOptionalVerse(startText);
    const endVerse = parseOptionalVerse(endText);
    if ((startText.trim() && startVerse == null) || (endText.trim() && endVerse == null)) {
      setFormError("Verses are optional. Use a number, or leave them blank.");
      return;
    }
    setFormError(null);
    await addQueueItem({
      spaceId,
      bookId: book.id,
      bookName: book.name,
      chapter,
      startVerse,
      endVerse,
    });
    setChapterText("");
    setStartText("");
    setEndText("");
  }

  async function saveAim() {
    if (!aimBook) return;
    const chapter = Number(aimChapterText.trim());
    if (
      !Number.isInteger(chapter) ||
      chapter < 1 ||
      chapter > aimBook.chapterCount
    ) {
      setFormError(`Aim needs a chapter from 1 to ${aimBook.chapterCount}.`);
      return;
    }
    setFormError(null);
    setSavingAim(true);
    try {
      await setStudyAim(spaceId, {
        bookId: aimBook.id,
        bookName: aimBook.name,
        chapter,
        byDate: aimDate.trim() || undefined,
      });
      toast.success("Aim saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the aim");
    } finally {
      setSavingAim(false);
    }
  }

  async function clearAim() {
    setSavingAim(true);
    try {
      await setStudyAim(spaceId, null);
      setAimChapterText("");
      setAimDate("");
      toast.success("Aim cleared");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not clear the aim");
    } finally {
      setSavingAim(false);
    }
  }

  return (
    <Modal open={open} title="What’s next" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Readings you mean to open in {studyName}. The first one is Next on
          Read. Opening it does not take it off this list.
        </p>
        {items.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing is queued. The app will not pick the next chapter for you.
          </p>
        ) : (
          <ol className="space-y-2">
            {items.map((item, index) => {
              const label = formatQueueLabel(item);
              return (
                <li
                  key={item.id}
                  className="rounded-xl border border-border bg-bg px-3 py-2"
                  data-queue-item={label}
                >
                  <p className="text-sm font-medium text-primary">
                    {index === 0 ? "Next · " : `${index + 1}. `}
                    {label}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="min-h-11 rounded-xl border border-border px-3 text-sm font-medium text-primary disabled:opacity-40"
                      disabled={index === 0}
                      aria-label={`Move ${label} up`}
                      onClick={() => void moveQueueItem(item.id, -1)}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="min-h-11 rounded-xl border border-border px-3 text-sm font-medium text-primary disabled:opacity-40"
                      disabled={index === items.length - 1}
                      aria-label={`Move ${label} down`}
                      onClick={() => void moveQueueItem(item.id, 1)}
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      className="min-h-11 rounded-xl border border-border px-3 text-sm font-medium text-primary"
                      aria-label={`Remove ${label}`}
                      onClick={() => void removeQueueItems([item.id])}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {loadError ? (
          <p className="text-sm text-danger">{loadError}</p>
        ) : books.length === 0 ? (
          <p className="text-sm text-muted">Loading books…</p>
        ) : (
          <div className="space-y-3 rounded-xl border border-border p-3">
            <p className="text-sm font-medium text-primary">Add a reading</p>
            <label className="block text-sm font-medium text-primary">
              Book
              <select
                className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
                value={book?.id ?? ""}
                onChange={(event) => setBookId(event.target.value)}
              >
                {books.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-primary">
              Chapter
              <input
                value={chapterText}
                onChange={(event) => setChapterText(event.target.value)}
                inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
                placeholder={book ? `1–${book.chapterCount}` : "Chapter"}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm font-medium text-primary">
                Start verse
                <input
                  value={startText}
                  onChange={(event) => setStartText(event.target.value)}
                  inputMode="numeric"
                  className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
                  placeholder="Optional"
                />
              </label>
              <label className="block text-sm font-medium text-primary">
                End verse
                <input
                  value={endText}
                  onChange={(event) => setEndText(event.target.value)}
                  inputMode="numeric"
                  className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
                  placeholder="Optional"
                />
              </label>
            </div>
            {formError ? <p className="text-sm text-danger">{formError}</p> : null}
            <Button type="button" fullWidth onClick={() => void addReading()}>
              Add to what’s next
            </Button>
          </div>
        )}

        <div className="space-y-3 rounded-xl border border-border p-3">
          <p className="text-sm font-medium text-primary">Aim</p>
          <p className="text-sm text-muted">
            One line, such as aim to be at Daniel 12 by Dec 16. No countdown.
            Clear it anytime.
          </p>
          {aim ? (
            <p className="text-sm text-primary">{formatAimLine(aim)}</p>
          ) : null}
          <label className="block text-sm font-medium text-primary">
            Book
            <select
              className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
              value={aimBook?.id ?? ""}
              onChange={(event) => setAimBookId(event.target.value)}
            >
              {books.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-primary">
            Chapter
            <input
              value={aimChapterText}
              onChange={(event) => setAimChapterText(event.target.value)}
              inputMode="numeric"
              className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
              placeholder={aimBook ? `1–${aimBook.chapterCount}` : "Chapter"}
            />
          </label>
          <label className="block text-sm font-medium text-primary">
            By date
            <input
              type="date"
              value={aimDate}
              onChange={(event) => setAimDate(event.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
            />
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              fullWidth
              onClick={() => void saveAim()}
              disabled={savingAim || !aimBook}
            >
              Save aim
            </Button>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => void clearAim()}
              disabled={savingAim || !aim}
            >
              Clear
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
