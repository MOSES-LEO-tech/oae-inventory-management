"use client";

import { useEffect } from "react";
import { Menu, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/ui-store";
import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useOnlineStatus } from "@/hooks/use-online-status";

// Longest-prefix-first is unnecessary here: keys are exact paths, and the
// dynamic segments below are resolved by suffix checks.
const PATH_TITLE_MAP: Record<string, string> = {
  "/super-admin/dashboard": "Dashboard",
  "/super-admin/facilities": "Facilities",
  "/super-admin/licenses": "Licenses",
  "/super-admin/invoices": "Invoices",
  "/super-admin/notifications": "Notifications",
  "/dashboard": "Dashboard",
  "/inventory": "Inventory",
  "/inventory/add": "Add New Item",
  "/stock-in": "Stock In",
  "/stock-out": "Stock Out",
  "/transfers": "Stock Transfers",
  "/transfers/new": "New Transfer",
  "/reports": "Reports",
  "/reports/sales": "Sales Summary",
  "/reports/profits": "Profits",
  "/reports/valuation": "Stock Valuation",
  "/reports/movements": "Movement History",
  "/reports/aging": "Stock Aging Report",
  "/reports/low-stock": "Low Stock Report",
  "/settings": "Settings",
  "/profile": "Profile",
  "/staff": "Staff Management",
  "/staff-activity": "Staff Activity",
};

function resolvePageTitle(pathname: string): string {
  if (PATH_TITLE_MAP[pathname]) return PATH_TITLE_MAP[pathname];
  if (pathname.startsWith("/super-admin/facilities/")) return "Facility Details";
  if (pathname.startsWith("/inventory/") && pathname.endsWith("/edit")) {
    return "Edit Item";
  }
  if (pathname.startsWith("/inventory/") && pathname.endsWith("/adjust")) {
    return "Adjust Stock";
  }
  if (pathname.startsWith("/transfers/")) return "Transfer Details";
  return "";
}

export function Header() {
  const pathname = usePathname();
  const { toggleSidebar } = useUIStore();
  const title = resolvePageTitle(pathname);
  const isOnline = useOnlineStatus();

  // Rehydrate the persisted working-store selection (client-only: the server
  // render never reads localStorage, so no hydration mismatch is possible).
  useEffect(() => {
    void useUIStore.persist.rehydrate();
  }, []);

  return (
    <header className="flex h-16 items-center justify-between border-b border-hairline bg-background px-4 lg:px-8">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={toggleSidebar}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {title ? (
        <h1 className="min-w-0 truncate text-base font-semibold tracking-tight">
          {title}
        </h1>
      ) : null}

      <div className="flex-1" />

      {!isOnline && (
        <span
          className="mr-2 flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
          title="You are offline — viewing cached data. Changes will sync when you reconnect."
        >
          <WifiOff className="h-3.5 w-3.5" />
          Offline
        </span>
      )}

      <NotificationBell />
    </header>
  );
}
