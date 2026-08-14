export type ThemeMode = "light" | "dark" | "system";
export type FontSize = "sm" | "md" | "lg";
export type Density = "compact" | "default" | "cozy";
export type SymbolPos = "before" | "after";
export type ThousandsSep = "," | " ";
export type ReportPreset = "today" | "7d" | "month" | "custom";
export type PrintOrient = "portrait" | "landscape";

export interface AppearancePrefs {
  theme: ThemeMode;
  fontSize: FontSize;
  density: Density;
  reducedMotion: boolean;
  strongFocus: boolean;
}

export interface CompanyPrefs {
  name: string;
  shortCode: string;
  address: string;
  phone: string;
  email: string;
  logoDataUrl?: string;
}

export interface CurrencyPrefs {
  code: string;
  symbol: string;
  symbolPos: SymbolPos;
  decimals: 0 | 2;
  thousandsSep: ThousandsSep;
}

export interface DefaultsPrefs {
  storeId: string | null;
  stockYear: string | "auto";
  pageSize: 20 | 50 | 100;
  reportPreset: ReportPreset;
  printOrient: PrintOrient;
  ctnSize: number;
}

export interface NotificationCategoryPrefs {
  lowStock: { enabled: boolean; criticalOnly: boolean; storeId: string | null };
  agingStock: { enabled: boolean; olderThanMonths: number };
  stockTakeReminder: {
    enabled: boolean;
    everyWeeks: number;
    weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    hhmm: string;
  };
  dailyCloseSummary: {
    enabled: boolean;
    hhmm: string;
    storeId: string | null;
  };
}

export interface NotificationsPrefs {
  channels: { toast: boolean; email: boolean };
  categories: NotificationCategoryPrefs;
}

export interface StockRulesPrefs {
  blockNegativeSales: boolean;
  paperNegDuringStocktake: boolean;
  ctnSize: number;
  criticalPct: number;
  hideOldStockMonths: number | null;
}

export interface Preferences {
  appearance: AppearancePrefs;
  company: CompanyPrefs;
  currency: CurrencyPrefs;
  defaults: DefaultsPrefs;
  notifications: NotificationsPrefs;
  stockRules: StockRulesPrefs;
}

export type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

export const DEFAULT_PREFERENCES: Preferences = {
  appearance: {
    theme: "system",
    fontSize: "md",
    density: "default",
    reducedMotion: false,
    strongFocus: false,
  },
  company: {
    name: "Office Automation & Equipment Limited",
    shortCode: "OAE",
    address: "",
    phone: "",
    email: "",
    logoDataUrl: undefined,
  },
  currency: {
    code: "UGX",
    symbol: "USh",
    symbolPos: "before",
    decimals: 0,
    thousandsSep: ",",
  },
  defaults: {
    storeId: null,
    stockYear: "auto",
    pageSize: 50,
    reportPreset: "7d",
    printOrient: "portrait",
    ctnSize: 24,
  },
  notifications: {
    channels: { toast: true, email: false },
    categories: {
      lowStock: { enabled: true, criticalOnly: false, storeId: null },
      agingStock: { enabled: true, olderThanMonths: 12 },
      stockTakeReminder: {
        enabled: true,
        everyWeeks: 4,
        weekday: 1,
        hhmm: "09:00",
      },
      dailyCloseSummary: {
        enabled: false,
        hhmm: "18:00",
        storeId: null,
      },
    },
  },
  stockRules: {
    blockNegativeSales: true,
    paperNegDuringStocktake: false,
    ctnSize: 24,
    criticalPct: 50,
    hideOldStockMonths: null,
  },
};

export type PrefPath =
  | "appearance.theme"
  | "appearance.fontSize"
  | "appearance.density"
  | "appearance.reducedMotion"
  | "appearance.strongFocus"
  | "company.name"
  | "company.shortCode"
  | "company.address"
  | "company.phone"
  | "company.email"
  | "company.logoDataUrl"
  | "currency.code"
  | "currency.symbol"
  | "currency.symbolPos"
  | "currency.decimals"
  | "currency.thousandsSep"
  | "defaults.storeId"
  | "defaults.stockYear"
  | "defaults.pageSize"
  | "defaults.reportPreset"
  | "defaults.printOrient"
  | "defaults.ctnSize"
  | "notifications.channels.toast"
  | "notifications.channels.email"
  | "notifications.categories.lowStock"
  | "notifications.categories.lowStock.enabled"
  | "notifications.categories.lowStock.criticalOnly"
  | "notifications.categories.lowStock.storeId"
  | "notifications.categories.agingStock"
  | "notifications.categories.agingStock.enabled"
  | "notifications.categories.agingStock.olderThanMonths"
  | "notifications.categories.stockTakeReminder"
  | "notifications.categories.stockTakeReminder.enabled"
  | "notifications.categories.stockTakeReminder.everyWeeks"
  | "notifications.categories.stockTakeReminder.weekday"
  | "notifications.categories.stockTakeReminder.hhmm"
  | "notifications.categories.dailyCloseSummary"
  | "notifications.categories.dailyCloseSummary.enabled"
  | "notifications.categories.dailyCloseSummary.hhmm"
  | "notifications.categories.dailyCloseSummary.storeId"
  | "stockRules.blockNegativeSales"
  | "stockRules.paperNegDuringStocktake"
  | "stockRules.ctnSize"
  | "stockRules.criticalPct"
  | "stockRules.hideOldStockMonths";

export type Role = "admin" | "manager" | "clerk";

export type CapabilityKey =
  | "inventory.view"
  | "inventory.edit"
  | "inventory.adjust"
  | "inventory.delete"
  | "sales.record"
  | "stockIn.record"
  | "transfers.manage"
  | "stockTake.run"
  | "reports.view"
  | "reports.export"
  | "users.manage"
  | "stores.manage"
  | "settings.manage";

export interface CapabilityDefinition {
  key: CapabilityKey;
  label: string;
  description: string;
  matrix: Record<Role, boolean>;
}

export const CAPABILITY_MATRIX: CapabilityDefinition[] = [
  {
    key: "inventory.view",
    label: "View inventory",
    description: "Browse inventory lists and item detail pages.",
    matrix: { admin: true, manager: true, clerk: true },
  },
  {
    key: "inventory.edit",
    label: "Edit item metadata",
    description: "Rename items, edit prices, change types/codes.",
    matrix: { admin: true, manager: true, clerk: false },
  },
  {
    key: "inventory.adjust",
    label: "Adjust stock",
    description: "Manually increase or decrease on-hand quantities.",
    matrix: { admin: true, manager: true, clerk: false },
  },
  {
    key: "inventory.delete",
    label: "Delete inventory items",
    description: "Permanently remove items from the catalog.",
    matrix: { admin: true, manager: false, clerk: false },
  },
  {
    key: "sales.record",
    label: "Record sales (stock out)",
    description: "Record customer sales and reduce inventory.",
    matrix: { admin: true, manager: true, clerk: true },
  },
  {
    key: "stockIn.record",
    label: "Record stock in",
    description: "Receive and add new stock into a store.",
    matrix: { admin: true, manager: true, clerk: false },
  },
  {
    key: "transfers.manage",
    label: "Create and approve transfers",
    description: "Move stock between Main Stores and Store B.",
    matrix: { admin: true, manager: true, clerk: false },
  },
  {
    key: "stockTake.run",
    label: "Run stock take",
    description: "Start, reconcile, and finalize stock count sessions.",
    matrix: { admin: true, manager: true, clerk: false },
  },
  {
    key: "reports.view",
    label: "View reports",
    description: "Sales, movements, valuation, aging and low stock.",
    matrix: { admin: true, manager: true, clerk: false },
  },
  {
    key: "reports.export",
    label: "Export reports",
    description: "Print or export report results.",
    matrix: { admin: true, manager: true, clerk: false },
  },
  {
    key: "users.manage",
    label: "Manage users",
    description: "Invite, remove and assign user roles.",
    matrix: { admin: true, manager: false, clerk: false },
  },
  {
    key: "stores.manage",
    label: "Manage stores",
    description: "Add, rename, and configure stores.",
    matrix: { admin: true, manager: false, clerk: false },
  },
  {
    key: "settings.manage",
    label: "Manage settings",
    description: "Configure appearance, currency, defaults, notifications and rules.",
    matrix: { admin: true, manager: false, clerk: false },
  },
];

const SETTINGS_STORAGE_KEY = "oae.settings.v1";
const NOTIFICATIONS_STORAGE_KEY = "oae.notifications.v1";

export function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readStoredPrefs(): DeepPartial<Preferences> | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DeepPartial<Preferences>;
  } catch {
    return null;
  }
}

export function writeStoredPrefs(prefs: Preferences): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Quota or disabled storage: ignore.
  }
}

export function readStoredNotificationQueue<T>(): T[] | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as T[];
  } catch {
    return null;
  }
}

export function writeStoredNotificationQueue<T>(queue: T[]): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Quota or disabled storage: ignore.
  }
}

export const FONT_SCALE_MULTIPLIERS: Record<FontSize, number> = {
  sm: 0.925,
  md: 1,
  lg: 1.08,
};

export const DENSITY_MULTIPLIERS: Record<Density, number> = {
  compact: 0.85,
  default: 1,
  cozy: 1.15,
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function deepMergePrefs(
  target: Preferences,
  patch: DeepPartial<Preferences>
): Preferences {
  const result: Preferences = structuredClone(target);
  const merge = (obj: Record<string, unknown>, part: DeepPartial<Preferences> | object): void => {
    Object.entries(part as Record<string, unknown>).forEach(([key, value]) => {
      if (isObject(value) && isObject(obj[key])) {
        merge(obj[key] as Record<string, unknown>, value as object);
      } else if (value !== undefined) {
        obj[key] = value as unknown;
      }
    });
  };
  merge(result as unknown as Record<string, unknown>, patch);
  return result;
}

export function setPrefByPath(
  prefs: Preferences,
  path: string,
  value: unknown
): Preferences {
  const next = structuredClone(prefs);
  const parts = path.split(".");
  let cursor: Record<string, unknown> = next as unknown as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    const nested = cursor[key];
    if (!isObject(nested)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
  return next;
}

export function formatCurrencyWithPrefs(
  amount: number,
  prefs: CurrencyPrefs
): string {
  const { symbol, symbolPos, decimals, thousandsSep } = prefs;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
    .format(amount)
    .replace(/,/g, thousandsSep);
  return symbolPos === "before" ? `${symbol} ${formatted}` : `${formatted} ${symbol}`;
}
