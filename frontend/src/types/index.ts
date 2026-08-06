import { Timestamp } from "firebase/firestore";

// ─── User & Auth ────────────────────────────────────────
export type UserRole = "admin" | "manager" | "clerk";

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  storeId: string;
}

// ─── Store ──────────────────────────────────────────────
export interface Store {
  id: string;
  name: string;
  createdAt: Timestamp;
}

// ─── Items ──────────────────────────────────────────────
export interface Item {
  id: string;
  name: string;
  type: string;
  code?: string;
  category: string; // "OLD_STOCK" | "2026" | "2027" | ...
  unitPricePc: number;
  unitPriceCtn: number;
  lowStockThresholdPc?: number;
  lowStockThresholdCtn?: number;
  createdAt: Timestamp;
}

// ─── Inventory ──────────────────────────────────────────
export interface InventoryItem {
  id: string;
  storeId: string;
  itemId: string;
  stockYear: string;
  qtyPc: number;
  qtyCtn: number;
  updatedAt: Timestamp;
}

export type InventoryWithItem = InventoryItem & {
  itemName: string;
  itemType: string;
  itemCode?: string;
  unitPricePc: number;
  unitPriceCtn: number;
  lowStockThresholdPc?: number;
  lowStockThresholdCtn?: number;
};

// ─── Stock Movements ────────────────────────────────────
export type MovementType = "IN" | "OUT" | "TRANSFER_IN" | "TRANSFER_OUT" | "ADJUSTMENT";
export type ReferenceType = "SALE" | "PURCHASE" | "TRANSFER" | "ADJUSTMENT";

export interface StockMovement {
  id: string;
  storeId: string;
  itemId: string;
  type: MovementType;
  qtyPc: number;
  qtyCtn: number;
  referenceType: ReferenceType;
  referenceId: string;
  performedBy: string;
  notes?: string;
  createdAt: Timestamp;
}

// ─── Sales ──────────────────────────────────────────────
export interface SaleItem {
  itemId: string;
  qtyPc: number;
  qtyCtn: number;
  unitPrice: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  storeId: string;
  items: SaleItem[];
  totalAmount: number;
  soldBy: string;
  createdAt: Timestamp;
}

// ─── Stock Transfers ────────────────────────────────────
export type TransferStatus = "PENDING" | "COMPLETED" | "CANCELLED";

export interface TransferItem {
  itemId: string;
  qtyPc: number;
  qtyCtn: number;
}

export interface StockTransfer {
  id: string;
  fromStoreId: string;
  toStoreId: string;
  items: TransferItem[];
  status: TransferStatus;
  requestedBy: string;
  completedBy?: string;
  notes?: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
}
