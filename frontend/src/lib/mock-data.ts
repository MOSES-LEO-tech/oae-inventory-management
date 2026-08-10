/**
 * Mock data for development preview. Replace with Firestore calls when backend is ready.
 * This file should only be used in dev mode — guarded by the DEV_BYPASS in auth-provider.tsx.
 */

import {
  CurrencyPrefs,
  DEFAULT_PREFERENCES,
  formatCurrencyWithPrefs,
} from "@/lib/preferences";
import { useUIStore } from "@/stores/ui-store";

function getActiveCurrencyPrefs(): CurrencyPrefs {
  try {
    const state = useUIStore.getState();
    if (state?.prefs?.currency) return state.prefs.currency;
  } catch {
    // Fall through to defaults if store not yet initialized (SSR / early import).
  }
  return DEFAULT_PREFERENCES.currency;
}

export const MOCK_STORES = [
  { id: "main-stores", name: "Main Stores" },
  { id: "store-b", name: "Store B" },
];

export type MockItem = {
  id: string;
  name: string;
  type: string;
  code?: string;
  category: string;
  unitPricePc: number;
  unitPriceCtn: number;
  lowStockThresholdPc: number;
  lowStockThresholdCtn: number;
};

export type MockInventoryRow = MockItem & {
  storeId: string;
  stockYear: string;
  qtyPc: number;
  qtyCtn: number;
};

export const MOCK_ITEMS: MockItem[] = [
  { id: "1", name: "Ball point pens, Dolphin", type: "Blue", category: "NEW_STOCK", unitPricePc: 500, unitPriceCtn: 12000, lowStockThresholdPc: 20, lowStockThresholdCtn: 5 },
  { id: "2", name: "Ball point pens, Dolphin", type: "Black", category: "NEW_STOCK", unitPricePc: 500, unitPriceCtn: 12000, lowStockThresholdPc: 20, lowStockThresholdCtn: 5 },
  { id: "3", name: "Binding Rings, PVC", type: "12mm", category: "NEW_STOCK", unitPricePc: 2000, unitPriceCtn: 0, lowStockThresholdPc: 10, lowStockThresholdCtn: 0 },
  { id: "4", name: "Binding Rings, PVC", type: "18mm", category: "NEW_STOCK", unitPricePc: 3000, unitPriceCtn: 0, lowStockThresholdPc: 10, lowStockThresholdCtn: 0 },
  { id: "5", name: "Binder Clips", type: "Small", category: "OLD_STOCK", unitPricePc: 300, unitPriceCtn: 8000, lowStockThresholdPc: 30, lowStockThresholdCtn: 8 },
  { id: "6", name: "Binder Clips", type: "Medium", category: "OLD_STOCK", unitPricePc: 500, unitPriceCtn: 10000, lowStockThresholdPc: 25, lowStockThresholdCtn: 6 },
  { id: "7", name: "Notice Boards", type: "60x90", category: "OLD_STOCK", unitPricePc: 25000, unitPriceCtn: 0, lowStockThresholdPc: 3, lowStockThresholdCtn: 0 },
  { id: "8", name: "White Boards", type: "60x90", category: "OLD_STOCK", unitPricePc: 30000, unitPriceCtn: 0, lowStockThresholdPc: 3, lowStockThresholdCtn: 0 },
  { id: "9", name: "Counter Books", type: "200p", category: "NEW_STOCK", unitPricePc: 1500, unitPriceCtn: 0, lowStockThresholdPc: 15, lowStockThresholdCtn: 0 },
  { id: "10", name: "Cash Books", type: "", category: "OLD_STOCK", unitPricePc: 2000, unitPriceCtn: 0, lowStockThresholdPc: 10, lowStockThresholdCtn: 0 },
  { id: "11", name: "Cello Tape", type: "1 inch", category: "NEW_STOCK", unitPricePc: 1000, unitPriceCtn: 18000, lowStockThresholdPc: 20, lowStockThresholdCtn: 4 },
  { id: "12", name: "Clear Bags", type: "Small", category: "NEW_STOCK", unitPricePc: 200, unitPriceCtn: 5000, lowStockThresholdPc: 50, lowStockThresholdCtn: 12 },
  { id: "13", name: "Analysis Books", type: "96p", category: "OLD_STOCK", unitPricePc: 800, unitPriceCtn: 0, lowStockThresholdPc: 15, lowStockThresholdCtn: 0 },
  { id: "14", name: "Box Files", type: "A4", category: "NEW_STOCK", unitPricePc: 3500, unitPriceCtn: 0, lowStockThresholdPc: 5, lowStockThresholdCtn: 0 },
  { id: "15", name: "Canvas Art Boards", type: "Cotton", category: "OLD_STOCK", unitPricePc: 5000, unitPriceCtn: 0, lowStockThresholdPc: 8, lowStockThresholdCtn: 0 },
  { id: "16", name: "Clamp Files", type: "A4", category: "OLD_STOCK", unitPricePc: 2500, unitPriceCtn: 0, lowStockThresholdPc: 10, lowStockThresholdCtn: 0 },
  { id: "17", name: "Computer Papers, Sinarline", type: "1000s", category: "NEW_STOCK", unitPricePc: 18000, unitPriceCtn: 0, lowStockThresholdPc: 3, lowStockThresholdCtn: 0 },
  { id: "18", name: "Desk Organizers", type: "24pcs", category: "NEW_STOCK", unitPricePc: 8000, unitPriceCtn: 0, lowStockThresholdPc: 5, lowStockThresholdCtn: 0 },
  { id: "19", name: "Manuscript Books, A4", type: "2Q", category: "NEW_STOCK", unitPricePc: 1200, unitPriceCtn: 0, lowStockThresholdPc: 10, lowStockThresholdCtn: 0 },
  { id: "20", name: "Manuscript Books, A4", type: "3Q", category: "NEW_STOCK", unitPricePc: 1500, unitPriceCtn: 0, lowStockThresholdPc: 10, lowStockThresholdCtn: 0 },
];

export const MOCK_INVENTORY: MockInventoryRow[] = [
  // Main Stores
  { ...MOCK_ITEMS[0], storeId: "main-stores", stockYear: "2026", qtyPc: 45, qtyCtn: 8 },
  { ...MOCK_ITEMS[1], storeId: "main-stores", stockYear: "2026", qtyPc: 38, qtyCtn: 7 },
  { ...MOCK_ITEMS[2], storeId: "main-stores", stockYear: "2026", qtyPc: 15, qtyCtn: 0 },
  { ...MOCK_ITEMS[3], storeId: "main-stores", stockYear: "2026", qtyPc: 12, qtyCtn: 0 },
  { ...MOCK_ITEMS[4], storeId: "main-stores", stockYear: "OLD_STOCK", qtyPc: 8, qtyCtn: 2 },
  { ...MOCK_ITEMS[5], storeId: "main-stores", stockYear: "OLD_STOCK", qtyPc: 5, qtyCtn: 1 },
  { ...MOCK_ITEMS[6], storeId: "main-stores", stockYear: "OLD_STOCK", qtyPc: 4, qtyCtn: 0 },
  { ...MOCK_ITEMS[7], storeId: "main-stores", stockYear: "OLD_STOCK", qtyPc: 3, qtyCtn: 0 },
  { ...MOCK_ITEMS[8], storeId: "main-stores", stockYear: "2026", qtyPc: 22, qtyCtn: 0 },
  { ...MOCK_ITEMS[9], storeId: "main-stores", stockYear: "OLD_STOCK", qtyPc: 10, qtyCtn: 0 },
  { ...MOCK_ITEMS[10], storeId: "main-stores", stockYear: "2026", qtyPc: 30, qtyCtn: 6 },
  { ...MOCK_ITEMS[11], storeId: "main-stores", stockYear: "2026", qtyPc: 100, qtyCtn: 24 },
  { ...MOCK_ITEMS[12], storeId: "main-stores", stockYear: "OLD_STOCK", qtyPc: 12, qtyCtn: 0 },
  { ...MOCK_ITEMS[13], storeId: "main-stores", stockYear: "2026", qtyPc: 7, qtyCtn: 0 },
  { ...MOCK_ITEMS[14], storeId: "main-stores", stockYear: "OLD_STOCK", qtyPc: 6, qtyCtn: 0 },
  { ...MOCK_ITEMS[15], storeId: "main-stores", stockYear: "OLD_STOCK", qtyPc: 3, qtyCtn: 0 },
  { ...MOCK_ITEMS[16], storeId: "main-stores", stockYear: "2026", qtyPc: 2, qtyCtn: 0 },
  { ...MOCK_ITEMS[17], storeId: "main-stores", stockYear: "2026", qtyPc: 4, qtyCtn: 0 },
  { ...MOCK_ITEMS[18], storeId: "main-stores", stockYear: "2026", qtyPc: 8, qtyCtn: 0 },
  { ...MOCK_ITEMS[19], storeId: "main-stores", stockYear: "2026", qtyPc: 5, qtyCtn: 0 },

  // Store B
  { ...MOCK_ITEMS[0], storeId: "store-b", stockYear: "2026", qtyPc: 30, qtyCtn: 5 },
  { ...MOCK_ITEMS[1], storeId: "store-b", stockYear: "2026", qtyPc: 25, qtyCtn: 4 },
  { ...MOCK_ITEMS[6], storeId: "store-b", stockYear: "OLD_STOCK", qtyPc: 2, qtyCtn: 0 },
  { ...MOCK_ITEMS[7], storeId: "store-b", stockYear: "OLD_STOCK", qtyPc: 1, qtyCtn: 0 },
  { ...MOCK_ITEMS[8], storeId: "store-b", stockYear: "2026", qtyPc: 15, qtyCtn: 0 },
  { ...MOCK_ITEMS[10], storeId: "store-b", stockYear: "2026", qtyPc: 18, qtyCtn: 3 },
  { ...MOCK_ITEMS[11], storeId: "store-b", stockYear: "2026", qtyPc: 60, qtyCtn: 14 },
  { ...MOCK_ITEMS[18], storeId: "store-b", stockYear: "2026", qtyPc: 42, qtyCtn: 0 },
  { ...MOCK_ITEMS[19], storeId: "store-b", stockYear: "2026", qtyPc: 20, qtyCtn: 0 },
];

export type MockMovement = {
  id: string;
  storeId: string;
  itemName: string;
  type: "IN" | "OUT" | "TRANSFER_IN" | "TRANSFER_OUT" | "ADJUSTMENT";
  qtyPc: number;
  qtyCtn: number;
  referenceType: string;
  performedBy: string;
  notes?: string;
  createdAt: string; // ISO date
};

export const MOCK_MOVEMENTS: MockMovement[] = [
  { id: "m1", storeId: "main-stores", itemName: "Ball point pens, Dolphin", type: "IN", qtyPc: 50, qtyCtn: 10, referenceType: "PURCHASE", performedBy: "Preview User", notes: "New stock received", createdAt: "2026-08-03T09:30:00Z" },
  { id: "m2", storeId: "main-stores", itemName: "Counter Books", type: "OUT", qtyPc: 5, qtyCtn: 0, referenceType: "SALE", performedBy: "Preview User", createdAt: "2026-08-03T10:15:00Z" },
  { id: "m3", storeId: "store-b", itemName: "Manuscript Books, A4", type: "OUT", qtyPc: 3, qtyCtn: 0, referenceType: "SALE", performedBy: "Preview User", createdAt: "2026-08-03T11:00:00Z" },
  { id: "m4", storeId: "main-stores", itemName: "Binding Rings, PVC", type: "TRANSFER_OUT", qtyPc: 2, qtyCtn: 0, referenceType: "TRANSFER", performedBy: "Preview User", notes: "Transfer to Store B", createdAt: "2026-08-03T11:45:00Z" },
  { id: "m5", storeId: "store-b", itemName: "Binding Rings, PVC", type: "TRANSFER_IN", qtyPc: 2, qtyCtn: 0, referenceType: "TRANSFER", performedBy: "Preview User", createdAt: "2026-08-03T12:00:00Z" },
  { id: "m6", storeId: "main-stores", itemName: "Box Files", type: "IN", qtyPc: 10, qtyCtn: 0, referenceType: "PURCHASE", performedBy: "Preview User", createdAt: "2026-08-02T14:00:00Z" },
  { id: "m7", storeId: "main-stores", itemName: "Clear Bags", type: "OUT", qtyPc: 20, qtyCtn: 5, referenceType: "SALE", performedBy: "Preview User", createdAt: "2026-08-02T15:30:00Z" },
  { id: "m8", storeId: "store-b", itemName: "Cello Tape", type: "IN", qtyPc: 100, qtyCtn: 20, referenceType: "PURCHASE", performedBy: "Preview User", createdAt: "2026-08-02T09:00:00Z" },
  { id: "m9", storeId: "main-stores", itemName: "Binder Clips", type: "ADJUSTMENT", qtyPc: -2, qtyCtn: 0, referenceType: "ADJUSTMENT", performedBy: "Preview User", notes: "Found damaged stock", createdAt: "2026-08-01T16:00:00Z" },
  { id: "m10", storeId: "main-stores", itemName: "Desk Organizers", type: "OUT", qtyPc: 1, qtyCtn: 0, referenceType: "SALE", performedBy: "Preview User", createdAt: "2026-08-01T10:00:00Z" },
];

export type MockSale = {
  id: string;
  storeId: string;
  items: { itemName: string; qtyPc: number; qtyCtn: number; unitPrice: number; subtotal: number }[];
  totalAmount: number;
  soldBy: string;
  createdAt: string;
};

export const MOCK_SALES: MockSale[] = [
  { id: "s1", storeId: "main-stores", items: [{ itemName: "Counter Books", qtyPc: 5, qtyCtn: 0, unitPrice: 1500, subtotal: 7500 }], totalAmount: 7500, soldBy: "Preview User", createdAt: "2026-08-03T10:15:00Z" },
  { id: "s2", storeId: "store-b", items: [{ itemName: "Manuscript Books, A4", qtyPc: 3, qtyCtn: 0, unitPrice: 1200, subtotal: 3600 }], totalAmount: 3600, soldBy: "Preview User", createdAt: "2026-08-03T11:00:00Z" },
  { id: "s3", storeId: "main-stores", items: [{ itemName: "Clear Bags", qtyPc: 20, qtyCtn: 5, unitPrice: 200, subtotal: 5000 }], totalAmount: 5000, soldBy: "Preview User", createdAt: "2026-08-02T15:30:00Z" },
  { id: "s4", storeId: "main-stores", items: [{ itemName: "Desk Organizers", qtyPc: 1, qtyCtn: 0, unitPrice: 8000, subtotal: 8000 }], totalAmount: 8000, soldBy: "Preview User", createdAt: "2026-08-01T10:00:00Z" },
  { id: "s5", storeId: "store-b", items: [{ itemName: "Ball point pens, Dolphin", qtyPc: 10, qtyCtn: 0, unitPrice: 500, subtotal: 5000 }, { itemName: "Cello Tape", qtyPc: 3, qtyCtn: 0, unitPrice: 1000, subtotal: 3000 }], totalAmount: 8000, soldBy: "Preview User", createdAt: "2026-08-01T14:00:00Z" },
];

export type MockTransfer = {
  id: string;
  fromStoreId: string;
  toStoreId: string;
  items: { itemName: string; qtyPc: number; qtyCtn: number }[];
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  requestedBy: string;
  completedBy?: string;
  notes?: string;
  createdAt: string;
  completedAt?: string;
};

export const MOCK_TRANSFERS: MockTransfer[] = [
  { id: "t1", fromStoreId: "main-stores", toStoreId: "store-b", items: [{ itemName: "Binding Rings, PVC", qtyPc: 2, qtyCtn: 0 }], status: "COMPLETED", requestedBy: "Preview User", completedBy: "Preview User", notes: "Urgent request from Store B", createdAt: "2026-08-03T11:45:00Z", completedAt: "2026-08-03T12:00:00Z" },
  { id: "t2", fromStoreId: "store-b", toStoreId: "main-stores", items: [{ itemName: "Manuscript Books, A4", qtyPc: 10, qtyCtn: 0 }], status: "PENDING", requestedBy: "Preview User", notes: "Need stock at main store", createdAt: "2026-08-03T14:00:00Z" },
];

// Utility
export function formatCurrency(amount: number, currencyPrefs?: CurrencyPrefs): string {
  const prefs = currencyPrefs ?? getActiveCurrencyPrefs();
  return formatCurrencyWithPrefs(amount, prefs);
}

export function getStoreName(storeId: string): string {
  return MOCK_STORES.find((s) => s.id === storeId)?.name ?? storeId;
}

export function removeItemFromInventory(inventoryRowId: string): { removed: boolean; message: string } {
  const idx = MOCK_INVENTORY.findIndex((r) => r.id === inventoryRowId);
  if (idx === -1) return { removed: false, message: "Item not found in inventory." };
  MOCK_INVENTORY.splice(idx, 1);
  return { removed: true, message: "Item removed from inventory." };
}

export function removeItemCompletely(itemId: string): { removed: boolean; message: string } {
  // Remove from inventory (all stores)
  const invIndices: number[] = [];
  MOCK_INVENTORY.forEach((r, i) => {
    if (r.id === itemId) invIndices.push(i);
  });
  // Remove in reverse order to preserve indices
  for (let i = invIndices.length - 1; i >= 0; i--) {
    MOCK_INVENTORY.splice(invIndices[i], 1);
  }
  // Remove from items catalog
  const itemIdx = MOCK_ITEMS.findIndex((i) => i.id === itemId);
  if (itemIdx !== -1) MOCK_ITEMS.splice(itemIdx, 1);
  return { removed: true, message: `Item removed from catalog and all inventory records (${invIndices.length} store${invIndices.length !== 1 ? "s" : ""}).` };
}

export function addItemToInventory(
  item: MockItem,
  storeId: string,
  qtyPc: number,
  qtyCtn: number
): MockInventoryRow {
  const newRow: MockInventoryRow = {
    id: item.id,
    name: item.name,
    type: item.type,
    category: item.category,
    lowStockThresholdPc: item.lowStockThresholdPc,
    lowStockThresholdCtn: item.lowStockThresholdCtn,
    storeId,
    stockYear: item.category,
    unitPricePc: item.unitPricePc,
    unitPriceCtn: item.unitPriceCtn,
    qtyPc,
    qtyCtn,
  };
  MOCK_INVENTORY.push(newRow);
  return newRow;
}

export function updateInventoryQuantities(
  inventoryRowId: string,
  qtyPc: number,
  qtyCtn: number
): MockInventoryRow | null {
  const row = MOCK_INVENTORY.find((r) => r.id === inventoryRowId);
  if (!row) return null;
  row.qtyPc = qtyPc;
  row.qtyCtn = qtyCtn;
  return row;
}

export function isLowStock(row: MockInventoryRow): boolean {
  const item = MOCK_ITEMS.find((i) => i.id === row.id);
  if (!item) return false;
  return (
    (item.lowStockThresholdPc > 0 && row.qtyPc <= item.lowStockThresholdPc) ||
    (item.lowStockThresholdCtn > 0 && row.qtyCtn <= item.lowStockThresholdCtn) ||
    row.qtyPc === 0
  );
}
