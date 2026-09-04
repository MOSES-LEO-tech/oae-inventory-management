"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Plus,
  Pencil,
  Settings2,
  Package,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/user-error";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useInventoryStore } from "@/stores/inventory-store";
import { usePageStoreSelection } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import type { QuantityType, Item } from "@/types";

// One rendered row = ONE catalog item doc (items collection). Stock rows
// (inventory collection) only contribute quantities for the active scope.
type ListRow = {
  itemId: string;
  name: string;
  type: string;
  category?: string;
  code?: string;
  quantityTypes: QuantityType[]; // New flexible quantity types with pricing
  lowStockThresholds: Record<string, number>; // threshold per quantity type id
  qtyByType: Record<string, number>; // quantity per quantity type id
  actionRowId: string | null; // a real stock-row id for adjust/remove
  scopeStoreId?: string;
  scopeYear?: string;
  // Legacy fields for backward compatibility
  unitPricePc: number;
  unitPriceCtn: number;
  lowStockThresholdPc: number;
  lowStockThresholdCtn: number;
  qtyPc: number;
  qtyCtn: number;
};

// English singular/plural derivation for quantity-type labels at display
// time. Labels are the admin's own text (e.g. "Books" or "Book") — nothing
// is hardcoded here; unrecognized shapes fall back to the label unchanged.
const singularize = (label: string): string => {
  const w = label.trim();
  if (!w) return label;
  const lower = w.toLowerCase();
  if (w.length > 3 && lower.endsWith("ies")) return w.slice(0, -3) + "y";
  if (lower.endsWith("sses")) return w.slice(0, -2); // Glasses → Glass
  if (lower.endsWith("xes") || lower.endsWith("zes")) return w.slice(0, -2); // Boxes → Box
  if (lower.endsWith("ches") || lower.endsWith("shes")) return w.slice(0, -2); // Benches → Bench
  if (lower.endsWith("ses")) return w.slice(0, -1); // Cases → Case
  if (lower.endsWith("s") && !lower.endsWith("ss")) return w.slice(0, -1); // Books → Book
  return w; // already singular or unrecognized
};

const pluralize = (label: string): string => {
  const w = label.trim();
  if (!w) return label;
  const lower = w.toLowerCase();
  if (w.length > 3 && lower.endsWith("ies")) return w; // already plural
  if (lower.endsWith("s")) return lower.endsWith("ss") ? w + "es" : w; // Books stays; Glass → Glasses
  if (/[^aeiou]y$/.test(lower)) return w.slice(0, -1) + "ies"; // Baby → Babies
  if (/(s|x|z|ch|sh)$/.test(lower)) return w + "es"; // Box → Boxes
  return w + "s"; // Book → Books
};

export default function InventoryPage() {
  // Store selection is scoped to THIS page only — other pages keep their own.
  const { selectedStoreId, setSelectedStoreId } = usePageStoreSelection("inventory");
  const { user, hasDuty } = useAuthStore();
  // "Manager" is expressed via duties in this app (FacilityRole is admin|staff):
  // Store Manager / Inventory Officer carry manage_inventory; clerks do not.
  const canManage = user?.role === "admin" || hasDuty("manage_inventory");
  const {
    items: stockRows,
    inventoryItems,
    stores,
    isLoading,
    isLoadingItems,
    fetchInventory,
    fetchItems,
    fetchStores,
    deleteInventory,
    deleteItem,
    adjustStock,
    searchQuery,
    setSearchQuery,
    selectedStockYear,
    setSelectedStockYear,
    showLowStockOnly,
    toggleLowStockOnly,
    facilitySettings,
    fetchFacilitySettings,
  } = useInventoryStore();
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<ListRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Manage dialog state (details + per-row adjustment)
  const [manageTarget, setManageTarget] = useState<ListRow | null>(null);
  const [adjRowId, setAdjRowId] = useState("");
  // One adjustment input per quantity type, keyed by quantity type id
  const [adjQt, setAdjQt] = useState<Record<string, string>>({});
  const [adjReason, setAdjReason] = useState("");
  const [savingAdjust, setSavingAdjust] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      if (deleteTarget.actionRowId) {
        await deleteInventory(deleteTarget.actionRowId);
        toast.success(`Removed "${deleteTarget.name}" stock row`);
      } else {
        await deleteItem(deleteTarget.itemId);
        toast.success(`Deleted "${deleteTarget.name}" from catalog`);
      }
      setRefreshKey((k) => k + 1);
      setDeleteTarget(null);
    } catch (error) {
      console.error("Failed to remove item:", error);
      toast.error(toUserMessage(error, "Failed to remove item"));
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    fetchInventory();
    fetchItems();
    fetchStores();
    fetchFacilitySettings();
  }, [fetchInventory, fetchItems, fetchStores, fetchFacilitySettings]);

  // Every store — including the Main store — is listed so any store's users
  // can view items held by other stores. Access restrictions apply to
  // operations (stock in/out), not to viewing.
  //
  // Keep the store filter pinned to a store that still exists: re-pin only
  // when the persisted selection was deleted, never because of access grants.
  useEffect(() => {
    if (selectedStoreId && stores.some((s) => s.id === selectedStoreId)) return;
    if (stores.length > 0) setSelectedStoreId(stores[0].id);
  }, [selectedStoreId, stores, setSelectedStoreId]);

  const stockYearOptions = useMemo(() => {
    const years = new Set(stockRows.map((r) => r.stockYear));
    return Array.from(years).sort();
  }, [stockRows]);

  const rowsByItem = useMemo(() => {
    const map = new Map<string, typeof stockRows>();
    stockRows.forEach((r) => {
      const arr = map.get(r.itemId);
      if (arr) arr.push(r);
      else map.set(r.itemId, [r]);
    });
    return map;
  }, [stockRows]);

  // All stock rows of the item currently open in the Manage dialog.
  const manageItemRows = useMemo(() => {
    if (!manageTarget) return [];
    return rowsByItem.get(manageTarget.itemId) ?? [];
  }, [manageTarget, rowsByItem]);

  const openManage = (row: ListRow) => {
    setManageTarget(row);
    const firstRowId =
      row.actionRowId ?? rowsByItem.get(row.itemId)?.[0]?.id ?? "";
    setAdjRowId(firstRowId);
    setAdjQt({});
    setAdjReason("");
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manageTarget || !adjRowId || !user) return;
    try {
      setSavingAdjust(true);
      // Key adjustments by the row's actual quantity type ids — never
      // hardcoded legacy keys — so custom quantity types adjust correctly.
      const adjustments: Record<string, number> = {};
      Object.entries(adjQt).forEach(([qtId, value]) => {
        const delta = Number(value);
        if (delta !== 0) adjustments[qtId] = delta;
      });
      if (Object.keys(adjustments).length === 0) {
        toast.error("Enter a non-zero adjustment for at least one quantity type.");
        setSavingAdjust(false);
        return;
      }
      await adjustStock(
        adjRowId,
        adjustments,
        adjReason.trim(),
        user.id,
        user.name
      );
      toast.success(`Adjustment saved for "${manageTarget.name}"`);
      setManageTarget(null);
    } catch (error) {
      console.error("Failed to save adjustment:", error);
      toast.error(toUserMessage(error, "Failed to save adjustment"));
    } finally {
      setSavingAdjust(false);
    }
  };

  const listRows = useMemo<ListRow[]>(() => {
    return inventoryItems.map((item) => {
      let rows = rowsByItem.get(item.id) ?? [];
      if (selectedStockYear) rows = rows.filter((r) => r.stockYear === selectedStockYear);
      const scoped = selectedStoreId ? rows.filter((r) => r.storeId === selectedStoreId) : rows;

      // Per-store pricing: when a store is selected, prices and thresholds
      // come from that store's own inventory doc; the catalog copy is the
      // facility-wide fallback (no store selected / no row yet).
      const scopedRow = selectedStoreId
        ? rows.find((r) => r.storeId === selectedStoreId) ?? null
        : null;

      // Build quantity types: the store's row copy first, then the catalog
      // item (with legacy field fallback)
      const quantityTypes = scopedRow?.quantityTypes && scopedRow.quantityTypes.length > 0
        ? scopedRow.quantityTypes
        : item.quantityTypes && item.quantityTypes.length > 0
        ? item.quantityTypes
        : [
            { id: "pcs", label: "Pieces", unit: "pcs" as const, price: item.unitPricePc, isDefault: true, conversionFactor: 1 },
            { id: "boxes", label: "Boxes", unit: "boxes" as const, price: item.unitPriceCtn, isDefault: false, conversionFactor: item.pcsPerCtn || 1 },
          ];

      // Build low stock thresholds: the store's row copy first, then legacy
      // catalog fields (Item doesn't have lowStockThresholds)
      const lowStockThresholds: Record<string, number> = scopedRow?.lowStockThresholds
        ? { ...scopedRow.lowStockThresholds }
        : {};
      if (!scopedRow?.lowStockThresholds) {
        quantityTypes.forEach(qt => {
          if (qt.isDefault) {
            lowStockThresholds[qt.id] = item.lowStockThresholdPc;
          } else if (qt.unit === "boxes") {
            lowStockThresholds[qt.id] = item.lowStockThresholdCtn;
          } else {
            lowStockThresholds[qt.id] = 0;
          }
        });
      }
      
      // Build quantities map from scoped stock rows - use new quantities field
      const qtyByType: Record<string, number> = {};
      quantityTypes.forEach(qt => {
        qtyByType[qt.id] = scoped.reduce((s, r) => s + ((r.quantities?.[qt.id] || 0) || 0), 0);
      });

      return {
        itemId: item.id,
        name: item.name,
        type: item.type,
        category: item.category,
        code: item.code,
        quantityTypes,
        lowStockThresholds,
        qtyByType,
        actionRowId: scoped[0]?.id ?? rows[0]?.id ?? null,
        scopeStoreId: selectedStoreId ?? scoped[0]?.storeId,
        scopeYear: selectedStockYear ?? scoped[0]?.stockYear,
        // Legacy fields for backward compatibility
        unitPricePc: item.unitPricePc,
        unitPriceCtn: item.unitPriceCtn,
        lowStockThresholdPc: item.lowStockThresholdPc,
        lowStockThresholdCtn: item.lowStockThresholdCtn,
        qtyPc: scoped.reduce((s, r) => s + ((r.quantities?.pcs || 0) || 0), 0),
        qtyCtn: scoped.reduce((s, r) => s + ((r.quantities?.boxes || 0) || 0), 0),
      };
    });
  }, [inventoryItems, rowsByItem, selectedStoreId, selectedStockYear]);

  // Store/year filters re-scope quantities; they never HIDE catalog docs.
  const filtered = useMemo(() => {
    let result = listRows;
    if (showLowStockOnly) {
      result = result.filter(
        (r) =>
          Object.entries(r.qtyByType || {}).some(([qtId, qty]) => {
            const threshold = r.lowStockThresholds?.[qtId] || 0;
            return threshold > 0 && qty <= threshold;
          }) ||
          Object.values(r.qtyByType || {}).every(q => q === 0)
      );
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.type.toLowerCase().includes(q) ||
          (r.code && r.code.toLowerCase().includes(q))
      );
    }
    return result;
  }, [listRows, showLowStockOnly, searchQuery]);

  const itemCount = filtered.length;
  const totalValue = filtered.reduce(
    (s, r) => s + Object.entries(r.qtyByType || {}).reduce((sum, [qtId, qty]) => {
      const qt = r.quantityTypes?.find(q => q.id === qtId);
      return sum + qty * (qt?.costPrice ?? 0);
    }, 0),
    0
  );

  // Currency follows the facility's chosen currency (settings page dropdown /
  // onboarding) instead of a hardcoded default.
  const currency = facilitySettings?.currency ?? "UGX";

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-UG", { style: "currency", currency, minimumFractionDigits: 0 }).format(amount);
  };

  // Plain grouped number for the per-type Price / In Store lines (the currency
  // is carried by the Value column, per the approved table design).
  const formatNumber = (amount: number): string => {
    return new Intl.NumberFormat("en-UG", { maximumFractionDigits: 2 }).format(amount);
  };

  const getStoreName = (storeId: string): string =>
    stores.find((s) => s.id === storeId)?.name ?? storeId;

  const selectCls =
    "h-9 rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40";

  return (
    <div className="space-y-6" key={refreshKey}>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-muted-foreground">
            {itemCount} items · total value {formatCurrency(totalValue)}
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

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
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
              value={selectedStoreId || ""}
              onChange={(e) => setSelectedStoreId(e.target.value || null)}
              className={selectCls}
              aria-label="Filter by store"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={selectedStockYear || ""}
              onChange={(e) => setSelectedStockYear(e.target.value || null)}
              className={selectCls}
              aria-label="Filter by stock year"
            >
              <option value="">All Years</option>
              {stockYearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm whitespace-nowrap">
              <Checkbox
                checked={showLowStockOnly}
                onCheckedChange={(v) => toggleLowStockOnly()}
              />
              <AlertTriangle className="h-3.5 w-3.5 text-ink" />
              Low stock only
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {isLoading || isLoadingItems ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-sm text-muted-foreground">Loading inventory...</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No items found.</p>
            <p className="text-xs text-muted-foreground">
              Try adjusting your filters or search query.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-left">Item Name</TableHead>
                    <TableHead className="text-left">Category</TableHead>
                    {/* Per-type prices/quantities render as stacked lines
                        inside one fixed column each — the table never grows
                        sideways, no matter how many quantity types an item
                        has. Full per-type detail also lives in the Manage
                        dialog. */}
                    <TableHead className="hidden md:table-cell text-left">Cost Price</TableHead>
                    <TableHead className="hidden md:table-cell text-left">Sale Price</TableHead>
                    <TableHead className="text-left">In Store</TableHead>
                    <TableHead className="hidden md:table-cell text-left">Storage</TableHead>
                    <TableHead className="hidden md:table-cell text-left">Value</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => {
                    // Calculate total value across all quantity types
                    // (value = quantity × cost price)
                    const value = row.quantityTypes.reduce((sum, qt) => {
                      const qty = row.qtyByType[qt.id] ?? 0;
                      return sum + qty * (qt.costPrice ?? 0);
                    }, 0);
                    return (
                      <TableRow key={row.itemId}>
                        <TableCell className="text-left text-sm font-medium">{row.name}</TableCell>
                        <TableCell className="text-left text-sm text-mid-gray">{row.type}</TableCell>
                        {/* One line per quantity type: grouped number + unit
                            label (status lives in the Manage dialog) */}
                        <TableCell className="hidden md:table-cell text-left">
                          <div className="space-y-1">
                            {row.quantityTypes.map((qt) => (
                              <div key={qt.id} className="text-sm">
                                <span className="font-medium tabular-nums">{formatNumber(qt.costPrice ?? 0)}</span>
                                {qt.label && (
                                  <span className="ml-1 text-xs text-mid-gray">per {singularize(qt.label)}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-left">
                          <div className="space-y-1">
                            {row.quantityTypes.map((qt) => (
                              <div key={qt.id} className="text-sm">
                                <span className="font-medium tabular-nums">{formatNumber(qt.price)}</span>
                                {qt.label && (
                                  <span className="ml-1 text-xs text-mid-gray">per {singularize(qt.label)}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-left">
                          <div className="space-y-1">
                            {row.quantityTypes.map((qt) => (
                              <div key={qt.id} className="text-sm">
                                <span className="font-medium tabular-nums">{formatNumber(row.qtyByType[qt.id] ?? 0)}</span>
                                {qt.label && (
                                  <span className="ml-1 text-xs text-mid-gray">{pluralize(qt.label)}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-left text-sm">
                          {row.scopeStoreId ? getStoreName(row.scopeStoreId) : "—"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-left text-sm font-medium tabular-nums">
                          {formatCurrency(value)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canManage ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="View details & manage stock"
                                  onClick={() => openManage(row)}
                                >
                                  <Settings2 className="h-3.5 w-3.5" />
                                </Button>
                                <Link href={`/inventory/${row.itemId}/edit${selectedStoreId ? `?store=${selectedStoreId}` : ""}`}>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit item">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </Link>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title={
                                    row.actionRowId
                                      ? "Remove this item's stock row"
                                      : "Delete catalog item"
                                  }
                                  onClick={() => setDeleteTarget(row)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
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
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manage dialog — full item details + stock adjustments */}
      <Dialog
        open={!!manageTarget}
        onOpenChange={(o) => !o && setManageTarget(null)}
      >
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{manageTarget?.name}</DialogTitle>
          </DialogHeader>

          {manageTarget && (
            <div className="space-y-5">
              {/* Full details — fields hidden on small table screens live here */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="font-medium">{manageTarget.type}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="font-medium">{manageTarget.category ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Code</p>
                  <p className="font-medium">{manageTarget.code || "—"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Low Stock Thresholds</p>
                  <p className="font-medium">
                    {manageTarget.quantityTypes.map((qt) => (
                      <span key={qt.id} className="inline-block mr-2">
                        {qt.label}: {manageTarget.lowStockThresholds[qt.id] ?? 0}
                      </span>
                    ))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Est. Value</p>
                  <p className="font-medium tabular-nums">
                    {formatCurrency(
                      manageTarget.quantityTypes.reduce((sum, qt) => {
                        const qty = manageTarget.qtyByType[qt.id] ?? 0;
                        return sum + qty * (qt.costPrice ?? 0);
                      }, 0)
                    )}
                  </p>
                </div>
              </div>

              {/* Stock rows across all stores/years */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Stock on hand
                </p>
                {manageItemRows.length === 0 ? (
                  <div className="rounded-2xl border border-hairline bg-surface-alt p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      No stock recorded yet for this item.
                    </p>
                    <Link href="/stock-in">
                      <Button variant="outline" size="sm" className="mt-2">
                        Record first stock in
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {/* Quantity type headers — same grid as the rows below so
                        every column lines up exactly */}
                    <div
                      className="grid items-center gap-2 border-b border-hairline px-3 py-2 text-xs font-medium text-muted-foreground"
                      style={{
                        gridTemplateColumns: `minmax(0, 1fr) repeat(${manageTarget.quantityTypes.length}, 4.5rem)`,
                      }}
                    >
                      <span>Store · Year</span>
                      {manageTarget.quantityTypes.map((qt) => (
                        <span key={qt.id} className="text-right font-medium tabular-nums">
                          {qt.label}
                        </span>
                      ))}
                    </div>
                    {manageItemRows.map((r) => (
                      <div
                        key={r.id}
                        className={`grid items-center gap-2 px-3 py-2 text-sm ${
                          r.id === adjRowId ? "border-primary/40 bg-canvas" : "border-b border-hairline"
                        }`}
                        style={{
                          gridTemplateColumns: `minmax(0, 1fr) repeat(${manageTarget.quantityTypes.length}, 4.5rem)`,
                        }}
                      >
                        <span className="text-mid-gray">
                          {getStoreName(r.storeId)} · {r.stockYear}
                        </span>
                        {manageTarget.quantityTypes.map((qt) => (
                          <span key={qt.id} className="text-right font-medium tabular-nums">
                            {r.quantities?.[qt.id] ?? 0}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Adjustment form */}
              {manageItemRows.length > 0 && (
                <form onSubmit={handleAdjust} className="space-y-3 border-t border-hairline pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Adjust stock
                  </p>
                  <input type="hidden" value={adjRowId} readOnly />
                  <div className="grid grid-cols-2 gap-3">
                    {manageTarget.quantityTypes.map((qt) => (
                      <div key={qt.id} className="space-y-1.5">
                        <Label htmlFor={`adj-${qt.id}`}>Adjustment ({qt.label})</Label>
                        <Input
                          id={`adj-${qt.id}`}
                          type="number"
                          value={adjQt[qt.id] ?? "0"}
                          onChange={(e) =>
                            setAdjQt((prev) => ({ ...prev, [qt.id]: e.target.value }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Positive adds, negative removes. Applied to{" "}
                    {(() => {
                      const r = manageItemRows.find((x) => x.id === adjRowId);
                      return r ? `${getStoreName(r.storeId)} · ${r.stockYear}` : "selected row";
                    })()}
                    .
                  </p>
                  {manageItemRows.length > 1 && (
                    <select
                      value={adjRowId}
                      onChange={(e) => setAdjRowId(e.target.value)}
                      className={`${selectCls} w-full`}
                      aria-label="Select stock row to adjust"
                    >
                      {manageItemRows.map((r) => {
                        const qtySummary = manageTarget.quantityTypes.map(qt => `${r.quantities?.[qt.id] ?? 0} ${qt.label}`).join(" / ");
                        return (
                          <option key={r.id} value={r.id}>
                            {getStoreName(r.storeId)} · {r.stockYear} — {qtySummary}
                          </option>
                        );
                      })}
                    </select>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="adjReason">Reason *</Label>
                    <Textarea
                      id="adjReason"
                      rows={2}
                      required
                      placeholder="e.g., Damaged stock, count correction"
                      value={adjReason}
                      onChange={(e) => setAdjReason(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setManageTarget(null)}
                    >
                      Close
                    </Button>
                    <Button type="submit" size="sm" disabled={savingAdjust}>
                      {savingAdjust ? "Saving..." : "Save adjustment"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={deleteTarget?.actionRowId ? "Remove stock item" : "Delete catalog item"}
        message={
          deleteTarget?.actionRowId
            ? `Remove "${deleteTarget?.name}" stock row? The catalog item and its history are kept; only this stock row is deleted.`
            : `"${deleteTarget?.name}" has no stock records. Delete it from the catalog permanently?`
        }
        confirmLabel={deleting ? "Removing..." : deleteTarget?.actionRowId ? "Remove" : "Delete"}
        confirmVariant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
