"use client";

import { useAuthStore } from "@/stores/auth-store";
import { DutyGrants } from "@/types";

/**
 * Hook to check if current user has a specific duty
 * Returns true if user has the duty, false otherwise
 */
export function usePermission(duty: keyof DutyGrants): boolean {
  return useAuthStore((state) => state.hasDuty(duty));
}

/**
 * Hook to check multiple duties at once (AND logic - all must be true)
 */
export function useAllPermissions(duties: (keyof DutyGrants)[]): boolean {
  return useAuthStore((state) =>
    duties.every((duty) => state.hasDuty(duty))
  );
}

/**
 * Hook to check multiple duties (OR logic - at least one must be true)
 */
export function useAnyPermission(duties: (keyof DutyGrants)[]): boolean {
  return useAuthStore((state) =>
    duties.some((duty) => state.hasDuty(duty))
  );
}

/**
 * Route to duty mapping for route guards
 * Maps route paths to required duties
 */
export const ROUTE_DUTIES: Record<string, (keyof DutyGrants)[]> = {
  // Inventory routes
  "/inventory": ["view_inventory"],
  "/inventory/add": ["manage_inventory"],
  "/inventory/[id]/edit": ["manage_inventory"],

  // Stock movements
  "/stock-in": ["manage_stock_levels"],
  "/stock-out": ["record_sales"],

  // Transfers
  "/transfers": ["manage_transfers"],
  "/transfers/new": ["manage_transfers"],

  // Reports
  "/reports": ["view_reports"],
  "/reports/low-stock": ["view_reports"],
  "/reports/valuation": ["view_reports"],
  "/reports/sales": ["view_reports"],
  "/reports/movements": ["view_reports"],
  "/reports/aging": ["view_reports"],

  // Settings & Admin
  "/settings": [],
  "/staff": ["manage_users"],
  "/staff-activity": ["manage_users"],
  "/stores": ["manage_stores"],

  // Dashboard (all authenticated users)
  "/dashboard": [],
};

/**
 * Check if user has access to a route based on duties
 * Used by route guards
 */
export function hasRouteAccess(pathname: string, userDuties: DutyGrants): boolean {
  // Find matching route pattern (exact match or prefix match)
  const matchingRoute = Object.keys(ROUTE_DUTIES).find((route) => {
    if (route === pathname) return true;
    // Handle dynamic routes like /inventory/[id]/edit
    const pattern = route.replace(/\[.*?\]/g, "[^/]+");
    return new RegExp(`^${pattern}$`).test(pathname);
  });

  if (!matchingRoute) return true; // No restriction

  const requiredDuties = ROUTE_DUTIES[matchingRoute];
  if (requiredDuties.length === 0) return true; // No duties required

  return requiredDuties.every((duty) => userDuties[duty] === true);
}

/**
 * Get the list of duties required for a route
 */
export function getRequiredDuties(pathname: string): (keyof DutyGrants)[] {
  const matchingRoute = Object.keys(ROUTE_DUTIES).find((route) => {
    if (route === pathname) return true;
    const pattern = route.replace(/\[.*?\]/g, "[^/]+");
    return new RegExp(`^${pattern}$`).test(pathname);
  });

  return matchingRoute ? ROUTE_DUTIES[matchingRoute] : [];
}