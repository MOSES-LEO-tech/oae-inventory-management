"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  const { user } = useAuthStore();
  const panelRef = useRef<HTMLElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  const userRole = user?.role;

  const filteredItems = navItems.filter((item) => {
    if (!item.requiresRoles) return true;
    return userRole && item.requiresRoles.includes(userRole);
  });

  // Track the lg breakpoint so the off-canvas panel can be made inert on
  // mobile (removed from tab order + screen-reader tree) while it is closed.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Mobile menu: lock background scroll, remember where focus came from, and
  // restore it when the panel closes so keyboard/screen-reader users never
  // lose their place.
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      document.body.style.overflow = originalOverflow;
      previouslyFocusedRef.current?.focus?.();
      previouslyFocusedRef.current = null;
    };
  }, [open]);

  // Mobile menu: close on Escape and keep Tab focus trapped inside the panel.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Mobile menu: move focus into the panel after the slide-in transition.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const closeButton = panel.querySelector<HTMLElement>("[data-sidebar-close]");
      (closeButton ?? panel).focus();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [open]);

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — sits one tonal step off canvas (surface-alt) */}
      <aside
        ref={panelRef}
        id="app-sidebar"
        role={open ? "dialog" : undefined}
        aria-modal={open ? "true" : undefined}
        aria-label={open ? "Navigation menu" : undefined}
        inert={!open && !isDesktop}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-surface-alt transition-transform duration-300 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-hairline px-6">
          <Image
            src="/logo-oat.svg"
            alt="OAE Logo"
            width={128}
            height={32}
            className="h-8 w-auto"
          />
          <span className="text-lg font-semibold">OAE Inventory</span>
          <Button
            data-sidebar-close
            variant="ghost"
            size="icon"
            className="ml-auto lg:hidden"
            onClick={onClose}
            aria-label="Close navigation menu"
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
