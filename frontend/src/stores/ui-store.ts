import { useCallback } from "react";
import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import { Store } from "@/types";

interface UIState {
  // Store selection is PER-PAGE: a switcher controls only the page it lives
  // on. Keys are page identifiers ("inventory", "dashboard", "stock-in",
  // "reports-valuation", ...); each defaults to null (= all stores / first
  // accessible store, per the page).
  selectedStoreIds: Record<string, string | null>;
  stores: Store[];

  setSelectedStoreId: (page: string, id: string | null) => void;
  setStores: (stores: Store[]) => void;

  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

// Only the per-page working-store selections survive reloads; the header
// rehydrates them on mount (client-only, so the server never reads
// localStorage and no hydration mismatch is possible).
type PersistedUIState = Pick<UIState, "selectedStoreIds">;

// Quota/unavailability-safe localStorage adapter: persistence silently
// degrades instead of throwing into every set().
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // Over quota or blocked — the in-memory store keeps working.
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // Nothing to clear.
    }
  },
};

export const useUIStore = create<UIState>()(
  persist<UIState, [], [], PersistedUIState>(
    (set) => ({
      selectedStoreIds: {},
      stores: [],

      setSelectedStoreId: (page, id) =>
        set((s) => ({ selectedStoreIds: { ...s.selectedStoreIds, [page]: id } })),
      setStores: (stores) => set({ stores }),

      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    }),
    {
      name: "inv-ui-prefs",
      version: 2,
      storage: createJSONStorage<PersistedUIState>(() => safeStorage),
      skipHydration: true, // Header calls rehydrate() on mount (client-only).
      partialize: (state): PersistedUIState => ({
        selectedStoreIds: state.selectedStoreIds,
      }),
      // v1 stored one global selectedStoreId; carry it over as the inventory
      // page's selection (the page it was set from), others start fresh.
      migrate: (persisted): PersistedUIState => {
        const legacy =
          (persisted as { selectedStoreId?: string | null } | null)?.selectedStoreId ?? null;
        const selectedStoreIds: Record<string, string | null> = legacy
          ? { inventory: legacy }
          : {};
        return { selectedStoreIds };
      },
    }
  )
);

// Page-scoped accessor: a page passes its key and gets only ITS selection
// back. Switching stores on one page can never affect another page.
export function usePageStoreSelection(page: string) {
  const selectedStoreId = useUIStore((s) => s.selectedStoreIds[page] ?? null);
  const setSelectedStoreId = useCallback(
    (id: string | null) => useUIStore.getState().setSelectedStoreId(page, id),
    [page]
  );
  return { selectedStoreId, setSelectedStoreId };
}
