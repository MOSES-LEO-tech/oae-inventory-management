"use client";

import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { getRouteAccess } from "@/lib/route-permissions";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RoleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const role = user?.role ?? "admin";

  const { allowed } = getRouteAccess(pathname, role);

  if (!allowed) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-16">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="mt-4 text-xl font-bold tracking-tight">Access Denied</h1>
        <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
          Your role ({role}) does not have permission to view this page.
          Please contact an administrator if you believe this is a mistake.
        </p>
        <Link href="/dashboard" className="mt-6">
          <Button>Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
