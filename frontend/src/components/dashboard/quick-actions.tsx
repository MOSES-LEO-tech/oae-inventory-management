"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Package, ShoppingCart, FileDown } from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth-store";

export function QuickActions() {
  const { hasDuty } = useAuthStore();

  const actions = [
    {
      title: "Add Item",
      description: "Add new product to inventory",
      icon: Package,
      href: "/inventory/add",
      permission: "manage_inventory" as const,
      variant: "default" as const,
    },
    {
      title: "Stock In",
      description: "Record stock intake",
      icon: Plus,
      href: "/stock-in",
      permission: "manage_stock_levels" as const,
      variant: "outline" as const,
    },
    {
      title: "Sales",
      description: "Record a sale",
      icon: ShoppingCart,
      href: "/stock-out",
      permission: "record_sales" as const,
      variant: "outline" as const,
    },
    {
      title: "Reports",
      description: "Generate inventory reports",
      icon: FileDown,
      href: "/reports",
      permission: "view_reports" as const,
      variant: "outline" as const,
    },
  ].filter((action) => hasDuty(action.permission));

  if (actions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No actions available. Contact your administrator to assign duties.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.title} href={action.href}>
                <Button
                  variant={action.variant}
                  className="w-full justify-start"
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {action.title}
                </Button>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}