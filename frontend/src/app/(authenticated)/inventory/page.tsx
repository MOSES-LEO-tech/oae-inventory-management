"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  Plus,
  Pencil,
  Settings2,
  Package,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import {
  MOCK_INVENTORY,
  MOCK_STORES,
  formatCurrency,
  getStoreName,
  isLowStock,
  removeItemCompletely,
} from "@/lib/mock-data";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";

export default function InventoryPage() {
  const { selectedStoreId, setSelectedStoreId } = useUIStore();
  const { canManageStock } = useAuthStore();
  const canManage = canManageStock();
  const [searchQuery, setSearchQuery] = useState("");
  const [stockYearFilter, setStockYearFilter] = useState<string>("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const stockYearOptions = useMemo(() => {
    const years = new Set(MOCK_INVENTORY.map((i) => i.stockYear));
    return Array.from(years).sort();
  }, []);

  const filtered = useMemo(() => {
    let result = MOCK_INVENTORY;

    if (selectedStoreId) {
      result = result.filter((i) => i.storeId === selectedStoreId);
    }
    if (stockYearFilter) {
      result = result.filter((i) => i.stockYear === stockYearFilter);
    }
    if (showLowStockOnly) {
      result = result.filter(isLowStock);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.type.toLowerCase().includes(q) ||
          (i.code && i.code.toLowerCase().includes(q))
      );
    }

    return result;
  }, [selectedStoreId, stockYearFilter, showLowStockOnly, searchQuery]);

  const itemCount = new Set(filtered.map((i) => i.id)).size;
  const totalValue = filtered.reduce(
    (s, i) => s + i.qtyPc * i.unitPricePc + i.qtyCtn * i.unitPriceCtn,
    0
  );

  return (
    <div className="space-y-6" key={refreshKey}>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-heading-sm font-semibold tracking-heading-sm">Inventory</h1>
          <p className="text-muted-foreground">
            {canManage
              ? `Manage items and view stock levels. ${itemCount} items, total value ${formatCurrency(totalValue)}.`
              : `View stock levels. ${itemCount} items, total value ${formatCurrency(totalValue)}.`}
          </p>
        </div>
        {canManage && (
          <Link href="/inventory/add">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Item
            </Button>
          </Link>
        )}
      </div>

      {!canManage && (
        <div className="rounded-2xl border border-hairline bg-surface-alt p-3 text-sm text-ink">
          Read-only view — you can view stock levels but only admins and managers can add or adjust items.
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by item name or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            aria-label="Search items"
          />
        </div>
        <select
          value={selectedStoreId ?? ""}
          onChange={(e) => setSelectedStoreId(e.target.value || null)}
          className="h-9 rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40"
          aria-label="Filter by store"
        >
          <option value="">All Stores</option>
          {MOCK_STORES.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={stockYearFilter}
          onChange={(e) => setStockYearFilter(e.target.value)}
          className="h-9 rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40"
          aria-label="Filter by stock year"
        >
          <option value="">All Years</option>
          {stockYearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm whitespace-nowrap">
          <Checkbox
            checked={showLowStockOnly}
            onCheckedChange={(v) => setShowLowStockOnly(v === true)}
          />
          <AlertTriangle className="h-3.5 w-3.5 text-ink" />
          Low stock only
        </label>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Package className="h-10 w-10" />}
              title="No items found"
              description="Try adjusting your filters or search query."
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="hidden sm:table-cell">Store</TableHead>
                    <TableHead className="hidden md:table-cell">Year</TableHead>
                    <TableHead className="text-right">Qty PC</TableHead>
                    <TableHead className="text-right">Qty CTN</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">Unit Price</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => {
                    const low = isLowStock(row);
                    const value = row.qtyPc * row.unitPricePc + row.qtyCtn * row.unitPriceCtn;
                    return (
                      <TableRow key={row.id} className={low ? "bg-canvas/60" : ""}>
                        <TableCell className="font-medium text-sm">{row.name}</TableCell>
                        <TableCell className="text-sm text-mid-gray">{row.type}</TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">{getStoreName(row.storeId)}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm">
                          <Badge variant="outline" className="text-xs">
                            {row.stockYear}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">{row.qtyPc}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{row.qtyCtn}</TableCell>
                        <TableCell className="hidden sm:table-cell text-right text-sm">
                          {formatCurrency(row.unitPricePc)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-right text-sm font-medium">
                          {formatCurrency(value)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`text-xs ${
                              low
                                ? "border border-hairline bg-transparent text-ink"
                                : "bg-ink text-paper"
                            }`}
                          >
                            {low ? "Low" : "OK"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canManage ? (
                              <>
                                <Link href={`/inventory/${row.id}/edit`}>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit item">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </Link>
                                <Link href={`/inventory/${row.id}/adjust`}>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Adjust stock">
                                    <Settings2 className="h-3.5 w-3.5" />
                                  </Button>
                                </Link>
                                {confirmDeleteId === row.id ? (
                                  <>
                                    <Button
                                      variant="destructive"
                                      size="icon"
                                      className="h-7 w-7"
                                      title="Confirm remove"
                                      onClick={() => {
                                        removeItemCompletely(row.id);
                                        setRefreshKey((k) => k + 1);
                                        setConfirmDeleteId(null);
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      title="Cancel"
                                      onClick={() => setConfirmDeleteId(null)}
                                    >
                                      <span className="text-xs">✕</span>
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    title="Remove item"
                                    onClick={() => setConfirmDeleteId(row.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
