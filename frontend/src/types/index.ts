import { Timestamp } from "firebase/firestore";

// ─── User & Auth ────────────────────────────────────────
export type UserRole = "admin" | "manager" | "clerk";
export type FacilityRole = "admin" | "staff";

export interface DutyGrants {
  // Inventory duties
  view_inventory: boolean;
  manage_inventory: boolean; // Add/edit items, stock adjustments
  manage_stock_levels: boolean; // Stock-in, stock-out
  manage_transfers: boolean; // Inter-store transfers

  // Sales duties
  record_sales: boolean;
  view_sales: boolean;
  manage_sales: boolean; // Void, refund

  // Reports duties
  view_reports: boolean;
  export_reports: boolean;

  // Settings duties
  manage_users: boolean; // Invite/remove staff
  manage_stores: boolean; // Add/edit stores
  manage_settings: boolean; // Business settings

  // Admin duty (super-set)
  admin: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  normalizedEmail: string;
  onboarded: boolean;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface FacilityUser {
  id: string; // Firebase Auth UID
  facilityId: string;
  name: string;
  email: string;
  normalizedEmail: string;
  phone?: string;
  jobTitle: string; // "Store Manager", "Sales Clerk", "Inventory Officer", "Accountant", "Admin"
  role: FacilityRole; // Only 2 roles: admin | staff
  duties: DutyGrants;
  storeIds: string[]; // Stores this user can access
  active: boolean;
  onboarded: boolean;
  invitedAt: Timestamp;
  invitedBy: string;
  lastLoginAt?: Timestamp;
  createdAt: Timestamp;
  isSuperAdmin?: boolean; // Platform-level administrator (session-resolved)
}

export interface UserLookup {
  email: string;
  facilityId: string;
  role: FacilityRole;
  createdAt: Timestamp;
}

// ─── Facility / Business ─────────────────────────────────
export type BusinessType = "stationary" | "hardware" | "both";
export type FacilityType = "retail" | "wholesale" | "both";
export type Currency = "UGX" | "KES" | "USD";
export type StoreType = "main" | "branch";

export interface Store {
  id: string; // "main", "branch-1", etc.
  name: string; // "Main Store", "Kampala Branch"
  type: StoreType;
  address?: string;
  managerId?: string; // User uid
  isActive: boolean;
}

export interface FacilitySettings {
  defaultStoreId?: string;
  allowNegativeStock: boolean;
  requireTransferApproval: boolean;
  lowStockAlertEnabled: boolean;
  currency: Currency;
  timezone: string;
}

export interface Facility {
  id: string;
  name: string;
  businessType: BusinessType;
  facilityType: FacilityType;
  stores: Store[];
  currency: Currency;
  phone: string;
  adminEmail: string;
  address?: string;
  createdAt: Timestamp;
  onboardingCompletedAt: Timestamp;
  licenseStatus: LicenseStatus;
  trialEndsAt: Timestamp;
  settings: FacilitySettings;
}

export type LicenseStatus = "trial" | "active" | "grace" | "expired" | "suspended";

export type LicenseTier = "solo" | "multi" | "enterprise";

export interface LicenseFeatures {
  maxStores: number;
  maxItems: number;
  maxStaff: number;
  multiCurrency: boolean;
  advancedReports: boolean;
  apiAccess: boolean;
  barcodeScanning: boolean;
  serialTracking: boolean;
}

export interface FacilityLicense {
  id: string;
  facilityId: string;
  tier: LicenseTier;
  status: LicenseStatus;
  issuedAt: Timestamp;
  expiresAt: Timestamp;
  graceEndsAt?: Timestamp;
  paymentMethod?: string;
  lastPaymentAmount?: number;
  lastPaymentAt?: Timestamp;
  invoiceId?: string;
  currency: Currency;
  features: LicenseFeatures;
}

// ─── Items / Products ───────────────────────────────────
export type ItemCategory =
  // Stationary
  | "PENS"
  | "PENCILS"
  | "MARKERS"
  | "HIGHLIGHTERS"
  | "NOTEBOOKS"
  | "EXERCISE_BOOKS"
  | "COUNTER_BOOKS"
  | "ANALYSIS_BOOKS"
  | "CASH_BOOKS"
  | "FILES"
  | "BOX_FILES"
  | "CLAMP_FILES"
  | "RING_BINDERS"
  | "BINDING_RINGS"
  | "PAPER"
  | "COMPUTER_PAPER"
  | "PRINTING_PAPER"
  | "PHOTOCOPY_PAPER"
  | "BOARDS"
  | "WHITE_BOARDS"
  | "NOTICE_BOARDS"
  | "CHALKBOARDS"
  | "TAPES"
  | "CELLO_TAPE"
  | "MASKING_TAPE"
  | "DUCT_TAPE"
  | "BAGS"
  | "CLEAR_BAGS"
  | "PLASTIC_BAGS"
  | "CLIPS"
  | "BINDER_CLIPS"
  | "PAPER_CLIPS"
  | "PUSH_PINS"
  | "DESK_ORGANIZERS"
  | "STAPLERS"
  | "PUNCHES"
  | "SCISSORS"
  | "RULERS"
  | "ART_SUPPLIES"
  | "CANVAS_BOARDS"
  | "PAINTS"
  | "BRUSHES"
  // Hardware
  | "HAND_TOOLS"
  | "POWER_TOOLS"
  | "MEASURING_TOOLS"
  | "CUTTING_TOOLS"
  | "FASTENERS"
  | "SCREWS"
  | "NAILS"
  | "BOLTS"
  | "NUTS"
  | "WASHERS"
  | "PLUMBING"
  | "PIPES"
  | "FITTINGS"
  | "VALVES"
  | "SEALANTS"
  | "ELECTRICAL"
  | "WIRES"
  | "SWITCHES"
  | "SOCKETS"
  | "BREAKERS"
  | "PAINTING"
  | "PAINTS_HW"
  | "BRUSHES_HW"
  | "ROLLERS"
  | "DROP_CLOTHS"
  | "SAFETY"
  | "HELMETS"
  | "GLOVES"
  | "GOGGLES"
  | "BOOTS"
  | "BUILDING_MATERIALS"
  | "CEMENT"
  | "SAND"
  | "AGGREGATES"
  | "BRICKS"
  | "OTHER";

export type UnitOfMeasure = "pcs" | "meters" | "kg" | "liters" | "boxes" | "custom";

export interface QuantityType {
  id: string; // Unique identifier for this quantity type
  label: string; // Display label (e.g., "Piece", "Carton", "Meter", "Kilogram")
  unit: UnitOfMeasure; // Standard unit or "custom"
  customUnit?: string; // Custom unit name when unit === "custom"
  price: number; // Sale price per unit
  costPrice?: number; // Cost price per unit (what the business pays)
  isDefault: boolean; // One primary quantity type
  conversionFactor?: number; // For non-default: how many of this unit = 1 default unit
}

export interface Item {
  id: string;
  facilityId: string;
  name: string; // "Ball point pens, Dolphin"
  type: string; // "Blue", "Black", "12mm"
  code?: string; // SKU/Barcode
  category: ItemCategory;
  // Legacy fields (kept for backward compatibility)
  unitPricePc: number; // Price per piece
  unitPriceCtn: number; // Price per carton (0 if not sold by carton)
  pcsPerCtn: number; // Pieces per carton (default: 1)
  lowStockThresholdPc: number;
  lowStockThresholdCtn: number;
  // New flexible quantity types system
  quantityTypes: QuantityType[]; // Custom quantity types with pricing
  // Low stock thresholds per quantity type ID
  lowStockThresholds?: Record<string, number>;
  supplier?: string;
  reorderPoint?: number;
  reorderQty?: number;
  // Stationary-specific
  brand?: string;
  // Hardware-specific
  serialTracked?: boolean; // For tools/equipment
  warrantyMonths?: number;
  unitOfMeasure?: UnitOfMeasure;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

// ─── Inventory ──────────────────────────────────────────
export interface InventoryItem {
  id: string;
  facilityId: string;
  storeId: string; // References stores subcollection
  itemId: string;
  stockYear: string; // "2026", "2025" (for year-over-year)
  quantities: Record<string, number>; // Quantity per quantity type ID (e.g., "pcs": 100, "boxes": 10)
  reservedQuantities?: Record<string, number>; // Reserved per quantity type ID
  lastCountedAt?: Timestamp; // Last physical count
  lastCountedBy?: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

export type InventoryWithItem = InventoryItem & {
  itemName: string;
  itemType: string;
  itemCode?: string;
  // Denormalized quantity types from Item for display/calculation
  quantityTypes: QuantityType[];
  // Low stock thresholds per quantity type ID
  lowStockThresholds: Record<string, number>;
  serialTracked?: boolean;
  unitOfMeasure?: UnitOfMeasure;
};

// ─── Stock Movements ────────────────────────────────────
export type MovementType =
  | "IN"
  | "OUT"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "ADJUSTMENT";

export type ReferenceType =
  | "SALE"
  | "PURCHASE"
  | "TRANSFER"
  | "ADJUSTMENT";

export interface StockMovement {
  id: string;
  facilityId: string;
  storeId: string;
  itemId: string;
  type: MovementType;
  quantities: Record<string, number>; // Quantity per quantity type ID
  referenceType: ReferenceType;
  referenceId: string;
  unitCosts?: Record<string, number>; // Cost price snapshot per quantity type ID (stock-in)
  quantityTypes?: QuantityType[]; // Label snapshot at write time — catalog/row copies can drift or regenerate ids later
  performedBy: string;
  performedByName: string;
  notes?: string;
  createdAt: Timestamp;
}

// ─── Transactions / Sales ────────────────────────────────
export interface TransactionItem {
  itemId: string;
  itemName: string;
  itemType: string;
  quantities: Record<string, number>; // Quantity per quantity type ID
  unitPrices: Record<string, number>; // Unit sale price per quantity type ID
  unitCosts?: Record<string, number>; // Unit cost price snapshot per quantity type ID
  quantityTypes?: QuantityType[]; // Label snapshot at sale time — catalog/row copies can drift or regenerate ids later
  profit?: number; // Profit for this item (Σ qty × (sale price − cost price))
  subtotal: number;
}

export interface SplitPayment {
  method: "CASH" | "MOBILE_MONEY" | "BANK_TRANSFER";
  amount: number;
  reference?: string;
  paidAt: Timestamp;
}

export type PaymentMethod = "CASH" | "MOBILE_MONEY" | "BANK_TRANSFER" | "CREDIT" | "SPLIT";
export type TransactionStatus = "COMPLETED" | "PENDING" | "CANCELLED" | "REFUNDED";
export type TransactionType =
  | "SALE"
  | "PURCHASE"
  | "ADJUSTMENT"
  | "TRANSFER_IN"
  | "TRANSFER_OUT";

export interface Transaction {
  id: string;
  facilityId: string;
  storeId: string;
  type: TransactionType;
  items: TransactionItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  profit?: number; // Total profit snapshot (Σ item profits)
  paidAmount: number;
  paymentMethod: PaymentMethod;
  paymentReference?: string; // Mobile money transaction ID
  splitPayments?: SplitPayment[]; // For split mobile money
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  referenceId?: string; // Links to transfer/adjustment
  referenceType?: "TRANSFER" | "ADJUSTMENT";
  performedBy: string; // User uid
  performedByName: string;
  notes?: string;
  status: TransactionStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Stock Transfers ────────────────────────────────────
export type TransferStatus = "PENDING" | "IN_TRANSIT" | "COMPLETED" | "CANCELLED";

export interface TransferItem {
  itemId: string;
  itemName: string;
  itemType: string;
  quantities: Record<string, number>; // Quantity per quantity type ID
  receivedQuantities?: Record<string, number>; // Actual quantities confirmed at the destination store
}

export interface StockTransfer {
  id: string;
  facilityId: string;
  fromStoreId: string;
  toStoreId: string;
  items: TransferItem[];
  status: TransferStatus;
  requestedBy: string;
  requestedByName: string;
  approvedBy?: string;
  approvedAt?: Timestamp;
  dispatchedBy?: string;
  dispatchedByName?: string;
  dispatchedAt?: Timestamp;
  receivedBy?: string;
  receivedByName?: string;
  receivedAt?: Timestamp;
  cancelledBy?: string;
  cancelledByName?: string;
  cancelledAt?: Timestamp;
  cancelReason?: string;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Invoices (License) ─────────────────────────────────
export interface LicenseInvoice {
  id: string;
  facilityId: string;
  amount: number;
  currency: Currency;
  status: "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
  issuedAt: Timestamp;
  dueAt: Timestamp;
  paidAt?: Timestamp;
  paymentMethod?: string;
  paymentReference?: string;
  tier: LicenseTier;
  billingPeriodMonths: number;
}

// ─── SuperAdmin ────────────────────────────────────────
export interface SuperAdminUser {
  uid: string;
  email: string;
  name: string;
  createdAt: Timestamp;
}

// ─── Onboarding ────────────────────────────────────────
export interface OnboardingData {
  // Step 1: Business Details
  businessName: string;
  businessType: BusinessType;
  facilityType: FacilityType;
  currency: Currency;
  phone: string;
  email: string; // Admin email
  address?: string;

  // Step 2: Store Configuration
  hasMultipleStores: boolean;
  stores: Array<{
    name: string;
    type: StoreType;
    address?: string;
  }>;

  // Step 3: Admin Account
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  adminPassword: string;
  confirmPassword: string;
}

// ─── Legacy types (for backward compatibility during migration) ───
export interface AppUser {
  uid: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "clerk"; // Legacy roles
  storeId: string;
}

export interface StoreLegacy {
  id: string;
  name: string;
  createdAt: Timestamp;
}

export interface ItemLegacy {
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

export interface InventoryItemLegacy {
  id: string;
  storeId: string;
  itemId: string;
  stockYear: string;
  qtyPc: number;
  qtyCtn: number;
  updatedAt: Timestamp;
}

export type InventoryWithItemLegacy = InventoryItemLegacy & {
  itemName: string;
  itemType: string;
  itemCode?: string;
  unitPricePc: number;
  unitPriceCtn: number;
  lowStockThresholdPc?: number;
  lowStockThresholdCtn?: number;
};