import { create } from "zustand";
import { InventoryWithItem } from "@/types";
import {
  getDocuments,
  addDocument,
  updateDocument,
} from "@/lib/firebase/firestore";
import { where, orderBy } from "firebase/firestore";

interface InventoryState {
  items: InventoryWithItem[];
  searchQuery: string;
  selectedStoreId: string | null;
  selectedStockYear: string | null;
  showLowStockOnly: boolean;
  isLoading: boolean;

  // Actions
  setSearchQuery: (query: string) => void;
  setSelectedStoreId: (id: string | null) => void;
  setSelectedStockYear: (year: string | null) => void;
  toggleLowStockOnly: () => void;

  fetchInventory: () => Promise<void>;
  adjustStock: (
    inventoryId: string,
    adjustmentPc: number,
    adjustmentCtn: number,
    notes: string,
    performedBy: string
  ) => Promise<void>;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  items: [],
  searchQuery: "",
  selectedStoreId: null,
  selectedStockYear: null,
  showLowStockOnly: false,
  isLoading: false,

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedStoreId: (id) => set({ selectedStoreId: id }),
  setSelectedStockYear: (year) => set({ selectedStockYear: year }),
  toggleLowStockOnly: () => set((s) => ({ showLowStockOnly: !s.showLowStockOnly })),

  fetchInventory: async () => {
    set({ isLoading: true });
    try {
      const constraints = [orderBy("itemName")];
      // TODO: Add store/year filters via composite queries once Firebase indexes are set up
      const items = await getDocuments<InventoryWithItem>("inventory", constraints);
      set({ items });
    } catch (error) {
      console.error("Failed to fetch inventory:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  adjustStock: async (inventoryId, adjustmentPc, adjustmentCtn, notes, performedBy) => {
    const item = get().items.find((i) => i.id === inventoryId);
    if (!item) throw new Error("Item not found");

    await updateDocument("inventory", inventoryId, {
      qtyPc: item.qtyPc + adjustmentPc,
      qtyCtn: item.qtyCtn + adjustmentCtn,
    });
  },
}));
