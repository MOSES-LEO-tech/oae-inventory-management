/**
 * Stock Operation Types
 * 
 * Single source of truth for all inventory mutations.
 * Every quantity change is recorded as an intent (delta), never as computed state.
 * This makes math errors impossible by construction - increments commute in any order.
 */

import { Timestamp } from 'firebase/firestore';

/** Types of stock operations */
export type StockOperationType = 
  | 'STOCK_IN' 
  | 'STOCK_OUT' 
  | 'ADJUSTMENT' 
  | 'TRANSFER_OUT' 
  | 'TRANSFER_IN';

/** Status of an operation in the sync pipeline */
export type OperationStatus = 'PENDING' | 'SYNCED' | 'FAILED';

/** Core stock operation - append-only ledger entry */
export interface StockOperation {
  id: string; // UUID v4, serves as idempotency key
  type: StockOperationType;
  inventoryId: string;
  storeId: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  /** Deltas per quantity type: { qtyTypeId: +5 } or { qtyTypeId: -3 } */
  deltas: Record<string, number>;
  reason: string;
  performedBy: string;
  performedAt: Timestamp; // Client timestamp when operation initiated
  serverTimestamp?: Timestamp; // Set by server on successful sync
  status: OperationStatus;
  syncAttempts: number;
  lastError?: string;
  /** Optional link to transfer document */
  transferId?: string;
}

/** Transfer document - links dispatch and receive operations */
export interface TransferDoc {
  id: string;
  fromStoreId: string;
  toStoreId: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  deltas: Record<string, number>;
  status: 'DISPATCHED' | 'RECEIVED' | 'CANCELLED';
  dispatchedAt: Timestamp;
  receivedAt?: Timestamp;
  dispatchedOpId: string; // Links to TRANSFER_OUT StockOperation
  receivedOpId?: string;  // Links to TRANSFER_IN StockOperation
  createdBy: string;
}

/** Inventory document shape (quantities only modified via increment transforms) */
export interface InventoryDoc {
  id: string;
  itemId: string;
  storeId: string;
  itemName: string;
  itemType: string;
  itemCode: string;
  quantityTypes: QuantityType[];
  lowStockThresholds: Record<string, number>;
  // Quantities are NEVER written as absolute map
  // Modified ONLY via FieldValue.increment() transforms
  updatedAt: Timestamp;
  updatedBy: string;
  version: number;
}

/** Quantity type definition from catalog */
export interface QuantityType {
  id: string;
  name: string;
  unit: string;
  isBase: boolean;
  conversionFactor?: number; // For non-base types
}

/** Input for creating stock operations */
export interface CreateStockOperationInput {
  type: StockOperationType;
  inventoryId: string;
  storeId: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  deltas: Record<string, number>;
  reason: string;
  performedBy: string;
  transferId?: string;
}

/** Result of a stock operation */
export interface StockOperationResult {
  success: boolean;
  operationId?: string;
  error?: string;
}

/** Sync status for UI */
export type SyncStatus = 'synced' | 'syncing' | 'offline';

/** Inventory item with sync metadata */
export interface InventoryItemWithSync extends InventoryDoc {
  hasPendingWrites: boolean;
  fromCache: boolean;
}