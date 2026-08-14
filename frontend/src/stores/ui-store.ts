import { create } from "zustand";
import { Store } from "@/types";
import {
  Preferences,
  DEFAULT_PREFERENCES,
  PrefPath,
  DeepPartial,
  canUseStorage,
  readStoredPrefs,
  writeStoredPrefs,
  readStoredNotificationQueue,
  writeStoredNotificationQueue,
  deepMergePrefs,
  setPrefByPath,
} from "@/lib/preferences";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  category:
    | "lowStock"
    | "agingStock"
    | "stockTakeReminder"
    | "dailyCloseSummary"
    | "system";
  priority: "info" | "warning" | "critical";
  read: boolean;
  storeId?: string | null;
  createdAt: string;
  actionLabel?: string;
  actionHref?: string;
}

interface UIState {
  // Store selection
  selectedStoreId: string | null;
  stores: Store[];

  setSelectedStoreId: (id: string | null) => void;
  setStores: (stores: Store[]) => void;

  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // Preferences
  prefs: Preferences;
  prefsHydrated: boolean;

  hydratePrefs: () => void;
  patchPrefs: (patch: DeepPartial<Preferences>) => void;
  setPref: <P extends PrefPath>(
    path: P,
    value: P extends keyof Preferences
      ? Preferences[P]
      : unknown
  ) => void;
  resetPrefs: () => void;

  // Notification queue (toasts + in-app center)
  notifications: AppNotification[];
  notificationsHydrated: boolean;

  hydrateNotifications: () => void;
  enqueueNotification: (n: Omit<AppNotification, "id" | "createdAt" | "read">) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  dismissNotification: (id: string) => void;
}

let savePrefsTimer: ReturnType<typeof setTimeout> | null = null;
const PREFS_DEBOUNCE_MS = 250;

let saveNotificationsTimer: ReturnType<typeof setTimeout> | null = null;
const NOTIFICATIONS_DEBOUNCE_MS = 250;

function scheduleSavePrefs(prefs: Preferences): void {
  if (!canUseStorage()) return;
  if (savePrefsTimer) clearTimeout(savePrefsTimer);
  savePrefsTimer = setTimeout(() => {
    writeStoredPrefs(prefs);
    savePrefsTimer = null;
  }, PREFS_DEBOUNCE_MS);
}

function scheduleSaveNotifications(notifications: AppNotification[]): void {
  if (!canUseStorage()) return;
  if (saveNotificationsTimer) clearTimeout(saveNotificationsTimer);
  saveNotificationsTimer = setTimeout(() => {
    writeStoredNotificationQueue<AppNotification>(notifications);
    saveNotificationsTimer = null;
  }, NOTIFICATIONS_DEBOUNCE_MS);
}

export const useUIStore = create<UIState>((set, get) => ({
  selectedStoreId: null,
  stores: [],

  setSelectedStoreId: (id) => set({ selectedStoreId: id }),
  setStores: (stores) => set({ stores }),

  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  prefs: DEFAULT_PREFERENCES,
  prefsHydrated: false,

  hydratePrefs: () => {
    const current = get();
    if (current.prefsHydrated) return;
    const saved = readStoredPrefs();
    if (saved) {
      const merged = deepMergePrefs(DEFAULT_PREFERENCES, saved);
      set({ prefs: merged, prefsHydrated: true });
    } else {
      set({ prefsHydrated: true });
    }
  },

  patchPrefs: (patch) => {
    const merged = deepMergePrefs(get().prefs, patch);
    set({ prefs: merged });
    scheduleSavePrefs(merged);
  },

  setPref: (path, value) => {
    const next = setPrefByPath(get().prefs, path as string, value);
    set({ prefs: next });
    scheduleSavePrefs(next);
  },

  resetPrefs: () => {
    set({ prefs: DEFAULT_PREFERENCES });
    scheduleSavePrefs(DEFAULT_PREFERENCES);
  },

  notifications: [],
  notificationsHydrated: false,

  hydrateNotifications: () => {
    const current = get();
    if (current.notificationsHydrated) return;
    const saved = readStoredNotificationQueue<AppNotification>();
    if (saved && Array.isArray(saved)) {
      set({ notifications: saved, notificationsHydrated: true });
    } else {
      set({ notificationsHydrated: true });
    }
  },

  enqueueNotification: (n) => {
    const item: AppNotification = {
      ...n,
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      read: false,
    };
    const next = [item, ...get().notifications].slice(0, 100);
    set({ notifications: next });
    scheduleSaveNotifications(next);
  },

  markNotificationRead: (id) => {
    const next = get().notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    set({ notifications: next });
    scheduleSaveNotifications(next);
  },

  markAllNotificationsRead: () => {
    const next = get().notifications.map((n) => ({ ...n, read: true }));
    set({ notifications: next });
    scheduleSaveNotifications(next);
  },

  clearNotifications: () => {
    set({ notifications: [] });
    scheduleSaveNotifications([]);
  },

  dismissNotification: (id) => {
    const next = get().notifications.filter((n) => n.id !== id);
    set({ notifications: next });
    scheduleSaveNotifications(next);
  },
}));
