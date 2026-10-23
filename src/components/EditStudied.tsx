/**
 * Check and uncheck studied chapters for one study.
 * Opening a chapter elsewhere does not come through here.
 */

import { useEffect, useState } from "react";
import { getBooks, type BibleBookMeta } from "../lib/bible";
import { setChapterStudied } from "../lib/chapterMarks";
import { offerTakeOffWhatsNext } from "./markStudiedOffer";
import { useLiveChapterMarks } from "../hooks/useLiveDb";
import { Modal } from "./Modal";

export function EditStudied({
  open,
  onClose,
  spaceId,
  studyName,
  initialBookId,
}: {
  open: boolean;
  onClose: () => void;
  spaceId: string;
  studyName: string;
  initialBookId?: string;
}) {
  const marks = useLiveChapterMarks(open ? spaceId : undefined);
  const [books, setBooks] = useState<BibleBookMeta[]>([]);
  const [bookId, setBookId] = useState(initialBookId || "john");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setBookId(initialBookId || "john");
    let cancelled = false;
    setLoadError(null);
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
  }, [open, initialBookId]);

  const book = books.find((item) => item.id === bookId) ?? books[0];
  const studied = new Set(
    (marks ?? [])
      .filter((mark) => mark.bookId === book?.id)
      .map((mark) => mark.chapter),
  );

  return (
    <Modal open={open} title="Edit studied" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Checked chapters are studied in {studyName}. Uncheck to clear a mark.
          Opening a chapter does not mark it.
        </p>
        {loadError ? (
          <p className="text-sm text-danger">{loadError}</p>
        ) : (
          <label className="block text-sm font-medium text-primary">
            Book
            <select
              className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-3 text-base"
              value={book?.id ?? ""}
              onChange={(event) => setBookId(event.target.value)}
            >
              {books.map((item) => {
                const count = (marks ?? []).filter(
                  (mark) => mark.bookId === item.id,
                ).length;
                return (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {count > 0 ? ` · ${count} studied` : ""}
                  </option>
                );
              })}
            </select>
          </label>
        )}
        {book ? (
          <div className="grid grid-cols-2 gap-2 max-h-[50dvh] overflow-y-auto sm:grid-cols-3">
            {Array.from({ length: book.chapterCount }, (_, i) => i + 1).map(
              (n) => {
                const checked = studied.has(n);
                return (
                  <label
                    key={n}
                    className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={checked}
                      aria-label={`${book.name} ${n}`}
                      onChange={(event) => {
                        const studied = event.target.checked;
                        void setChapterStudied({
                          spaceId,
                          bookId: book.id,
                          chapter: n,
                          studied,
                        }).then(() => {
                          if (studied) {
                            void offerTakeOffWhatsNext(spaceId, [
                              { bookId: book.id, chapters: [n] },
                            ]);
                          }
                        });
                      }}
                    />
                    <span className="tabular-nums">Chapter {n}</span>
                  </label>
                );
              },
            )}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
