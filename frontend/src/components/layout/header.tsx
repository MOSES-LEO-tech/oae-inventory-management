"use client";

import { Menu, Moon, Sun, Bell, BellRing, CheckCheck, X, Info, TriangleAlert, OctagonX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { signOut } from "@/lib/firebase/auth";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppNotification } from "@/stores/ui-store";
import { useMemo } from "react";

function NotificationIcon({ notification }: { notification: AppNotification }) {
  if (notification.priority === "critical") {
    return <OctagonX className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />;
  }
  if (notification.priority === "warning") {
    return <TriangleAlert className="h-4 w-4 shrink-0 text-military" aria-hidden="true" />;
  }
  return <Info className="h-4 w-4 shrink-0 text-mid-gray" aria-hidden="true" />;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function NotificationsBell() {
  const { notifications, markAllNotificationsRead, markNotificationRead, dismissNotification, clearNotifications } =
    useUIStore();

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        {unreadCount > 0 ? (
          <BellRing className="h-4.5 w-4.5" />
        ) : (
          <Bell className="h-4.5 w-4.5" />
        )}
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ember px-1 text-[10px] font-semibold leading-none text-white tabular-nums">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="px-0 py-0 text-sm font-semibold">Notifications</span>
          <div className="flex items-center gap-0.5">
            {notifications.length > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={markAllNotificationsRead}
                  disabled={unreadCount === 0}
                >
                  <CheckCheck className="mr-1 h-3.5 w-3.5" /> Mark all read
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-7 w-7"
                  onClick={clearNotifications}
                  title="Clear all notifications"
                  aria-label="Clear all notifications"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Bell className="mx-auto h-6 w-6 text-mid-gray" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium">No notifications yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Low stock, aging stock and reminders will appear here.
            </p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  if (!n.read) markNotificationRead(n.id);
                }}
                className={`group flex cursor-pointer items-start gap-2.5 px-3 py-2.5 hover:bg-surface-alt ${
                  n.read ? "opacity-60" : ""
                }`}
              >
                <NotificationIcon notification={n} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-4 text-muted-foreground">{n.body}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-6 w-6 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissNotification(n.id);
                  }}
                  title="Dismiss"
                  aria-label="Dismiss notification"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  const { toggleSidebar, sidebarOpen, prefsHydrated, patchPrefs } = useUIStore();
  const { user, clearUser } = useAuthStore();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    clearUser();
    router.push("/");
  };

  // next-themes drives the visual state; the UI store owns the persisted
  // preference. Write through to the store so the PrefsApplier watcher and
  // the Settings page stay in sync (previously the toggle was reverted by
  // the watcher because only next-themes changed).
  const handleToggleTheme = () => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
    if (prefsHydrated) patchPrefs({ appearance: { theme: next } });
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-hairline bg-background px-4 lg:px-8">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={toggleSidebar}
        aria-expanded={sidebarOpen}
        aria-controls="app-sidebar"
        aria-label={sidebarOpen ? "Close navigation menu" : "Open navigation menu"}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Notifications */}
        <NotificationsBell />

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={handleToggleTheme}
          aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* User menu */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex h-9 w-9 items-center justify-center rounded-full bg-canvas text-sm font-medium text-ink transition-colors hover:bg-hairline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="User menu"
            >
              {user.name.charAt(0).toUpperCase()}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <DropdownMenuItem onClick={handleSignOut}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
