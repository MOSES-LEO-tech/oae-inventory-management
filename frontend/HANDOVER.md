# HANDOVER.md — OAE Inventory & Sales Management System

**To:** Backend Partner (Firebase)  
**From:** Frontend Developer  
**Company:** Office Automation & Equipment Limited (OAE)  
**Date:** 2026-08-05  

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [What's Built (Frontend)](#2-whats-built-frontend)
3. [Tech Stack](#3-tech-stack)
4. [Your Job — Backend (Firebase)](#4-your-job--backend-firebase)
5. [Firebase Data Model (Complete)](#5-firebase-data-model-complete)
6. [Firestore Security Rules (Template)](#6-firestore-security-rules-template)
7. [Environment Setup (For Your AI)](#7-environment-setup-for-your-ai)
8. [How the Frontend Talks to Your Backend](#8-how-the-frontend-talks-to-your-backend)
9. [Step-by-Step: What Your AI Should Do](#9-step-by-step-what-your-ai-should-do)
10. [Testing Checklist](#10-testing-checklist)
11. [File Structure Reference](#11-file-structure-reference)

---

## 1. Project Overview

OAE is a stationery inventory and sales management system for two store locations: **Main Stores** and **Store B**. The system tracks items (pens, binding rings, counter books, notice boards, etc.) in two units: PC (pieces) and CTN (cartons). Each item belongs to a stock year category (OLD_STOCK, 2026, NEW_STOCK, etc.).

**Three user roles:**

| Role | Capabilities |
|------|-------------|
| **admin** | Full access: settings, users, inventory CRUD, stock in/out, transfers, reports, stock taking |
| **manager** | Store-scoped: inventory CRUD, stock in/out, transfers, reports, stock taking (no settings) |
| **clerk** | Read-only inventory view, stock out (sales), dashboard (no management functions) |

**The frontend is fully built and working** with mock data. Your job is to provision the Firebase backend and then we connect the real Firestore.

---

## 2. What's Built (Frontend)

| Page | Route | Status | Notes |
|------|-------|--------|-------|
| Login | `/` | Complete | Email/password form, Zod validation, connects to Firebase Auth |
| Dashboard | `/dashboard` | Complete | 3 role-specific views (admin/manager/clerk), store selector, stats |
| Inventory | `/inventory` | Complete | Table + search + filters + add/edit/adjust/delete, clerk read-only |
| Inventory Add | `/inventory/add` | Complete | Form to add new item with PC/CTN pricing + thresholds |
| Inventory Edit | `/inventory/[id]/edit` | Complete | Pre-filled form from existing item |
| Inventory Adjust | `/inventory/[id]/adjust` | Complete | Stock adjustment with reason notes |
| Stock In | `/stock-in` | Complete | Single entry + bulk entry tabs, adds to inventory |
| Stock Out | `/stock-out` | Complete | Sales recording, item search, daily summary |
| Transfers | `/transfers` | Complete | List view with status badges |
| Transfer New | `/transfers/new` | Complete | Between-store transfer form |
| Transfer Detail | `/transfers/[id]` | Complete | Full detail view with item breakdown |
| Reports Hub | `/reports` | Complete | 5 linked report cards |
| Stock Valuation | `/reports/valuation` | Complete | Per-item value (qty x unit price) |
| Movement History | `/reports/movements` | Complete | All stock in/out/transfer records |
| Low Stock | `/reports/low-stock` | Complete | Items below threshold, critical status |
| Sales Summary | `/reports/sales` | Complete | Sales by item with totals |
| Stock Aging | `/reports/aging` | Complete | Items grouped by stock year |
| Stock Taking | `/stock-taking` | Complete | Physical count → reconcile workflow, add/remove items |
| Settings | `/settings` | Complete | Users, stores, thresholds tabs (mock) |

**Design system:**

- Company colors: Primary green `#42a10b` + White `#ffffff`
- Font: Geist (via `next/font/google`)
- Border radius: 18px interactive, 24px containers
- Layout: 1280px max-width, sidebar + content shell
- Dark mode tokens defined in `globals.css`

**Route protection:**

- All routes protected by `role-guard.tsx` — unauthorized roles see "Access Denied"
- Clerk role is read-only on inventory (no add/edit/delete buttons)
- Settings page: admin only
- Stock In / Transfers / Reports / Stock Taking: admin + manager only
- Route permission matrix: `src/lib/route-permissions.ts`

**State management:**

- **Zustand stores:** `auth-store.ts`, `ui-store.ts` (store selector + sidebar), `inventory-store.ts`
- **Auth:** AuthProvider context with dev bypass (see section 8)

**Mock data layer:**

- `src/lib/mock-data.ts` — all mock items, inventory, movements, sales, transfers
- Type-safe: all mock data conforms to `src/types/index.ts`
- `AuthProvider` has a DEV BYPASS: if `NEXT_PUBLIC_FIREBASE_API_KEY` is `"your-api-key"` (placeholder), it injects a mock user. Use `?role=admin|manager|clerk` query param to test each dashboard.
- **This bypass MUST be removed** once Firebase is configured.

---

## 3. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS 4 |
| Components | shadcn/ui (Base UI variant — not Radix) |
| Forms | React Hook Form + Zod |
| State | Zustand |
| Icons | Lucide React |
| Auth | Firebase Auth |
| Database | Firestore |
| Offline | Firestore `enableIndexedDbPersistence()` |
| PWA | manifest.json present, Serwist installed (not configured) |

**Important shadcn/ui quirk:** The installed version uses **Base UI** not Radix. This means:
- `TooltipProvider` accepts `delay` not `delayDuration`
- `DropdownMenuTrigger` renders its own `<button>` — do NOT wrap it in a shadcn `<Button>` (will cause nested button DOM error)

---

## 4. Your Job — Backend (Firebase)

### 4.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (name: "OAE-Inventory" or similar)
3. Enable **Firebase Auth** → Email/Password provider
4. Enable **Cloud Firestore** (production mode)

### 4.2 Get Web App Config

1. Firebase Console → Project Settings → General → Your apps → Add app → Web
2. Copy the config values and send them to me. They go in `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
```

### 4.3 Create Required Composite Indexes

In Firestore, create these composite indexes (or your AI can create them via `firebase.json` or CLI):

| Collection | Fields | Purpose |
|-----------|--------|---------|
| `inventory` | `storeId` ASC, `stockYear` ASC | Inventory filtering |
| `inventory` | `itemId` ASC, `storeId` ASC | Item lookup per store |
| `stock_movements` | `storeId` ASC, `createdAt` DESC | Recent activity |
| `stock_movements` | `itemId` ASC, `createdAt` DESC | Item history |
| `sales` | `storeId` ASC, `createdAt` DESC | Sales filtering |
| `stock_transfers` | `status` ASC, `createdAt` DESC | Transfer list |

### 4.4 Create Initial Users (Firebase Auth)

Create these users in Firebase Auth → Users → Add user:

| Name | Email | Password (temp) | Custom Claims / Firestore role |
|------|-------|----------------|------|
| Admin User | admin@oae.dev | (set one) | `admin` + storeId: `main-stores` |
| Store Manager | manager@oae.dev | (set one) | `manager` + storeId: `store-b` |
| Sales Clerk | clerk@oae.dev | (set one) | `clerk` + storeId: `main-stores` |

### 4.5 Seed Initial Data

Your AI should write a seed script that populates these collections:

1. **`stores`** collection — 2 documents:
   - `{ id: "main-stores", name: "Main Stores" }`
   - `{ id: "store-b", name: "Store B" }`

2. **`users`** collection — 3 documents (matching Auth UIDs):
   ```json
   { "name": "Admin User", "email": "admin@oae.dev", "role": "admin", "storeId": "main-stores" }
   { "name": "Store Manager", "email": "manager@oae.dev", "role": "manager", "storeId": "store-b" }
   { "name": "Sales Clerk", "email": "clerk@oae.dev", "role": "clerk", "storeId": "main-stores" }
   ```

3. **`items`** collection — seed from the 20 items in `src/lib/mock-data.ts` (see MOCK_ITEMS array)

4. **`inventory`** collection — seed from MOCK_INVENTORY in `src/lib/mock-data.ts` (29 rows, store-specific quantities)

---

## 5. Firebase Data Model (Complete)

All types are defined in `src/types/index.ts`. Your Firestore documents must match these shapes exactly.

### Collection: `stores`
```
Document ID: store-id (string)
{
  id: string;
  name: string;
  createdAt: Timestamp;
}
```

### Collection: `users`
```
Document ID: firebase-auth-uid
{
  uid: string;        // same as doc ID
  name: string;
  email: string;
  role: "admin" | "manager" | "clerk";
  storeId: string;    // default store for this user
}
```

### Collection: `items`
```
Document ID: auto-generated
{
  id: string;
  name: string;                  // e.g. "Ball point pens, Dolphin"
  type: string;                  // e.g. "Blue", "Black", "Small", "Big"
  code?: string;                 // optional item code
  category: string;              // "OLD_STOCK" | "NEW_STOCK" | "2026" | etc.
  unitPricePc: number;           // price per piece in UGX
  unitPriceCtn: number;          // price per carton in UGX
  lowStockThresholdPc: number;   // PC threshold for low stock alert
  lowStockThresholdCtn: number;  // CTN threshold for low stock alert
  createdAt: Timestamp;
}
```

### Collection: `inventory`
```
Document ID: auto-generated
{
  id: string;
  storeId: string;     // FK → stores
  itemId: string;      // FK → items
  stockYear: string;   // denormalized from items.category for fast filtering
  qtyPc: number;       // current PC balance
  qtyCtn: number;      // current CTN balance
  updatedAt: Timestamp;
}
```

### Collection: `stock_movements`
```
Document ID: auto-generated
{
  id: string;
  storeId: string;
  itemId: string;
  type: "IN" | "OUT" | "TRANSFER_IN" | "TRANSFER_OUT" | "ADJUSTMENT";
  qtyPc: number;
  qtyCtn: number;
  referenceType: "SALE" | "PURCHASE" | "TRANSFER" | "ADJUSTMENT";
  referenceId: string;         // FK to the related document
  performedBy: string;         // user UID
  notes?: string;
  createdAt: Timestamp;
}
```

### Collection: `sales`
```
Document ID: auto-generated
{
  id: string;
  storeId: string;
  items: Array<{
    itemId: string;
    qtyPc: number;
    qtyCtn: number;
    unitPrice: number;
    subtotal: number;
  }>;
  totalAmount: number;
  soldBy: string;      // user UID
  createdAt: Timestamp;
}
```

### Collection: `stock_transfers`
```
Document ID: auto-generated
{
  id: string;
  fromStoreId: string;
  toStoreId: string;
  items: Array<{
    itemId: string;
    qtyPc: number;
    qtyCtn: number;
  }>;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  requestedBy: string;     // user UID
  completedBy?: string;    // user UID
  notes?: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
}
```

---

## 6. Firestore Security Rules (Template)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper: get the authenticated user's role
    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }
    function getUserStore() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.storeId;
    }
    function isAdmin() { return getUserRole() == "admin"; }
    function isManager() { return getUserRole() == "manager"; }
    function isClerk() { return getUserRole() == "clerk"; }

    // Stores: admin full access, others read only
    match /stores/{docId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }

    // Users: admin full access, users can read their own
    match /users/{docId} {
      allow read: if request.auth != null && (isAdmin() || docId == request.auth.uid);
      allow write: if isAdmin();
    }

    // Items: admin + manager full access, clerk read only
    match /items/{docId} {
      allow read: if request.auth != null;
      allow create, update, delete: if isAdmin() || isManager();
    }

    // Inventory: admin + manager full access, clerk read only (own store)
    match /inventory/{docId} {
      allow read: if request.auth != null;
      allow create, update, delete: if isAdmin() || isManager();
    }

    // Stock movements: admin + manager write, clerk read (own store)
    match /stock_movements/{docId} {
      allow read: if request.auth != null;
      allow create: if (isAdmin() || isManager() || isClerk()) && request.resource.data.performedBy == request.auth.uid;
      allow update, delete: if isAdmin() || isManager();
    }

    // Sales: all can create (clerk sales), admin/manager full access
    match /sales/{docId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if isAdmin() || isManager();
    }

    // Transfers: admin + manager only
    match /stock_transfers/{docId} {
      allow read: if request.auth != null;
      allow write: if isAdmin() || isManager();
    }
  }
}
```

---

## 7. Environment Setup (For Your AI)

**Prerequisites:**
- Node.js 18+ 
- Firebase CLI: `npm install -g firebase-tools`
- Firebase project created (section 4.1)

**Clone and install:**
```bash
git clone <this-repo-url>
cd OAT/frontend
npm install
npm run dev    # starts on http://localhost:3000
```

**Get it working:**
1. Replace `.env.local` values with real Firebase config from your project
2. Remove or update the DEV BYPASS guard in `src/components/auth/auth-provider.tsx` (line 21)
3. Remove the `import` of mock data from pages, replace with real Firestore hooks
4. Run `npm run build` to verify no errors

---

## 8. How the Frontend Talks to Your Backend

### Auth flow (already wired)

1. `src/lib/firebase/auth.ts` — `signIn(email, password)` calls Firebase Auth, then fetches user profile from Firestore `users/{uid}`
2. `src/lib/firebase/config.ts` — Initializes Firebase with env vars, enables offline persistence
3. `AuthProvider` listens to `onAuthStateChanged` and loads user profile into Zustand store

### Firestore CRUD (already wired)

`src/lib/firebase/firestore.ts` has generic helpers ready:
- `getDocument<T>(collection, docId)` → single doc
- `getDocuments<T>(collection, constraints)` → filtered query
- `addDocument<T>(collection, data)` → insert
- `updateDocument<T>(collection, docId, data)` → update
- `deleteDocument(collection, docId)` → delete

### What to replace

Each page currently imports from `@/lib/mock-data`. Your AI needs to:
1. Move mock data into a seed script (optional — for initial data population)
2. Replace mock imports with Firestore queries using the helpers above
3. Keep the Zustand stores — they're ready for real data, just swap the data source

**Current mock import pattern:**
```typescript
import { MOCK_INVENTORY, MOCK_STORES, formatCurrency } from "@/lib/mock-data";
```

**Target Firestore pattern:**
```typescript
import { getDocuments } from "@/lib/firebase/firestore";
import { where, orderBy } from "@/lib/firebase/firestore";

const items = await getDocuments<InventoryItem>("inventory", [
  where("storeId", "==", selectedStoreId),
  orderBy("name", "asc"),
]);
```

---

## 9. Step-by-Step: What Your AI Should Do

### Phase A: Firebase Provisioning

1. **Create Firebase project** — if not already done
2. **Enable Auth** (Email/Password) and **Firestore**
3. **Copy web config** → paste into `.env.local`
4. **Deploy security rules** — paste the template from section 6 into Firestore Rules
5. **Create composite indexes** — list from section 4.3

### Phase B: Seed Data

6. **Create Auth users** — admin, manager, clerk (set temp passwords)
7. **Populate `users` collection** — 3 user documents matching Auth UIDs
8. **Populate `stores` collection** — Main Stores + Store B
9. **Populate `items` collection** — 20 items from `mock-data.ts` MOCK_ITEMS
10. **Populate `inventory` collection** — 29 inventory rows from MOCK_INVENTORY (each row = one item in one store)

### Phase C: Frontend Migration (after Firebase is ready)

11. **Replace `.env.local` values** with real config
12. **Disable DEV BYPASS** in `auth-provider.tsx` — remove the `if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "your-api-key")` block
13. **Replace mock data in each page** — swap `MOCK_*` imports with Firestore queries
14. **Add TanStack Query** for caching/invalidation (optional but recommended)
15. **Test all flows** — login, dashboard, inventory CRUD, stock in/out, transfers, reports, stock taking
16. **Configure PWA** — wire up Serwist service worker for offline caching

### Phase D: Polish

17. **Toast notifications** — wire `useToast()` to all mutation actions
18. **Loading skeletons** — add to pages that don't have them yet
19. **Offline indicator** — banner when Firestore persistence is active but disconnected
20. **Error boundaries** — wrap pages with error UI components

---

## 10. Testing Checklist

After Firebase is connected, verify these flows:

- [ ] Login with admin credentials → sees all sidebar items
- [ ] Login with manager → sees store scoped dashboard, no Settings link
- [ ] Login with clerk → sees read-only inventory, no Stock In/Transfers
- [ ] Admin adds a new item → appears in inventory for selected store
- [ ] Manager edits item → updates in both stores if applicable
- [ ] Admin/manager performs stock in → inventory quantities increase
- [ ] Clerk records a sale (stock out) → quantities decrease, sale recorded
- [ ] Admin creates a transfer between stores → PENDING → COMPLETED
- [ ] Reports show accurate data after all operations
- [ ] Stock taking session: count, mark items for removal, add new items, finalize
- [ ] Settings: view users/stores/thresholds
- [ ] Dark mode toggle works across all pages
- [ ] Mobile responsive: sidebar collapses, tables scroll horizontally
- [ ] Offline: Firestore persistence serves cached data when disconnected
- [ ] Zero TypeScript errors: `npx tsc --noEmit`

---

## 11. File Structure Reference

```
frontend/
├── .env.local                          # Firebase config (placeholder values)
├── next.config.ts
├── package.json
├── tsconfig.json
├── public/
│   └── manifest.json                   # PWA manifest (OAE branded)
├── src/
│   ├── types/
│   │   └── index.ts                    # ALL TypeScript interfaces (AppUser, Item, InventoryItem, Sale, StockMovement, StockTransfer, Store)
│   ├── lib/
│   │   ├── mock-data.ts               # Mock data layer (REMOVE after Firebase integration)
│   │   ├── route-permissions.ts       # Route → role permission matrix
│   │   ├── utils.ts                    # cn() helper
│   │   └── firebase/
│   │       ├── config.ts              # Firebase init + env vars + offline persistence
│   │       ├── auth.ts                # signIn, signOut, onAuthChange, getCurrentUserProfile
│   │       └── firestore.ts           # Generic CRUD: getDocument, getDocuments, addDocument, updateDocument, deleteDocument
│   ├── stores/
│   │   ├── auth-store.ts              # Auth state + role helpers (Zustand)
│   │   ├── ui-store.ts                # Store selector, sidebar toggle (Zustand)
│   │   └── inventory-store.ts         # Inventory cache (Zustand)
│   ├── hooks/
│   │   └── use-online-status.ts       # Online/offline detection
│   ├── components/
│   │   ├── ui/                        # shadcn/ui components (button, card, input, badge, table, dialog, select, dropdown-menu, sheet, tabs, checkbox, label, textarea, toast, tooltip, separator, skeleton)
│   │   ├── layout/
│   │   │   ├── sidebar.tsx            # Left nav (role-filtered links, surface-alt bg)
│   │   │   ├── header.tsx             # Top bar (theme toggle, user menu)
│   │   │   └── theme-provider.tsx     # next-themes wrapper
│   │   └── auth/
│   │       ├── auth-provider.tsx       # Auth context + DEV BYPASS (REMOVE bypass)
│   │       ├── protected-route.tsx     # Route guard (not used — replaced by layout-level guard)
│   │       └── role-guard.tsx         # Client-side role guard with "Access Denied" screen
│   └── app/
│       ├── layout.tsx                  # Root layout: fonts, ThemeProvider, AuthProvider, TooltipProvider, Toaster
│       ├── page.tsx                    # Login page
│       ├── globals.css                 # DESIGN.md tokens, Tailwind v4 @theme, dark mode variables
│       └── (authenticated)/
│           ├── layout.tsx              # Sidebar + header + content shell (max-w-1280px, canvas bg)
│           ├── dashboard/page.tsx      # 3 role-specific dashboards
│           ├── inventory/
│           │   ├── page.tsx
│           │   ├── add/page.tsx
│           │   └── [id]/
│           │       ├── edit/page.tsx
│           │       └── adjust/page.tsx
│           ├── stock-in/page.tsx
│           ├── stock-out/page.tsx
│           ├── stock-taking/page.tsx   # Physical count → reconcile workflow
│           ├── transfers/
│           │   ├── page.tsx
│           │   ├── new/page.tsx
│           │   └── [id]/page.tsx
│           ├── reports/
│           │   ├── page.tsx
│           │   ├── aging/page.tsx
│           │   ├── low-stock/page.tsx
│           │   ├── movements/page.tsx
│           │   ├── sales/page.tsx
│           │   └── valuation/page.tsx
│           └── settings/page.tsx
├── docs/
│   └── superpowers/specs/
│       ├── 2026-08-03-inventory-sales-management-design.md   # Design spec
│       └── 2026-08-03-implementation-plan.md                  # 12-phase plan
├── DESIGN.md                            # UI design system reference
└── HANDOVER.md                          # THIS FILE
```

---

## Key Contact Info

- **Frontend repo:** (this repo)
- **Firebase config to send:** Paste `.env.local` values once project is created
- **Logo file:** The frontend partner will provide an OAE logo — place in `public/logo.png` and wire into sidebar/header/login page

---

*End of handover. For any questions, reach out to the frontend developer.*
