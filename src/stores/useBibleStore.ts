import { create } from "zustand";

/**
 * Ephemeral logging context for the Bible reader.
 * Primary source of truth is the URL (`?space=` / `?session=`).
 * This store is derived from the URL while `/bible` is mounted — no sessionStorage.
 */
export interface BibleLogContext {
  spaceId: string | null;
  spaceName: string | null;
  sessionId: string | null;
}

const EMPTY_CONTEXT: BibleLogContext = {
  spaceId: null,
  spaceName: null,
  sessionId: null,
};

interface BibleStore {
  logContext: BibleLogContext;
  setLogContext: (context: Partial<BibleLogContext>) => void;
  clearLogContext: () => void;
}

export const useBibleStore = create<BibleStore>((set, get) => ({
  logContext: { ...EMPTY_CONTEXT },

  setLogContext: (partial) => {
    const prev = get().logContext;
    set({
      logContext: {
        spaceId:
          partial.spaceId !== undefined ? partial.spaceId : prev.spaceId,
        spaceName:
          partial.spaceName !== undefined ? partial.spaceName : prev.spaceName,
        sessionId:
          partial.sessionId !== undefined ? partial.sessionId : prev.sessionId,
      },
    });
  },

  clearLogContext: () => {
    set({ logContext: { ...EMPTY_CONTEXT } });
  },
}));
