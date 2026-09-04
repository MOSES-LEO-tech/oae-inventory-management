# Inventory Math Architecture Redesign
## Making Math Errors Impossible by Construction

---

## The Root Cause (Confirmed by Official Firebase Docs)

| Problem | Evidence |
|---------|----------|
| **Two incompatible write models** | Online: transactions → absolute values. Offline: queued `increment()` transforms. |
| **Transactions can't see offline queue** | "Transactions will fail when the client is offline" — [Firebase Docs](https://firebase.google.com/docs/firestore/manage-data/transactions) |
| **LWW per field on reconnect** | "When multiple changes to the same document, the last write wins" — [Firestore Offline Docs](https://firebase.google.cn/docs/firestore/manage-data/enable-offline) |
| **Zustand mirror = second source of truth** | "API → cache → useEffect → Zustand items[] → Components... causes stale-state bugs when components read from Zustand instead of the actual server cache" — [React Architecture Guide](https://wild.codes/candidate-toolkit-question/how-do-you-design-offline-first-sync-conflict-resolution-on-firebase) |
| **FieldValue.increment() is the prescribed fix** | "This could be done without a transaction by updating the population using FieldValue.increment()" — [Firebase Transaction Docs](https://firebase.google.com/docs/firestore/manage-data/transactions) |

**The fatal flaw**: The app mixed **state-based writes** ("set quantity to X") with **intent-based writes** ("increment by Y"). These two models are mathematically incompatible under Firestore's offline sync.

---

## The New Architecture: Intent-Based, Single-Source-of-Truth

### Core Principles

1. **Firestore local cache IS the database** — `onSnapshot` listeners with `includeMetadataChanges: true` are the read path. The SDK's `DocumentOverlayCache` already merges pending local writes correctly.
2. **Zustand holds ZERO server data** — only UI state (filters, modals, form drafts, loading flags).
3. **Every quantity mutation = `increment(delta)`** — stock-in, stock-out, adjust, transfer-out, transfer-in. No exceptions. No absolute `quantities: {...}` writes ever.
4. **Transactions ONLY where validation is required** — stock-out needs "available ≥ requested". Inside transaction: read → validate → write `increment(-qty)`.
5. **Explicit operation ledger** — every mutation recorded as an intent with idempotency key, not computed state.
6. **Optimistic UI by default** — `hasPendingWrites: true` drives "syncing" indicators; `fromCache: true` drives "offline" banner.

---

### Data Model

```typescript
// Inventory document (single source of truth in Firestore)
interface InventoryDoc {
  itemId: string;
  storeId: string;
  itemName: string;
  itemType: string;
  itemCode: string;
  quantityTypes: QuantityType[];
  lowStockThresholds: Record<string, number>;
  // Quantities are NEVER written as absolute map
  // They are ONLY modified via increment() transforms
  updatedAt: Timestamp;
  updatedBy: string;
  version: number; // monotonic, for debugging
}

// Operation ledger (append-only, one doc per mutation)
interface StockOperation {
  id: string; // UUID v4 (idempotency key)
  type: 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT' | 'TRANSFER_OUT' | 'TRANSFER_IN';
  inventoryId: string;
  storeId: string;
  itemId: string;
  deltas: Record<string, number>; // { qtyTypeId: +5, qtyTypeId: -3 }
  reason: string;
  performedBy: string;
  performedAt: Timestamp; // client timestamp
  serverTimestamp?: Timestamp; // set by server on sync
  status: 'PENDING' | 'SYNCED' | 'FAILED';
  syncAttempts: number;
  lastError?: string;
}

// Transfer document (links two operations)
interface TransferDoc {
  id: string;
  fromStoreId: string;
  toStoreId: string;
  itemId: string;
  deltas: Record<string, number>;
  status: 'DISPATCHED' | 'RECEIVED' | 'CANCELLED';
  dispatchedAt: Timestamp;
  receivedAt?: Timestamp;
  dispatchedOpId: string; // links to StockOperation
  receivedOpId?: string;  // links to StockOperation
}
```

---

### Write Paths (All Use Increment Transforms)

#### Stock In
```typescript
async function addStockIn(
  inventoryId: string,
  deltas: Record<string, number>, // { qtyTypeId: +qty }
  reason: string,
  userId: string
) {
  const opId = crypto.randomUUID();
  const batch = writeBatch(db);
  
  // 1. Queue the operation (ledger)
  const opRef = doc(db, 'facilities', facilityId, 'stockOperations', opId);
  batch.set(opRef, {
    id: opId,
    type: 'STOCK_IN',
    inventoryId,
    deltas,
    reason,
    performedBy: userId,
    performedAt: Timestamp.now(),
    status: 'PENDING',
    syncAttempts: 0
  });
  
  // 2. Apply increment transforms to inventory
  const invRef = doc(db, 'facilities', facilityId, 'inventory', inventoryId);
  const increments: Record<string, FieldValue> = {};
  for (const [qtyTypeId, delta] of Object.entries(deltas)) {
    increments[`quantities.${qtyTypeId}`] = increment(delta);
  }
  batch.update(invRef, { ...increments, updatedAt: Timestamp.now(), updatedBy: userId });
  
  // 3. Fire-and-forget (local cache commit is immediate)
  await batch.commit(); // SDK queues if offline, replays on reconnect
}
```

#### Stock Out (Only Path Requiring Validation)
```typescript
async function recordSale(
  saleItems: { inventoryId: string; deltas: Record<string, number> }[],
  userId: string
) {
  // 1. Create operation record first (idempotency)
  const opId = crypto.randomUUID();
  const opRef = doc(db, 'facilities', facilityId, 'stockOperations', opId);
  
  // 2. Transaction: read → validate → write increments
  await runTransaction(db, async (txn) => {
    // ALL READS FIRST
    const invRefs = saleItems.map(s => 
      doc(db, 'facilities', facilityId, 'inventory', s.inventoryId)
    );
    const invSnaps = await Promise.all(invRefs.map(r => txn.get(r)));
    
    // VALIDATE: check each item has enough stock
    for (let i = 0; i < saleItems.length; i++) {
      const item = saleItems[i];
      const snap = invSnaps[i];
      const serverQuantities = (snap.data()?.quantities || {}) as Record<string, number>;
      
      for (const [qtyTypeId, qty] of Object.entries(item.deltas)) {
        const available = serverQuantities[qtyTypeId] || 0;
        if (available < qty) {
          throw new Error(`Insufficient stock for ${item.inventoryId}/${qtyTypeId}: ${available} < ${qty}`);
        }
      }
    }
    
    // ALL WRITES SECOND (increments only)
    for (const item of saleItems) {
      const invRef = doc(db, 'facilities', facilityId, 'inventory', item.inventoryId);
      const increments: Record<string, FieldValue> = {};
      for (const [qtyTypeId, delta] of Object.entries(item.deltas)) {
        increments[`quantities.${qtyTypeId}`] = increment(-delta); // NEGATIVE for stock out
      }
      txn.update(invRef, { ...increments, updatedAt: Timestamp.now(), updatedBy: userId });
    }
    
    // Record operation
    txn.set(opRef, {
      id: opId,
      type: 'STOCK_OUT',
      inventoryId: saleItems[0].inventoryId, // primary
      deltas: Object.fromEntries(
        saleItems.flatMap(s => Object.entries(s.deltas).map(([k, v]) => [k, -v]))
      ),
      reason: 'Sale',
      performedBy: userId,
      performedAt: Timestamp.now(),
      status: 'SYNCED', // transaction = immediately synced
      syncAttempts: 0
    });
  });
}
```

#### Adjustment
```typescript
async function adjustStock(
  inventoryId: string,
  deltas: Record<string, number>, // { qtyTypeId: ±delta }
  reason: string,
  userId: string
) {
  const opId = crypto.randomUUID();
  const batch = writeBatch(db);
  
  // Ledger
  const opRef = doc(db, 'facilities', facilityId, 'stockOperations', opId);
  batch.set(opRef, {
    id: opId,
    type: 'ADJUSTMENT',
    inventoryId,
    deltas,
    reason,
    performedBy: userId,
    performedAt: Timestamp.now(),
    status: 'PENDING',
    syncAttempts: 0
  });
  
  // Increments (positive or negative)
  const invRef = doc(db, 'facilities', facilityId, 'inventory', inventoryId);
  const increments: Record<string, FieldValue> = {};
  for (const [qtyTypeId, delta] of Object.entries(deltas)) {
    increments[`quantities.${qtyTypeId}`] = increment(delta);
  }
  batch.update(invRef, { ...increments, updatedAt: Timestamp.now(), updatedBy: userId });
  
  await batch.commit();
}
```

#### Transfer (Dispatch → Receive)
```typescript
// Dispatch: decrement source, create transfer doc, log TRANSFER_OUT
async function dispatchTransfer(...) {
  const opId = crypto.randomUUID();
  const transferId = crypto.randomUUID();
  const batch = writeBatch(db);
  
  // Source inventory: increment(-delta)
  const srcRef = doc(db, 'facilities', facilityId, 'inventory', srcInventoryId);
  const srcIncrements: Record<string, FieldValue> = {};
  for (const [qtyTypeId, delta] of Object.entries(deltas)) {
    srcIncrements[`quantities.${qtyTypeId}`] = increment(-delta);
  }
  batch.update(srcRef, { ...srcIncrements, updatedAt: Timestamp.now(), updatedBy: userId });
  
  // Transfer doc
  const xferRef = doc(db, 'facilities', facilityId, 'transfers', transferId);
  batch.set(xferRef, {
    id: transferId,
    fromStoreId,
    toStoreId,
    itemId,
    deltas,
    status: 'DISPATCHED',
    dispatchedAt: Timestamp.now(),
    dispatchedOpId: opId
  });
  
  // Ledger
  const opRef = doc(db, 'facilities', facilityId, 'stockOperations', opId);
  batch.set(opRef, { /* TRANSFER_OUT record */ });
  
  await batch.commit();
}

// Receive: increment target, update transfer doc, log TRANSFER_IN
async function receiveTransfer(transferId: string, ...) {
  // Similar pattern: increment(+delta) on target, update transfer status to RECEIVED
}
```

---

### Read Path (Firestore Cache = Single Source of Truth)

```typescript
// Hook: subscribes to inventory collection with metadata
function useInventory(facilityId: string) {
  const [items, setItems] = useState<InventoryDoc[]>([]);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('synced');
  
  useEffect(() => {
    const q = query(
      collection(db, 'facilities', facilityId, 'inventory'),
      orderBy('itemName')
    );
    
    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      // Firestore's DocumentOverlayCache already merges pending writes here
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setItems(data);
      
      // Sync status from metadata
      const hasPending = snapshot.docChanges().some(
        c => c.doc.metadata.hasPendingWrites
      );
      const fromCache = snapshot.metadata.fromCache;
      
      if (!navigator.onLine) setSyncStatus('offline');
      else if (hasPending) setSyncStatus('syncing');
      else setSyncStatus('synced');
    });
    
    return unsubscribe;
  }, [facilityId]);
  
  return { items, syncStatus };
}

// Hook: single item with real-time quantities
function useInventoryItem(facilityId: string, inventoryId: string) {
  const [item, setItem] = useState<InventoryDoc | null>(null);
  const [pending, setPending] = useState(false);
  
  useEffect(() => {
    const ref = doc(db, 'facilities', facilityId, 'inventory', inventoryId);
    const unsubscribe = onSnapshot(ref, { includeMetadataChanges: true }, (snap) => {
      if (snap.exists()) {
        setItem({ id: snap.id, ...snap.data() });
        setPending(snap.metadata.hasPendingWrites);
      }
    });
    return unsubscribe;
  }, [facilityId, inventoryId]);
  
  return { item, pending };
}
```

---

### Why This Makes Math Errors Impossible

| Scenario | Old System | New System |
|----------|------------|------------|
| Online stock-in 20+5 | Transaction reads 20, writes 25 ✓ | `increment(5)` on base 20 → 25 ✓ |
| Offline stock-in 20+5 | Queued `increment(5)` ✓ | Queued `increment(5)` ✓ |
| Offline→online replay | Absolute write stomps replayed increments | **Increments commute** — any order sums correctly |
| Concurrent offline edits | LWW loses one edit | **Increments commute** — both apply |
| Stock-out validation | Transaction reads stale base (missed queue) | Transaction reads **server-committed** state, validates, writes increment |
| Adjustment replaces quantities | Full map replace drops untouched types | **Per-field increment** — untouched types untouched |
| Repair tool | Replaced map, wiped untouched types | **Never needed** — ledger is source of truth |

---

### Migration Plan

1. **Add `stockOperations` collection** and `increment()`-only write functions (new module, no breaking changes)
2. **Add `onSnapshot` read hooks** alongside existing Zustand reads (parallel, not replacement)
3. **Migrate one page at a time**: Stock In → Stock Out → Adjust → Transfers
4. **Remove Zustand quantity state** after all pages migrated
5. **Delete old transaction/absolute-write code**

---

### Testing Checklist (Run Before Each Migration Step)

- [ ] Online: stock-in 20+5=25, stock-out 20-5=15, adjust 20-5=15
- [ ] Offline: same operations, verify UI shows correct pending values
- [ ] Offline→online: wait for sync, refresh, verify server matches UI
- [ ] Concurrent: two tabs, same item, both offline→online, verify sum
- [ ] Over-sell: offline stock-out more than available → negative allowed (fixable via adjust), base never stomped
- [ ] Transfer: dispatch + receive across reconnect

---

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/lib/stock/operations.ts` | New: all increment-based write functions |
| `src/lib/stock/queries.ts` | New: onSnapshot read hooks |
| `src/lib/stock/types.ts` | New: StockOperation, TransferDoc types |
| `src/stores/inventory-store.ts` | **Phase out** quantity state, keep only UI state |
| `src/app/(authenticated)/stock-in/page.tsx` | Migrate to new write hooks |
| `src/app/(authenticated)/stock-out/page.tsx` | Migrate |
| `src/app/(authenticated)/inventory/[id]/adjust/page.tsx` | Migrate |
| `src/app/(authenticated)/transfers/...` | Migrate |

---

## Approval Required

This redesign eliminates the bug class entirely by aligning with Firebase's documented offline model. It requires:

1. **New write module** (`src/lib/stock/operations.ts`) with increment-only functions
2. **New read hooks** (`src/lib/stock/queries.ts`) using `onSnapshot` + metadata
3. **Page-by-page migration** (4-5 pages)
4. **Removal of Zustand quantity mirror** after migration

**Do you approve this architecture? I'll implement it step by step with build verification at each stage.**