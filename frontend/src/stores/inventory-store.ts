import { create } from "zustand";
import {
  InventoryWithItem,
  Item,
  Store,
  StockMovement,
  Transaction,
  TransactionItem,
  StockTransfer,
  TransferItem,
  FacilitySettings,
  FacilityUser,
  DutyGrants,
  PaymentMethod,
  QuantityType
} from "@/types";
import {
  getFacilityDocuments,
  updateFacilityDocument,
  deleteFacilityDocument,
  facilityCol,
  facilityDoc,
  Timestamp,
} from "@/lib/firebase/firestore";
import { doc as firestoreDoc, setDoc, writeBatch, runTransaction, updateDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/config";
import {
  where,
  orderBy,
  query,
  limit as fbLimit,
  startAfter,
  increment,
  onSnapshot,
} from "firebase/firestore";
import { useAuthStore } from "./auth-store";
import { toast } from "sonner";
import {
  persist,
  createJSONStorage,
  type StateStorage,
} from "zustand/middleware";
import { reviveFirestoreTimestamps } from "@/lib/timestamp-revive";
import { mergeQuantityTypes } from "@/lib/qty-label";
import { findCartonType, pcsPerCarton } from "@/lib/stock/conversion";

// Merge every live quantity-type source for an item — catalog copy plus ALL
// inventory-row copies (rows of the same item across stores can carry
// different type sets). Used to snapshot labels onto movements/transaction
// lines at write time so later catalog edits can never orphan the keys.
function mergedItemQts(
  catalog: Item[],
  rows: InventoryWithItem[],
  itemId: string
): QuantityType[] {
  return mergeQuantityTypes(
    catalog.find((c) => c.id === itemId)?.quantityTypes,
    ...rows.filter((r) => r.itemId === itemId).map((r) => r.quantityTypes)
  );
}

// Surface fetch failures to the UI (throttled to one toast per burst);
// console always receives full details for diagnostics.
let lastLoadErrorAt = 0;
function reportLoadError(scope: string, error: unknown) {
  console.error(`Failed to fetch ${scope}:`, error);
  const now = Date.now();
  if (now - lastLoadErrorAt > 4000) {
    lastLoadErrorAt = now;
    toast.error(`Couldn't load ${scope}. Check your connection or permissions.`);
  }
}

// Firestore rejects `undefined` field values; optional fields (e.g. code,
// warrantyMonths) are stripped instead of failing the whole write.
function stripUndefined<T extends Record<string, unknown>>(data: T): Partial<T> {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) as Partial<T>;
}

// Firestore write promises only settle after a server acknowledgement — the
// SDK documents that batch.commit() "won't resolve while you're offline".
// The persistent local cache makes the WRITE itself durable and visible the
// moment it is enqueued (onSnapshot merges pending writes via the
// DocumentOverlayCache), so offline callers must not block on the ack:
// confirm buttons would spin for 30s+ waiting for a server that isn't there.
// Online the promise resolves normally and nothing changes; offline we return
// as soon as the write is queued and detach a rejection guard so a replay
// failure can't surface as an unhandled promise rejection (listeners and the
// reconnect replay remain the source of truth).
async function commitWrite(write: Promise<unknown>): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    write.catch(() => {
      // Queued write failed to replay (e.g. permission change while offline).
      // The onSnapshot listeners reflect whatever the server actually has, so
      // the UI self-corrects on reconnect; swallow only the rejection itself.
    });
    return;
  }
  await write;
}

// Prepend optimistic records (movements/sales) without duplicates. A doc id
// can already be present in the slice when the optimistic prepend races a
// refetch that landed first (page remount, another page's fetch, rehydration
// from the persisted cache) — prepending again renders "two children with the
// same key" warnings and double rows. Server truth has no duplicates
// (verified via Firestore REST); this guard only keeps the local slice clean.
// Existing rows keep their position; a new row goes to the front.
function prependUnique<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const existingIds = new Set(existing.map((row) => row.id));
  const fresh = incoming.filter((row) => !existingIds.has(row.id));
  return fresh.length ? [...fresh, ...existing] : existing;
}

// Merge entered cost prices into a quantity-types array. Only overwrites a
// type's costPrice when a positive cost was entered for that type, so a
// blank cost on stock-in never wipes a previously recorded one.
function applyUnitCosts(
  quantityTypes: QuantityType[],
  unitCosts: Record<string, number>
): QuantityType[] {
  return quantityTypes.map(qt => {
    const cost = unitCosts[qt.id];
    return cost !== undefined && cost > 0 ? { ...qt, costPrice: cost } : qt;
  });
}

// Staff rows are unique per email (inviteStaff enforces it), but duplicate
// placeholder docs from pre-batch double-sends can linger in Firestore and
// would render as repeated staff rows. Collapse them: prefer the real
// membership (onboarded) over an invite placeholder; keep first-seen order
// otherwise. Display-level only — no destructive Firestore cleanup here;
// Tier-4 sign-in sweeps stale placeholders automatically.
function dedupeUsers(users: FacilityUser[]): FacilityUser[] {
  const byEmail = new Map<string, FacilityUser>();
  const out: FacilityUser[] = [];
  for (const u of users) {
    const key = (u.normalizedEmail || u.email || "").toLowerCase() || u.id;
    const existing = byEmail.get(key);
    if (!existing) {
      byEmail.set(key, u);
      out.push(u);
      continue;
    }
    if (u.onboarded && !existing.onboarded) {
      out.splice(out.indexOf(existing), 1, u);
      byEmail.set(key, u);
    }
  }
  return out;
}

// Emails with an invite currently in flight (double-click guard).
const pendingInvites = new Set<string>();

// Full invite sequence: duplicate check → Firebase email → atomic batch
// (placeholder + invite-index). Split from inviteStaff so the in-flight
// guard wraps the entire await chain, not just the Firestore write.
async function inviteStaffOnce(
  input: {
    name: string;
    email: string;
    phone?: string;
    jobTitle: string;
    duties: DutyGrants;
    storeIds: string[];
  },
  invitedBy: string,
  facilityId: string,
  email: string,
  get: () => InventoryState,
  set: (partial: Partial<InventoryState>) => void
) {
  // The invite email must go out now — this flow cannot be queued offline.
  if (!navigator.onLine) {
    throw new Error(
      "Staff invitations require an internet connection. Please reconnect and try again."
    );
  }

  // Duplicate guard — Tier-4 resolution matches invites by exact email,
  // so two records with the same address would race (limit(1)).
  const sliceDuplicate = get().users.some((u) => u.normalizedEmail === email);
  const remoteDuplicates = sliceDuplicate
    ? []
    : await getFacilityDocuments<FacilityUser>(facilityId, "users", [
        where("email", "==", email),
        fbLimit(1),
      ]);
  if (sliceDuplicate || remoteDuplicates.length > 0) {
    throw new Error("A staff member with this email already exists");
  }

  const { getFirebaseAuth } = await import("@/lib/firebase/config");
  const { sendSignInLinkToEmail } = await import("firebase/auth");
  await sendSignInLinkToEmail(getFirebaseAuth(), email, {
    url: `${window.location.origin}/login`,
    handleCodeInApp: true,
  });
  // Medicore parity: helps same-device link completion (pre-fills the
  // confirm step). The SDK also writes this key when a link is opened here.
  try {
    window.localStorage.setItem("emailForSignIn", email);
  } catch {
    // Private-mode browsers — best-effort only.
  }

  const localId = crypto.randomUUID();
  const placeholder: Omit<FacilityUser, "id"> = {
    facilityId,
    name: input.name.trim(),
    email,
    normalizedEmail: email,
    ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
    jobTitle: input.jobTitle,
    role: input.jobTitle === "Admin" ? "admin" : "staff",
    duties: input.duties,
    storeIds: input.storeIds,
    active: true,
    onboarded: false,
    invitedAt: Timestamp.now(),
    invitedBy,
    createdAt: Timestamp.now(),
  };
  // invite-index/{email} gives the invitee's first sign-in a deterministic,
  // rules-permitted address for their invite data — no collectionGroup
  // query, no index, nothing that can be denied (the client-side
  // equivalent of Medicore's sync-user server route). Keyed by the
  // lowercased email; a re-invite overwrites instead of duplicating.
  const batch = writeBatch(getFirebaseDb());
  batch.set(
    firestoreDoc(getFirebaseDb(), "facilities", facilityId, "users", localId),
    placeholder
  );
  batch.set(
    firestoreDoc(getFirebaseDb(), "invite-index", email),
    {
      email,
      facilityId,
      name: placeholder.name,
      phone: placeholder.phone ?? null,
      jobTitle: placeholder.jobTitle,
      role: placeholder.role,
      duties: placeholder.duties,
      storeIds: placeholder.storeIds,
      invitedBy,
      createdAt: Timestamp.now(),
    }
  );
  await batch.commit();

  // Mirror into the local slice (read-cache consistency).
  set({ users: [...get().users, { ...placeholder, id: localId }] });
}

// A cached "Invited" row can outlive its Firestore doc: the invitee's first
// sign-in (Tier-4) materializes the real membership under their auth uid and
// sweeps the placeholder — on another device/session. Until this device's
// read cache expires, writes to that row's stale id throw "No document to
// update". Re-point non-onboarded rows at the live doc resolved by email
// before writing; real members (onboarded) always write directly.
async function resolveLiveStaffRow(
  facilityId: string,
  userId: string,
  get: () => InventoryState
): Promise<FacilityUser | null> {
  const row = get().users.find((u) => u.id === userId);
  if (!row || row.onboarded !== false) return null;
  const emailKey = (row.normalizedEmail || row.email || "").toLowerCase();
  if (!emailKey) return null;
  const matches = await getFacilityDocuments<FacilityUser>(
    facilityId,
    "users",
    [where("email", "==", emailKey), fbLimit(5)]
  );
  return matches.find((m) => m.onboarded && m.id !== userId) ?? null;
}

// ── Read cache (Firestore cost optimization) ──────────────────────────────
// Pages refetch on every mount; within READ_CACHE_TTL_MS we reuse the
// in-memory Zustand slices instead of re-reading Firestore, so repeat
// navigation costs zero reads. Every mutation patches its slices directly,
// keeping cached data correct for THIS device; changes from other devices
// become visible when the TTL elapses. Keys are facility-scoped so a
// logout/login into another facility can never serve stale cross-tenant data.
const READ_CACHE_TTL_MS = 60_000;
const lastFetchedAt = new Map<string, number>();

function isCacheFresh(key: string): boolean {
  const at = lastFetchedAt.get(key);
  return at !== undefined && Date.now() - at < READ_CACHE_TTL_MS;
}

function markFetched(key: string): void {
  lastFetchedAt.set(key, Date.now());
}

// Live inventory listener state. The store's `items` slice is driven by
// onSnapshot with includeMetadataChanges, so the UI always renders the
// Firestore local cache's DocumentOverlayCache-merged truth — pending
// offline writes are already reflected in snapshots, online and offline.
// One subscription per (facility, store, stockYear) filter combination;
// re-subscribing with the same key is a no-op.
let inventoryUnsub: (() => void) | null = null;
let inventorySubKey = "";
function unsubscribeInventory() {
  if (inventoryUnsub) {
    inventoryUnsub();
    inventoryUnsub = null;
  }
  inventorySubKey = "";
}

interface InventoryState {
  // Inventory data
  items: InventoryWithItem[];
  inventoryItems: Item[];
  stores: Store[];
  users: FacilityUser[];
  movements: StockMovement[];
  sales: Transaction[];
  transfers: StockTransfer[];
  facilitySettings: FacilitySettings | null;
  
  // UI state
  searchQuery: string;
  selectedStoreId: string | null;
  selectedStockYear: string | null;
  showLowStockOnly: boolean;
  isLoading: boolean;
  isLoadingItems: boolean;
  isLoadingStores: boolean;
  isLoadingUsers: boolean;
  isLoadingMovements: boolean;
  isLoadingSales: boolean;
  isLoadingTransfers: boolean;

  // Actions - UI
  setSearchQuery: (query: string) => void;
  setSelectedStoreId: (id: string | null) => void;
  setSelectedStockYear: (year: string | null) => void;
  toggleLowStockOnly: () => void;

  // Actions - Data fetching
  // `silent` skips the loading flags so background polls (e.g. the
  // notification bell) refresh data without flashing loading UI.
  fetchInventory: (storeId?: string, stockYear?: string, silent?: boolean) => Promise<void>;
  fetchItems: () => Promise<void>;
  fetchStores: (silent?: boolean) => Promise<void>;
  fetchUsers: () => Promise<void>;
  fetchMovements: (storeId?: string, limit?: number) => Promise<void>;
  fetchSales: (storeId?: string, limit?: number) => Promise<void>;
  fetchTransfers: (storeId?: string) => Promise<void>;
  fetchFacilitySettings: (force?: boolean) => Promise<void>;
  fetchAll: (storeId?: string, stockYear?: string) => Promise<void>;

  // Actions - Mutations
  adjustStock: (
    inventoryId: string,
    adjustments: Record<string, number>,
    notes: string,
    performedBy: string,
    performedByName: string
  ) => Promise<void>;

  addStockIn: (
    itemId: string,
    storeId: string,
    quantities: Record<string, number>,
    unitCosts: Record<string, number>,
    supplier: string,
    notes: string,
    performedBy: string,
    performedByName: string
  ) => Promise<void>;

  recordSale: (
    items: Array<{itemId: string; itemName: string; itemType: string; quantities: Record<string, number>; unitPrices: Record<string, number>; subtotal: number}>,
    storeId: string,
    paymentMethod: PaymentMethod,
    customerName: string,
    customerPhone: string,
    performedBy: string,
    performedByName: string,
    notes?: string
  ) => Promise<void>;

  createTransfer: (
    fromStoreId: string,
    toStoreId: string,
    items: Array<{itemId: string; itemName: string; itemType: string; quantities: Record<string, number>}>,
    notes: string,
    requestedBy: string,
    requestedByName: string
  ) => Promise<string>;

  dispatchTransfer: (transferId: string, dispatchedBy: string, dispatchedByName: string) => Promise<void>;
  completeTransfer: (
    transferId: string,
    receivedItems: Array<{itemId: string; quantities: Record<string, number>}>,
    receivedBy: string,
    receivedByName: string
  ) => Promise<void>;
  cancelTransfer: (transferId: string, cancelledBy: string, cancelledByName: string, reason: string) => Promise<void>;

  // Item management
  addItem: (item: Omit<Item, "id" | "createdAt" | "updatedAt" | "createdBy"> & {createdBy: string}) => Promise<string>;
  updateItem: (
    itemId: string,
    data: Partial<Item>,
    options?: { storeId?: string }
  ) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  deleteInventory: (inventoryId: string) => Promise<void>;

  // Store management
  addStore: (store: Omit<Store, "id">) => Promise<string>;
  updateStore: (storeId: string, data: Partial<Store>) => Promise<void>;
  deleteStore: (storeId: string) => Promise<void>;

  // Staff management (facilities/{fid}/users)
  inviteStaff: (
    input: {
      name: string;
      email: string;
      phone?: string;
      jobTitle: string;
      duties: DutyGrants;
      storeIds: string[];
    },
    invitedBy: string
  ) => Promise<void>;
  updateStaffUser: (
    userId: string,
    data: Partial<Pick<FacilityUser, "name" | "phone" | "jobTitle" | "storeIds">>
  ) => Promise<void>;
  setStaffDuties: (userId: string, duties: DutyGrants) => Promise<void>;
  setStaffActive: (userId: string, active: boolean) => Promise<void>;
}

// --- Durable read cache (offline Phase B) -----------------------------------
// The eight data slices survive reloads/tabs via localStorage so cold starts
// and offline sessions render last-known data instead of blanks. Loading
// flags, UI filters and actions stay session-local. `ownerFacilityId` is
// stamped by partialize on every write so the auth subscription below can
// prove restored data belongs to the incoming session before showing it.
const DATA_CACHE_STORAGE_KEY = "inv-data-cache";

type PersistedDataState = Pick<
  InventoryState,
  | "items"
  | "inventoryItems"
  | "stores"
  | "users"
  | "movements"
  | "sales"
  | "transfers"
  | "facilitySettings"
> & { ownerFacilityId: string };

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

function readPersistedOwnerFacilityId(): string | null {
  try {
    const raw = localStorage.getItem(DATA_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      state?: { ownerFacilityId?: string };
    };
    return parsed?.state?.ownerFacilityId ?? null;
  } catch {
    return null;
  }
}

function reviveRows<T>(rows: unknown): T[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => reviveFirestoreTimestamps(row)) as T[];
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
  items: [],
  inventoryItems: [],
  stores: [],
  users: [],
  movements: [],
  sales: [],
  transfers: [],
  facilitySettings: null,
  
  searchQuery: "",
  selectedStoreId: null,
  selectedStockYear: null,
  showLowStockOnly: false,
  isLoading: false,
  isLoadingItems: false,
  isLoadingStores: false,
  isLoadingUsers: false,
  isLoadingMovements: false,
  isLoadingSales: false,
  isLoadingTransfers: false,

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedStoreId: (selectedStoreId) => set({ selectedStoreId }),
  setSelectedStockYear: (selectedStockYear) => set({ selectedStockYear }),
  toggleLowStockOnly: () => set((s) => ({ showLowStockOnly: !s.showLowStockOnly })),

  // Fetch all data in parallel for dashboard
  fetchAll: async (storeId, stockYear) => {
    const facilityId = useAuthStore.getState().user?.facilityId;
    if (!facilityId) return;
    
    await Promise.all([
      get().fetchInventory(storeId, stockYear),
      get().fetchItems(),
      get().fetchStores(),
      get().fetchMovements(storeId, 50),
      get().fetchSales(storeId, 50),
      get().fetchTransfers(storeId),
      get().fetchFacilitySettings(),
    ]);
  },

  fetchInventory: async (storeId, stockYear, silent = false) => {
    const facilityId = useAuthStore.getState().user?.facilityId;
    if (!facilityId) return;

    // Live read path: an onSnapshot listener owns the `items` slice. Every
    // callback REPLACES the slice with the snapshot's DocumentOverlayCache-
    // merged view, so pending offline writes and server changes are both
    // reflected — hand-maintained mirrors can never drift the UI truth.
    // Awaiting callers resolve on the first snapshot (cache OR server), so
    // page behaviour (including offline first paint) is unchanged.
    const subKey = `${facilityId}:${storeId ?? "all"}:${stockYear ?? "all"}`;
    if (inventorySubKey === subKey && inventoryUnsub) return;

    unsubscribeInventory();
    if (!silent) set({ isLoading: true });

    const constraints: any[] = [];
    if (storeId) constraints.unshift(where("storeId", "==", storeId));
    if (stockYear) constraints.unshift(where("stockYear", "==", stockYear));

    // No server-side orderBy on itemName: Firestore silently EXCLUDES any
    // doc missing that field, which hid stock rows created before the
    // denormalized fields existed. Sort client-side instead.
    const q = query(facilityCol(facilityId, "inventory"), ...constraints);

    await new Promise<void>((resolve) => {
      let firstSnapshot = true;
      inventoryUnsub = onSnapshot(
        q,
        { includeMetadataChanges: true },
        (snapshot) => {
          const items = snapshot.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as InventoryWithItem
          );
          items.sort((a, b) => (a.itemName ?? "").localeCompare(b.itemName ?? ""));
          set({ items });
          if (firstSnapshot) {
            firstSnapshot = false;
            if (!silent) set({ isLoading: false });
            resolve();
          }
        },
        (error) => {
          reportLoadError("inventory", error);
          if (firstSnapshot) {
            firstSnapshot = false;
            if (!silent) set({ isLoading: false });
            resolve();
          }
        }
      );
      inventorySubKey = subKey;
    });
  },

  fetchItems: async () => {
    const facilityId = useAuthStore.getState().user?.facilityId;
    if (!facilityId) return;

    const cacheKey = `${facilityId}:items`;
    if (isCacheFresh(cacheKey)) return;

    set({ isLoadingItems: true });
    try {
      const items = await getFacilityDocuments<Item>(facilityId, "items", [orderBy("name")]);
      set({ inventoryItems: items });
      markFetched(cacheKey);
    } catch (error) {
      reportLoadError("catalog items", error);
    } finally {
      set({ isLoadingItems: false });
    }
  },

  fetchStores: async (silent = false) => {
    const facilityId = useAuthStore.getState().user?.facilityId;
    if (!facilityId) return;

    const cacheKey = `${facilityId}:stores`;
    if (isCacheFresh(cacheKey)) return;

    if (!silent) set({ isLoadingStores: true });
    try {
      // Stores are in facility document, not subcollection
      const { getFacilityDocument } = await import("@/lib/firebase/firestore");
      const facility = await getFacilityDocument<any>(facilityId, "", facilityId);
      if (facility?.stores) {
        set({ stores: facility.stores.filter((s: Store) => s.isActive) });
        markFetched(cacheKey);
      }
    } catch (error) {
      reportLoadError("stores", error);
    } finally {
      if (!silent) set({ isLoadingStores: false });
    }
  },

  fetchUsers: async () => {
    const facilityId = useAuthStore.getState().user?.facilityId;
    if (!facilityId) return;

    const cacheKey = `${facilityId}:users`;
    if (isCacheFresh(cacheKey)) return;

    set({ isLoadingUsers: true });
    try {
      const users = await getFacilityDocuments<FacilityUser>(facilityId, "users", [orderBy("name")]);
      set({ users: dedupeUsers(users) });
      markFetched(cacheKey);
    } catch (error) {
      reportLoadError("staff", error);
    } finally {
      set({ isLoadingUsers: false });
    }
  },

  fetchMovements: async (storeId, limitCount = 100) => {
    const facilityId = useAuthStore.getState().user?.facilityId;
    if (!facilityId) return;

    const cacheKey = `${facilityId}:movements:${storeId ?? "all"}:${limitCount}`;
    if (isCacheFresh(cacheKey)) return;

    set({ isLoadingMovements: true });
    try {
      const constraints: any[] = [orderBy("createdAt", "desc"), fbLimit(limitCount)];
      if (storeId) constraints.unshift(where("storeId", "==", storeId));

      const movements = await getFacilityDocuments<StockMovement>(facilityId, "stockMovements", constraints);
      set({ movements });
      markFetched(cacheKey);
    } catch (error) {
      reportLoadError("stock movements", error);
    } finally {
      set({ isLoadingMovements: false });
    }
  },

  fetchSales: async (storeId, limitCount = 100) => {
    const facilityId = useAuthStore.getState().user?.facilityId;
    if (!facilityId) return;

    const cacheKey = `${facilityId}:sales:${storeId ?? "all"}:${limitCount}`;
    if (isCacheFresh(cacheKey)) return;

    set({ isLoadingSales: true });
    try {
      const constraints: any[] = [orderBy("createdAt", "desc"), fbLimit(limitCount)];
      if (storeId) constraints.unshift(where("storeId", "==", storeId));

      const sales = await getFacilityDocuments<Transaction>(facilityId, "transactions", constraints);
      set({ sales });
      markFetched(cacheKey);
    } catch (error) {
      reportLoadError("sales", error);
    } finally {
      set({ isLoadingSales: false });
    }
  },

  fetchTransfers: async (storeId) => {
    const facilityId = useAuthStore.getState().user?.facilityId;
    if (!facilityId) return;

    const cacheKey = `${facilityId}:transfers:${storeId ?? "all"}`;
    if (isCacheFresh(cacheKey)) return;

    set({ isLoadingTransfers: true });
    try {
      const constraints: any[] = [orderBy("createdAt", "desc")];
      if (storeId) {
        // Fetch transfers where user's store is either from or to
        // Note: This requires composite index or client-side filtering
        // For now, fetch all and filter client-side
      }

      const transfers = await getFacilityDocuments<StockTransfer>(facilityId, "transfers", constraints);
      // Filter client-side for store-specific view
      const filtered = storeId
        ? transfers.filter(t => t.fromStoreId === storeId || t.toStoreId === storeId)
        : transfers;
      set({ transfers: filtered });
      markFetched(cacheKey);
    } catch (error) {
      reportLoadError("transfers", error);
    } finally {
      set({ isLoadingTransfers: false });
    }
  },

  fetchFacilitySettings: async (force = false) => {
    const facilityId = useAuthStore.getState().user?.facilityId;
    if (!facilityId) return;

    const cacheKey = `${facilityId}:settings`;
    if (!force && isCacheFresh(cacheKey)) return;

    try {
      const { getFacilityDocument } = await import("@/lib/firebase/firestore");
      const facility = await getFacilityDocument<any>(facilityId, "", facilityId);
      if (facility) {
        // Root `currency` (written by the Business Profile save) is the
        // currency authority; `settings` holds toggle preferences. Merge so
        // pages always get a complete FacilitySettings with the CURRENT
        // currency — previously currency changes never reached the store.
        const settings = facility.settings ?? {};
        set({
          facilitySettings: {
            ...settings,
            currency: facility.currency ?? settings.currency ?? "UGX",
          },
        });
        markFetched(cacheKey);
      }
    } catch (error) {
      reportLoadError("facility settings", error);
    }
  },

  // Mutations
  adjustStock: async (inventoryId, adjustments: Record<string, number>, notes, performedBy, performedByName) => {
    const facilityId = useAuthStore.getState().user?.facilityId;
    if (!facilityId) throw new Error("No facility");

    const item = get().items.find((i) => i.id === inventoryId);
    if (!item) throw new Error("Item not found");

    const batch = writeBatch(getFirebaseDb());

    // Update inventory — delta transforms so concurrent writers (and offline
    // queued writes replayed later) apply their change instead of overwriting
    // the whole map with a value computed from a possibly-stale cache.
    const inventoryRef = facilityDoc(facilityId, "inventory", inventoryId);
    batch.update(inventoryRef, {
      // Dot-path keys are ESSENTIAL: a nested `quantities: {...}` literal puts
      // the PARENT map in the update mask, which replaces the whole map with
      // {} before the increment transforms apply (0 + delta = delta — the
      // "entered = total" corruption). Dot paths mask only the subfields.
      ...Object.fromEntries(
        Object.entries(adjustments).map(([qtyTypeId, delta]) => [
          `quantities.${qtyTypeId}`,
          increment(delta),
        ])
      ),
      updatedAt: Timestamp.now(),
      updatedBy: performedBy,
    });

    // Create movement record
    const movementRef = firestoreDoc(facilityCol(facilityId, "stockMovements"));
    const movement: StockMovement = {
      id: movementRef.id,
      facilityId,
      storeId: item.storeId,
      itemId: item.itemId,
      type: "ADJUSTMENT",
      quantities: adjustments,
      quantityTypes: mergedItemQts(get().inventoryItems, get().items, item.itemId),
      referenceType: "ADJUSTMENT",
      referenceId: inventoryId,
      performedBy,
      performedByName,
      notes,
      createdAt: Timestamp.now(),
    };

    // ONE write path for online AND offline: batched increment transforms
    // with the movement record. FieldValue.increment is applied server-side
    // to whatever value is committed at apply time — queued offline writes
    // replay as additive intents and always sum correctly, so there is no
    // online/offline seam to race. (Absolute map writes are last-write-wins
    // per field offline and stomp queued deltas; they are banned here.)
    batch.set(movementRef, { ...movement });
    await commitWrite(batch.commit());
    // The onSnapshot listener (fetchInventory) will push the updated
    // document — including pending writes merged via DocumentOverlayCache —
    // into the `items` slice automatically. No mirror update needed.
    set({
      movements: prependUnique(get().movements, [movement]),
    });
  },

  addStockIn: async (
    itemId,
    storeId,
    quantities: Record<string, number>,
    unitCosts: Record<string, number>,
    supplier,
    notes,
    performedBy,
    performedByName
  ) => {
    const facilityId = useAuthStore.getState().user?.facilityId;
    if (!facilityId) throw new Error("No facility");

    // Find or create inventory record
    const { getFacilityDocument } = await import("@/lib/firebase/firestore");
    let inventoryItem = get().items.find(i => i.itemId === itemId && i.storeId === storeId);
    let persistedQuantityTypes: QuantityType[] | null = null;
    let newInventoryRef: ReturnType<typeof firestoreDoc> | null = null;
    let shouldUpdateCatalog = false;
    // Skip catalog writes entirely when no cost price was entered
    const hasCosts = Object.values(unitCosts).some((c) => c > 0);
    
    const batch = writeBatch(getFirebaseDb());
    
    if (inventoryItem) {
      // Persist the entered cost prices onto the item's data: the catalog
      // doc and the row's denormalized copy (value estimation reads the row).
      const itemDoc = await getFacilityDocument<Item>(facilityId, "items", itemId);
      const baseTypes = itemDoc?.quantityTypes || inventoryItem.quantityTypes || [];
      const updatedQuantityTypes = applyUnitCosts(baseTypes, unitCosts);
      shouldUpdateCatalog = !!itemDoc && hasCosts;
      if (shouldUpdateCatalog) {
        batch.update(facilityDoc(facilityId, "items", itemId), {
          quantityTypes: updatedQuantityTypes,
          updatedAt: Timestamp.now(),
          updatedBy: performedBy,
        });
      }
      persistedQuantityTypes = updatedQuantityTypes;

      const inventoryRef = facilityDoc(facilityId, "inventory", inventoryItem.id);
      batch.update(inventoryRef, {
        // Delta transform: the absolute quantityTypes (cost snapshot read
        // mid-flow) stays, but quantities apply as increments so concurrent
        // writers and offline replays add their change instead of overwriting.
        // Dot-path keys (see adjustStock) — a nested map literal would put the
        // parent `quantities` in the mask and wipe the map before transforms.
        ...Object.fromEntries(
          Object.entries(quantities).map(([qtyTypeId, qty]) => [
            `quantities.${qtyTypeId}`,
            increment(qty),
          ])
        ),
        quantityTypes: updatedQuantityTypes,
        updatedAt: Timestamp.now(),
        updatedBy: performedBy,
      });
    } else {
      // Get item details for pricing
      const itemDoc = await getFacilityDocument<Item>(facilityId, "items", itemId);
      if (!itemDoc) throw new Error("Item not found");

      // Persist the entered cost prices onto the item's data and use the
      // updated types for the new row's denormalized copy.
      const updatedQuantityTypes = applyUnitCosts(itemDoc.quantityTypes || [], unitCosts);
      shouldUpdateCatalog = hasCosts;
      if (hasCosts) {
        batch.update(facilityDoc(facilityId, "items", itemId), {
          quantityTypes: updatedQuantityTypes,
          updatedAt: Timestamp.now(),
          updatedBy: performedBy,
        });
      }
      persistedQuantityTypes = updatedQuantityTypes;
      
      // Create new inventory record
      newInventoryRef = firestoreDoc(facilityCol(facilityId, "inventory"));
      const inventoryRef = newInventoryRef;
      const inventoryId = inventoryRef.id;
      const payload = stripUndefined({
        id: inventoryId,
        facilityId,
        storeId,
        itemId,
        stockYear: new Date().getFullYear().toString(),
        quantities,
        reservedQuantities: {},
        // Denormalized catalog fields — fetchInventory orders by itemName and
        // the page filters on name/type/code; omitting them hides the row.
        itemName: itemDoc.name,
        itemType: itemDoc.type,
        itemCode: itemDoc.code,
        // Legacy denormalized pricing (kept for backward compatibility)
        unitPricePc: itemDoc.unitPricePc,
        unitPriceCtn: itemDoc.unitPriceCtn,
        lowStockThresholdPc: itemDoc.lowStockThresholdPc,
        lowStockThresholdCtn: itemDoc.lowStockThresholdCtn,
        pcsPerCtn: itemDoc.pcsPerCtn,
        quantityTypes: updatedQuantityTypes,
        // New low stock thresholds per quantity type
        lowStockThresholds: Object.fromEntries(
          (itemDoc.quantityTypes || []).map(qt => [qt.id, qt.price > 0 ? 10 : 0]) // Default threshold
        ),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        updatedBy: performedBy,
      }) as InventoryWithItem;
      // Offline replay safety: when offline, this batch is durably queued and
      // replayed on reconnect. A plain absolute set would REPLACE a server row
      // that already exists for this item/store (e.g. created by another
      // device while we were offline — the local find above missed it),
      // wiping its quantities to the local view (base loss). Merge + increment
      // transforms make the replay additive in both cases: a genuinely missing
      // row is created with the same values (increments start from 0); an
      // existing row keeps its base and the stock is added atomically.
      batch.set(
        inventoryRef,
        {
          ...payload,
          // Dot-path keys for the same reason as adjustStock: a nested
          // `quantities` literal replaces the map (mask includes the parent)
          // before the transforms apply — corrupting existing rows on replay.
          // Dot paths transform the subfields in place on an existing doc and
          // create the subfields on a new one, so both replay cases stay right.
          ...Object.fromEntries(
            Object.entries(quantities).map(([qtyTypeId, qty]) => [
              `quantities.${qtyTypeId}`,
              increment(qty),
            ])
          ),
        },
        { merge: true }
      );
    }

    // Create movement record
    const movementRef = firestoreDoc(facilityCol(facilityId, "stockMovements"));
    const movement: StockMovement = {
      id: movementRef.id,
      facilityId,
      storeId,
      itemId,
      type: "IN",
      quantities,
      quantityTypes: mergedItemQts(get().inventoryItems, get().items, itemId),
      unitCosts, // Cost price snapshot at receipt time
      referenceType: "PURCHASE",
      referenceId: movementRef.id,
      performedBy,
      performedByName,
      notes: notes || `Stock in from ${supplier}`,
      createdAt: Timestamp.now(),
    };
    // ONE write path for online AND offline: batched increment transforms
    // (existing row), merge+increment creation set (new row), catalog cost
    // update and the movement record. FieldValue.increment is applied
    // server-side to whatever value is committed at apply time — queued
    // offline writes replay as additive intents and always sum correctly,
    // so there is no online/offline seam to race. (Absolute map writes are
    // last-write-wins per field offline and stomp queued deltas; banned.)
    batch.set(movementRef, { ...movement });
    await commitWrite(batch.commit());

    // The onSnapshot listener (fetchInventory) will push the updated
    // inventory document — including pending writes merged via
    // DocumentOverlayCache — into the `items` slice automatically. No
    // quantities mirror is maintained anywhere.
    const catalogPatch = persistedQuantityTypes
      ? get().inventoryItems.map((c) =>
          c.id === itemId ? { ...c, quantityTypes: persistedQuantityTypes! } : c
        )
      : get().inventoryItems;
    set({
      inventoryItems: catalogPatch,
      movements: prependUnique(get().movements, [movement]),
    });
  },

  recordSale: async (
    items: Array<{itemId: string; itemName: string; itemType: string; quantities: Record<string, number>; unitPrices: Record<string, number>; subtotal: number}>,
    storeId,
    paymentMethod,
    customerName,
    customerPhone,
    performedBy,
    performedByName,
    notes
  ) => {
    const facilityId = useAuthStore.getState().user?.facilityId;
    if (!facilityId) throw new Error("No facility");

    const batch = writeBatch(getFirebaseDb());
    
    // Calculate totals
    const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
    const taxAmount = 0; // No tax for now
    const totalAmount = subtotal;
    const paidAmount = totalAmount; // Assume full payment

    // Snapshot cost prices and compute profit per item at sale time.
    // Items without a recorded cost price contribute zero profit.
    let totalProfit = 0;
    const transactionItems: TransactionItem[] = items.map((saleItem) => {
      const row = get().items.find((i) => i.itemId === saleItem.itemId && i.storeId === storeId);
      // Deny the sale when requested quantities exceed in-store stock — the
      // increments below would otherwise drive inventory negative.
      if (!row) throw new Error(`No stock record for "${saleItem.itemName}" in this store`);
      for (const [qtyTypeId, qty] of Object.entries(saleItem.quantities)) {
        const available = row.quantities?.[qtyTypeId] || 0;
        if (qty > available) {
          throw new Error(
            `Insufficient stock for "${saleItem.itemName}" in this store: requested ${qty}, only ${available} available`
          );
        }
      }
      const unitCosts: Record<string, number> = {};
      let profit = 0;
      for (const [qtyTypeId, qty] of Object.entries(saleItem.quantities)) {
        const qt = (row?.quantityTypes || []).find((q) => q.id === qtyTypeId);
        const cost = qt?.costPrice ?? 0;
        unitCosts[qtyTypeId] = cost;
        profit += qty * ((saleItem.unitPrices[qtyTypeId] || 0) - cost);
      }
      totalProfit += profit;
      // Snapshot the quantity-type labels into the line at sale time —
      // catalog/row copies can drift or regenerate ids later, which would
      // orphan these line's quantity keys into unreadable raw UUIDs.
      const saleQts = mergedItemQts(get().inventoryItems, get().items, saleItem.itemId);
      return { ...saleItem, quantityTypes: saleQts, unitCosts, profit };
    });
    
    // Create transaction
    const transactionRef = firestoreDoc(facilityCol(facilityId, "transactions"));
    const transactionId = transactionRef.id;

    const transaction: Transaction = {
      id: transactionId,
      facilityId,
      storeId,
      type: "SALE",
      items: transactionItems,
      subtotal,
      taxAmount,
      discountAmount: 0,
      totalAmount,
      profit: totalProfit,
      paidAmount,
      paymentMethod,
      customerName,
      customerPhone,
      performedBy,
      performedByName,
      notes,
      status: "COMPLETED",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const newMovements: StockMovement[] = [];
    const movementRefs: ReturnType<typeof firestoreDoc>[] = [];
    const inventoryRefs: ReturnType<typeof facilityDoc>[] = [];

    // Resolve doc IDs and build movement records once — both write paths
    // below share them. A sale must never record without its stock movement.
    for (const saleItem of items) {
      const inventoryItem = get().items.find(i => i.itemId === saleItem.itemId && i.storeId === storeId);
      if (!inventoryItem) throw new Error(`No stock record for "${saleItem.itemName}" in this store`);
      inventoryRefs.push(facilityDoc(facilityId, "inventory", inventoryItem.id));
      const movementRef = firestoreDoc(facilityCol(facilityId, "stockMovements"));
      movementRefs.push(movementRef);
      newMovements.push({
        id: movementRef.id,
        facilityId,
        storeId,
        itemId: saleItem.itemId,
        type: "OUT",
        quantities: saleItem.quantities,
        quantityTypes: mergedItemQts(get().inventoryItems, get().items, saleItem.itemId),
        referenceType: "SALE",
        referenceId: transactionId,
        performedBy,
        performedByName,
        notes,
        createdAt: Timestamp.now(),
      });
    }

    const db = getFirebaseDb();
    const online = typeof navigator === "undefined" || navigator.onLine;

    if (online) {
      // SERVER-AUTHORITATIVE TRANSACTION — kept ONLY for its server-side
      // stock validation. Writes below are increment transforms, never
      // absolute maps: server-side additive math cannot stomp queued offline
      // deltas replaying around it. (waitForPendingWrites is deliberately
      // NOT used — calling it during physical reconnect can double-apply
      // queued increment transforms, firebase-tools issue #10882.)
      await runTransaction(db, async (txn) => {
        // Firestore transactions require ALL reads before ALL writes.

        // --- Reads: fetch every inventory doc from the server first ---
        const serverQuantitiesByKey = new Map<string, Record<string, number>>();
        const itemNameByKey = new Map<string, string>();
        for (let idx = 0; idx < items.length; idx++) {
          const invRef = inventoryRefs[idx];
          if (serverQuantitiesByKey.has(invRef.path)) continue;
          const invSnap = await txn.get(invRef);
          if (!invSnap.exists()) {
            throw new Error(`Inventory document vanished for "${items[idx].itemName}"`);
          }
          serverQuantitiesByKey.set(
            invRef.path,
            (invSnap.data().quantities || {}) as Record<string, number>
          );
          itemNameByKey.set(invRef.path, items[idx].itemName);
        }

        // Aggregate requested quantities per doc so a duplicated line item
        // still subtracts every entry (absolute writes replace the map —
        // they do not accumulate like the offline delta batch).
        const requestedByKey = new Map<string, Record<string, number>>();
        for (let idx = 0; idx < items.length; idx++) {
          const key = inventoryRefs[idx].path;
          const agg = requestedByKey.get(key) ?? {};
          for (const [qtyTypeId, qty] of Object.entries(items[idx].quantities)) {
            agg[qtyTypeId] = (agg[qtyTypeId] ?? 0) + qty;
          }
          requestedByKey.set(key, agg);
        }

        // --- Validate every line against SERVER quantities before writing ---
        for (const [key, requested] of requestedByKey) {
          const serverQuantities = serverQuantitiesByKey.get(key)!;
          for (const [qtyTypeId, qty] of Object.entries(requested)) {
            const available = serverQuantities[qtyTypeId] ?? 0;
            if (available < qty) {
              throw new Error(
                `Insufficient stock for "${itemNameByKey.get(key)}" in this store: requested ${qty}, only ${available} available`
              );
            }
          }
        }

        // --- Writes: sale record, INCREMENT deltas, movements ---
        // Increment transforms (not absolute maps): the server applies each
        // delta to whatever value is committed at apply time, so queued
        // offline deltas replaying before/after this transaction always sum
        // correctly. The validation above is the only guard, and its worst
        // case in a race is a small negative — never a stomped base.
        txn.set(transactionRef, { ...transaction });
        for (const [key, requested] of requestedByKey) {
          const invRef = inventoryRefs.find((r) => r.path === key)!;
          txn.update(invRef, {
            // Dot-path keys (see adjustStock) — nested map literal would wipe
            // the map via the parent mask before transforms apply.
            ...Object.fromEntries(
              Object.entries(requested).map(([qtyTypeId, qty]) => [
                `quantities.${qtyTypeId}`,
                increment(-qty),
              ])
            ),
            updatedAt: Timestamp.now(),
            updatedBy: performedBy,
          });
        }
        for (let idx = 0; idx < items.length; idx++) {
          txn.set(movementRefs[idx], { ...newMovements[idx] });
        }
      });
    } else {
      // Offline: the SDK's persistent cache queues this delta batch and
      // replays it on reconnect — server-side increment math stays atomic.
      batch.set(transactionRef, { ...transaction });
      for (let idx = 0; idx < items.length; idx++) {
        batch.update(inventoryRefs[idx], {
          // Dot-path keys (see adjustStock) — nested map literal would wipe
          // the map via the parent mask before transforms apply.
          ...Object.fromEntries(
            Object.entries(items[idx].quantities).map(([qtyTypeId, qty]) => [
              `quantities.${qtyTypeId}`,
              increment(-qty),
            ])
          ),
          updatedAt: Timestamp.now(),
          updatedBy: performedBy,
        });
        batch.set(movementRefs[idx], { ...newMovements[idx] });
      }
      await commitWrite(batch.commit());
    }

    // The onSnapshot listener (fetchInventory) pushes the updated inventory
    // documents — pending writes merged via DocumentOverlayCache — into the
    // `items` slice automatically. No quantities mirror is maintained.
    set({
      sales: prependUnique(get().sales, [transaction]),
      movements: prependUnique(get().movements, newMovements),
    });
  },

  createTransfer: async (
    fromStoreId,
    toStoreId,
    items: Array<{itemId: string; itemName: string; itemType: string; quantities: Record<string, number>}>,
    notes,
    requestedBy,
    requestedByName
  ) => {
    const facilityId = useAuthStore.getState().user?.facilityId;
    if (!facilityId) throw new Error("No facility");

    const batch = writeBatch(getFirebaseDb());
    
    // Create transfer record
    const transferRef = firestoreDoc(facilityCol(facilityId, "transfers"));
    const transferId = transferRef.id;

    const transfer: StockTransfer = {
      id: transferId,
      facilityId,
      fromStoreId,
      toStoreId,
      items,
      status: "PENDING",
      requestedBy,
      requestedByName,
      notes,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    batch.set(transferRef, { ...transfer });

    // Fail-fast validation only — no stock and no ledger rows change until
    // dispatch (stock leaves the source store at dispatch, not at request).
    for (const item of items) {
      const fromInventoryItem = get().items.find(i => i.itemId === item.itemId && i.storeId === fromStoreId);
      if (!fromInventoryItem) throw new Error(`No stock record for "${item.itemName}" in the source store`);
    }

    await commitWrite(batch.commit());

    // Mirror the committed request into the local slices so the UI updates
    // instantly without an extra Firestore read.
    set({
      transfers: [transfer, ...get().transfers],
    });
    return transferId;
  },

  dispatchTransfer: async (transferId, dispatchedBy, dispatchedByName) => {
    const facilityId = useAuthStore.getState().user?.facilityId;
    if (!facilityId) throw new Error("No facility");

    const transfer = get().transfers.find(t => t.id === transferId);
    if (!transfer) throw new Error("Transfer not found");
    if (transfer.status !== "PENDING") throw new Error("Transfer already processed");

    const db = getFirebaseDb();
    const newMovements: StockMovement[] = [];

    // Update transfer status first (can be batched, not transactional)
    const transferRef = facilityDoc(facilityId, "transfers", transferId);
    await commitWrite(updateDoc(transferRef, {
      status: "IN_TRANSIT",
      dispatchedBy,
      dispatchedByName,
      dispatchedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }));

    // Process each item in a SERVER-AUTHORITATIVE TRANSACTION (online-only —
    // transactions cannot queue offline). The transaction validates against
    // server quantities, then writes INCREMENT deltas — never absolute maps:
    // queued offline writes may replay around this transaction, and while
    // increments commute under any replay order, an absolute map write would
    // stomp them (last-write-wins per field).
    for (const item of transfer.items) {
      await commitWrite(runTransaction(db, async (txn) => {
        const fromInventoryLocal = get().items.find(
          i => i.itemId === item.itemId && i.storeId === transfer.fromStoreId
        );
        if (!fromInventoryLocal) {
          throw new Error(`No stock record in the source store for "${item.itemName}"`);
        }
        const invRef = facilityDoc(facilityId, "inventory", fromInventoryLocal.id);
        const invSnap = await txn.get(invRef);
        if (!invSnap.exists()) {
          throw new Error(`Inventory document vanished for "${item.itemName}"`);
        }
        const serverQuantities = (invSnap.data().quantities || {}) as Record<string, number>;

        // Validate against SERVER quantities, not local
        for (const [qtyTypeId, qty] of Object.entries(item.quantities)) {
          const available = serverQuantities[qtyTypeId] ?? 0;
          if (available < qty) {
            throw new Error(
              `Insufficient stock in the source store for "${item.itemName}" ` +
              `(type ${qtyTypeId}: have ${available}, need ${qty})`
            );
          }
        }

        // Write INCREMENT deltas — the server applies each delta to whatever
        // value is committed at apply time, so replaying queued offline
        // deltas before or after this write always sums correctly.
        txn.update(invRef, {
          // Dot-path keys (see adjustStock) — nested map literal would wipe
          // the map via the parent mask before transforms apply.
          ...Object.fromEntries(
            Object.entries(item.quantities).map(([qtyTypeId, qty]) => [
              `quantities.${qtyTypeId}`,
              increment(-qty),
            ])
          ),
          updatedAt: Timestamp.now(),
          updatedBy: dispatchedBy,
        });

        // TRANSFER_OUT movement
        const movementRef = firestoreDoc(facilityCol(facilityId, "stockMovements"));
        const movement: StockMovement = {
          id: movementRef.id,
          facilityId,
          storeId: transfer.fromStoreId,
          itemId: item.itemId,
          type: "TRANSFER_OUT",
          quantities: item.quantities,
          quantityTypes: mergedItemQts(get().inventoryItems, get().items, item.itemId),
          referenceType: "TRANSFER",
          referenceId: transferId,
          performedBy: dispatchedBy,
          performedByName: dispatchedByName,
          notes: transfer.notes,
          createdAt: Timestamp.now(),
        };
        txn.set(movementRef, { ...movement });
        newMovements.push(movement);
      }));
    }

    // The onSnapshot listener (fetchInventory) pushes updated inventory docs
    // — pending writes merged via DocumentOverlayCache — automatically. No
    // quantities mirror is maintained.
    set({
      transfers: get().transfers.map((t) =>
        t.id === transferId
          ? {
              ...t,
              status: "IN_TRANSIT" as const,
              dispatchedBy,
              dispatchedByName,
              dispatchedAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            }
          : t
      ),
      movements: prependUnique(get().movements, newMovements),
    });
  },

  completeTransfer: async (transferId, receivedItems, receivedBy, receivedByName) => {
    const facilityId = useAuthStore.getState().user?.facilityId;
    if (!facilityId) throw new Error("No facility");

    const transfer = get().transfers.find(t => t.id === transferId);
    if (!transfer) throw new Error("Transfer not found");
    if (transfer.status !== "IN_TRANSIT") throw new Error("Only in-transit transfers can be confirmed");

    const db = getFirebaseDb();
    const newMovements: StockMovement[] = [];

    // Merge confirmed quantities onto the items array for sent-vs-received display.
    const mergedItems: TransferItem[] = transfer.items.map((item) => {
      const received = receivedItems.find((r) => r.itemId === item.itemId);
      return received ? { ...item, receivedQuantities: received.quantities } : item;
    });

    // Update transfer status (batched, not transactional)
    const transferRef = facilityDoc(facilityId, "transfers", transferId);
    await commitWrite(updateDoc(transferRef, {
      status: "COMPLETED",
      receivedBy,
      receivedByName,
      receivedAt: Timestamp.now(),
      items: mergedItems,
      updatedAt: Timestamp.now(),
    }));

    // For each item, add the ACTUAL received quantities to the destination
    // store using SERVER-AUTHORITATIVE TRANSACTIONS (online-only). The
    // source was already deducted at dispatch — do not deduct again.
    for (const item of transfer.items) {
      const received = receivedItems.find((r) => r.itemId === item.itemId)?.quantities ?? item.quantities;

      await commitWrite(runTransaction(db, async (txn) => {
        // Resolve the destination doc reference. The local index can be
        // stale (the row may exist server-side, created by another device),
        // so the in-transaction read below — not the local find — decides
        // create-vs-update.
        const toInventoryLocal = get().items.find(
          i => i.itemId === item.itemId && i.storeId === transfer.toStoreId
        );
        const invRef = toInventoryLocal
          ? facilityDoc(facilityId, "inventory", toInventoryLocal.id)
          : firestoreDoc(facilityCol(facilityId, "inventory"));

        if ((await txn.get(invRef)).exists()) {
          // Existing row — INCREMENT deltas. Queued offline writes may replay
          // around this transaction; increments commute under any replay
          // order, an absolute map write would stomp them.
          txn.update(invRef, {
            // Dot-path keys (see adjustStock) — nested map literal would wipe
            // the map via the parent mask before transforms apply.
            ...Object.fromEntries(
              Object.entries(received).map(([qtyTypeId, qty]) => [
                `quantities.${qtyTypeId}`,
                increment(qty),
              ])
            ),
            updatedAt: Timestamp.now(),
            updatedBy: receivedBy,
          });
        } else {
          // Genuine new row — create with absolute received quantities
          const { getFacilityDocument } = await import("@/lib/firebase/firestore");
          const itemDoc = await getFacilityDocument<Item>(facilityId, "items", item.itemId);
          if (!itemDoc) throw new Error(`Catalog item not found for a transferred item`);
          const payload = stripUndefined({
            id: invRef.id,
            facilityId,
            storeId: transfer.toStoreId,
            itemId: item.itemId,
            stockYear: new Date().getFullYear().toString(),
            quantities: received,
            reservedQuantities: {},
            itemName: itemDoc.name,
            itemType: itemDoc.type,
            itemCode: itemDoc.code,
            unitPricePc: itemDoc.unitPricePc,
            unitPriceCtn: itemDoc.unitPriceCtn,
            lowStockThresholdPc: itemDoc.lowStockThresholdPc,
            lowStockThresholdCtn: itemDoc.lowStockThresholdCtn,
            pcsPerCtn: itemDoc.pcsPerCtn,
            quantityTypes: itemDoc.quantityTypes,
            lowStockThresholds: Object.fromEntries(
              (itemDoc.quantityTypes || []).map(qt => [qt.id, qt.price > 0 ? 10 : 0])
            ),
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            updatedBy: receivedBy,
          }) as InventoryWithItem;
          txn.set(invRef, payload);
        }

        // Create TRANSFER_IN movement for destination store — actual quantities.
        const movementRef = firestoreDoc(facilityCol(facilityId, "stockMovements"));
        const movement: StockMovement = {
          id: movementRef.id,
          facilityId,
          storeId: transfer.toStoreId,
          itemId: item.itemId,
          type: "TRANSFER_IN",
          quantities: received,
          quantityTypes: mergedItemQts(get().inventoryItems, get().items, item.itemId),
          referenceType: "TRANSFER",
          referenceId: transferId,
          performedBy: receivedBy,
          performedByName: receivedByName,
          notes: `Transfer from ${transfer.fromStoreId}`,
          createdAt: Timestamp.now(),
        };
        txn.set(movementRef, { ...movement });
        newMovements.push(movement);

        // Discrepancy (received ≠ sent) — auto-log ADJUSTMENT movement.
        const deltas = Object.fromEntries(
          Object.entries(received)
            .map(([qtyTypeId, qty]) => [qtyTypeId, qty - (item.quantities[qtyTypeId] || 0)] as const)
            .filter(([, delta]) => delta !== 0)
        );
        if (Object.keys(deltas).length > 0) {
          const adjRef = firestoreDoc(facilityCol(facilityId, "stockMovements"));
          const adjustment: StockMovement = {
            id: adjRef.id,
            facilityId,
            storeId: transfer.toStoreId,
            itemId: item.itemId,
            type: "ADJUSTMENT",
            quantities: deltas,
            quantityTypes: mergedItemQts(get().inventoryItems, get().items, item.itemId),
            referenceType: "TRANSFER",
            referenceId: transferId,
            performedBy: receivedBy,
            performedByName: receivedByName,
            notes: `Variance on transfer ${transferId} (received vs sent)`,
            createdAt: Timestamp.now(),
          };
          txn.set(adjRef, { ...adjustment });
          newMovements.push(adjustment);
        }
      }));
    }

    // The onSnapshot listener (fetchInventory) pushes updated inventory docs
    // — pending writes merged via DocumentOverlayCache — automatically,
    // including rows created inside the transactions above. No quantities
    // mirror is maintained.
    set({
      transfers: get().transfers.map((t) =>
        t.id === transferId
          ? {
              ...t,
              status: "COMPLETED" as const,
              receivedBy,
              receivedByName,
              receivedAt: Timestamp.now(),
              items: mergedItems,
              updatedAt: Timestamp.now(),
            }
          : t
      ),
      movements: prependUnique(get().movements, newMovements),
    });
  },

  cancelTransfer: async (transferId, cancelledBy, cancelledByName, reason) => {
    const facilityId = useAuthStore.getState().user?.facilityId;
    if (!facilityId) throw new Error("No facility");

    const transfer = get().transfers.find(t => t.id === transferId);
    if (!transfer) throw new Error("Transfer not found");
    if (transfer.status !== "PENDING" && transfer.status !== "IN_TRANSIT") {
      throw new Error("Only pending or in-transit transfers can be cancelled");
    }

    const statusPatch = {
      status: "CANCELLED" as const,
      cancelledBy,
      cancelledByName,
      cancelledAt: Timestamp.now(),
      cancelReason: reason,
      updatedAt: Timestamp.now(),
    };

    if (transfer.status === "PENDING") {
      // Stock never left the source — a status update is all that's needed.
      await commitWrite(
        updateFacilityDocument(facilityId, "transfers", transferId, statusPatch)
      );
    } else {
      // IN_TRANSIT: stock was dispatched — return it to the source using
      // SERVER-AUTHORITATIVE TRANSACTIONS.
      const db = getFirebaseDb();
      const newMovements: StockMovement[] = [];

      // Update transfer status first
      await commitWrite(updateDoc(facilityDoc(facilityId, "transfers", transferId), statusPatch));

      // Return each item's stock to the source store via transactions
      for (const item of transfer.items) {
        await commitWrite(runTransaction(db, async (txn) => {
          const fromInventoryLocal = get().items.find(
            i => i.itemId === item.itemId && i.storeId === transfer.fromStoreId
          );
          if (!fromInventoryLocal) {
            throw new Error(`No stock record in the source store for "${item.itemName}"`);
          }
          const invRef = facilityDoc(facilityId, "inventory", fromInventoryLocal.id);
          const invSnap = await txn.get(invRef);
          if (!invSnap.exists()) {
            throw new Error(`Inventory document vanished for "${item.itemName}"`);
          }

          // INCREMENT deltas — restore what was dispatched (never absolute
          // maps: queued offline writes may replay around this transaction,
          // and increments commute under any replay order).
          txn.update(invRef, {
            // Dot-path keys (see adjustStock) — nested map literal would wipe
            // the map via the parent mask before transforms apply.
            ...Object.fromEntries(
              Object.entries(item.quantities).map(([qtyTypeId, qty]) => [
                `quantities.${qtyTypeId}`,
                increment(qty),
              ])
            ),
            updatedAt: Timestamp.now(),
            updatedBy: cancelledBy,
          });

          // TRANSFER_IN movement at the source — the stock came back.
          const movementRef = firestoreDoc(facilityCol(facilityId, "stockMovements"));
          const movement: StockMovement = {
            id: movementRef.id,
            facilityId,
            storeId: transfer.fromStoreId,
            itemId: item.itemId,
            type: "TRANSFER_IN",
            quantities: item.quantities,
            quantityTypes: mergedItemQts(get().inventoryItems, get().items, item.itemId),
            referenceType: "TRANSFER",
            referenceId: transferId,
            performedBy: cancelledBy,
            performedByName: cancelledByName,
            notes: `Transfer cancelled — stock returned to source`,
            createdAt: Timestamp.now(),
          };
          txn.set(movementRef, { ...movement });
          newMovements.push(movement);
        }));
      }

      // The onSnapshot listener (fetchInventory) pushes updated inventory
      // docs — pending writes merged via DocumentOverlayCache —
      // automatically. No quantities mirror is maintained.
      set({
        movements: prependUnique(get().movements, newMovements),
      });
    }

    // Mirror the cancellation into the local slice (read-cache consistency).
    set({
      transfers: get().transfers.map((t) =>
        t.id === transferId ? { ...t, ...statusPatch } : t
      ),
    });
  },

  // Item management
  addItem: async (item) => {
    const facilityId = useAuthStore.getState().user?.facilityId;
    if (!facilityId) throw new Error("No facility");

    // Medicore parity: an added item must be VISIBLE immediately. Visibility
    // in this app lives on per-store stock rows (inventory), so creation also
    // mints ONE zero-qty row in the facility's first store — otherwise the
    // catalog entry stays invisible until its first Stock In.
    let storeIds = useAuthStore.getState().user?.storeIds ?? [];
    if (storeIds.length === 0) {
      // Admin accounts can carry an empty personal storeIds; fall back to the
      // facility document's store list (same source Settings reads).
      const { getFacilityDocument } = await import("@/lib/firebase/firestore");
      const facility = await getFacilityDocument<{ stores?: Array<{ id: string; isActive?: boolean }> }>(facilityId, "", facilityId);
      storeIds = (facility?.stores ?? []).filter((s) => s.isActive !== false).map((s) => s.id);
    }

    const now = Timestamp.now();
    const batch = writeBatch(getFirebaseDb());

    const itemRef = firestoreDoc(facilityCol(facilityId, "items"));
    const itemId = itemRef.id;
    batch.set(itemRef, {
      ...stripUndefined(item),
      id: itemId,
      createdAt: now,
      updatedAt: now,
    });

    const primaryStoreId = storeIds[0];
    let initialRow: InventoryWithItem | null = null;
    if (primaryStoreId) {
      const invRef = firestoreDoc(facilityCol(facilityId, "inventory"));
      initialRow = stripUndefined({
        id: invRef.id,
        facilityId,
        storeId: primaryStoreId,
        itemId,
        stockYear: new Date().getFullYear().toString(),
        quantities: {},
        reservedQuantities: {},
        // Denormalized catalog fields — the inventory list orders and filters
        // on these; a row without itemName is silently dropped by the query.
        itemName: item.name,
        itemType: item.type,
        itemCode: item.code,
        unitPricePc: item.unitPricePc,
        unitPriceCtn: item.unitPriceCtn,
        lowStockThresholdPc: item.lowStockThresholdPc,
        lowStockThresholdCtn: item.lowStockThresholdCtn,
        pcsPerCtn: item.pcsPerCtn,
        quantityTypes: item.quantityTypes,
        lowStockThresholds: item.lowStockThresholds ?? Object.fromEntries(
          (item.quantityTypes || []).map(qt => [qt.id, qt.price > 0 ? 10 : 0])
        ),
        serialTracked: item.serialTracked,
        unitOfMeasure: item.unitOfMeasure,
        createdAt: now,
        updatedAt: now,
        updatedBy: item.createdBy,
      }) as InventoryWithItem;
      batch.set(invRef, { ...initialRow });
    }

    await commitWrite(batch.commit());

    // Mirror the committed item (and its zero-qty visibility row) into the
    // local slices so pickers/lists update instantly without a refetch.
    set({
      inventoryItems: [...get().inventoryItems, { ...item, id: itemId, createdAt: now, updatedAt: now } as Item],
      ...(initialRow ? { items: [initialRow, ...get().items] } : {}),
    });

    return itemId;
  },

  updateItem: async (itemId, data, options) => {
    const facilityId = useAuthStore.getState().user?.facilityId;
    if (!facilityId) throw new Error("No facility");

    const cleanData = stripUndefined(data);

    // Pricing and thresholds are PER-STORE (each store's inventory doc carries
    // its own prices): only the initiating store's row may receive them.
    // Identity fields (name/type/code/pcsPerCtn) describe the catalog item
    // itself and propagate to every store's row.
    const STORE_SCOPED_KEYS = new Set<string>([
      "unitPricePc", "unitPriceCtn",
      "lowStockThresholdPc", "lowStockThresholdCtn",
      "quantityTypes", "lowStockThresholds",
    ]);

    // With store context, store-scoped pricing never reaches the catalog doc —
    // the catalog keeps its facility-wide copy until a store-less edit reprices
    // it. Identity fields still update the catalog.
    const catalogPayload: Record<string, unknown> = { ...cleanData };
    if (options?.storeId) {
      for (const k of STORE_SCOPED_KEYS) delete catalogPayload[k];
    }

    await commitWrite(
      updateFacilityDocument(facilityId, "items", itemId, {
        ...catalogPayload,
        updatedAt: Timestamp.now(),
      })
    );

    // Mirror the edit into the local slices (read-cache consistency): the
    // catalog entry directly, and the denormalized copies on stock rows so
    // lists/pickers reflect renamed/repriced items without a refetch.
    const DENORM_KEYS = [
      "name", "type", "code", "unitPricePc", "unitPriceCtn",
      "lowStockThresholdPc", "lowStockThresholdCtn", "pcsPerCtn",
      "quantityTypes", "lowStockThresholds",
    ] as const;
    const buildRowPatch = (rowStoreId: string | undefined): Record<string, unknown> => {
      const patch: Record<string, unknown> = {};
      for (const k of DENORM_KEYS) {
        if (!(k in cleanData)) continue;
        if (STORE_SCOPED_KEYS.has(k) && options?.storeId !== rowStoreId) continue;
        patch[k === "name" ? "itemName" : k === "type" ? "itemType" : k === "code" ? "itemCode" : k] =
          cleanData[k];
      }
      return patch;
    };

    // Persist the denormalized patch to the item's stock rows in Firestore —
    // the local mirror alone reverts on the next fetchInventory (thresholds
    // edits especially reappear stale). Price-bearing fields are written only
    // to the initiating store's doc; other stores' pricing is never touched.
    const affectedRows = get().items.filter((i) => i.itemId === itemId);
    for (const affectedRow of affectedRows) {
      const rowPatch = buildRowPatch(affectedRow.storeId);
      if (Object.keys(rowPatch).length === 0) continue;
      await commitWrite(
        updateFacilityDocument(facilityId, "inventory", affectedRow.id, {
          ...rowPatch,
          updatedAt: Timestamp.now(),
        })
      );
    }

    set({
      inventoryItems: get().inventoryItems.map((c) =>
        c.id === itemId ? { ...c, ...catalogPayload } as Item : c
      ),
      items: get().items.map((i) => {
        if (i.itemId !== itemId) return i;
        const rowPatch = buildRowPatch(i.storeId);
        return Object.keys(rowPatch).length > 0 ? ({ ...i, ...rowPatch } as InventoryWithItem) : i;
      }),
    });
  },

  deleteItem: async (itemId) => {
    const facilityId = useAuthStore.getState().user?.facilityId;
    if (!facilityId) throw new Error("No facility");

    await commitWrite(deleteFacilityDocument(facilityId, "items", itemId));
    // Mirror the deletion into the local catalog slice (read-cache
    // consistency). Stock rows are intentionally left — Firestore keeps them
    // too, and they remain sellable via the offline fallback picker.
    set({ inventoryItems: get().inventoryItems.filter((c) => c.id !== itemId) });
  },

  deleteInventory: async (inventoryId) => {
    const facilityId = useAuthStore.getState().user?.facilityId;
    if (!facilityId) throw new Error("No facility");

    // Remove the stock row; the catalog item itself is untouched.
    await commitWrite(deleteFacilityDocument(facilityId, "inventory", inventoryId));
    set({ items: get().items.filter((i) => i.id !== inventoryId) });
  },

  // Store management
  addStore: async (store) => {
    const facilityId = useAuthStore.getState().user?.facilityId;
    if (!facilityId) throw new Error("No facility");

    const { getFacilityDocument, updateFacilityDocument, getDocument } = await import("@/lib/firebase/firestore");
    const facility = await getFacilityDocument<any>(facilityId, "", facilityId);
    if (!facility) throw new Error("Facility not found");

    // License limit — safety net evaluated against the freshly-read facility
    // doc (race-safe, unlike a client-side count). Missing license = no limit.
    // The settings page shows the friendly message first.
    const license = await getDocument<any>("licenses", facilityId).catch(() => null);
    const maxStores = license?.features?.maxStores;
    if (typeof maxStores === "number") {
      const activeCount = (facility.stores || []).filter(
        (s: Store) => s.isActive !== false
      ).length;
      if (activeCount >= maxStores) {
        throw new Error(`Your plan allows up to ${maxStores} stores`);
      }
    }

    // Firestore rejects nested undefined (e.g. an unset address) inside the
    // stores array — strip undefined fields before the write. stripUndefined
    // returns a Partial<Store>, so assert the completed shape here.
    const newStore = {
      ...stripUndefined(store),
      id: `store-${Date.now()}`,
      isActive: true,
    } as Store;

    const updatedStores = [...(facility.stores || []), newStore];
    // Facility doc stores array is the single source of truth (fetchStores reads
    // only this); no subcollection dual-write — nothing reads that copy.
    await commitWrite(updateFacilityDocument(facilityId, "", facilityId, { stores: updatedStores }));

    set({ stores: [...get().stores, newStore] });
    return newStore.id;
  },

  updateStore: async (storeId, data) => {
    const facilityId = useAuthStore.getState().user?.facilityId;
    if (!facilityId) throw new Error("No facility");

    const { getFacilityDocument, updateFacilityDocument } = await import("@/lib/firebase/firestore");
    const facility = await getFacilityDocument<any>(facilityId, "", facilityId);
    if (!facility) throw new Error("Facility not found");

    // Same undefined-guard as addStore — merged fields land in the array write.
    const cleanData = stripUndefined(data);
    const updatedStores = facility.stores.map((s: Store) =>
      s.id === storeId ? { ...s, ...cleanData } : s
    );

    await commitWrite(updateFacilityDocument(facilityId, "", facilityId, { stores: updatedStores }));
    // Mirror into the local slice (read-cache consistency).
    set({ stores: updatedStores.filter((s: Store) => s.isActive) });
  },

  deleteStore: async (storeId) => {
    const facilityId = useAuthStore.getState().user?.facilityId;
    if (!facilityId) throw new Error("No facility");

    const { getFacilityDocument, updateFacilityDocument } = await import("@/lib/firebase/firestore");
    const facility = await getFacilityDocument<any>(facilityId, "", facilityId);
    if (!facility) throw new Error("Facility not found");

    const updatedStores = facility.stores.filter((s: Store) => s.id !== storeId);
    await commitWrite(updateFacilityDocument(facilityId, "", facilityId, { stores: updatedStores }));
    // Mirror into the local slice (read-cache consistency).
    set({ stores: updatedStores.filter((s: Store) => s.isActive) });
  },

  // ── Staff management (facilities/{fid}/users) ────────────────────────────

  // Email-link invitation (Medicore pattern): sends the Firebase sign-in
  // link, then writes a placeholder membership doc under a random local id.
  // When the invitee completes the link on THEIR device, auth.ts Tier-4
  // resolution materializes users/{realUid} and deletes this placeholder.
  inviteStaff: async (input, invitedBy) => {
    const facilityId = useAuthStore.getState().user?.facilityId;
    if (!facilityId) throw new Error("No facility");

    const email = input.email.trim().toLowerCase();

    // In-flight guard: a double-clicked Send passes the duplicate check
    // twice before the first write commits (the origin of duplicate
    // placeholder rows). One invite per email per device at a time.
    if (pendingInvites.has(email)) {
      throw new Error("An invitation for this email is already being sent");
    }
    pendingInvites.add(email);
    try {
      await inviteStaffOnce(input, invitedBy, facilityId, email, get, set);
    } finally {
      pendingInvites.delete(email);
    }
  },

  updateStaffUser: async (userId, data) => {
    const facilityId = useAuthStore.getState().user?.facilityId;
    if (!facilityId) throw new Error("No facility");

    const patch = stripUndefined(data);
    const live = await resolveLiveStaffRow(facilityId, userId, get);
    const liveId = live?.id ?? userId;
    await commitWrite(updateFacilityDocument(facilityId, "users", liveId, patch));
    // Mirror into the local slice (read-cache consistency); a stale
    // placeholder row is re-pointed at the live doc id and adopts its state.
    set({
      users: get()
        .users.filter((u) => !live || u.id !== liveId)
        .map((u) => (u.id === userId ? { ...(live ?? u), id: liveId, ...patch } : u)),
    });
  },

  setStaffDuties: async (userId, duties) => {
    const facilityId = useAuthStore.getState().user?.facilityId;
    if (!facilityId) throw new Error("No facility");

    const live = await resolveLiveStaffRow(facilityId, userId, get);
    const liveId = live?.id ?? userId;
    await commitWrite(updateFacilityDocument(facilityId, "users", liveId, { duties }));
    // Mirror into the local slice (read-cache consistency); a stale
    // placeholder row is re-pointed at the live doc id and adopts its state.
    set({
      users: get()
        .users.filter((u) => !live || u.id !== liveId)
        .map((u) => (u.id === userId ? { ...(live ?? u), id: liveId, duties } : u)),
    });
  },

  setStaffActive: async (userId, active) => {
    const facilityId = useAuthStore.getState().user?.facilityId;
    if (!facilityId) throw new Error("No facility");

    const live = await resolveLiveStaffRow(facilityId, userId, get);
    const liveId = live?.id ?? userId;
    await commitWrite(updateFacilityDocument(facilityId, "users", liveId, { active }));
    // Mirror into the local slice (read-cache consistency); a stale
    // placeholder row is re-pointed at the live doc id and adopts its state.
    set({
      users: get()
        .users.filter((u) => !live || u.id !== liveId)
        .map((u) => (u.id === userId ? { ...(live ?? u), id: liveId, active } : u)),
    });
  },
    }),
    {
      name: DATA_CACHE_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage<PersistedDataState>(() => safeStorage),
      // Rehydration is driven client-side from AuthProvider (SSR-safe: the
      // server never renders persisted rows, so no hydration mismatch).
      skipHydration: true,
      partialize: (state): PersistedDataState => ({
        items: state.items,
        inventoryItems: state.inventoryItems,
        stores: state.stores,
        users: state.users,
        movements: state.movements,
        sales: state.sales,
        transfers: state.transfers,
        facilitySettings: state.facilitySettings,
        ownerFacilityId: useAuthStore.getState().user?.facilityId ?? "",
      }),
      // Restore real Firestore Timestamps (JSON reduces them to plain
      // {seconds, nanoseconds}) so page code keeps calling toDate()/toMillis()
      // on persisted rows exactly as it does on live rows.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PersistedDataState>;
        return {
          ...current,
          items: reviveRows<InventoryWithItem>(p.items),
          inventoryItems: reviveRows<Item>(p.inventoryItems),
          stores: reviveRows<Store>(p.stores),
          users: reviveRows<FacilityUser>(p.users),
          movements: reviveRows<StockMovement>(p.movements),
          sales: reviveRows<Transaction>(p.sales),
          transfers: reviveRows<StockTransfer>(p.transfers),
          facilitySettings: p.facilitySettings
            ? reviveFirestoreTimestamps(p.facilitySettings)
            : null,
        };
      },
    }
  )
);

// Invalidate the read cache whenever the signed-in session changes (logout,
// account switch, or cross-facility login) so a new session can never serve
// another session's cached data. On first arrival (prev undefined — every
// boot), restored persisted data is kept ONLY when it was saved under the
// same facility (ownerFacilityId stamp written by partialize); otherwise it
// is wiped before it can ever be shown.
useAuthStore.subscribe((authState, prevAuthState) => {
  const nextUser = authState.user;
  const prevUser = prevAuthState.user;
  if (
    nextUser?.id === prevUser?.id &&
    nextUser?.facilityId === prevUser?.facilityId
  ) {
    return;
  }
  const keepRestored =
    !!nextUser &&
    !prevUser &&
    readPersistedOwnerFacilityId() === nextUser.facilityId;
  lastFetchedAt.clear();
  // The live inventory listener is facility-scoped — never let it survive a
  // logout or account switch; the next fetchInventory re-subscribes.
  unsubscribeInventory();
  if (!keepRestored) {
    useInventoryStore.setState({
      items: [],
      inventoryItems: [],
      stores: [],
      users: [],
      movements: [],
      sales: [],
      transfers: [],
      facilitySettings: null,
    });
  }
});

// Refresh-on-reconnect: queued offline writes replay when connectivity
// returns and other devices may have changed data meanwhile. Drop the 60s
// read TTL so the next page mount refetches post-replay state. No automatic
// refetch here — that would spend reads on pages the user never visits.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    // Deliberately plain: do NOT call waitForPendingWrites here. Calling it
    // during physical reconnect can double-apply queued increment transforms
    // (firebase-tools issue #10882). The queued writes replay on their own;
    // dropping the read TTLs just triggers a fresh fetch.
    lastFetchedAt.clear();
  });
}
