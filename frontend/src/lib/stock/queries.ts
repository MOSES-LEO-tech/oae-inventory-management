/**
 * Firestore onSnapshot Read Hooks
 * 
 * Firestore's local cache IS the database. The SDK's DocumentOverlayCache
 * automatically merges pending local writes on top of server state.
 * 
 * Using onSnapshot with includeMetadataChanges: true gives us:
 * - Real-time optimistic UI (pending writes visible immediately)
 * - hasPendingWrites metadata for "syncing" indicators
 * - fromCache metadata for "offline" banner
 * - No hand-rolled Zustand mirror needed
 * 
 * Based on Firebase docs:
 * - "Cloud Firestore snapshot listeners take an initial snapshot from the local cache"
 * - "Your listener can use the metadata.hasPendingWrites field"
 * - DocumentOverlayCache merges all pending mutations correctly
 */

import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  query,
  onSnapshot,
  doc,
  orderBy,
  where,
  QueryConstraint,
  DocumentData,
  QuerySnapshot,
  DocumentSnapshot,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase/config';
import {
  InventoryDoc,
  InventoryItemWithSync,
  StockOperation,
  TransferDoc,
  SyncStatus,
} from './types';

/** Get facility ID from local storage (matches existing pattern) */
function getFacilityId(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('facilityId');
    if (stored) return stored;
  }
  return 'default-facility';
}

/**
 * Hook: Subscribe to all inventory items for a facility
 * Returns items with real-time sync status
 */
export function useInventory() {
  const [items, setItems] = useState<InventoryItemWithSync[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const facilityId = getFacilityId();
    if (!facilityId || facilityId === 'default-facility') {
      setLoading(false);
      return;
    }

    const q = query(
      collection(getFirebaseDb(), 'facilities', facilityId, 'inventory'),
      orderBy('itemName')
    );

    const unsubscribe = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot: QuerySnapshot<DocumentData>) => {
        const data: InventoryItemWithSync[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          hasPendingWrites: doc.metadata.hasPendingWrites,
          fromCache: snapshot.metadata.fromCache,
        } as InventoryItemWithSync));
        
        setItems(data);
        
        // Compute overall sync status
        const hasPending = snapshot.docChanges().some(
          change => change.doc.metadata.hasPendingWrites
        );
        const fromCache = snapshot.metadata.fromCache;
        
        if (!navigator.onLine) {
          setSyncStatus('offline');
        } else if (hasPending || fromCache) {
          setSyncStatus('syncing');
        } else {
          setSyncStatus('synced');
        }
        
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[stockQueries] Inventory listener error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { items, syncStatus, loading, error };
}

/**
 * Hook: Subscribe to a single inventory item
 * Returns item with pending writes status for optimistic UI
 */
export function useInventoryItem(inventoryId: string | null) {
  const [item, setItem] = useState<InventoryItemWithSync | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!inventoryId) {
      setItem(null);
      setLoading(false);
      return;
    }

    const facilityId = getFacilityId();
    if (!facilityId || facilityId === 'default-facility') {
      setLoading(false);
      return;
    }

    const ref = doc(getFirebaseDb(), 'facilities', facilityId, 'inventory', inventoryId);

    const unsubscribe = onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (snapshot.exists()) {
          setItem({
            id: snapshot.id,
            ...snapshot.data(),
            hasPendingWrites: snapshot.metadata.hasPendingWrites,
            fromCache: snapshot.metadata.fromCache,
          } as InventoryItemWithSync);
        } else {
          setItem(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[stockQueries] Item listener error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [inventoryId]);

  return { item, loading, error };
}

/**
 * Hook: Subscribe to stock operations (ledger) for a facility
 * Optional: filter by inventoryId, type, status
 */
export function useStockOperations(filters?: {
  inventoryId?: string;
  type?: StockOperation['type'];
  status?: StockOperation['status'];
  limit?: number;
}) {
  const [operations, setOperations] = useState<StockOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const facilityId = getFacilityId();
    if (!facilityId || facilityId === 'default-facility') {
      setLoading(false);
      return;
    }

    const constraints: QueryConstraint[] = [orderBy('performedAt', 'desc')];
    
    if (filters?.inventoryId) {
      constraints.push(where('inventoryId', '==', filters.inventoryId));
    }
    if (filters?.type) {
      constraints.push(where('type', '==', filters.type));
    }
    if (filters?.status) {
      constraints.push(where('status', '==', filters.status));
    }
    // Note: limit would require Firestore limit() but we'll handle in memory for simplicity

    const q = query(
      collection(getFirebaseDb(), 'facilities', facilityId, 'stockOperations'),
      ...constraints
    );

    const unsubscribe = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot: QuerySnapshot<DocumentData>) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as StockOperation));
        
        setOperations(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[stockQueries] Operations listener error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [filters?.inventoryId, filters?.type, filters?.status]);

  return { operations, loading, error };
}

/**
 * Hook: Subscribe to transfers for a facility
 */
export function useTransfers(filters?: {
  status?: TransferDoc['status'];
  fromStoreId?: string;
  toStoreId?: string;
}) {
  const [transfers, setTransfers] = useState<TransferDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const facilityId = getFacilityId();
    if (!facilityId || facilityId === 'default-facility') {
      setLoading(false);
      return;
    }

    const constraints: QueryConstraint[] = [orderBy('dispatchedAt', 'desc')];
    
    if (filters?.status) {
      constraints.push(where('status', '==', filters.status));
    }
    if (filters?.fromStoreId) {
      constraints.push(where('fromStoreId', '==', filters.fromStoreId));
    }
    if (filters?.toStoreId) {
      constraints.push(where('toStoreId', '==', filters.toStoreId));
    }

    const q = query(
      collection(getFirebaseDb(), 'facilities', facilityId, 'transfers'),
      ...constraints
    );

    const unsubscribe = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot: QuerySnapshot<DocumentData>) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as TransferDoc));
        
        setTransfers(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[stockQueries] Transfers listener error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [filters?.status, filters?.fromStoreId, filters?.toStoreId]);

  return { transfers, loading, error };
}

/**
 * Hook: Single transfer document
 */
export function useTransfer(transferId: string | null) {
  const [transfer, setTransfer] = useState<TransferDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!transferId) {
      setTransfer(null);
      setLoading(false);
      return;
    }

    const facilityId = getFacilityId();
    if (!facilityId || facilityId === 'default-facility') {
      setLoading(false);
      return;
    }

    const ref = doc(getFirebaseDb(), 'facilities', facilityId, 'transfers', transferId);

    const unsubscribe = onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (snapshot.exists()) {
          setTransfer({
            id: snapshot.id,
            ...snapshot.data(),
          } as TransferDoc);
        } else {
          setTransfer(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[stockQueries] Transfer listener error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [transferId]);

  return { transfer, loading, error };
}

/**
 * Utility: Get sync status text for UI
 */
export function getSyncStatusText(status: SyncStatus): string {
  switch (status) {
    case 'synced': return 'Synced';
    case 'syncing': return 'Syncing...';
    case 'offline': return 'Offline - changes will sync when online';
    default: return 'Unknown';
  }
}

/**
 * Utility: Get sync status color for UI
 */
export function getSyncStatusColor(status: SyncStatus): string {
  switch (status) {
    case 'synced': return 'text-green-600';
    case 'syncing': return 'text-yellow-600';
    case 'offline': return 'text-orange-600';
    default: return 'text-gray-600';
  }
}