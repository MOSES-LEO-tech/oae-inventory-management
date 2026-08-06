"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { MOCK_INVENTORY, MOCK_ITEMS, MOCK_STORES, getStoreName, isLowStock } from "@/lib/mock-data";
import { useUIStore } from "@/stores/ui-store";

export default function LowStockPage() {
  const { selectedStoreId, setSelectedStoreId } = useUIStore();

  const lowStockItems = useMemo(() => {
    let rows = MOCK_INVENTORY;
    if (selectedStoreId) rows = rows.filter((i) => i.storeId === selectedStoreId);
    return rows.filter(isLowStock).sort((a, b) => a.qtyPc - b.qtyPc);
  }, [selectedStoreId]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/reports" className="inline-flex items-center text-sm text-mid-gray hover:text-ink mb-2">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Reports
        </Link>
        <h1 className="text-heading-sm font-semibold tracking-heading-sm">Low Stock Report</h1>
        <p className="text-body text-mid-gray">Items below their configured threshold.</p>
      </div>

      {/* Alert Banner — monochromatic tonal panel */}
      <Card className="border-hairline bg-surface-alt">
        <CardContent className="p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-ink" />
          <p className="text-sm font-medium text-ink">
            {lowStockItems.length} {lowStockItems.length === 1 ? "item needs" : "items need"} restocking
          </p>
        </CardContent>
      </Card>

      {/* Filter */}
      <div>
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
                  <TableHead className="text-right">Current PC</TableHead>
                  <TableHead className="text-right">Threshold PC</TableHead>
                  <TableHead className="text-right">Current CTN</TableHead>
                  <TableHead className="text-right">Threshold CTN</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStockItems.map((row) => {
                  const item = MOCK_ITEMS.find((i) => i.id === row.id);
                  const isCritical = row.qtyPc === 0;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm font-medium">{row.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.type}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{getStoreName(row.storeId)}</TableCell>
                      <TableCell className="text-right text-sm font-bold">{row.qtyPc}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{item?.lowStockThresholdPc || 0}</TableCell>
                      <TableCell className="text-right text-sm font-bold">{row.qtyCtn}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{item?.lowStockThresholdCtn || 0}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-xs ${
                          isCritical
                            ? "bg-ink text-paper"
                            : "border border-hairline bg-transparent text-ink"
                        }`}>
                          {isCritical ? "Critical" : "Low"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
