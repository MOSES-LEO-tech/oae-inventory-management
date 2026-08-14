"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
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
import {
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Clock,
  ArrowRight,
  Store,
  Users,
  ArrowRightLeft,
  ShoppingBag,
} from "lucide-react";
import {
  MOCK_INVENTORY,
  MOCK_MOVEMENTS,
  MOCK_SALES,
  MOCK_STORES,
  MOCK_TRANSFERS,
  formatCurrency,
  getStoreName,
  isLowStock,
} from "@/lib/mock-data";
import { useAuthStore } from "@/stores/auth-store";
import { useUIStore } from "@/stores/ui-store";

// Monochromatic badge treatments — hierarchy via tonal weight, not color
const MOVEMENT_BADGES: Record<string, string> = {
  IN: "bg-ink text-paper", // solid — high emphasis
  OUT: "bg-canvas text-ink", // soft
  TRANSFER_IN: "border border-hairline bg-transparent text-ink", // outline
  TRANSFER_OUT: "border border-hairline bg-transparent text-ink", // outline
  ADJUSTMENT: "bg-canvas text-ink", // soft
};

// ─── Admin Dashboard ────────────────────────────────────
function AdminDashboard() {
  const { selectedStoreId, setSelectedStoreId } = useUIStore();
  const today = new Date().toISOString().split("T")[0];

  const filteredInventory = useMemo(() => {
    if (!selectedStoreId) return MOCK_INVENTORY;
    return MOCK_INVENTORY.filter((i) => i.storeId === selectedStoreId);
  }, [selectedStoreId]);

  const todayMovements = useMemo(() => {
    const filtered = MOCK_MOVEMENTS.filter((m) => m.createdAt.startsWith(today));
    if (selectedStoreId) return filtered.filter((m) => m.storeId === selectedStoreId);
    return filtered;
  }, [selectedStoreId, today]);

  const todaySales = useMemo(() => {
    const filtered = MOCK_SALES.filter((s) => s.createdAt.startsWith(today));
    if (selectedStoreId) return filtered.filter((s) => s.storeId === selectedStoreId);
    return filtered;
  }, [selectedStoreId, today]);

  const lowStockCount = filteredInventory.filter(isLowStock).length;
  const totalValue = filteredInventory.reduce(
    (sum, row) => sum + row.qtyPc * row.unitPricePc + row.qtyCtn * row.unitPriceCtn,
    0
  );
  const totalItems = new Set(filteredInventory.map((i) => i.id)).size;
  const todayStockIn = todayMovements.filter((m) => m.type === "IN").reduce((s, m) => s + m.qtyPc, 0);
  const todaySalesTotal = todaySales.reduce((s, sale) => s + sale.totalAmount, 0);
  const pendingTransfers = MOCK_TRANSFERS.filter((t) => t.status === "PENDING").length;

  const stats = [
    { title: "Total Items", value: totalItems, icon: Package, desc: "Unique items in inventory" },
    { title: "Inventory Value", value: formatCurrency(totalValue), icon: DollarSign, desc: "Total stock value" },
    { title: "Today's Sales", value: formatCurrency(todaySalesTotal), icon: ArrowUpFromLine, desc: "Revenue today" },
    { title: "Low Stock", value: lowStockCount, icon: AlertTriangle, desc: "Items below threshold" },
    { title: "Today's Stock In", value: todayStockIn, icon: ArrowDownToLine, desc: "Pieces received" },
    { title: "Pending Transfers", value: pendingTransfers, icon: ArrowRightLeft, desc: "Awaiting completion" },
  ];

  const recentMovements = [...MOCK_MOVEMENTS]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return (
    <>
      {/* Store Selector */}
      <div className="flex items-center gap-2 mb-2">
        <Store className="h-4 w-4 text-mid-gray" />
        <select
          value={selectedStoreId ?? ""}
          onChange={(e) => setSelectedStoreId(e.target.value || null)}
          className="h-9 rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40"
          aria-label="Select store"
        >
          <option value="">All Stores</option>
          {MOCK_STORES.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Stats Grid — stat block: caption label over semibold value */}
      <div className="flex items-center gap-3 pt-2">
        <h2 className="text-caption font-medium uppercase tracking-caption text-mid-gray">Overview</h2>
        <div className="flex-1 border-t border-hairline" />
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="min-w-0 transition-shadow hover:shadow-subtle-2">
            <CardHeader className="flex min-h-14 flex-row items-start justify-between gap-2 pb-2">
              <CardTitle className="min-w-0 text-caption font-medium uppercase leading-tight tracking-caption text-mid-gray">{stat.title}</CardTitle>
              <stat.icon className="mt-0.5 h-4 w-4 shrink-0 text-mid-gray" />
            </CardHeader>
            <CardContent className="min-w-0 pt-0">
              <div className="stat-value tabular-nums whitespace-nowrap font-semibold tracking-tight">{stat.value}</div>
              <p className="mt-1 min-h-8 text-xs leading-4 text-mid-gray">{stat.desc}</p>
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
            <EmptyState
              icon={<Clock className="h-10 w-10" />}
              title="No recent activity"
            />
          ) : (
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
                        {new Date(m.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{m.itemName}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-xs ${MOVEMENT_BADGES[m.type] || ""}`}>
                          {m.type.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{getStoreName(m.storeId)}</TableCell>
                      <TableCell className="text-sm">{m.qtyPc}PC{m.qtyCtn > 0 ? ` / ${m.qtyCtn}CTN` : ""}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{m.performedBy}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="flex items-center gap-3 pt-4">
        <h2 className="text-caption font-medium uppercase tracking-caption text-mid-gray">Quick Actions</h2>
        <div className="flex-1 border-t border-hairline" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/stock-in", label: "Record Stock In", icon: ArrowDownToLine, desc: "Add incoming stock" },
          { href: "/stock-out", label: "Record Sale", icon: ArrowUpFromLine, desc: "Deduct sold stock" },
          { href: "/transfers", label: "Transfers", icon: ArrowRightLeft, desc: "Move stock between stores" },
          { href: "/settings", label: "Settings", icon: Users, desc: "Manage users & stores" },
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

// ─── Manager Dashboard ──────────────────────────────────
function ManagerDashboard() {
  const { user } = useAuthStore();
  const storeId = user?.storeId ?? "main-stores";
  const storeName = getStoreName(storeId);
  const today = new Date().toISOString().split("T")[0];

  const storeInventory = useMemo(
    () => MOCK_INVENTORY.filter((i) => i.storeId === storeId),
    [storeId]
  );

  const todaySales = useMemo(
    () => MOCK_SALES.filter((s) => s.storeId === storeId && s.createdAt.startsWith(today)),
    [storeId, today]
  );

  const storeMovements = useMemo(() => {
    return [...MOCK_MOVEMENTS]
      .filter((m) => m.storeId === storeId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [storeId]);

  const lowStockItems = useMemo(
    () => storeInventory.filter(isLowStock).sort((a, b) => a.qtyPc - b.qtyPc),
    [storeInventory]
  );

  const totalValue = storeInventory.reduce(
    (s, i) => s + i.qtyPc * i.unitPricePc + i.qtyCtn * i.unitPriceCtn,
    0
  );
  const totalItems = new Set(storeInventory.map((i) => i.id)).size;
  const todaySalesTotal = todaySales.reduce((s, sale) => s + sale.totalAmount, 0);
  const pendingTransfers = MOCK_TRANSFERS.filter(
    (t) => t.status === "PENDING" && (t.fromStoreId === storeId || t.toStoreId === storeId)
  ).length;

  const stats = [
    { title: "My Store Items", value: totalItems, icon: Package, desc: "Items in stock" },
    { title: "Inventory Value", value: formatCurrency(totalValue), icon: DollarSign, desc: "Total stock value" },
    { title: "Today's Sales", value: formatCurrency(todaySalesTotal), icon: TrendingUp, desc: "Revenue today" },
    { title: "Low Stock", value: lowStockItems.length, icon: AlertTriangle, desc: "Items to reorder" },
  ];

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
      <div className="flex items-center gap-3 pt-2">
        <h2 className="text-caption font-medium uppercase tracking-caption text-mid-gray">Store Stats</h2>
        <div className="flex-1 border-t border-hairline" />
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="min-w-0">
            <CardHeader className="flex min-h-14 flex-row items-start justify-between gap-2 pb-2">
              <CardTitle className="min-w-0 text-caption font-medium uppercase leading-tight tracking-caption text-mid-gray">{stat.title}</CardTitle>
              <stat.icon className="mt-0.5 h-4 w-4 shrink-0 text-mid-gray" />
            </CardHeader>
            <CardContent className="min-w-0 pt-0">
              <div className="stat-value tabular-nums whitespace-nowrap font-semibold tracking-tight">{stat.value}</div>
              <p className="mt-1 min-h-8 text-xs leading-4 text-mid-gray">{stat.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Low Stock Alert — monochromatic tonal panel */}
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
                  <span>{row.name} ({row.type})</span>
                  <span className="font-medium">{row.qtyPc}PC / {row.qtyCtn}CTN</span>
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

      {/* Recent Activity + Pending Transfers side by side */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Activity</CardTitle>
            <Link href="/reports/movements">
              <Button variant="ghost" size="sm">View All <ArrowRight className="ml-1 h-4 w-4" /></Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {storeMovements.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No recent activity in this store.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {storeMovements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-sm">
                          {new Date(m.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </TableCell>
                        <TableCell className="text-sm font-medium">{m.itemName}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`text-xs ${MOVEMENT_BADGES[m.type] || ""}`}>
                            {m.type.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{m.qtyPc}PC{m.qtyCtn > 0 ? ` / ${m.qtyCtn}CTN` : ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pending Transfers</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {pendingTransfers === 0 ? (
              <p className="text-sm text-muted-foreground">No pending transfers.</p>
            ) : (
              <div className="space-y-3">
                {MOCK_TRANSFERS.filter(
                  (t) => t.status === "PENDING" && (t.fromStoreId === storeId || t.toStoreId === storeId)
                ).map((t) => (
                  <Link key={t.id} href={`/transfers/${t.id}`}>
                    <div className="rounded-2xl border border-hairline p-3 text-sm transition-colors hover:bg-canvas">
                      <p className="font-medium">{getStoreName(t.fromStoreId)} → {getStoreName(t.toStoreId)}</p>
                      <p className="text-xs text-mid-gray">
                        {t.items.map((i) => `${i.itemName} (${i.qtyPc}PC)`).join(", ")}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { href: "/stock-in", label: "Record Stock In", icon: ArrowDownToLine },
          { href: "/stock-out", label: "Record Sale", icon: ArrowUpFromLine },
          { href: "/transfers/new", label: "New Transfer", icon: ArrowRightLeft },
        ].map((link) => (
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

// ─── Clerk Dashboard ────────────────────────────────────
function ClerkDashboard() {
  const { user } = useAuthStore();
  const storeId = user?.storeId ?? "main-stores";
  const storeName = getStoreName(storeId);
  const today = new Date().toISOString().split("T")[0];

  const myTodaySales = useMemo(
    () => MOCK_SALES.filter((s) => s.storeId === storeId && s.createdAt.startsWith(today)),
    [storeId, today]
  );

  const myRecentSales = useMemo(
    () =>
      MOCK_SALES.filter((s) => s.storeId === storeId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10),
    [storeId]
  );

  const totalRevenue = myTodaySales.reduce((s, sale) => s + sale.totalAmount, 0);
  const totalItemsSold = myTodaySales.reduce(
    (s, sale) => s + sale.items.reduce((si, item) => si + item.qtyPc, 0),
    0
  );

  // Items sold most today
  const topItems = useMemo(() => {
    const map = new Map<string, { name: string; qtyPc: number; revenue: number }>();
    myTodaySales.forEach((sale) => {
      sale.items.forEach((item) => {
        const existing = map.get(item.itemName) ?? { name: item.itemName, qtyPc: 0, revenue: 0 };
        existing.qtyPc += item.qtyPc;
        existing.revenue += item.subtotal;
        map.set(item.itemName, existing);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [myTodaySales]);

  return (
    <>
      {/* Store Banner */}
      <Card className="border-hairline bg-surface-alt">
        <CardContent className="flex items-center gap-3 p-4">
          <Store className="h-5 w-5 text-ink" />
          <div>
            <p className="text-sm font-medium">Store: <span className="font-semibold">{storeName}</span></p>
            <p className="text-xs text-mid-gray">
              Welcome back, {user?.name}. Here&apos;s your sales summary for today.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="transition-shadow hover:shadow-subtle-2">
          <CardContent className="flex items-center gap-3 p-4">
            <DollarSign className="h-5 w-5 text-mid-gray" />
            <div>
              <p className="text-caption font-medium uppercase tracking-caption text-mid-gray">Today&apos;s Sales</p>
              <p className="stat-value tabular-nums whitespace-nowrap font-semibold tracking-tight">{formatCurrency(totalRevenue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-subtle-2">
          <CardContent className="flex items-center gap-3 p-4">
            <ShoppingBag className="h-5 w-5 text-mid-gray" />
            <div>
              <p className="text-caption font-medium uppercase tracking-caption text-mid-gray">Items Sold</p>
              <p className="stat-value tabular-nums whitespace-nowrap font-semibold tracking-tight">{totalItemsSold}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-subtle-2">
          <CardContent className="flex items-center gap-3 p-4">
            <TrendingUp className="h-5 w-5 text-mid-gray" />
            <div>
              <p className="text-caption font-medium uppercase tracking-caption text-mid-gray">Sales Count</p>
              <p className="stat-value tabular-nums whitespace-nowrap font-semibold tracking-tight">{myTodaySales.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Items Today */}
      {topItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top Items Sold Today</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty Sold</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topItems.map((item) => (
                    <TableRow key={item.name}>
                      <TableCell className="text-sm font-medium">{item.name}</TableCell>
                      <TableCell className="tabular-nums text-right text-sm">{item.qtyPc}PC</TableCell>
                      <TableCell className="tabular-nums text-right text-sm font-medium">{formatCurrency(item.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Sales */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Sales</CardTitle>
          <Link href="/reports/sales">
            <Button variant="ghost" size="sm">View All <ArrowRight className="ml-1 h-4 w-4" /></Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {myRecentSales.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <ShoppingBag className="mx-auto mb-2 h-8 w-8" />
              <p>No sales recorded yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Items</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myRecentSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="text-sm">
                        {new Date(sale.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-sm">{sale.items.map((i) => i.itemName).join(", ")}</TableCell>
                      <TableCell className="tabular-nums text-right text-sm">{sale.items.reduce((s, i) => s + i.qtyPc, 0)}PC</TableCell>
                      <TableCell className="tabular-nums text-right text-sm font-medium">{formatCurrency(sale.totalAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          )}
        </CardContent>
      </Card>

      {/* Quick Action */}
      <Link href="/stock-out">
        <Card className="cursor-pointer border-hairline transition-shadow hover:shadow-subtle-2">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-canvas">
              <ArrowUpFromLine className="h-5 w-5 text-ink" />
            </div>
            <div>
              <p className="text-sm font-medium">Record a Sale</p>
              <p className="text-xs text-mid-gray">Deduct stock and record a new sale</p>
            </div>
          </CardContent>
        </Card>
      </Link>
    </>
  );
}

// ─── Main Dashboard ─────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuthStore();
  const role = user?.role ?? "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading-sm font-semibold tracking-heading-sm">Dashboard</h1>
        <p className="text-body text-mid-gray">
          {role === "admin" && "Overview of all stores and inventory activity."}
          {role === "manager" && "Overview of your store's inventory and operations."}
          {role === "clerk" && "Your sales activity and performance."}
        </p>
      </div>

      {role === "admin" && <AdminDashboard />}
      {role === "manager" && <ManagerDashboard />}
      {role === "clerk" && <ClerkDashboard />}
    </div>
  );
}
