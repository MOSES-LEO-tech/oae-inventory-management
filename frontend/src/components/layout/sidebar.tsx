"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import {
  LayoutDashboard,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowRightLeft,
  BarChart3,
  Settings,
  X,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  requiresRoles?: string[];
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
  { href: "/inventory", label: "Inventory", icon: <Package className="h-5 w-5" /> },
  {
    href: "/stock-taking",
    label: "Stock Taking",
    icon: <ClipboardList className="h-5 w-5" />,
    requiresRoles: ["admin", "manager"],
  },
  {
    href: "/stock-in",
    label: "Stock In",
    icon: <ArrowDownToLine className="h-5 w-5" />,
    requiresRoles: ["admin", "manager"],
  },
  {
    href: "/stock-out",
    label: "Stock Out",
    icon: <ArrowUpFromLine className="h-5 w-5" />,
  },
  {
    href: "/transfers",
    label: "Transfers",
    icon: <ArrowRightLeft className="h-5 w-5" />,
    requiresRoles: ["admin", "manager"],
  },
  {
    href: "/reports",
    label: "Reports",
    icon: <BarChart3 className="h-5 w-5" />,
    requiresRoles: ["admin", "manager"],
  },
  {
    href: "/settings",
    label: "Settings",
    icon: <Settings className="h-5 w-5" />,
    requiresRoles: ["admin"],
  },
];

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, isAdmin, isManager } = useAuthStore();

  const userRole = user?.role;

  const filteredItems = navItems.filter((item) => {
    if (!item.requiresRoles) return true;
    return userRole && item.requiresRoles.includes(userRole);
  });

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar — sits one tonal step off canvas (surface-alt) */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-surface-alt transition-transform duration-300 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-hairline px-6">
          <img
            src="/logo-oat.svg"
            alt="OAE Logo"
            className="h-8 w-auto"
          />
          <span className="text-lg font-semibold">OAE Inventory</span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto lg:hidden"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="flex flex-col gap-1">
            {filteredItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-mid-gray hover:bg-canvas hover:text-ink"
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        <Separator />

        {/* User info */}
        {user && (
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-canvas text-sm font-medium text-ink">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 truncate">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="truncate text-xs text-mid-gray capitalize">{user.role}</p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
