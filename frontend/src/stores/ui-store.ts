import { create } from "zustand";
import { Store } from "@/types";

interface UIState {
  // Store selection
  selectedStoreId: string | null;
  stores: Store[];

  setSelectedStoreId: (id: string | null) => void;
  setStores: (stores: Store[]) => void;

  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedStoreId: null,
  stores: [],

  setSelectedStoreId: (id) => set({ selectedStoreId: id }),
  setStores: (stores) => set({ stores }),

  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
