# Implementation Plan — Inventory & Sales Management System

**Date**: 2026-08-03
**Spec**: `docs/superpowers/specs/2026-08-03-inventory-sales-management-design.md`
**Team**: Frontend (you) + Backend (partner, Firebase)

---

## Phase 0: Project Setup & Foundation

### 0.1 Backend Setup (Partner)
- [ ] Create Firebase project
- [ ] Enable Firebase Auth (email/password)
- [ ] Create Firestore database
- [ ] Write Firestore security rules per role permissions
- [ ] Create initial collections (stores, items seed data)
- [ ] Create required composite indexes
- [ ] Share Firebase config with frontend

### 0.2 Frontend Scaffold (You)
- [ ] `npx create-next-app@latest` with TypeScript, Tailwind, App Router
- [ ] Install dependencies: `firebase`, `zustand`, `react-hook-form`, `zod`, `@tanstack/react-table`, `lucide-react`, `next-themes`, `serwist`
- [ ] Initialize shadcn/ui (`npx shadcn@latest init`)
- [ ] Add shadcn components: button, input, card, table, dialog, form, select, dropdown-menu, sheet, toast, badge, separator, tabs, command, popover, calendar, avatar
- [ ] Configure PWA: `serwist` for service worker + manifest.json
- [ ] Set up Firebase config file and initialize Firebase app
- [ ] Set up layout: sidebar navigation, theme provider, auth provider
- [ ] Create folder structure per architecture plan

---

## Phase 1: Auth & User System

### Backend
- [ ] Firebase Auth configuration complete

### Frontend — `/src/lib/firebase/`
1. **Firebase init & auth helpers** (`firebase/config.ts`, `firebase/auth.ts`)
   - Initialize Firebase app, auth, firestore with `enableIndexedDbPersistence()`
   - `signIn()`, `signOut()`, `onAuthStateChanged()` wrapper
2. **Auth context provider** (`providers/auth-provider.tsx`)
   - Wrap app with auth state, expose `user`, `loading`, `signIn`, `signOut`
3. **Protected route middleware** (`middleware.ts`)
   - Redirect unauthenticated users to `/`
4. **Login page** (`app/page.tsx`)
   - Email/password form with validation (Zod)
   - Error handling for invalid credentials
5. **Auth guard hook** (`hooks/use-auth.ts`)
   - Role check helper: `canManageUsers()`, `canManageStock()`, `canRecordSales()`

---

## Phase 2: Core Layout & Navigation

### Frontend
1. **App layout** (`app/(authenticated)/layout.tsx`)
   - Sidebar navigation with role-based links
   - Store selector dropdown (persisted in Zustand)
   - User avatar + sign out in header
   - Theme toggle (light/dark)
2. **Sidebar items**: Dashboard, Inventory, Stock In, Stock Out, Transfers, Reports, Settings (admin only)
3. **Mobile responsive**: Collapsible sidebar / bottom nav for mobile
4. **Loading states**: Skeleton loaders for each page

---

## Phase 3: Inventory Module

### Frontend — `/app/(authenticated)/inventory/`
1. **Inventory list page** (`inventory/page.tsx`)
   - Zustand store: `useInventoryStore` (items, search query, filters, selected store)
   - TanStack Table: columns = name, type, PC balance, CTN balance, unit price, store, stock year, actions
   - Live search with debounce (300ms)
   - Filter dropdowns: store, stock year, show low stock only
   - Action buttons per row: edit, adjust stock
   - Add item button → navigates to `/inventory/add`
2. **Add item page** (`inventory/add/page.tsx`)
   - React Hook Form + Zod validation
   - Fields: name, type, code, unit price (PC), unit price (CTN), low stock thresholds
   - On submit: create item doc in Firestore
3. **Edit item page** (`inventory/[id]/edit/page.tsx`)
   - Pre-filled form from existing item data
   - Save updates to Firestore
4. **Stock adjustment dialog/page** (`inventory/[id]/adjust/page.tsx`)
   - Show current balance, enter adjustment qty in PC/CTN
   - Require reason/notes
   - Creates `stock_movements` record with type "ADJUSTMENT"

### Zustand Store Design
```typescript
// stores/inventory-store.ts
interface InventoryState {
  items: InventoryItem[];
  searchQuery: string;
  selectedStore: string | null;
  selectedStockYear: string | null;
  showLowStockOnly: boolean;
  isLoading: boolean;
  // actions
  setSearchQuery, setSelectedStore, setStockYear, toggleLowStock,
  fetchItems, addItem, updateItem, adjustStock
}
```

---

## Phase 4: Stock In (Purchases)

### Frontend — `/app/(authenticated)/stock-in/`
1. **Stock In page** (`stock-in/page.tsx`)
   - Two tabs: "Single Entry" | "Bulk Entry"
   - **Single entry**: item selector (searchable combobox), qty PC, qty CTN, store selector
   - **Bulk entry**: table of rows, each with item selector, qty PC, qty CTN. "Add row" button
   - Auto-categorizes stockYear = current year
   - On submit: batch write to Firestore — creates `stock_movements` + updates `inventory`
2. **Recent stock-ins**: List of today's entries below the form

---

## Phase 5: Stock Out (Sales)

### Frontend — `/app/(authenticated)/stock-out/`
1. **Stock Out page** (`stock-out/page.tsx`)
   - Item selector (searchable, shows current balance)
   - Qty PC, Qty CTN fields
   - Unit price auto-filled from item, editable
   - Store selector (defaults to user's store)
   - Validation: can't sell more than available balance
   - On submit: creates `sales` doc + `stock_movements` record, deducts from `inventory`
2. **Daily summary**: Below form, table shows today's sales with totals

---

## Phase 6: Stock Transfers

### Frontend — `/app/(authenticated)/transfers/`
1. **Transfer list** (`transfers/page.tsx`)
   - Table: date, from store, to store, status badge, item count, actions
   - Filter by status (PENDING / COMPLETED / CANCELLED)
2. **New transfer** (`transfers/new/page.tsx`)
   - From store selector, To store selector (different stores enforced)
   - Add items: searchable item selector + qty PC + qty CTN per row
   - Notes field
   - Submit → creates `stock_transfers` doc with status PENDING
3. **Transfer detail** (`transfers/[id]/page.tsx`)
   - Shows full transfer details
   - Actions (role-based): Approve/Complete → adjusts inventory on both stores, creates movement records; Cancel → marks as CANCELLED
   - Cannot modify completed or cancelled transfers

---

## Phase 7: Reports

### Frontend — `/app/(authenticated)/reports/`
1. **Reports hub** (`reports/page.tsx`) — Grid of report cards linking to each report
2. **Stock valuation** (`reports/valuation/page.tsx`)
   - Per store: table of items with qty × unit price = value, grand total
   - Filter by store, stock year
3. **Movement history** (`reports/movements/page.tsx`)
   - Table: date, item, type (IN/OUT/TRANSFER), qty, store, performed by, reference
   - Date range filter, type filter, store filter
4. **Low stock** (`reports/low-stock/page.tsx`)
   - Table: items where qtyPc < threshold OR qtyCtn < threshold
   - Highlight items at zero stock
   - Filter by store
5. **Sales summary** (`reports/sales/page.tsx`)
   - Summary cards: total sales, total items sold, average sale value
   - Table grouped by item with total qty sold and total revenue
   - Date range filter, store filter
6. **Stock aging** (`reports/aging/page.tsx`)
   - Grouped by stockYear (OLD STOCK, 2026, 2027...) with qty totals and value totals per group
   - Per store or combined view

---

## Phase 8: Settings

### Frontend — `/app/(authenticated)/settings/`
1. **Settings page** (`settings/page.tsx`)
   - Tabs: Users, Stores, Thresholds
2. **User management** (Admin only)
   - Table: name, email, role, store
   - Add user: invite email + assign role + default store
   - Edit user role/store, remove user
3. **Store management** (Admin only)
   - Add/edit store name
4. **Low stock thresholds**
   - Per-item table: item name, current PC threshold, current CTN threshold
   - Inline edit or modal to update thresholds

---

## Phase 9: Dashboard

### Frontend — `/app/(authenticated)/dashboard/`
1. **Dashboard page** (`dashboard/page.tsx`)
   - Quick stats cards (top row, grid): total items count, total inventory value, today's sales total, low stock items count
   - Each card uses Firestore real-time listener for live updates
   - Recent activity: last 10 `stock_movements` ordered by createdAt desc
   - Store selector affects all displayed data

---

## Phase 10: PWA & Polish

### Frontend
1. **Service worker** — Configure Serwist for app shell caching, static assets
2. **manifest.json** — App name, icons, start URL, display: standalone
3. **Install prompt** — Custom "Install App" button that triggers `beforeinstallprompt`
4. **Offline indicator** — Banner/tag showing "You're offline" when connectivity lost, auto-hides on reconnect
5. **Responsive audit** — Test all pages at 320px, 768px, 1024px, 1440px
6. **Dark mode** — Verify all components render correctly in both themes
7. **Accessibility** — Keyboard navigation, screen reader labels, color contrast

---

## File Structure (Frontend)

```
src/
├── app/
│   ├── page.tsx                          # Login
│   ├── layout.tsx                        # Root layout (no sidebar)
│   ├── (authenticated)/
│   │   ├── layout.tsx                    # App shell with sidebar
│   │   ├── dashboard/page.tsx
│   │   ├── inventory/
│   │   │   ├── page.tsx
│   │   │   ├── add/page.tsx
│   │   │   └── [id]/
│   │   │       ├── edit/page.tsx
│   │   │       └── adjust/page.tsx
│   │   ├── stock-in/page.tsx
│   │   ├── stock-out/page.tsx
│   │   ├── transfers/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── reports/
│   │   │   ├── page.tsx
│   │   │   ├── valuation/page.tsx
│   │   │   ├── movements/page.tsx
│   │   │   ├── low-stock/page.tsx
│   │   │   ├── sales/page.tsx
│   │   │   └── aging/page.tsx
│   │   └── settings/page.tsx
├── components/
│   ├── ui/                               # shadcn/ui components
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   └── store-selector.tsx
│   ├── inventory/
│   │   ├── item-table.tsx
│   │   ├── item-search.tsx
│   │   ├── item-filters.tsx
│   │   └── item-form.tsx
│   ├── stock/
│   │   ├── stock-in-form.tsx
│   │   ├── bulk-entry-table.tsx
│   │   ├── stock-out-form.tsx
│   │   └── daily-summary.tsx
│   ├── transfers/
│   │   ├── transfer-list.tsx
│   │   └── transfer-form.tsx
│   ├── reports/
│   │   └── report-filters.tsx
│   ├── dashboard/
│   │   ├── stat-card.tsx
│   │   └── recent-activity.tsx
│   └── auth/
│       └── login-form.tsx
├── lib/
│   ├── firebase/
│   │   ├── config.ts
│   │   ├── auth.ts
│   │   ├── firestore.ts
│   │   └── types.ts
│   └── utils.ts
├── hooks/
│   ├── use-auth.ts
│   ├── use-store.ts
│   └── use-online-status.ts
├── stores/
│   ├── auth-store.ts
│   ├── inventory-store.ts
│   ├── stock-store.ts
│   └── ui-store.ts
└── types/
    └── index.ts
```

---

## Build Order (Recommended)

| Step | What | Who | Depends On |
|------|------|-----|------------|
| 1 | Firebase project setup + config | Partner | — |
| 2 | Project scaffold + deps + PWA | You | Step 1 |
| 3 | Auth (Firebase Auth + Login page) | You + Partner | Steps 1-2 |
| 4 | Core layout (sidebar, header, theme) | You | Step 3 |
| 5 | Inventory (CRUD + search) | You | Steps 1,3 |
| 6 | Stock In + Stock Out | You | Steps 1,5 |
| 7 | Stock Transfers | You | Steps 1,5 |
| 8 | Reports | You | Steps 5-7 |
| 9 | Settings | You | Steps 1,3 |
| 10 | Dashboard | You | Steps 5-9 |
| 11 | PWA polish + offline testing | You | Step 10 |
| 12 | Data import from Excel | You + Partner | Step 5 |
