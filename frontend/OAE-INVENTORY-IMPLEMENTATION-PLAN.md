# OAE Inventory Management - Firebase Production Implementation Plan

**Timeline**: 2.5 Days (52 Hours)  
**Target Businesses**: Stationary Businesses (Primary) + Hardware Stores (Secondary - Minimal)  
**Approach**: Leverage Legacy Medicore patterns while avoiding its architectural complexity

---

## Executive Summary

This plan converts the OAE Inventory Management demo app into a production-ready, multi-tenant Firebase application with offline-first capabilities. It adopts the proven **facility-nesting architecture** from Legacy Medicore (`facilities/{facilityId}/...`) but simplifies the sync engine, removes Dexie conflicts, and implements a **job-title + duty-based RBAC system** suitable for variable team sizes in stationary and hardware businesses.

### Phases Overview (52 Hours)

| Phase | Hours | Focus |
|-------|-------|-------|
| 1 | 0-6 | Firebase config, remove DEV_BYPASS |
| 2 | 6-12 | Firestore schema (facility-nested) |
| 3 | 12-20 | Auth + duty-based permissions + add-staff-by-email |
| 4 | 20-30 | Stationary onboarding (handles single/multi-store) |
| 5 | 30-38 | Core inventory (stock, sales, transfers, stock-takes, reports) |
| 6 | 38-42 | SuperAdmin dashboard |
| 7 | 42-45 | Security rules (facility-scoped, license-aware) |
| 8 | 45-47 | Hardware minimal (categories, UoM flags) |
| 9 | 47-50 | **Mobile/Desktop UI + PWA** (responsive, touch, offline UX, SW) |
| 10 | 50-52 | Testing & deployment |

---

## Phase 0: Research & Analysis Summary

### Legacy Medicore Patterns to Adopt
| Pattern | Legacy Implementation | OAE Adaptation |
|---------|----------------------|----------------|
| **Facility Nesting** | `facilities/{facilityId}/users/{uid}` | `facilities/{facilityId}/users/{uid}` ✓ |
| **User-Lookup** | `user-lookup/{uid}` → facilityId | Same (critical for auth flow) |
| **Onboarding Flow** | 3-step: Facility → Staffing → Admin | 3-step: Business → Stores → Admin |
| **SuperAdmin Dashboard** | Facilities, Licenses, Invoices, Notifications | Same structure, inventory-focused |
| **License System** | Trial → Active/Grace/Expired | Same tiers: solo/multi-store |
| **RBAC** | Custom claims: duties + isTenantAdmin | Job titles + 2 roles (admin/staff) + duties |
| **Security Rules** | Facility-scoped with license locking | Adapted for inventory collections |

### Legacy Medicore Anti-Patterns to Avoid
1. ❌ **Dexie/IndexedDB dual-write** → Use Firebase offline persistence only
2. ❌ **Complex sync engine (200+ lines)** → Remove entirely
3. ❌ **LocalStorage session caching with empty firebaseUid** → Firebase Auth only
4. ❌ **Monolithic AuthProvider** → Separate concerns
5. ❌ **SuperAdmin catch-all security rules** → Strict facility-scoped rules
6. ❌ **Deep Firestore nesting beyond facility level** → Flat subcollections

### Business Requirements (Uganda Market Research)
| Challenge | Stationary Business | Hardware Store |
|-----------|---------------------|----------------|
| **Peak Season** | Back-to-school (60% revenue in 6 weeks) | Construction seasons |
| **Stockout Rate** | 18% without planning | 15-20% lost sales |
| **Shrinkage** | 5-15% annually | 5-15% (theft + errors) |
| **Payment** | Mobile money split payments | Mobile money + credit |
| **Multi-location** | Main store + branches | Main warehouse + retail outlets |
| **Key Need** | School list pre-orders, seasonal forecasting | Serial tracking, parts management |

---

## Phase 1: Firebase Infrastructure & Configuration (Hours 0-6)

### 1.1 Firebase Project Setup
```bash
# Required services to enable:
- Authentication (Email/Password)
- Cloud Firestore (Native mode)
- Firebase Hosting
- Cloud Functions (for license checks, license-engine)
```

### 1.2 Environment Configuration
**File**: `frontend/.env.local`
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-real-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

### 1.3 Firebase Config Enhancement
**File**: `frontend/src/lib/firebase/config.ts`
- Keep existing `enableIndexedDbPersistence` (works offline)
- Add `settings({ cacheSizeBytes: 50 * 1024 * 1024 })` for larger offline cache
- No Dexie integration

### 1.4 Remove DEV_BYPASS
**File**: `frontend/src/components/auth/auth-provider.tsx`
- Remove lines 18-40 (DEV_BYPASS block)
- Keep only real Firebase auth flow
- Add proper error handling for auth state changes

---

## Phase 2: Data Model & Firestore Schema (Hours 6-12)

### 2.1 Core Collections Structure (Facility-Nested)

```
firestore/
├── superAdmin/{uid}                    # SuperAdmin flags
├── user-lookup/{uid}                   # uid → {facilityId, email, role}
├── facilities/{facilityId}/
│   ├── facility (doc)                  # Business profile
│   ├── users/{uid}                     # Staff members
│   ├── items/{itemId}                  # Product catalog
│   ├── inventory/{inventoryId}         # Stock levels per store
│   ├── stores/{storeId}                # Store locations
│   ├── transactions/{transactionId}    # Sales, purchases, adjustments
│   ├── transfers/{transferId}          # Inter-store transfers
│   ├── stock-takes/{stockTakeId}       # Physical counts
│   ├── licenses/{licenseId}            # Facility license
│   └── invoices/{invoiceId}            # License invoices
```

### 2.2 Document Schemas

#### Facility Document (`facilities/{facilityId}`)
```typescript
interface Facility {
  id: string;
  name: string;
  businessType: "stationary" | "hardware" | "both";
  facilityType: "retail" | "wholesale" | "both";
  stores: Store[];                    // Embedded store configs
  currency: "UGX" | "KES" | "USD";    // Default: UGX
  phone: string;
  adminEmail: string;
  address?: string;
  createdAt: Timestamp;
  onboardingCompletedAt: Timestamp;
  licenseStatus: "trial" | "active" | "grace" | "expired" | "suspended";
  trialEndsAt: Timestamp;
  settings: FacilitySettings;
}

interface Store {
  id: string;                         // "main", "branch-1", etc.
  name: string;                       // "Main Store", "Kampala Branch"
  type: "main" | "branch";
  address?: string;
  managerId?: string;                 // User uid
  isActive: boolean;
}
```

#### User Document (`facilities/{facilityId}/users/{uid}`)
```typescript
interface FacilityUser {
  id: string;                         // Firebase Auth UID
  facilityId: string;
  name: string;
  email: string;
  phone?: string;
  jobTitle: string;                   // "Store Manager", "Sales Clerk", "Inventory Officer", "Accountant"
  role: "admin" | "staff";            // Only 2 roles
  duties: DutyGrants;                 // Copied from Legacy Medicore
  storeIds: string[];                 // Stores this user can access
  active: boolean;
  invitedAt: Timestamp;
  invitedBy: string;
  lastLoginAt?: Timestamp;
  createdAt: Timestamp;
}

type DutyGrants = {
  // Inventory duties
  view_inventory: boolean;
  manage_inventory: boolean;          // Add/edit items, stock adjustments
  manage_stock_levels: boolean;       // Stock-in, stock-out
  manage_transfers: boolean;          // Inter-store transfers
  manage_stock_takes: boolean;        // Physical counts
  
  // Sales duties
  record_sales: boolean;
  view_sales: boolean;
  manage_sales: boolean;              // Void, refund
  
  // Reports duties
  view_reports: boolean;
  export_reports: boolean;
  
  // Settings duties
  manage_users: boolean;              // Invite/remove staff
  manage_stores: boolean;             // Add/edit stores
  manage_settings: boolean;           // Business settings
  
  // Admin duty (super-set)
  admin: boolean;
};
```

#### Item Document (`facilities/{facilityId}/items/{itemId}`)
```typescript
interface Item {
  id: string;
  facilityId: string;
  name: string;                       // "Ball point pens, Dolphin"
  type: string;                       // "Blue", "Black", "12mm"
  code?: string;                      // SKU/Barcode
  category: ItemCategory;             // See below
  unitPricePc: number;                // Price per piece
  unitPriceCtn: number;               // Price per carton (0 if not sold by carton)
  pcsPerCtn: number;                  // Pieces per carton (default: 1)
  lowStockThresholdPc: number;
  lowStockThresholdCtn: number;
  supplier?: string;
  reorderPoint?: number;
  reorderQty?: number;
  // Stationary-specific
  brand?: string;
  // Hardware-specific
  serialTracked?: boolean;            // For tools/equipment
  warrantyMonths?: number;
  unitOfMeasure?: "pcs" | "meters" | "kg" | "liters";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

type ItemCategory = 
  // Stationary
  | "PENS" | "PENCILS" | "MARKERS" | "HIGHLIGHTERS"
  | "NOTEBOOKS" | "EXERCISE_BOOKS" | "COUNTER_BOOKS" | "ANALYSIS_BOOKS" | "CASH_BOOKS"
  | "FILES" | "BOX_FILES" | "CLAMP_FILES" | "RING_BINDERS" | "BINDING_RINGS"
  | "PAPER" | "COMPUTER_PAPER" | "PRINTING_PAPER" | "PHOTOCOPY_PAPER"
  | "BOARDS" | "WHITE_BOARDS" | "NOTICE_BOARDS" | "CHALKBOARDS"
  | "TAPES" | "CELLO_TAPE" | "MASKING_TAPE" | "DUCT_TAPE"
  | "BAGS" | "CLEAR_BAGS" | "PLASTIC_BAGS"
  | "CLIPS" | "BINDER_CLIPS" | "PAPER_CLIPS" | "PUSH_PINS"
  | "DESK_ORGANIZERS" | "STAPLERS" | "PUNCHES" | "SCISSORS" | "RULERS"
  | "ART_SUPPLIES" | "CANVAS_BOARDS" | "PAINTS" | "BRUSHES"
  // Hardware
  | "HAND_TOOLS" | "POWER_TOOLS" | "MEASURING_TOOLS" | "CUTTING_TOOLS"
  | "FASTENERS" | "SCREWS" | "NAILS" | "BOLTS" | "NUTS" | "WASHERS"
  | "PLUMBING" | "PIPES" | "FITTINGS" | "VALVES" | "SEALANTS"
  | "ELECTRICAL" | "WIRES" | "SWITCHES" | "SOCKETS" | "BREAKERS"
  | "PAINTING" | "PAINTS" | "BRUSHES" | "ROLLERS" | "DROP_CLOTHS"
  | "SAFETY" | "HELMETS" | "GLOVES" | "GOGGLES" | "BOOTS"
  | "BUILDING_MATERIALS" | "CEMENT" | "SAND" | "AGGREGATES" | "BRICKS"
  | "OTHER";
```

#### Inventory Document (`facilities/{facilityId}/inventory/{inventoryId}`)
```typescript
interface InventoryItem {
  id: string;
  facilityId: string;
  storeId: string;                    // References stores subcollection
  itemId: string;
  stockYear: string;                  // "2026", "2025" (for year-over-year)
  qtyPc: number;                      // Quantity in pieces
  qtyCtn: number;                     // Quantity in cartons
  reservedQtyPc?: number;             // Reserved for pending orders
  reservedQtyCtn?: number;
  lastCountedAt?: Timestamp;          // Last physical count
  lastCountedBy?: string;
  updatedAt: Timestamp;
  updatedBy: string;
}
```

#### Transaction Document (`facilities/{facilityId}/transactions/{transactionId}`)
```typescript
interface Transaction {
  id: string;
  facilityId: string;
  storeId: string;
  type: "SALE" | "PURCHASE" | "ADJUSTMENT" | "TRANSFER_IN" | "TRANSFER_OUT";
  items: TransactionItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  paymentMethod: "CASH" | "MOBILE_MONEY" | "BANK_TRANSFER" | "CREDIT" | "SPLIT";
  paymentReference?: string;          // Mobile money transaction ID
  splitPayments?: SplitPayment[];     // For split mobile money
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  referenceId?: string;               // Links to transfer/stock-take
  referenceType?: "TRANSFER" | "STOCK_TAKE" | "ADJUSTMENT";
  performedBy: string;                // User uid
  performedByName: string;
  notes?: string;
  status: "COMPLETED" | "PENDING" | "CANCELLED" | "REFUNDED";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface TransactionItem {
  itemId: string;
  itemName: string;
  itemType: string;
  qtyPc: number;
  qtyCtn: number;
  unitPrice: number;                  // Price at time of sale
  subtotal: number;
}

interface SplitPayment {
  method: "CASH" | "MOBILE_MONEY" | "BANK_TRANSFER";
  amount: number;
  reference?: string;
  paidAt: Timestamp;
}
```

#### Stock Transfer Document (`facilities/{facilityId}/transfers/{transferId}`)
```typescript
interface StockTransfer {
  id: string;
  facilityId: string;
  fromStoreId: string;
  toStoreId: string;
  items: TransferItem[];
  status: "PENDING" | "IN_TRANSIT" | "COMPLETED" | "CANCELLED";
  requestedBy: string;
  requestedByName: string;
  approvedBy?: string;
  approvedAt?: Timestamp;
  receivedBy?: string;
  receivedAt?: Timestamp;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### Stock Take Document (`facilities/{facilityId}/stock-takes/{stockTakeId}`)
```typescript
interface StockTake {
  id: string;
  facilityId: string;
  storeId: string;
  items: StockTakeItem[];
  status: "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  initiatedBy: string;
  initiatedByName: string;
  completedBy?: string;
  completedAt?: Timestamp;
  varianceNotes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface StockTakeItem {
  itemId: string;
  itemName: string;
  itemType: string;
  systemQtyPc: number;
  systemQtyCtn: number;
  countedQtyPc: number;
  countedQtyCtn: number;
  variancePc: number;
  varianceCtn: number;
  notes?: string;
}
```

### 2.3 License System (Adapted from Legacy)

**License Tiers for Inventory App:**
- **Solo**: Single store, up to 500 items, 2 staff
- **Multi-Store**: Up to 5 stores, 2000 items, 10 staff
- **Enterprise**: Unlimited stores/items/staff

**License Document** (`facilities/{facilityId}/licenses/{licenseId}`)
```typescript
interface FacilityLicense {
  id: string;
  facilityId: string;
  tier: "solo" | "multi" | "enterprise";
  status: "trial" | "active" | "grace" | "expired" | "suspended";
  issuedAt: Timestamp;
  expiresAt: Timestamp;
  graceEndsAt?: Timestamp;
  paymentMethod?: string;
  lastPaymentAmount?: number;
  lastPaymentAt?: Timestamp;
  invoiceId?: string;
  currency: "UGX" | "KES" | "USD";
  features: LicenseFeatures;
}

interface LicenseFeatures {
  maxStores: number;
  maxItems: number;
  maxStaff: number;
  multiCurrency: boolean;
  advancedReports: boolean;
  apiAccess: boolean;
  barcodeScanning: boolean;
  serialTracking: boolean;
}
```

---

## Phase 3: Authentication & Authorization System (Hours 12-20)

### 3.1 Auth Flow (Following Legacy Pattern)

```
Onboarding → Firebase Auth User Created → Firestore Docs Created (atomic batch)
    ↓
User-Lookup Doc Created (uid → facilityId)
    ↓
Trial License Created
    ↓
Sign Out → Redirect to Login
    ↓
Login → Firebase Auth → onAuthStateChanged → Read user-lookup → Read Facility User → Set Session
```

### 3.2 Auth Provider Implementation

**File**: `frontend/src/components/auth/auth-provider.tsx`
```typescript
// Key changes:
// 1. Remove DEV_BYPASS entirely
// 2. Use onAuthChange from firebase/auth.ts
// 3. On auth change: read user-lookup → read facility user → set Zustand store
// 4. Add loading states for each step
// 5. Handle license status check (redirect to /billing if expired)
```

### 3.3 Add Staff by Email (Copy Legacy Pattern)

**File**: `frontend/src/app/(authenticated)/staff/page.tsx` (new)
- Admin clicks "Add Staff"
- Enters email + job title + duties
- Creates Firebase Auth user with temporary password
- Sends invitation email (or shows temp password for manual sharing)
- Creates user doc in `facilities/{facilityId}/users/{newUid}`
- Updates user-lookup

### 3.4 Duty-Based Permission System

**File**: `frontend/src/lib/permissions.ts` (new)
```typescript
// Map job titles to default duty grants
const JOB_TITLE_DUTIES: Record<string, DutyGrants> = {
  "Store Manager": {
    view_inventory: true, manage_inventory: true, manage_stock_levels: true,
    manage_transfers: true, manage_stock_takes: true,
    record_sales: true, view_sales: true, manage_sales: true,
    view_reports: true, export_reports: true,
    manage_users: false, manage_stores: false, manage_settings: false,
    admin: false
  },
  "Sales Clerk": {
    view_inventory: true, manage_inventory: false, manage_stock_levels: false,
    manage_transfers: false, manage_stock_takes: false,
    record_sales: true, view_sales: true, manage_sales: false,
    view_reports: false, export_reports: false,
    manage_users: false, manage_stores: false, manage_settings: false,
    admin: false
  },
  "Inventory Officer": {
    view_inventory: true, manage_inventory: true, manage_stock_levels: true,
    manage_transfers: true, manage_stock_takes: true,
    record_sales: false, view_sales: true, manage_sales: false,
    view_reports: true, export_reports: true,
    manage_users: false, manage_stores: false, manage_settings: false,
    admin: false
  },
  "Accountant": {
    view_inventory: true, manage_inventory: false, manage_stock_levels: false,
    manage_transfers: false, manage_stock_takes: false,
    record_sales: false, view_sales: true, manage_sales: true,
    view_reports: true, export_reports: true,
    manage_users: false, manage_stores: false, manage_settings: false,
    admin: false
  },
  "Admin": {
    // All true
  }
};

// Permission check hook
export function usePermission(duty: keyof DutyGrants): boolean {
  const user = useAuthStore(state => state.user);
  return user?.duties?.[duty] ?? false;
}
```

### 3.5 Route Guards (Update Existing)

**File**: `frontend/src/lib/route-permissions.ts`
```typescript
// Replace role-based with duty-based
export const ROUTE_DUTIES: Record<string, keyof DutyGrants[]> = {
  "/inventory": ["view_inventory"],
  "/inventory/add": ["manage_inventory"],
  "/inventory/[id]/edit": ["manage_inventory"],
  "/stock-in": ["manage_stock_levels"],
  "/stock-out": ["record_sales"],
  "/stock-taking": ["manage_stock_takes"],
  "/transfers": ["manage_transfers"],
  "/reports": ["view_reports"],
  "/settings": ["manage_settings"],
  "/staff": ["manage_users"],
  "/stores": ["manage_stores"],
};
```

---

## Phase 4: Onboarding Flow for Stationary Businesses (Hours 20-30)

### 4.1 Onboarding Steps (Adapted from Legacy)

**Step 1: Business Details**
```typescript
interface OnboardingStep1 {
  businessName: string;               // "Kampala Stationers Ltd"
  businessType: "stationary" | "hardware" | "both";
  facilityType: "retail" | "wholesale" | "both";
  currency: "UGX" | "KES" | "USD";
  phone: string;
  email: string;                      // Admin email
  address?: string;
}
```

**Step 2: Store Configuration** (Handles businesses with/without multiple stores)
```typescript
interface OnboardingStep2 {
  hasMultipleStores: boolean;
  stores: Array<{
    name: string;                     // "Main Store", "Nakawa Branch"
    type: "main" | "branch";
    address?: string;
  }>;
  // Default: if !hasMultipleStores, create single "Main Store"
}
```

**Step 3: Admin Account**
```typescript
interface OnboardingStep3 {
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  adminPassword: string;              // Min 8 chars
  confirmPassword: string;
}
```

### 4.2 Onboarding Implementation

**Files to Create/Modify:**
- `frontend/src/app/onboarding/page.tsx` (new - copy Legacy structure)
- `frontend/src/app/onboarding/onboarding-context.tsx` (new)
- `frontend/src/app/onboarding/steps/business-details.tsx` (new)
- `frontend/src/app/onboarding/steps/store-config.tsx` (new)
- `frontend/src/app/onboarding/steps/admin-account.tsx` (new)

### 4.3 Onboarding Firestore Write (Atomic Batch)

```typescript
// In onboarding completion handler:
const batch = writeBatch(firestore);

// 1. Facility doc
batch.set(doc(firestore, "facilities", facilityId), {
  id: facilityId,
  name: data.businessName,
  businessType: data.businessType,
  facilityType: data.facilityType,
  stores: data.stores.map(s => ({ ...s, id: generateId() })),
  currency: data.currency,
  phone: data.phone,
  adminEmail: data.adminEmail.toLowerCase(),
  address: data.address,
  createdAt: serverTimestamp(),
  onboardingCompletedAt: serverTimestamp(),
  licenseStatus: "trial",
  trialEndsAt: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
});

// 2. Admin user doc
batch.set(doc(firestore, "facilities", facilityId, "users", firebaseUid), {
  id: firebaseUid,
  facilityId,
  name: data.adminName,
  email: data.adminEmail.toLowerCase(),
  phone: data.adminPhone,
  jobTitle: "Admin",
  role: "admin",
  duties: JOB_TITLE_DUTIES["Admin"],
  storeIds: data.stores.map(s => s.id),
  active: true,
  invitedAt: serverTimestamp(),
  invitedBy: firebaseUid,
  createdAt: serverTimestamp(),
});

// 3. Default items for stationary (seed catalog)
if (data.businessType === "stationary" || data.businessType === "both") {
  STATIONARY_DEFAULT_ITEMS.forEach(item => {
    batch.set(doc(firestore, "facilities", facilityId, "items", item.id), {
      ...item,
      facilityId,
      createdAt: serverTimestamp(),
      createdBy: firebaseUid,
    });
  });
}

// 4. User-lookup
batch.set(doc(firestore, "user-lookup", firebaseUid), {
  email: data.adminEmail.toLowerCase(),
  facilityId,
  role: "admin",
  createdAt: serverTimestamp(),
});

// 5. Trial license
const license = createTrialLicense(facilityId, "solo", "UGX");
batch.set(doc(firestore, "facilities", facilityId, "licenses", license.id), license);

await batch.commit();
await firebaseSignOut();
router.push("/login?setup=complete");
```

### 4.4 Stationary Default Catalog (Seed Data)

Pre-populate with common stationary items organized by category for immediate use.

---

## Phase 5: Core Inventory Features (Hours 30-38)

### 5.1 Inventory Dashboard
- Real-time stock levels across stores
- Low stock alerts (using thresholds)
- Category filtering
- Search by name/code/barcode

### 5.2 Stock Movements
| Movement | Who | Description |
|----------|-----|-------------|
| **Stock In** | Admin/Inventory Officer | Receive purchases, record supplier deliveries |
| **Stock Out (Sales)** | Sales Clerk | Record customer sales (mobile money reference) |
| **Adjustment** | Admin/Inventory Officer | Damage, expiry, write-offs |
| **Transfer** | Admin/Inventory Officer | Move stock between stores |

### 5.3 Stock Taking (Physical Counts)
- Initiate count by store
- Compare system vs actual
- Record variances with notes
- Auto-adjust inventory on completion

### 5.4 Reports (Read-only for Clerks)
- Stock valuation (FIFO/Weighted average)
- Low stock report
- Sales by item/category/store
- Stock movement history
- Aging inventory (OLD_STOCK vs NEW_STOCK)

---

## Phase 6: SuperAdmin Dashboard (Hours 38-42)

### 6.1 Features (Copy from Legacy)
**File**: `frontend/src/app/super-admin/dashboard/page.tsx`
- Platform overview: Total facilities, active licenses, revenue
- License status breakdown (trial/active/grace/expired)
- Quick actions: Manage facilities, Create invoice, Send notification

### 6.2 SuperAdmin Pages to Implement
| Page | Purpose |
|------|---------|
| `/super-admin/facilities` | List all facilities, suspend/activate, view details |
| `/super-admin/facilities/[facilityId]` | Facility details, license management, staff view |
| `/super-admin/licenses` | All licenses, upgrade/downgrade, extend trial |
| `/super-admin/invoices` | Generate invoices, record payments |
| `/super-admin/notifications` | Broadcast to all or specific facilities |

### 6.3 SuperAdmin Auth
- Check `user-lookup` for `role: "superadmin"` or separate `superAdmin/{uid}` collection
- Custom claim `isSuperAdmin: true`

---

## Phase 7: Security Rules (Hours 42-45)

### 7.1 Firestore Rules Structure (Adapted from Legacy)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ── Helpers ─────────────────────────────────────────────
    function isAuth() { return request.auth != null; }
    
    function isSuperAdmin() {
      return isAuth() && (
        request.auth.token.isSuperAdmin == true ||
        exists(/databases/$(database)/documents/superAdmin/$(request.auth.uid))
      );
    }
    
    function getUserFacilityId() {
      return get(/databases/$(database)/documents/user-lookup/$(request.auth.uid)).data.facilityId;
    }
    
    function getUserRole() {
      return get(/databases/$(database)/documents/user-lookup/$(request.auth.uid)).data.role;
    }
    
    function getUserDuties() {
      return get(/databases/$(database)/documents/facilities/$(getUserFacilityId())/users/$(request.auth.uid)).data.duties;
    }
    
    function hasDuty(duty) {
      return isAuth() && getUserDuties()[duty] == true;
    }
    
    function isFacilityMember(facilityId) {
      return isAuth() && getUserFacilityId() == facilityId;
    }
    
    function isFacilityAdmin(facilityId) {
      return isFacilityMember(facilityId) && getUserRole() == "admin";
    }
    
    function isFacilityLocked(facilityId) {
      return isAuth() && request.auth.token.licenseLocked == true;
    }
    
    // ── SuperAdmin Collections ──────────────────────────────
    match /superAdmin/{uid} {
      allow read, write: if isSuperAdmin();
    }
    
    match /user-lookup/{uid} {
      allow read: if isAuth() && (request.auth.uid == uid || isSuperAdmin());
      allow create: if isAuth();  // Onboarding
      allow update, delete: if isSuperAdmin();
    }
    
    // ── Facility Collections ────────────────────────────────
    match /facilities/{facilityId} {
      allow read: if isSuperAdmin() || isFacilityMember(facilityId);
      allow create: if isAuth();  // Onboarding
      allow update: if isSuperAdmin() || (isFacilityAdmin(facilityId) && !isFacilityLocked(facilityId));
      allow delete: if isSuperAdmin();
      
      // Users subcollection
      match /users/{uid} {
        allow read: if isSuperAdmin() || isFacilityMember(facilityId);
        allow create: if isSuperAdmin() || (isFacilityAdmin(facilityId) && !isFacilityLocked(facilityId));
        allow update: if isSuperAdmin() || (isFacilityAdmin(facilityId) && !isFacilityLocked(facilityId));
        allow delete: if isSuperAdmin() || (isFacilityAdmin(facilityId) && !isFacilityLocked(facilityId));
      }
      
      // Items
      match /items/{itemId} {
        allow read: if isSuperAdmin() || isFacilityMember(facilityId);
        allow create: if isSuperAdmin() || (hasDuty('manage_inventory') && !isFacilityLocked(facilityId));
        allow update: if isSuperAdmin() || (hasDuty('manage_inventory') && !isFacilityLocked(facilityId));
        allow delete: if isSuperAdmin() || (hasDuty('manage_inventory') && !isFacilityLocked(facilityId));
      }
      
      // Inventory
      match /inventory/{inventoryId} {
        allow read: if isSuperAdmin() || isFacilityMember(facilityId);
        allow create, update: if isSuperAdmin() || (hasDuty('manage_stock_levels') && !isFacilityLocked(facilityId));
        allow delete: if isSuperAdmin();
      }
      
      // Stores
      match /stores/{storeId} {
        allow read: if isSuperAdmin() || isFacilityMember(facilityId);
        allow create, update: if isSuperAdmin() || (hasDuty('manage_stores') && !isFacilityLocked(facilityId));
        allow delete: if isSuperAdmin();
      }
      
      // Transactions
      match /transactions/{transactionId} {
        allow read: if isSuperAdmin() || isFacilityMember(facilityId);
        allow create: if isSuperAdmin() || (
          (hasDuty('record_sales') || hasDuty('manage_stock_levels')) && !isFacilityLocked(facilityId)
        );
        allow update: if isSuperAdmin() || (hasDuty('manage_sales') && !isFacilityLocked(facilityId));
        allow delete: if isSuperAdmin();
      }
      
      // Transfers
      match /transfers/{transferId} {
        allow read: if isSuperAdmin() || isFacilityMember(facilityId);
        allow create, update: if isSuperAdmin() || (hasDuty('manage_transfers') && !isFacilityLocked(facilityId));
        allow delete: if isSuperAdmin();
      }
      
      // Stock Takes
      match /stock-takes/{stockTakeId} {
        allow read: if isSuperAdmin() || isFacilityMember(facilityId);
        allow create, update: if isSuperAdmin() || (hasDuty('manage_stock_takes') && !isFacilityLocked(facilityId));
        allow delete: if isSuperAdmin();
      }
      
      // Licenses
      match /licenses/{licenseId} {
        allow read: if isSuperAdmin() || isFacilityMember(facilityId);
        allow write: if isSuperAdmin();
      }
      
      // Invoices
      match /invoices/{invoiceId} {
        allow read: if isSuperAdmin() || isFacilityMember(facilityId);
        allow write: if isSuperAdmin();
      }
    }
  }
}
```

---

## Phase 8: Hardware Store Minimal Implementation (Hours 45-47)

### 8.1 Additional Item Categories
Add hardware categories to `ItemCategory` type (already defined above).

### 8.2 Serial Tracking (Optional - Flag Only)
```typescript
// In Item schema:
serialTracked?: boolean;  // If true, track individual serial numbers
```

### 8.3 Unit of Measure
```typescript
unitOfMeasure?: "pcs" | "meters" | "kg" | "liters" | "boxes";
```

### 8.4 No Additional UI for Now
- Hardware items use same inventory UI
- Serial tracking = future enhancement
- Unit of measure = display only for now

---

## Phase 9: Mobile + Desktop UI Optimizations & PWA Support (Hours 47-50)

### 9.1 Responsive Design System (Tailwind CSS 4)

**Breakpoint Strategy:**
```css
/* Mobile-first breakpoints */
sm: 640px   /* Small tablets */
md: 768px   /* Tablets */
lg: 1024px  /* Laptops */
xl: 1280px  /* Desktops */
2xl: 1536px /* Large screens */
```

**Component Responsiveness Patterns:**
| Component | Mobile (<640px) | Tablet (640-1024px) | Desktop (>1024px) |
|-----------|-----------------|---------------------|-------------------|
| **Sidebar** | Slide-out drawer (Sheet) | Collapsible rail | Full sidebar |
| **Tables** | Horizontal scroll / card view | Condensed columns | Full columns |
| **Forms** | Stacked fields | 2-column grid | 3-column grid |
| **Dashboard Stats** | 1-col grid | 2-col grid | 4-col grid |
| **Modals** | Full-screen | Centered (max-w-lg) | Centered (max-w-2xl) |
| **Inventory List** | Card layout | Compact table | Full table |

### 9.2 Mobile-First UI Components

**Files to Enhance:**
- `frontend/src/components/layout/sidebar.tsx` → Add Sheet drawer for mobile
- `frontend/src/components/layout/header.tsx` → Mobile menu button, search
- `frontend/src/components/ui/table.tsx` → Responsive table with card fallback
- `frontend/src/components/ui/card.tsx` → Inventory item cards for mobile
- `frontend/src/app/(authenticated)/inventory/page.tsx` → Mobile card view
- `frontend/src/app/(authenticated)/dashboard/page.tsx` → Responsive stat grid

**Key Mobile Patterns:**
```tsx
// Sidebar: Desktop = fixed, Mobile = Sheet
<Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
  <SheetTrigger asChild>
    <Button variant="outline" className="lg:hidden">Menu</Button>
  </SheetTrigger>
  <SheetContent side="left" className="w-72 lg:hidden">
    <SidebarContent />
  </SheetContent>
</Sheet>
{/* Desktop sidebar */}
<aside className="hidden lg:flex lg:flex-col lg:w-64">...</aside>

// Table: Desktop = table, Mobile = cards
<div className="hidden lg:block">
  <Table>...</Table>
</div>
<div className="lg:hidden space-y-3">
  {data.map(item => <InventoryCard key={item.id} item={item} />)}
</div>
```

### 9.3 Touch Optimizations

| Optimization | Implementation |
|--------------|----------------|
| **Touch Targets** | Min 44x44px (use `min-h-[44px] min-w-[44px]`) |
| **Swipe Actions** | Swipe-to-delete on inventory cards, swipe-to-edit |
| **Pull-to-Refresh** | On dashboard/inventory lists |
| **Haptic Feedback** | Vibrate API on critical actions (stock adjust, sale) |
| **Virtual Keyboard** | `inputMode="numeric"` for quantity fields |
| **Safe Areas** | `pb-safe` for bottom nav on notched devices |

### 9.4 PWA Implementation

**File**: `frontend/public/manifest.json`
```json
{
  "name": "OAE Inventory",
  "short_name": "OAE",
  "description": "Offline-first inventory management for stationary & hardware businesses",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "orientation": "portrait-primary",
  "icons": [
    { "src": "/icons/icon-72.png", "sizes": "72x72", "type": "image/png" },
    { "src": "/icons/icon-96.png", "sizes": "96x96", "type": "image/png" },
    { "src": "/icons/icon-128.png", "sizes": "128x128", "type": "image/png" },
    { "src": "/icons/icon-144.png", "sizes": "144x144", "type": "image/png" },
    { "src": "/icons/icon-152.png", "sizes": "152x152", "type": "image/png" },
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-384.png", "sizes": "384x384", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "categories": ["business", "productivity"],
  "screenshots": [],
  "shortcuts": [
    { "name": "New Sale", "url": "/stock-out", "icons": [{ "src": "/icons/sale.png", "sizes": "96x96" }] },
    { "name": "Stock In", "url": "/stock-in", "icons": [{ "src": "/icons/stock-in.png", "sizes": "96x96" }] },
    { "name": "Low Stock", "url": "/reports/low-stock", "icons": [{ "src": "/icons/alert.png", "sizes": "96x96" }] }
  ]
}
```

**File**: `frontend/src/app/layout.tsx` (add PWA meta)
```tsx
export const metadata: Metadata = {
  title: "OAE Inventory",
  description: "Offline-first inventory management",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "OAE" },
  formatDetection: "telephone=no",
};
```

**Service Worker**: `frontend/public/sw.js` (Workbox)
```javascript
// Cache strategies:
// - Static assets: CacheFirst
// - API/Firestore: NetworkFirst with offline fallback
// - Images: CacheFirst with expiration

const CACHE_NAME = 'oae-inventory-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([
      '/', '/dashboard', '/inventory', '/offline.html',
      '/manifest.json'
    ]))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // NetworkFirst for navigation, CacheFirst for static
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
  }
});
```

**Register SW**: `frontend/src/components/pwa/sw-registration.tsx`
```tsx
"use client";
import { useEffect } from "react";

export function SWRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js")
        .then(reg => console.log("SW registered:", reg.scope))
        .catch(err => console.log("SW registration failed:", err));
    }
  }, []);
  return null;
}
```

### 9.5 Offline UX Enhancements

| Feature | Implementation |
|---------|----------------|
| **Offline Indicator** | Top banner "You're offline - changes will sync when online" |
| **Pending Sync Queue** | Show count of pending writes in header |
| **Conflict Resolution** | Last-write-wins with user notification |
| **Background Sync** | Service Worker periodic sync for pending transactions |
| **Offline Pages** | `/offline.html` with cached dashboard data |

### 9.6 Performance Optimizations

| Optimization | Target |
|--------------|--------|
| **First Contentful Paint** | < 1.5s |
| **Time to Interactive** | < 3s |
| **Bundle Size** | < 200KB gzipped (main) |
| **Lighthouse Score** | > 90 Performance, > 90 PWA |

**Implementation:**
- Dynamic imports for heavy pages (`next/dynamic`)
- Image optimization (`next/image` with WebP/AVIF)
- Font optimization (`next/font` with variable fonts)
- React.memo on list items
- Virtualized lists for large inventories (`@tanstack/react-virtual`)

---

## Phase 10: Testing & Deployment (Hours 50-52)

### 10.1 Testing Checklist

| Test | Description |
|------|-------------|
| **Auth Flow** | Onboarding → Login → Dashboard access |
| **Role/Duty Permissions** | Each duty grants/denies correct routes |
| **Multi-Store** | Switch stores, transfer stock, consolidated reports |
| **Offline** | Disconnect network, make changes, reconnect → sync |
| **License** | Trial expiry → grace → expired → license blocked |
| **SuperAdmin** | Can view all facilities, manage licenses |
| **Mobile Money** | Record split payments with references |
| **Responsive** | Test all breakpoints (320px - 1920px) |
| **Touch** | Swipe, tap, long-press on mobile devices |
| **PWA** | Install prompt, offline mode, background sync |
| **Performance** | Lighthouse audit on mobile & desktop |

### 10.2 Deployment Steps
1. `firebase deploy --only firestore:rules`
2. `firebase deploy --only functions` (if license engine functions)
3. `npm run build` in frontend
4. `firebase deploy --only hosting`
5. Verify PWA installability on mobile Chrome/Safari

---

## File Changes Summary

### New Files to Create
```
frontend/src/
├── app/
│   ├── onboarding/
│   │   ├── page.tsx
│   │   ├── onboarding-context.tsx
│   │   └── steps/
│   │       ├── business-details.tsx
│   │       ├── store-config.tsx
│   │       └── admin-account.tsx
│   ├── super-admin/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── facilities/page.tsx
│   │   ├── facilities/[facilityId]/page.tsx
│   │   ├── licenses/page.tsx
│   │   ├── invoices/page.tsx
│   │   └── notifications/page.tsx
│   └── (authenticated)/
│       └── staff/page.tsx
├── lib/
│   ├── permissions.ts
│   └── license/
│       ├── license-engine.ts
│       └── license-adapter.ts
├── components/
│   ├── onboarding/
│   │   └── step-indicator.tsx
│   ├── pwa/
│   │   └── sw-registration.tsx
│   └── ui/
│       └── inventory-card.tsx          # Mobile card view for inventory
├── public/
│   ├── manifest.json                   # PWA manifest
│   ├── sw.js                           # Service Worker
│   ├── offline.html                    # Offline fallback page
│   └── icons/                          # PWA icons (72-512px)
└── types/
    └── index.ts (extend with new types)
```

### Files to Modify
```
frontend/
├── .env.local                              # Real Firebase config
├── src/
│   ├── app/
│   │   ├── layout.tsx                      # Add PWA metadata
│   │   └── globals.css                     # Add safe-area, touch utilities
│   ├── components/
│   │   ├── auth/auth-provider.tsx          # Remove DEV_BYPASS, add SWRegistration
│   │   ├── layout/sidebar.tsx              # Add Sheet drawer for mobile
│   │   ├── layout/header.tsx               # Mobile menu, offline indicator
│   │   └── ui/
│   │       ├── table.tsx                   # Responsive: table + card fallback
│   │       └── card.tsx                    # Inventory card component
│   ├── lib/
│   │   ├── firebase/config.ts              # Enhance persistence (50MB cache)
│   │   ├── firebase/auth.ts                # Add getUserProfile with facility
│   │   ├── firebase/firestore.ts           # Add facility-scoped helpers
│   │   └── route-permissions.ts            # Duty-based instead of role-based
│   ├── stores/
│   │   ├── auth-store.ts                   # Add duties, storeIds, jobTitle
│   │   ├── inventory-store.ts              # Real Firestore listeners
│   │   └── ui-store.ts                     # Add sidebarOpen, offline status
│   └── types/index.ts                      # Add Facility, FacilityUser, DutyGrants, etc.
```

### Files NOT to Touch (Per Requirements)
```
c:\Users\DELL\OneDrive\Desktop\Legacy M\NEW UPDATE\  # Legacy Medicore - READ ONLY
```

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Firebase config issues | Medium | High | Test config early, have fallback mock mode |
| Security rules too restrictive | Medium | High | Test each duty/role combination thoroughly |
| Offline sync conflicts | Low | Medium | Firebase persistence handles most cases |
| Onboarding email delivery | Medium | Medium | Show temp password in UI as backup |
| Performance with large catalogs | Low | Medium | Add pagination, indexes for queries |

---

## Success Criteria

### Technical
- [ ] Firebase Auth + Firestore fully integrated
- [ ] Offline persistence working (IndexedDB)
- [ ] Multi-tenant facility isolation enforced by rules
- [ ] Duty-based RBAC functional for all routes
- [ ] SuperAdmin dashboard operational
- [ ] License system: trial → active → grace → expired

### Business
- [ ] Stationary onboarding handles single/multi-store
- [ ] Default stationary catalog seeded on onboarding
- [ ] Mobile money payments recorded with references
- [ ] Hardware items supported (categories, UoM flags)
- [ ] Staff invitation by email working

### Quality
- [ ] Zero TypeScript errors
- [ ] Build passes (`npm run build`)
- [ ] All route guards tested
- [ ] Security rules tested per role/duty
- [ ] **Lighthouse PWA score > 90**
- [ ] **Lighthouse Performance > 90 (mobile & desktop)**
- [ ] **Responsive at all breakpoints (320px - 1920px)**
- [ ] **PWA installable on Chrome Android & Safari iOS**
- [ ] **Offline mode functional (read/write + sync)**

---

## Post-Launch Enhancements (Not in 2.5-Day Scope)

1. **Barcode Scanning** - Camera-based for stock-in/sales
2. **Advanced Forecasting** - ML-based demand prediction
3. **Supplier Portal** - External purchase orders
4. **Customer Portal** - B2B ordering for stationary
5. **React Native App** - Native mobile apps (PWA covers web)
6. **Serial Number Tracking** - Full hardware implementation
7. **Accounting Integration** - QuickBooks/Xero sync
8. **Multi-Currency** - Full support with exchange rates

---

## Appendix: Key Code References

### Legacy Medicore Reference Files (Read-Only)
- `NEW UPDATE/firestore.rules` - Security rules pattern
- `NEW UPDATE/app/onboarding/page.tsx` - Onboarding flow
- `NEW UPDATE/app/onboarding/onboarding-context.tsx` - State management
- `NEW UPDATE/app/super-admin/dashboard/page.tsx` - SuperAdmin UI
- `NEW UPDATE/lib/auth/firebase-auth.ts` - Auth utilities
- `NEW UPDATE/lib/license/license-engine.ts` - License logic
- `NEW UPDATE/lib/license/license-adapter.ts` - Firestore license CRUD

### OAE Files to Reference
- `frontend/src/types/index.ts` - Current type definitions
- `frontend/src/lib/route-permissions.ts` - Current route guards
- `frontend/src/stores/auth-store.ts` - Current auth state
- `frontend/src/lib/mock-data.ts` - Stationary catalog reference

---

*Plan created: 2026-08-21*  
*Status: Ready for Implementation Phase*