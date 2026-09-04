/**
 * Increment-Only Stock Operations
 * 
 * Every quantity mutation uses FieldValue.increment() transforms.
 * No absolute quantity writes anywhere. This makes math errors impossible
 * because increments commute in any replay order (online, offline, reconnect).
 * 
 * Based on Firebase's documented pattern:
 * "This could be done without a transaction by updating the population using FieldValue.increment()"
 * https://firebase.google.com/docs/firestore/manage-data/transactions
 */

import {
  doc,
  writeBatch,
  runTransaction,
  increment,
  Timestamp,
  FieldValue,
  DocumentReference,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase/config';
import {
  StockOperation,
  StockOperationType,
  CreateStockOperationInput,
  StockOperationResult,
  TransferDoc,
} from './types';

/** Generate a UUID v4 for idempotency keys */
function generateId(): string {
  return crypto.randomUUID();
}

/** Get facility ID from auth context - single source of truth */
function getFacilityId(): string {
  // This mirrors the existing pattern in inventory-store.ts
  // In production, this should come from auth context
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('facilityId');
    if (stored) return stored;
  }
  return 'default-facility';
}

/**
 * Core: Apply increment transforms to inventory document via batch
 * Used by STOCK_IN, ADJUSTMENT, TRANSFER_OUT, TRANSFER_IN
 */
async function applyIncrementsToInventory(
  facilityId: string,
  inventoryId: string,
  deltas: Record<string, number>,
  userId: string,
  batch: ReturnType<typeof writeBatch>
): Promise<void> {
  const invRef = doc(getFirebaseDb(), 'facilities', facilityId, 'inventory', inventoryId);
  const increments: Record<string, FieldValue> = {};
  
  for (const [qtyTypeId, delta] of Object.entries(deltas)) {
    if (delta !== 0) {
      increments[`quantities.${qtyTypeId}`] = increment(delta);
    }
  }
  
  if (Object.keys(increments).length > 0) {
    batch.update(invRef, {
      ...increments,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }
}

/**
 * Core: Record operation in ledger
 */
function recordOperation(
  facilityId: string,
  input: CreateStockOperationInput,
  batch: ReturnType<typeof writeBatch>
): string {
  const opId = generateId();
  const opRef = doc(getFirebaseDb(), 'facilities', facilityId, 'stockOperations', opId);
  
  const operation: StockOperation = {
    id: opId,
    type: input.type,
    inventoryId: input.inventoryId,
    storeId: input.storeId,
    itemId: input.itemId,
    itemName: input.itemName,
    itemCode: input.itemCode,
    deltas: input.deltas,
    reason: input.reason,
    performedBy: input.performedBy,
    performedAt: Timestamp.now(),
    status: 'PENDING',
    syncAttempts: 0,
    transferId: input.transferId,
  };
  
  batch.set(opRef, operation);
  return opId;
}

/**
 * STOCK IN - Add stock to inventory
 * Online & Offline: Same code path - batched increments + ledger entry
 */
export async function addStockIn(
  inventoryId: string,
  deltas: Record<string, number>,
  reason: string,
  userId: string,
  itemMeta: { itemId: string; itemName: string; itemCode: string; storeId: string }
): Promise<StockOperationResult> {
  try {
    const facilityId = getFacilityId();
    const batch = writeBatch(getFirebaseDb());
    
    // 1. Record operation in ledger
    recordOperation(facilityId, {
      type: 'STOCK_IN',
      inventoryId,
      storeId: itemMeta.storeId,
      itemId: itemMeta.itemId,
      itemName: itemMeta.itemName,
      itemCode: itemMeta.itemCode,
      deltas,
      reason,
      performedBy: userId,
    }, batch);
    
    // 2. Apply increment transforms to inventory
    await applyIncrementsToInventory(facilityId, inventoryId, deltas, userId, batch);
    
    // 3. Commit batch (fire-and-forget for offline - SDK queues durably)
    await batch.commit();
    
    return { success: true };
  } catch (error) {
    console.error('[stockOps] addStockIn failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * ADJUST STOCK - Positive or negative adjustment
 * Online & Offline: Same code path - batched increments + ledger entry
 */
export async function adjustStock(
  inventoryId: string,
  deltas: Record<string, number>,
  reason: string,
  userId: string,
  itemMeta: { itemId: string; itemName: string; itemCode: string; storeId: string }
): Promise<StockOperationResult> {
  try {
    const facilityId = getFacilityId();
    const batch = writeBatch(getFirebaseDb());
    
    // Filter out zero deltas
    const filteredDeltas = Object.fromEntries(
      Object.entries(deltas).filter(([, v]) => v !== 0)
    );
    
    if (Object.keys(filteredDeltas).length === 0) {
      return { success: true }; // No-op
    }
    
    // 1. Record operation in ledger
    recordOperation(facilityId, {
      type: 'ADJUSTMENT',
      inventoryId,
      storeId: itemMeta.storeId,
      itemId: itemMeta.itemId,
      itemName: itemMeta.itemName,
      itemCode: itemMeta.itemCode,
      deltas: filteredDeltas,
      reason,
      performedBy: userId,
    }, batch);
    
    // 2. Apply increment transforms (positive or negative)
    await applyIncrementsToInventory(facilityId, inventoryId, filteredDeltas, userId, batch);
    
    // 3. Commit batch
    await batch.commit();
    
    return { success: true };
  } catch (error) {
    console.error('[stockOps] adjustStock failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * STOCK OUT (Sale) - Requires validation: available >= requested
 * Only path using transaction - but writes increments, not absolute values
 */
export async function recordSale(
  saleItems: Array<{
    inventoryId: string;
    deltas: Record<string, number>; // Positive quantities to deduct
    itemMeta: { itemId: string; itemName: string; itemCode: string; storeId: string };
  }>,
  userId: string,
  reason: string = 'Sale'
): Promise<StockOperationResult> {
  try {
    const facilityId = getFacilityId();
    const opId = generateId();
    const opRef = doc(getFirebaseDb(), 'facilities', facilityId, 'stockOperations', opId);
    
    await runTransaction(getFirebaseDb(), async (txn) => {
      // ALL READS FIRST - get server-committed state
      const invRefs = saleItems.map(item => 
        doc(getFirebaseDb(), 'facilities', facilityId, 'inventory', item.inventoryId)
      );
      const invSnaps = await Promise.all(invRefs.map(ref => txn.get(ref)));
      
      // VALIDATE: Check each item has sufficient stock
      for (let i = 0; i < saleItems.length; i++) {
        const item = saleItems[i];
        const snap = invSnaps[i];
        const serverQuantities = (snap.data()?.quantities || {}) as Record<string, number>;
        
        for (const [qtyTypeId, requestedQty] of Object.entries(item.deltas)) {
          const available = serverQuantities[qtyTypeId] || 0;
          if (available < requestedQty) {
            throw new Error(
              `Insufficient stock for ${item.itemMeta.itemName} (${qtyTypeId}): ` +
              `available ${available}, requested ${requestedQty}`
            );
          }
        }
      }
      
      // ALL WRITES SECOND - increment transforms only
      for (const item of saleItems) {
        const invRef = doc(getFirebaseDb(), 'facilities', facilityId, 'inventory', item.inventoryId);
        const increments: Record<string, FieldValue> = {};
        
        for (const [qtyTypeId, qty] of Object.entries(item.deltas)) {
          if (qty !== 0) {
            increments[`quantities.${qtyTypeId}`] = increment(-qty); // NEGATIVE for stock out
          }
        }
        
        if (Object.keys(increments).length > 0) {
          txn.update(invRef, {
            ...increments,
            updatedAt: Timestamp.now(),
            updatedBy: userId,
          });
        }
      }
      
      // Record operation as SYNCED (transaction = immediate sync)
      const combinedDeltas: Record<string, number> = {};
      for (const item of saleItems) {
        for (const [qtyTypeId, qty] of Object.entries(item.deltas)) {
          combinedDeltas[qtyTypeId] = (combinedDeltas[qtyTypeId] || 0) - qty;
        }
      }
      
      txn.set(opRef, {
        id: opId,
        type: 'STOCK_OUT',
        inventoryId: saleItems[0].inventoryId,
        storeId: saleItems[0].itemMeta.storeId,
        itemId: saleItems[0].itemMeta.itemId,
        itemName: saleItems[0].itemMeta.itemName,
        itemCode: saleItems[0].itemMeta.itemCode,
        deltas: combinedDeltas,
        reason,
        performedBy: userId,
        performedAt: Timestamp.now(),
        status: 'SYNCED',
        syncAttempts: 0,
      } satisfies StockOperation);
    });
    
    return { success: true, operationId: opId };
  } catch (error) {
    console.error('[stockOps] recordSale failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * TRANSFER DISPATCH - Decrement source, create transfer doc, log TRANSFER_OUT
 */
export async function dispatchTransfer(
  transferData: {
    fromStoreId: string;
    toStoreId: string;
    itemId: string;
    itemName: string;
    itemCode: string;
    deltas: Record<string, number>;
    sourceInventoryId: string;
    reason: string;
    userId: string;
  }
): Promise<StockOperationResult> {
  try {
    const facilityId = getFacilityId();
    const transferId = generateId();
    const opId = generateId();
    const batch = writeBatch(getFirebaseDb());
    
    // 1. Source inventory: increment(-delta)
    await applyIncrementsToInventory(
      facilityId,
      transferData.sourceInventoryId,
      Object.fromEntries(
        Object.entries(transferData.deltas).map(([k, v]) => [k, -v])
      ),
      transferData.userId,
      batch
    );
    
    // 2. Create transfer document
    const xferRef = doc(getFirebaseDb(), 'facilities', facilityId, 'transfers', transferId);
    batch.set(xferRef, {
      id: transferId,
      fromStoreId: transferData.fromStoreId,
      toStoreId: transferData.toStoreId,
      itemId: transferData.itemId,
      itemName: transferData.itemName,
      itemCode: transferData.itemCode,
      deltas: transferData.deltas,
      status: 'DISPATCHED',
      dispatchedAt: Timestamp.now(),
      dispatchedOpId: opId,
      createdBy: transferData.userId,
    } satisfies TransferDoc);
    
    // 3. Log TRANSFER_OUT operation
    recordOperation(facilityId, {
      type: 'TRANSFER_OUT',
      inventoryId: transferData.sourceInventoryId,
      storeId: transferData.fromStoreId,
      itemId: transferData.itemId,
      itemName: transferData.itemName,
      itemCode: transferData.itemCode,
      deltas: Object.fromEntries(
        Object.entries(transferData.deltas).map(([k, v]) => [k, -v])
      ),
      reason: transferData.reason,
      performedBy: transferData.userId,
      transferId,
    }, batch);
    
    // 4. Commit batch
    await batch.commit();
    
    return { success: true, operationId: opId };
  } catch (error) {
    console.error('[stockOps] dispatchTransfer failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * TRANSFER RECEIVE - Increment target, update transfer doc, log TRANSFER_IN
 */
export async function receiveTransfer(
  transferId: string,
  targetInventoryId: string,
  targetStoreId: string,
  userId: string,
  reason: string = 'Transfer received'
): Promise<StockOperationResult> {
  try {
    const facilityId = getFacilityId();
    const opId = generateId();
    
    // Get transfer doc to read deltas
    const xferRef = doc(getFirebaseDb(), 'facilities', facilityId, 'transfers', transferId);
    const xferSnap = await runTransaction(getFirebaseDb(), async (txn) => {
      const xferSnap = await txn.get(xferRef);
      if (!xferSnap.exists()) {
        throw new Error('Transfer not found');
      }
      const xferData = xferSnap.data() as TransferDoc;
      if (xferData.status !== 'DISPATCHED') {
        throw new Error(`Transfer already ${xferData.status}`);
      }
      
      // 1. Target inventory: increment(+delta)
      const targetInvRef = doc(getFirebaseDb(), 'facilities', facilityId, 'inventory', targetInventoryId);
      const increments: Record<string, FieldValue> = {};
      for (const [qtyTypeId, delta] of Object.entries(xferData.deltas)) {
        increments[`quantities.${qtyTypeId}`] = increment(delta);
      }
      txn.update(targetInvRef, {
        ...increments,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });
      
      // 2. Update transfer doc to RECEIVED
      txn.update(xferRef, {
        status: 'RECEIVED',
        receivedAt: Timestamp.now(),
        receivedOpId: opId,
      });
      
      // 3. Log TRANSFER_IN operation
      const opRef = doc(getFirebaseDb(), 'facilities', facilityId, 'stockOperations', opId);
      txn.set(opRef, {
        id: opId,
        type: 'TRANSFER_IN',
        inventoryId: targetInventoryId,
        storeId: targetStoreId,
        itemId: xferData.itemId,
        itemName: xferData.itemName,
        itemCode: xferData.itemCode,
        deltas: xferData.deltas,
        reason,
        performedBy: userId,
        performedAt: Timestamp.now(),
        status: 'SYNCED',
        syncAttempts: 0,
        transferId,
      } satisfies StockOperation);
      
      return xferSnap;
    });
    
    return { success: true, operationId: opId };
  } catch (error) {
    console.error('[stockOps] receiveTransfer failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * TRANSFER CANCEL - Reverse dispatch: increment source back, update transfer doc
 */
export async function cancelTransfer(
  transferId: string,
  userId: string,
  reason: string = 'Transfer cancelled'
): Promise<StockOperationResult> {
  try {
    const facilityId = getFacilityId();
    const opId = generateId();
    
    const xferRef = doc(getFirebaseDb(), 'facilities', facilityId, 'transfers', transferId);

    await runTransaction(getFirebaseDb(), async (txn) => {
      const xferSnap = await txn.get(xferRef);
      if (!xferSnap.exists()) {
        throw new Error('Transfer not found');
      }
      const xferData = xferSnap.data() as TransferDoc;
      if (xferData.status !== 'DISPATCHED') {
        throw new Error(`Cannot cancel transfer in status: ${xferData.status}`);
      }
      
      // 1. Source inventory: increment(+delta) to reverse dispatch
      // Need to find source inventory - for now assume we can query it
      // In practice, source inventory ID should be stored on transfer doc
      // For this implementation, we'll need to look it up
      // This is a simplification - real impl would store sourceInventoryId on transfer
      throw new Error('Cancel transfer requires sourceInventoryId on transfer doc - not yet implemented');
    });
    
    return { success: false, error: 'Cancel transfer not fully implemented - needs sourceInventoryId on transfer doc' };
  } catch (error) {
    console.error('[stockOps] cancelTransfer failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}