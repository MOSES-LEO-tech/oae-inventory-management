"use client";

import { useState, useMemo } from "react";
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
import { ArrowLeft, DollarSign, ShoppingBag, Hash, TrendingUp } from "lucide-react";
import { MOCK_SALES, MOCK_STORES, formatCurrency, getStoreName } from "@/lib/mock-data";
import { useUIStore } from "@/stores/ui-store";

export default function SalesReportPage() {
  const { selectedStoreId, setSelectedStoreId } = useUIStore();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = useMemo(() => {
    let rows = MOCK_SALES;
    if (selectedStoreId) rows = rows.filter((s) => s.storeId === selectedStoreId);
    if (dateFrom) rows = rows.filter((s) => s.createdAt >= dateFrom);
    if (dateTo) rows = rows.filter((s) => s.createdAt <= dateTo + "T23:59:59Z");
    return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [selectedStoreId, dateFrom, dateTo]);

  const totalRevenue = filtered.reduce((s, sale) => s + sale.totalAmount, 0);
  const totalItemsSold = filtered.reduce(
    (s, sale) => s + sale.items.reduce((si, item) => si + item.qtyPc, 0),
    0
  );
  const avgSale = filtered.length > 0 ? totalRevenue / filtered.length : 0;

  // Group by item
  const itemBreakdown = useMemo(() => {
    const map = new Map<string, { qtyPc: number; revenue: number }>();
    filtered.forEach((sale) => {
      sale.items.forEach((item) => {
        const existing = map.get(item.itemName) ?? { qtyPc: 0, revenue: 0 };
        existing.qtyPc += item.qtyPc;
        existing.revenue += item.subtotal;
        map.set(item.itemName, existing);
      });
    });
    return Array.from(map.entries()).map(([name, data]) => ({ name, ...data }));
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/reports" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Reports
        </Link>
        <h1 className="text-heading-sm font-semibold tracking-heading-sm">Sales Summary</h1>
        <p className="text-muted-foreground">Sales by store, item, and date range.</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" aria-label="Date from" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" aria-label="Date to" />
            <select
              value={selectedStoreId ?? ""}
              onChange={(e) => setSelectedStoreId(e.target.value || null)}
              className="h-9 rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40"
              aria-label="Filter by store"
            >
              <option value="">All Stores</option>
              {MOCK_STORES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
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
                  <TableHead>Date</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead className="hidden sm:table-cell">Items</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="text-sm">
                      {new Date(sale.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-sm">{getStoreName(sale.storeId)}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">
                      {sale.items.map((i) => i.itemName).join(", ")}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {sale.items.reduce((s, i) => s + i.qtyPc, 0)}PC
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatCurrency(sale.totalAmount)}</TableCell>
                  </TableRow>
                ))}
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
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty Sold</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemBreakdown.map((item) => (
                    <TableRow key={item.name}>
                      <TableCell className="text-sm font-medium">{item.name}</TableCell>
                      <TableCell className="text-right text-sm">{item.qtyPc}PC</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatCurrency(item.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
