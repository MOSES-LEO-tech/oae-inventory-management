import { create } from "zustand";
import { AppUser } from "@/types";

interface AuthState {
  user: AppUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  setUser: (user: AppUser | null) => void;
  setLoading: (loading: boolean) => void;
  clearUser: () => void;

  // Role helpers
  isAdmin: () => boolean;
  isManager: () => boolean;
  isClerk: () => boolean;
  canManageUsers: () => boolean;
  canManageStock: () => boolean;
  canRecordSales: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setLoading: (isLoading) => set({ isLoading }),
  clearUser: () => set({ user: null, isAuthenticated: false }),

  isAdmin: () => get().user?.role === "admin",
  isManager: () => get().user?.role === "manager",
  isClerk: () => get().user?.role === "clerk",
  canManageUsers: () => get().user?.role === "admin",
  canManageStock: () => get().user?.role !== "clerk",
  canRecordSales: () => true,
}));
