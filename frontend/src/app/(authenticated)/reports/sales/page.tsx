"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, DollarSign, ShoppingBag, Hash, TrendingUp, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInventoryStore } from "@/stores/inventory-store";
import { usePageStoreSelection } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import {
  resolveReportFacilityInfo,
  generateSalesSummaryPdf,
  type ReportContext,
} from "@/lib/reports/pdf";
import { getQuantityTypeLabel, mergeQuantityTypes } from "@/lib/qty-label";

export default function SalesReportPage() {
  const { selectedStoreId, setSelectedStoreId } = usePageStoreSelection("reports-sales");
  const { sales, stores, items, inventoryItems: itemCatalog, fetchSales, fetchItems, fetchStores, fetchFacilitySettings, facilitySettings, isLoading } = useInventoryStore();
  const { user, canAccessStore } = useAuthStore();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Store switcher is a Main-store-only feature; secondary stores switch
  // stores exclusively on the Inventory page.
  const isMainStoreUser = useMemo(
    () => stores.some((s) => s.type === "main" && canAccessStore(s.id)),
    [stores, canAccessStore]
  );

  useEffect(() => {
    fetchSales();
    fetchItems();
    fetchStores();
    fetchFacilitySettings();
  }, []);

  const filtered = useMemo(() => {
    let rows = sales.filter(s => s.type === "SALE");
    if (selectedStoreId) rows = rows.filter((s) => s.storeId === selectedStoreId);
    if (dateFrom) rows = rows.filter((s) => s.createdAt.toDate() >= new Date(dateFrom));
    if (dateTo) rows = rows.filter((s) => s.createdAt.toDate() <= new Date(dateTo + "T23:59:59Z"));
    return rows.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  }, [sales, selectedStoreId, dateFrom, dateTo]);

  const totalRevenue = filtered.reduce((s, sale) => s + sale.totalAmount, 0);
  const totalItemsSold = filtered.reduce(
    (s, sale) => s + sale.items.reduce((si, item) => si + Object.values(item.quantities ?? {}).reduce((a, b) => a + b, 0), 0),
    0
  );
  const avgSale = filtered.length > 0 ? totalRevenue / filtered.length : 0;

  const getStoreName = (storeId: string) => {
    return stores.find((s) => s.id === storeId)?.name || storeId;
  };

  const currency = facilitySettings?.currency ?? "UGX";
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", { style: "currency", currency }).format(amount);
  };

  const formatDateParam = (value: string) =>
    value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Start";

  const handleExportPdf = async () => {
    if (!user) return;
    setIsExporting(true);
    try {
      const info = await resolveReportFacilityInfo(user.facilityId);
      const ctx: ReportContext = {
        facilityName: info.name,
        currency: info.currency,
        generatedBy: user.name,
      };
      await generateSalesSummaryPdf(ctx, {
        fileName: `sales-summary-${new Date().toISOString().slice(0, 10)}.pdf`,
        periodLine: `${formatDateParam(dateFrom)} – ${dateTo ? formatDateParam(dateTo) : "Present"} · ${selectedStoreId ? getStoreName(selectedStoreId) : "All Stores"}`,
        summary: {
          revenue: totalRevenue,
          itemsSold: totalItemsSold,
          salesCount: filtered.length,
          avgSale,
        },
        records: filtered.map((sale) => ({
          date: sale.createdAt.toDate(),
          store: getStoreName(sale.storeId),
          lines: sale.items.length,
          qty: sale.items.reduce((s, i) => s + Object.values(i.quantities ?? {}).reduce((a, b) => a + b, 0), 0),
          total: sale.totalAmount,
        })),
        breakdown: itemBreakdown.map((b) => ({ 
          item: b.name, 
          qty: Object.values(b.quantities ?? {}).reduce((a, b) => a + b, 0), 
          revenue: b.revenue 
        })),
      });
      toast.success("Sales report downloaded");
    } catch (err) {
      console.error("[Reports] Sales PDF export failed:", err);
      toast.error("Could not generate the PDF report");
    } finally {
      setIsExporting(false);
    }
  };

  // Group by item
  const itemBreakdown = useMemo(() => {
    const map = new Map<string, { itemId: string; quantities: Record<string, number>; revenue: number }>();
    filtered.forEach((sale) => {
      sale.items.forEach((item) => {
        const existing = map.get(item.itemName) ?? { itemId: item.itemId, quantities: {}, revenue: 0 };
        Object.entries(item.quantities ?? {}).forEach(([key, val]) => {
          existing.quantities[key] = (existing.quantities[key] || 0) + val;
        });
        existing.revenue += item.subtotal;
        map.set(item.itemName, existing);
      });
    });
    return Array.from(map.entries()).map(([name, data]) => ({ name, ...data }));
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/reports" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Reports
          </Link>
          <p className="text-muted-foreground">Sales by store, item, and date range.</p>
        </div>
        <Button onClick={handleExportPdf} disabled={isExporting || filtered.length === 0}>
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export PDF
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" aria-label="Date from" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" aria-label="Date to" />
            </div>
            {isMainStoreUser && (
              <select
                value={selectedStoreId ?? ""}
                onChange={(e) => setSelectedStoreId(e.target.value || null)}
                className="h-9 rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40"
                aria-label="Filter by store"
              >
                <option value="">All Stores</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-mid-gray" />
            <div>
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="text-xl font-semibold">{formatCurrency(totalRevenue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ShoppingBag className="h-5 w-5 text-mid-gray" />
            <div>
              <p className="text-xs text-muted-foreground">Items Sold</p>
              <p className="text-xl font-semibold">{totalItemsSold}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Hash className="h-5 w-5 text-mid-gray" />
            <div>
              <p className="text-xs text-muted-foreground">Sales Count</p>
              <p className="text-xl font-semibold">{filtered.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-mid-gray" />
            <div>
              <p className="text-xs text-muted-foreground">Average Sale</p>
              <p className="text-xl font-semibold">{formatCurrency(avgSale)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Records</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Date</TableHead>
                  <TableHead className="text-center">Store</TableHead>
                  <TableHead className="hidden sm:table-cell text-center">Items</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      <p className="text-sm text-muted-foreground mt-2">Loading...</p>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">
                      No sales found for the selected period
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((sale) => {
                    const totalQty = sale.items.reduce((s, i) => s + Object.values(i.quantities ?? {}).reduce((a, b) => a + b, 0), 0);
                    const qtyBreakdown = sale.items
                      .flatMap((i) => {
                        // Sale lines may be keyed against ids from either
                        // the catalog's or the row's quantity-type copies.
                        const qts = mergeQuantityTypes(
                          itemCatalog.find((c) => c.id === i.itemId)?.quantityTypes,
                          items.find((r) => r.itemId === i.itemId)?.quantityTypes
                        );
                        return Object.entries(i.quantities ?? {}).map(([key, val]) => `${val} ${getQuantityTypeLabel(qts, key)}`);
                      })
                      .join(" / ");
                    return (
                      <TableRow key={sale.id}>
                        <TableCell className="text-center text-sm">
                          {sale.createdAt.toDate().toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-center text-sm">{getStoreName(sale.storeId)}</TableCell>
                        <TableCell className="hidden sm:table-cell text-center text-sm">
                          {sale.items.map((i) => i.itemName).join(", ")}
                        </TableCell>
                        <TableCell className="text-center text-sm tabular-nums">
                          {qtyBreakdown || totalQty}
                        </TableCell>
                        <TableCell className="text-center text-sm font-medium tabular-nums">{formatCurrency(sale.totalAmount)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Item Breakdown */}
      {itemBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Breakdown by Item</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Item</TableHead>
                    <TableHead className="text-center">Qty Sold</TableHead>
                    <TableHead className="text-center">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemBreakdown.map((item) => {
                    // Prefer id lookup; fall back to name for older
                    // breakdowns recorded before itemId was tracked.
                    const qts = mergeQuantityTypes(
                      itemCatalog.find((c) => c.id === item.itemId)?.quantityTypes ??
                        itemCatalog.find((c) => c.name === item.name)?.quantityTypes,
                      items.find((r) => r.itemId === item.itemId)?.quantityTypes
                    );
                    const qtyBreakdown = Object.entries(item.quantities ?? {}).map(([key, val]) => `${val} ${getQuantityTypeLabel(qts, key)}`).join(" / ");
                    const totalQty = Object.values(item.quantities ?? {}).reduce((a, b) => a + b, 0);
                    return (
                      <TableRow key={item.name}>
                        <TableCell className="text-center text-sm font-medium">{item.name}</TableCell>
                        <TableCell className="text-center text-sm tabular-nums">{qtyBreakdown || totalQty}</TableCell>
                        <TableCell className="text-center text-sm font-medium tabular-nums">{formatCurrency(item.revenue)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
