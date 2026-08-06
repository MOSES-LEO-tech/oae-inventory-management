# Inventory & Sales Management System — Design Spec

**Date**: 2026-08-03
**Status**: Approved
**Project**: OAT Stationery Inventory & Sales Management

***

## 1. Overview

A Progressive Web App (PWA) for managing stationery/office supplies inventory and sales across two store locations (MAIN STORES and STORE B). Replaces Excel-based tracking with a real-time, offline-capable, multi-user system.

### 1.1 Core Goals

- Eliminate manual data entry and calculations from Excel
- Provide full audit trail for all stock movements
- Enable multi-user access with role-based permissions
- Generate reports and analytics (valuation, movements, low stock, sales, aging)
- Work offline with automatic sync when connectivity returns

### 1.2 Users & Roles

| Role        | Permissions                                                                    |
| ----------- | ------------------------------------------------------------------------------ |
| **Admin**   | Full access: manage users, stores, all stock operations, all reports, settings |
| **Manager** | Manage stock (IN/OUT/TRANSFERS), view all reports, cannot manage users         |
| **Clerk**   | Record sales (stock out) only, view inventory (read-only)                      |

Target: 2-5 users across two store locations.

***

## 2. Technical Architecture

### 2.1 Stack

| Layer     | Technology                         | Notes                                              |
| --------- | ---------------------------------- | -------------------------------------------------- |
| Framework | Next.js 15 (App Router)            | TypeScript 5, strict mode                          |
| UI        | React + shadcn/ui + Tailwind CSS 4 | Accessible, responsive, dark mode                  |
| State     | Zustand                            | Lightweight client state + Firestore subscriptions |
| Forms     | React Hook Form + Zod              | Typed validation                                   |
| Tables    | TanStack Table                     | Sorting, filtering, pagination                     |
| Auth      | Firebase Auth (email/password)     | Built-in with Firestore                            |
| Database  | Firestore with offline persistence | `enableIndexedDbPersistence()` for offline         |
| Hosting   | Firebase Hosting                   | Same ecosystem as backend                          |
| PWA       | Serwist (next-pwa)                 | Service worker, manifest, installable              |

### 2.2 Architecture Diagram

```
┌───────────────────────────────────────────────────┐
│              PWA — Next.js App                     │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐   │
│  │ React UI  │  │  Zustand  │  │ Service Worker │   │
│  │ (shadcn)  │  │  (store)  │  │ (app cache)    │   │
│  └─────┬─────┘  └────┬─────┘  └────────────────┘   │
│        │              │                             │
│  ┌─────┴──────────────┴─────────────────────────┐  │
│  │  Firestore SDK (offline persistence)          │  │
│  │  Online → Firestore | Offline → IndexedDB     │  │
│  └──────────────────────┬───────────────────────┘  │
└─────────────────────────┼──────────────────────────┘
                          │
              ┌───────────┴───────────┐
              │      Firebase          │
              │  Auth │ Firestore │    │
              │  Hosting │ Rules   │    │
              └───────────────────────┘
```

### 2.3 Offline Strategy

Firestore's `enableIndexedDbPersistence()` handles offline automatically:

- **Online**: reads/writes go to Firestore, cached in IndexedDB
- **Offline**: reads from IndexedDB cache, writes queued in IndexedDB
- **Reconnect**: Firestore SDK auto-syncs queued changes and pulls latest data

No custom sync engine required. Service worker caches the app shell so the PWA loads even without connectivity.

### 2.4 Team Split

| Developer             | Responsibility                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| **Frontend (you)**    | Next.js app, React components, Zustand state, shadcn/ui, PWA config, service worker, routes, pages |
| **Backend (partner)** | Firebase project setup, Firestore data modeling, security rules, Firebase Auth, Firestore indexes  |

***

## 3. Data Model (Firestore)

### 3.1 Collections

```
users
├── id: string (Firebase Auth UID)
├── name: string
├── email: string
├── role: "admin" | "manager" | "clerk"
└── storeId: ref → stores (default store)

stores
├── id: string ("main-stores" | "store-b")
├── name: string
└── createdAt: timestamp

items
├── id: auto-generated
├── name: string                    (real-life name, e.g., "Dolphin Ball Point Pens")
├── type: string                    (variant, e.g., "12mm", "2Q")
├── code: string                    (internal code, optional)
├── category: string                ("OLD_STOCK" | "2026" | "2027" | ...)
├── unitPricePc: number             (price per piece)
├── unitPriceCtn: number            (price per carton)
├── lowStockThresholdPc: number     (optional, triggers low stock alert)
├── lowStockThresholdCtn: number    (optional)
└── createdAt: timestamp

inventory                          (current balance per store per item per year)
├── id: auto-generated
├── storeId: ref → stores
├── itemId: ref → items
├── stockYear: string              ("OLD_STOCK" | "2026" | "2027" | ...)
├── qtyPc: number
├── qtyCtn: number
└── updatedAt: timestamp

stock_movements                    (immutable audit log)
├── id: auto-generated
├── storeId: ref → stores
├── itemId: ref → items
├── type: "IN" | "OUT" | "TRANSFER_IN" | "TRANSFER_OUT" | "ADJUSTMENT"
├── qtyPc: number
├── qtyCtn: number
├── referenceType: string          ("SALE" | "PURCHASE" | "TRANSFER" | "ADJUSTMENT")
├── referenceId: string            (links to sale, transfer, or adjustment doc)
├── performedBy: ref → users
├── notes: string
└── createdAt: timestamp

sales
├── id: auto-generated
├── storeId: ref → stores
├── items: [{
│     itemId: ref → items,
│     qtyPc: number,
│     qtyCtn: number,
│     unitPrice: number,
│     subtotal: number
│   }]
├── totalAmount: number
├── soldBy: ref → users
└── createdAt: timestamp

stock_transfers
├── id: auto-generated
├── fromStoreId: ref → stores
├── toStoreId: ref → stores
├── items: [{
│     itemId: ref → items,
│     qtyPc: number,
│     qtyCtn: number
│   }]
├── status: "PENDING" | "COMPLETED" | "CANCELLED"
├── requestedBy: ref → users
├── completedBy: ref → users
├── notes: string
├── createdAt: timestamp
└── completedAt: timestamp
```

### 3.2 Design Decisions

| Decision                            | Reasoning                                                   |
| ----------------------------------- | ----------------------------------------------------------- |
| `inventory` as top-level collection | Enables cross-store reporting without subcollection queries |
| `stock_movements` append-only       | Full audit trail, never modified after creation             |
| PC and CTN tracked independently    | Matches existing Excel data structure                       |
| `stockYear` as string on inventory  | Enables OLD STOCK vs year-based filtering                   |
| Firestore subcollections avoided    | Simpler queries, fewer composite indexes                    |

***

## 4. Features & Screens

### 4.1 Authentication

- **Login page**: Email/password via Firebase Auth
- **Route protection**: Middleware checks auth state, redirects to login
- **Role-based UI**: Components conditionally render based on user role

### 4.2 Dashboard (`/dashboard`)

- Quick stats cards: total items, total stock value, today's sales, low stock alerts count
- Recent activity feed: last 10 stock movements across all stores
- Store selector: toggle between MAIN STORES and STORE B views

### 4.3 Inventory (`/inventory`)

- Item list table (TanStack Table): name, type, PC balance, CTN balance, unit price, store, stock year
- Live search bar: filters items by name as user types
- Filters: by store, stock year (OLD STOCK / 2026 / 2027...), low stock only
- Add item form (`/inventory/add`): name (real name), type, code, unit prices
- Edit item (`/inventory/[id]/edit`): modify item details
- Stock adjustment (`/inventory/[id]/adjust`): correct stock levels with reason/notes, creates movement record

### 4.4 Stock In — Purchases (`/stock-in`)

- Single entry: select item, enter qty PC/CTN, select store
- Bulk entry mode: add multiple items at once, matching Excel workflow
- Auto-categorizes by current year (e.g., entries in 2026 → stockYear "2026")
- Each entry creates a `stock_movements` record and updates `inventory`

### 4.5 Stock Out — Sales (`/stock-out`)

- Select item, enter qty sold in PC/CTN
- Unit price auto-fills from item, editable
- Deducts from inventory on save
- Daily sales summary per store

### 4.6 Stock Transfers (`/transfers`)

- Transfer list: all transfers with status, date, from/to store
- New transfer (`/transfers/new`): select items, quantities, from store, to store, notes
- Transfer detail (`/transfers/[id]`): view, approve/complete, or cancel
- Status workflow: PENDING → COMPLETED (or CANCELLED)
- On completion: inventory adjusts on both stores, movement records created

### 4.7 Reports (`/reports`)

- Stock valuation: quantity × unit price per item, per store
- Movement history: all IN/OUT/TRANSFER records in date range
- Low stock: items below configured threshold (PC or CTN)
- Sales summary: by store, by item, by date range
- Stock aging: grouped by stockYear/category with totals

### 4.8 Settings (`/settings`)

- User management (Admin only): add/edit/remove users, assign roles and default store
- Store management: add/edit store locations
- Low stock thresholds: per-item configurable minimum stock levels (PC and CTN)

***

## 5. Route Map

```
/                         → Login page
/dashboard                → Quick stats + recent activity

/inventory                → Item list with search & filters
/inventory/add            → Add new item
/inventory/[id]/edit      → Edit item details
/inventory/[id]/adjust    → Stock adjustment

/stock-in                 → Record incoming stock (single + bulk)
/stock-out                → Record sales (daily summary)

/transfers                → Transfer list
/transfers/new            → Request new transfer
/transfers/[id]           → Transfer detail (approve/complete)

/reports                  → Reports hub
/reports/valuation        → Stock valuation
/reports/movements        → Movement history
/reports/low-stock        → Low stock alerts
/reports/sales            → Sales summary
/reports/aging            → Stock aging

/settings                 → User & store management, thresholds
```

***

## 6. Non-Functional Requirements

| Requirement        | Target                                            |
| ------------------ | ------------------------------------------------- |
| Offline capability | Full CRUD offline, auto-sync on reconnect         |
| Installable        | PWA on mobile, tablet, desktop                    |
| Responsive         | Mobile-first, works 320px–2560px                  |
| Accessibility      | WCAG 2.1 AA minimum                               |
| Dark mode          | System-preference + manual toggle                 |
| Performance        | Initial load < 3s on 3G, time-to-interactive < 5s |

***

## 7. Assumptions

- Firebase project will be created and configured by backend developer
- Real-life item names will be provided for the initial data import
- Both stores share the same item catalog
- Internet is available most of the time; offline is for intermittent connectivity loss, not permanent disconnected operation but should be able to work offline for long periods of time
- Security rules will be defined by backend developer per role permissions

***

## 8. Out of Scope (v1)

- Supplier management and purchase orders
- Customer management and accounts receivable
- Barcode/QR code scanning
- Full POS receipt printing
- Advanced profit margin analysis
- Multi-currency support
- Integration with accounting software

