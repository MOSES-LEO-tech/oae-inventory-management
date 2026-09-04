import { create } from "zustand";
import { FacilityUser, DutyGrants, FacilityRole } from "@/types";

interface AuthState {
  user: FacilityUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  setUser: (user: FacilityUser | null) => void;
  setLoading: (loading: boolean) => void;
  clearUser: () => void;

  // Role helpers
  isAdmin: () => boolean;
  isStaff: () => boolean;
  hasDuty: (duty: keyof DutyGrants) => boolean;
  canAccessStore: (storeId: string) => boolean;
}

const DEFAULT_DUTIES: DutyGrants = {
  view_inventory: false,
  manage_inventory: false,
  manage_stock_levels: false,
  manage_transfers: false,
  record_sales: false,
  view_sales: false,
  manage_sales: false,
  view_reports: false,
  export_reports: false,
  manage_users: false,
  manage_stores: false,
  manage_settings: false,
  admin: false,
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  clearUser: () => set({ user: null, isAuthenticated: false, isLoading: false }),

  isAdmin: () => get().user?.role === "admin",
  isStaff: () => get().user?.role === "staff",
  hasDuty: (duty: keyof DutyGrants) => get().user?.duties?.[duty] ?? false,
  canAccessStore: (storeId: string) => {
    const user = get().user;
    if (!user) return false;
    if (user.role === "admin") return true;
    // Empty storeIds grants access to all stores (Add Staff dialog contract:
    // "Leave empty for access to all stores.").
    if (!user.storeIds || user.storeIds.length === 0) return true;
    return user.storeIds.includes(storeId);
  },
}));

// Job title to duties mapping (from plan)
export const JOB_TITLE_DUTIES: Record<string, DutyGrants> = {
  Admin: {
    view_inventory: true,
    manage_inventory: true,
    manage_stock_levels: true,
    manage_transfers: true,
    record_sales: true,
    view_sales: true,
    manage_sales: true,
    view_reports: true,
    export_reports: true,
    manage_users: true,
    manage_stores: true,
    manage_settings: true,
    admin: true,
  },
  "Store Manager": {
    view_inventory: true,
    manage_inventory: true,
    manage_stock_levels: true,
    manage_transfers: true,
    record_sales: true,
    view_sales: true,
    manage_sales: true,
    view_reports: true,
    export_reports: true,
    manage_users: false,
    manage_stores: false,
    manage_settings: false,
    admin: false,
  },
  "Sales Clerk": {
    view_inventory: true,
    manage_inventory: false,
    manage_stock_levels: false,
    manage_transfers: false,
    record_sales: true,
    view_sales: true,
    manage_sales: false,
    view_reports: false,
    export_reports: false,
    manage_users: false,
    manage_stores: false,
    manage_settings: false,
    admin: false,
  },
  "Inventory Officer": {
    view_inventory: true,
    manage_inventory: true,
    manage_stock_levels: true,
    manage_transfers: true,
    record_sales: false,
    view_sales: true,
    manage_sales: false,
    view_reports: true,
    export_reports: true,
    manage_users: false,
    manage_stores: false,
    manage_settings: false,
    admin: false,
  },
  Accountant: {
    view_inventory: true,
    manage_inventory: false,
    manage_stock_levels: false,
    manage_transfers: false,
    record_sales: false,
    view_sales: true,
    manage_sales: true,
    view_reports: true,
    export_reports: true,
    manage_users: false,
    manage_stores: false,
    manage_settings: false,
    admin: false,
  },
};

export function getDutiesForJobTitle(jobTitle: string): DutyGrants {
  return JOB_TITLE_DUTIES[jobTitle] ?? DEFAULT_DUTIES;
}