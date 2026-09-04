"use client";

import { useMemo, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatQuantities, mergeQuantityTypes } from "@/lib/qty-label";
import {
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  DollarSign,
  ArrowRightLeft,
  Clock,
  ArrowRight,
  Activity,
  Store,
  Users,
  ShoppingBag,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { useInventoryStore } from "@/stores/inventory-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePageStoreSelection } from "@/stores/ui-store";
import { hasRouteAccess } from "@/lib/permissions";

const MOVEMENT_BADGES: Record<string, string> = {
  IN: "bg-ink text-paper",
  OUT: "bg-canvas text-ink",
  TRANSFER_IN: "border border-hairline bg-transparent text-ink",
  TRANSFER_OUT: "border border-hairline bg-transparent text-ink",
  ADJUSTMENT: "bg-canvas text-ink",
};

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat("en-UG", { style: "currency", currency }).format(amount);
};

const getStoreName = (storeId: string, stores: any[]) => {
  return stores.find((s) => s.id === storeId)?.name || storeId;
};

const isLowStock = (item: any) => {
  if (!item.quantities || !item.lowStockThresholds) return false;
  const quantities = item.quantities as Record<string, number>;
  const thresholds = item.lowStockThresholds as Record<string, number>;
  return Object.entries(quantities).some(
    ([qtyTypeId, qty]) => qty <= (thresholds[qtyTypeId] || 0)
  );
};

const calculateItemValue = (item: any) => {
  if (!item.quantities || !item.quantityTypes) return 0;
  const quantities = item.quantities as Record<string, number>;
  const quantityTypes = item.quantityTypes as Array<{id: string; costPrice?: number}>;
  return Object.entries(quantities).reduce((sum, [qtyTypeId, qty]) => {
    const qt = quantityTypes.find((q: any) => q.id === qtyTypeId);
    return sum + qty * (qt?.costPrice ?? 0);
  }, 0);
};

const formatMovementQuantities = (
  movement: any,
  qtyLabelById: Map<string, string>
) => {
  if (!movement.quantities) return "";
  const quantities = movement.quantities as Record<string, number>;
  return Object.entries(quantities)
    .map(([id, qty]) => `${qty} ${qtyLabelById.get(id) ?? id}`)
    .join(" / ");
};

// ─── Admin Dashboard ────────────────────────────────────
function AdminDashboard() {
  // Store selection is scoped to THIS page only — other pages keep their own.
  const { selectedStoreId, setSelectedStoreId } = usePageStoreSelection("dashboard");
  const { items, movements, sales, stores, isLoading, facilitySettings } = useInventoryStore();
  const { canAccessStore } = useAuthStore();
  const currency = facilitySettings?.currency ?? "UGX";

  // Store switcher is a Main-store-only feature on the dashboard; secondary
  // stores switch stores exclusively on the Inventory page.
  const isMainStoreUser = useMemo(
    () => stores.some((s) => s.type === "main" && canAccessStore(s.id)),
    [stores, canAccessStore]
  );

  const filteredInventory = useMemo(() => {
    if (!selectedStoreId) return items;
    return items.filter((i) => i.storeId === selectedStoreId);
  }, [items, selectedStoreId]);

  const today = new Date().toDateString();
  const todayMovements = useMemo(() => {
    return movements.filter((m) => m.createdAt.toDate().toDateString() === today);
  }, [movements, today]);

  const todaySales = useMemo(() => {
    return sales.filter((s) => s.createdAt.toDate().toDateString() === today && s.type === "SALE");
  }, [sales, today]);

  const lowStockCount = filteredInventory.filter(isLowStock).length;
  const totalValue = filteredInventory.reduce(
    (sum, row) => sum + calculateItemValue(row),
    0
  );
  const totalItems = new Set(filteredInventory.map((i) => i.itemId)).size;
  const todayStockIn = todayMovements.filter((m) => m.type === "IN").reduce((s, m) => s + Object.values((m.quantities as Record<string, number>) || {}).reduce((sum: number, qty: number) => sum + qty, 0), 0);
  const todaySalesTotal = todaySales.reduce((s, sale) => s + sale.totalAmount, 0);
  // Profit is snapshotted per transaction at sale time; sales recorded
  // before cost prices existed carry no profit data (treated as 0).
  const totalProfit = sales.reduce((s, sale) => s + (sale.profit ?? 0), 0);

  const stats = [
    { title: "Total Items", value: totalItems, icon: Package, desc: "Unique items in inventory" },
    { title: "Inventory Value", value: formatCurrency(totalValue, currency), icon: DollarSign, desc: "Total stock value" },
    { title: "Today's Sales", value: formatCurrency(todaySalesTotal, currency), icon: ArrowUpFromLine, desc: "Revenue today" },
    { title: "Low Stock", value: lowStockCount, icon: AlertTriangle, desc: "Items below threshold" },
    { title: "Today's Stock In", value: todayStockIn, icon: ArrowDownToLine, desc: "Pieces received" },
    { title: "Total Profit", value: formatCurrency(totalProfit, currency), icon: TrendingUp, desc: "Profit from all sales" },
  ];

  const recentMovements = [...movements]
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
    .slice(0, 10);

  // StockMovement stores only ids (itemId + quantity-type ids) — resolve
  // display names at render time from the already-loaded inventory rows.
  const itemNameById = useMemo(
    () => new Map(items.map((i) => [i.itemId, i.itemName])),
    [items]
  );
  const qtyLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of items) {
      for (const qt of row.quantityTypes ?? []) {
        if (!map.has(qt.id)) map.set(qt.id, qt.label);
      }
    }
    return map;
  }, [items]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Store Selector — Main-store users only */}
      {isMainStoreUser && (
        <div className="flex items-center gap-2 mb-2">
          <Store className="h-4 w-4 text-mid-gray" />
          <select
            value={selectedStoreId ?? ""}
            onChange={(e) => setSelectedStoreId(e.target.value || null)}
            className="h-9 rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40"
            aria-label="Select store"
          >
            <option value="">All Stores</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat) => (
          <Card key={stat.title} className="transition-shadow hover:shadow-subtle-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-mid-gray">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-mid-gray" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight">{stat.value}</div>
              <p className="mt-1 text-xs text-mid-gray">{stat.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Activity (All Stores)</CardTitle>
          <Link href="/reports/movements">
            <Button variant="ghost" size="sm">View All <ArrowRight className="ml-1 h-4 w-4" /></Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentMovements.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Clock className="mx-auto mb-2 h-8 w-8" />
              <p>No recent activity.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="hidden sm:table-cell">Store</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead className="hidden sm:table-cell">By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentMovements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm">
                        {m.createdAt.toDate().toLocaleDateString("en-GB", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {itemNameById.get(m.itemId) ?? m.itemId}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-xs ${MOVEMENT_BADGES[m.type] || ""}`}>
                          {m.type.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{getStoreName(m.storeId, stores)}</TableCell>
                      <TableCell className="text-sm">{formatMovementQuantities(m, qtyLabelById)}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{m.performedByName}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { href: "/stock-in", label: "Record Stock In", icon: ArrowDownToLine, desc: "Add incoming stock" },
          { href: "/stock-out", label: "Record Sale", icon: ArrowUpFromLine, desc: "Deduct sold stock" },
          { href: "/transfers", label: "Transfers", icon: ArrowRightLeft, desc: "Move stock between stores" },
          { href: "/staff", label: "Staff", icon: Users, desc: "Invite & manage team" },
          { href: "/staff-activity", label: "Staff Activity", icon: Activity, desc: "Monitor team actions" },
          { href: "/settings", label: "Settings", icon: Store, desc: "Stores & thresholds" },
        ].map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="cursor-pointer transition-shadow hover:shadow-subtle-2">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-canvas">
                  <link.icon className="h-5 w-5 text-ink" />
                </div>
                <div>
                  <p className="text-sm font-medium">{link.label}</p>
                  <p className="text-xs text-mid-gray">{link.desc}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}

// ─── Staff Dashboard (for managers and clerks) ─────────────────────────
function StaffDashboard() {
  const { user } = useAuthStore();
  const { items, inventoryItems, movements, sales, stores, isLoading, facilitySettings } = useInventoryStore();
  // Same dashboard page, same page-scoped selection as the admin view.
  const { selectedStoreId } = usePageStoreSelection("dashboard");
  const currency = facilitySettings?.currency ?? "UGX";

  // Working store: the header switcher's selection when still valid for this
  // user, else the first assigned store (empty assignment = all stores).
  const fallbackStoreId = user?.storeIds?.[0] ?? stores[0]?.id ?? "";
  const storeId =
    selectedStoreId &&
    (!user?.storeIds?.length || user.storeIds.includes(selectedStoreId))
      ? selectedStoreId
      : fallbackStoreId;
  const storeName = getStoreName(storeId, stores);
  const today = new Date().toDateString();

  const storeInventory = useMemo(
    () => items.filter((i) => i.storeId === storeId),
    [items, storeId]
  );

  const todaySales = useMemo(
    () => sales.filter((s) => s.storeId === storeId && s.createdAt.toDate().toDateString() === today && s.type === "SALE"),
    [sales, storeId, today]
  );

  const lowStockItems = useMemo(
    () => storeInventory.filter(isLowStock).sort((a, b) => {
      const aQty = Object.values(a.quantities || {}).reduce((sum, q) => sum + q, 0);
      const bQty = Object.values(b.quantities || {}).reduce((sum, q) => sum + q, 0);
      return aQty - bQty;
    }),
    [storeInventory]
  );

  const totalValue = storeInventory.reduce(
    (s, i) => s + calculateItemValue(i),
    0
  );
  const totalItems = new Set(storeInventory.map((i) => i.itemId)).size;
  const todaySalesTotal = todaySales.reduce((s, sale) => s + sale.totalAmount, 0);

  const stats = [
    { title: "My Store Items", value: totalItems, icon: Package, desc: "Items in stock" },
    { title: "Inventory Value", value: formatCurrency(totalValue, currency), icon: DollarSign, desc: "Total stock value" },
    { title: "Today's Sales", value: formatCurrency(todaySalesTotal, currency), icon: ShoppingBag, desc: "Revenue today" },
    { title: "Low Stock", value: lowStockItems.length, icon: AlertTriangle, desc: "Items to reorder" },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Store Banner */}
      <Card className="border-hairline bg-surface-alt">
        <CardContent className="flex items-center gap-3 p-4">
          <Store className="h-5 w-5 text-ink" />
          <div>
            <p className="text-sm font-medium">Managing: <span className="font-semibold">{storeName}</span></p>
            <p className="text-xs text-mid-gray">Showing data for your assigned store only.</p>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="transition-shadow hover:shadow-subtle-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-mid-gray">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-mid-gray" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight">{stat.value}</div>
              <p className="mt-1 text-xs text-mid-gray">{stat.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <Card className="border-hairline bg-surface-alt">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-ink">
              <AlertTriangle className="h-4 w-4" />
              Low Stock Items ({lowStockItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1">
              {lowStockItems.slice(0, 5).map((row) => (
                <div key={row.id} className="flex justify-between text-sm">
                  <span>{row.itemName} ({row.itemType})</span>
                  <span className="font-medium">
                    {formatQuantities(
                      row.quantities,
                      mergeQuantityTypes(
                        inventoryItems.find((c) => c.id === row.itemId)?.quantityTypes,
                        row.quantityTypes
                      )
                    )}
                  </span>
                </div>
              ))}
              {lowStockItems.length > 5 && (
                <Link href="/reports/low-stock">
                  <Button variant="ghost" size="sm" className="mt-1">
                    View all {lowStockItems.length} items <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Links — hidden when the user lacks the route's duty */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { href: "/stock-in", label: "Record Stock In", icon: ArrowDownToLine },
          { href: "/stock-out", label: "Record Sale", icon: ArrowUpFromLine },
          { href: "/transfers/new", label: "New Transfer", icon: ArrowRightLeft },
        ]
          .filter((link) => user ? hasRouteAccess(link.href, user.duties) : false)
          .map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="cursor-pointer transition-shadow hover:shadow-subtle-2">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-canvas">
                  <link.icon className="h-5 w-5 text-ink" />
                </div>
                <p className="text-sm font-medium">{link.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}

// ─── Main Dashboard ─────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuthStore();
  const { fetchAll } = useInventoryStore();
  const role = user?.role ?? "admin";

  useEffect(() => {
    fetchAll();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-body text-mid-gray">
          {role === "admin" && "Overview of all stores and inventory activity."}
          {role === "staff" && "Overview of your store's inventory and operations."}
        </p>
      </div>

      {role === "admin" && <AdminDashboard />}
      {role === "staff" && <StaffDashboard />}
    </div>
  );
}