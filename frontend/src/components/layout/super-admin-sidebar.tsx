"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { signOut } from "@/lib/firebase/auth";
import { LOGO_DATA_URL } from "@/lib/logo-data";
import {
  LayoutDashboard,
  Building2,
  Shield,
  FileText,
  Activity,
  LogOut,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface SuperAdminSidebarProps {
  open: boolean;
  onClose: () => void;
}

const navItems = [
  { href: "/super-admin/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
  { href: "/super-admin/facilities", label: "Facilities", icon: <Building2 className="h-5 w-5" /> },
  { href: "/super-admin/licenses", label: "Licenses", icon: <Shield className="h-5 w-5" /> },
  { href: "/super-admin/invoices", label: "Invoices", icon: <FileText className="h-5 w-5" /> },
  { href: "/super-admin/notifications", label: "Notifications", icon: <Activity className="h-5 w-5" /> },
];

export function SuperAdminSidebar({ open, onClose }: SuperAdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearUser } = useAuthStore();

  const handleSignOut = async () => {
    try {
      await signOut();
      clearUser();
      router.push("/");
    } catch (error) {
      console.error("[SuperAdmin] Sign out failed:", error);
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-surface-alt transition-transform duration-300 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-hairline px-6">
          <img src={LOGO_DATA_URL} alt="OAE Logo" className="h-8 w-auto" />
          <span className="text-lg font-semibold">OAE Admin</span>
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
            {navItems.map((item) => {
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

        {/* User info + sign out */}
        {user && (
          <div className="flex items-center gap-3 rounded-2xl p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas text-sm font-medium text-ink">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 truncate">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-mid-gray capitalize">{user.role}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </aside>
    </>
  );
}
