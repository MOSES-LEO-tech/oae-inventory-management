"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PrintButton } from "@/components/ui/print-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Clock } from "lucide-react";
import { MOCK_INVENTORY, MOCK_STORES, formatCurrency, getStoreName } from "@/lib/mock-data";
import { useUIStore } from "@/stores/ui-store";

export default function AgingReportPage() {
  const { selectedStoreId, setSelectedStoreId } = useUIStore();

  const grouped = useMemo(() => {
    let rows = MOCK_INVENTORY;
    if (selectedStoreId) rows = rows.filter((i) => i.storeId === selectedStoreId);

    const groups = new Map<string, typeof rows>();
    rows.forEach((row) => {
      const group = groups.get(row.stockYear) ?? [];
      group.push(row);
      groups.set(row.stockYear, group);
    });

    const result = Array.from(groups.entries()).map(([year, items]) => {
      const totalValue = items.reduce(
        (s, i) => s + i.qtyPc * i.unitPricePc + i.qtyCtn * i.unitPriceCtn,
        0
      );
      return { year, items, totalValue };
    });

    return result.sort((a, b) => b.totalValue - a.totalValue);
  }, [selectedStoreId]);

  const grandTotal = grouped.reduce((s, g) => s + g.totalValue, 0);

  return (
    <div className="space-y-6" data-print-content="true">
      <div className="flex items-start justify-between gap-4">
        <div>
        <Link href="/reports" className="inline-flex items-center text-sm text-mid-gray hover:text-ink mb-2">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Reports
        </Link>
        <h1 className="text-heading-sm font-semibold tracking-heading-sm">Stock Aging Report</h1>
        <p className="text-body text-mid-gray">Stock grouped by year and category.</p>
        </div>
        <div data-print-hide="true"><PrintButton /></div>
      </div>

      {/* Filter */}
      <div data-print-hide="true">
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

      {/* Groups */}
      {grouped.length === 0 ? <EmptyState icon={<Clock className="h-10 w-10" />} title="No stock aging records" description="Select a different store to see stock by year." /> : grouped.map((group) => (
        <Card key={group.year}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">{group.year}</CardTitle>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline">{group.items.length} items</Badge>
              <span className="tabular-nums text-sm font-bold">{formatCurrency(group.totalValue)}</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="hidden sm:table-cell">Store</TableHead>
                    <TableHead className="text-right">Qty PC</TableHead>
                    <TableHead className="text-right">Qty CTN</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.items.map((row) => {
                    const value = row.qtyPc * row.unitPricePc + row.qtyCtn * row.unitPriceCtn;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm font-medium">{row.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.type}</TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">{getStoreName(row.storeId)}</TableCell>
                        <TableCell className="tabular-nums text-right text-sm">{row.qtyPc}</TableCell>
                        <TableCell className="tabular-nums text-right text-sm">{row.qtyCtn}</TableCell>
                        <TableCell className="tabular-nums text-right text-sm font-medium">{formatCurrency(value)}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow>
                    <TableCell colSpan={5} className="text-right text-sm font-bold">Subtotal</TableCell>
                    <TableCell className="tabular-nums text-right text-sm font-bold">{formatCurrency(group.totalValue)}</TableCell>
                  </TableRow>
                </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {/* Grand Total */}
      <Card>
        <CardContent className="p-4 flex justify-between items-center">
          <span className="text-sm font-bold">Grand Total</span>
          <span className="tabular-nums text-lg font-bold">{formatCurrency(grandTotal)}</span>
        </CardContent>
      </Card>
    </div>
  );
}
