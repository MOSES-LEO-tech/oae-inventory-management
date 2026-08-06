"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, DollarSign } from "lucide-react";
import { MOCK_INVENTORY, MOCK_STORES, formatCurrency, getStoreName } from "@/lib/mock-data";
import { useUIStore } from "@/stores/ui-store";

export default function ValuationPage() {
  const { selectedStoreId, setSelectedStoreId } = useUIStore();
  const [yearFilter, setYearFilter] = useState("");

  const years = useMemo(() => {
    const s = new Set(MOCK_INVENTORY.map((i) => i.stockYear));
    return Array.from(s).sort();
  }, []);

  const filtered = useMemo(() => {
    let rows = MOCK_INVENTORY;
    if (selectedStoreId) rows = rows.filter((i) => i.storeId === selectedStoreId);
    if (yearFilter) rows = rows.filter((i) => i.stockYear === yearFilter);
    return rows;
  }, [selectedStoreId, yearFilter]);

  const totalValue = filtered.reduce(
    (s, i) => s + i.qtyPc * i.unitPricePc + i.qtyCtn * i.unitPriceCtn,
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/reports" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Reports
        </Link>
        <h1 className="text-heading-sm font-semibold tracking-heading-sm">Stock Valuation</h1>
        <p className="text-muted-foreground">Total value of stock per item and store.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={selectedStoreId ?? ""}
          onChange={(e) => setSelectedStoreId(e.target.value || null)}
          className="h-9 rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40"
          aria-label="Filter by store"
        >
          <option value="">All Stores</option>
          {MOCK_STORES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="h-9 rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40"
          aria-label="Filter by stock year"
        >
          <option value="">All Years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Total Value */}
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <DollarSign className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Total Inventory Value</p>
            <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden sm:table-cell">Store</TableHead>
                  <TableHead className="hidden sm:table-cell">Year</TableHead>
                  <TableHead className="text-right">Qty PC</TableHead>
                  <TableHead className="text-right">Price PC</TableHead>
                  <TableHead className="text-right">Qty CTN</TableHead>
                  <TableHead className="text-right">Price CTN</TableHead>
                  <TableHead className="text-right font-bold">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const value = row.qtyPc * row.unitPricePc + row.qtyCtn * row.unitPriceCtn;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm font-medium">{row.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.type}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{getStoreName(row.storeId)}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">
                        <Badge variant="outline" className="text-xs">{row.stockYear}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">{row.qtyPc}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(row.unitPricePc)}</TableCell>
                      <TableCell className="text-right text-sm">{row.qtyCtn}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(row.unitPriceCtn)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatCurrency(value)}</TableCell>
                    </TableRow>
                  );
                })}
                {/* Grand Total */}
                <TableRow>
                  <TableCell colSpan={8} className="text-right font-bold text-sm">Grand Total</TableCell>
                  <TableCell className="text-right font-bold text-sm">{formatCurrency(totalValue)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
