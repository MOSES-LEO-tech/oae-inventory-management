"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowUpFromLine, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/user-error";
import { useInventoryStore } from "@/stores/inventory-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePageStoreSelection } from "@/stores/ui-store";
import { Item, Transaction, Store, QuantityType } from "@/types";
import { formatQuantitiesShort, mergeQuantityTypes } from "@/lib/qty-label";

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getStoreName(storeId: string, stores: Store[]): string {
  const store = stores.find((s) => s.id === storeId);
  return store?.name || storeId;
}

// Legacy fallback quantity types for items that don't have quantityTypes set
const LEGACY_QTS: QuantityType[] = [
  { id: "pcs", label: "Pieces", unit: "pcs", price: 0, isDefault: true, conversionFactor: 1 },
  { id: "boxes", label: "Boxes", unit: "boxes", price: 0, isDefault: false, conversionFactor: 1 },
];

function getItemQuantityTypes(item: Item | undefined): QuantityType[] {
  if (!item) return LEGACY_QTS;
  if (item.quantityTypes && item.quantityTypes.length > 0) return item.quantityTypes;
  return [
    { id: "pcs", label: "Pieces", unit: "pcs", price: item.unitPricePc, isDefault: true, conversionFactor: 1 },
    { id: "boxes", label: "Boxes", unit: "boxes", price: item.unitPriceCtn, isDefault: false, conversionFactor: item.pcsPerCtn || 1 },
  ];
}

// English singular/plural derivation for quantity-type labels at display
// time (same helpers as the Inventory page). Labels are the admin's own
// text (e.g. "Books" or "Book") — unrecognized shapes fall back unchanged.
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

export default function StockOutPage() {
  const [selectedItemId, setSelectedItemId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  // Dynamic quantity / unit price state, keyed by quantity type id
  const [qtInputs, setQtInputs] = useState<Record<string, { qty: string; unitPrice: string }>>({});
  const [storeId, setStoreId] = useState("");
  const [saving, setSaving] = useState(false);
  const [warning, setWarning] = useState("");

  // Portal popover position: computed from the trigger's viewport rect so the
  // panel renders on <body> and can never be clipped by Card's overflow-hidden.
  const pickerAnchorRef = useRef<HTMLDivElement | null>(null);
  const [pickerPos, setPickerPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  useEffect(() => {
    if (!itemPickerOpen) {
      setPickerPos(null);
      return;
    }
    let frame = 0;
    const position = () => {
      const anchor = pickerAnchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const margin = 8;
      const spaceBelow = window.innerHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
      const available = openUp ? spaceAbove : spaceBelow;
      const maxHeight = Math.max(160, Math.min(available, window.innerHeight - 24));
      setPickerPos((prev) => {
        const next = openUp
          ? { bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width, maxHeight }
          : { top: rect.bottom + 4, left: rect.left, width: rect.width, maxHeight };
        if (
          prev &&
          prev.top === next.top &&
          prev.bottom === next.bottom &&
          prev.left === next.left &&
          prev.width === next.width &&
          prev.maxHeight === next.maxHeight
        ) {
          return prev;
        }
        return next;
      });
    };
    position();
    const onReposition = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(position);
    };
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [itemPickerOpen]);

  const { 
    items: inventoryItems,  // InventoryWithItem[] - has itemName, itemType, qtyPc, qtyCtn
    inventoryItems: itemCatalog,  // Item[] - has name, type, category
    stores, 
    sales,
    isLoadingItems,
    isLoadingStores,
    isLoadingSales,
    facilitySettings,
    fetchItems,
    fetchStores,
    fetchInventory,
    fetchSales,
    fetchFacilitySettings,
    recordSale,
  } = useInventoryStore();

  const { user, canAccessStore } = useAuthStore();
  // Page-scoped selection: stock-out is never driven by other pages'
  // switchers. Null = first accessible store (below).
  const { selectedStoreId } = usePageStoreSelection("stock-out");
  const currency = facilitySettings?.currency ?? "UGX";

  // Only stores this user may operate in (admin or empty assignment = all).
  const accessibleStores = useMemo(
    () => stores.filter((s) => canAccessStore(s.id)),
    [stores, canAccessStore]
  );

  // Fetch data on mount
  useEffect(() => {
    if (user?.facilityId) {
      fetchItems();
      fetchStores();
      fetchInventory();
      fetchSales(undefined, 50);
      fetchFacilitySettings();
    }
  }, [user?.facilityId]);

  // Default to the header's working store when accessible, else the first
  // accessible store (respects store access assignments).
  useEffect(() => {
    if (storeId || accessibleStores.length === 0) return;
    const preferred =
      selectedStoreId && accessibleStores.some((s) => s.id === selectedStoreId)
        ? selectedStoreId
        : accessibleStores[0].id;
    setStoreId(preferred);
  }, [storeId, accessibleStores, selectedStoreId]);

  // Switching stores invalidates the picked item — it may not exist in the
  // new store's inventory.
  useEffect(() => {
    setSelectedItemId("");
    setItemSearch("");
    setQtInputs({});
    setWarning("");
  }, [storeId]);

  // Picker options are the items this store actually holds — derived from the
  // selected store's inventory rows (catalog preferred for names). Users of
  // one store cannot stock out items that belong to another store.
  const pickerItems = useMemo(() => {
    const seen = new Set<string>();
    return inventoryItems
      .filter((i) => i.storeId === storeId)
      .filter((i) => (seen.has(i.itemId) ? false : (seen.add(i.itemId), true)))
      .map((i) => {
        const catalog = itemCatalog.find((c) => c.id === i.itemId);
        return {
          itemId: i.itemId,
          itemName: catalog?.name ?? i.itemName,
          itemType: catalog?.type ?? i.itemType,
        };
      });
  }, [itemCatalog, inventoryItems, storeId]);

  const filteredItems = useMemo(() => {
    if (!itemSearch) return pickerItems;
    const q = itemSearch.toLowerCase();
    return pickerItems.filter(
      (i) => i.itemName.toLowerCase().includes(q) || i.itemType.toLowerCase().includes(q)
    );
  }, [itemSearch, pickerItems]);

  // Display name for the selected item while the picker is closed.
  const selectedItemOption = useMemo(
    () => pickerItems.find((i) => i.itemId === selectedItemId) ?? null,
    [pickerItems, selectedItemId]
  );

  // Current stock of an item in the selected store (undefined if none yet).
  const stockForItem = (itemId: string) =>
    inventoryItems.find((i) => i.itemId === itemId && i.storeId === storeId);

  const selectedItem = inventoryItems.find(
    (i) => i.itemId === selectedItemId && i.storeId === storeId
  );

  // The full Item document for the selected item (for quantity types / pricing).
  const selectedCatalogItem: Item | undefined = useMemo(
    () => itemCatalog.find((i) => i.id === selectedItemId),
    [itemCatalog, selectedItemId]
  );

  const selectedQuantityTypes = useMemo(
    () => getItemQuantityTypes(selectedCatalogItem),
    [selectedCatalogItem]
  );

  const handleItemSelect = (item: { itemId: string; itemName: string; itemType: string }) => {
    // Identity is the CATALOG itemId — recordSale matches inventory rows by itemId
    setSelectedItemId(item.itemId);
    setItemPickerOpen(false);
    // Pre-fill each quantity type's sale price from THIS store's inventory
    // doc (pricing is per-store), falling back to the catalog price for any
    // type the row doesn't carry. The field stays editable.
    const catalog = itemCatalog.find((c) => c.id === item.itemId);
    const row = stockForItem(item.itemId);
    const qts = mergeQuantityTypes(
      row?.quantityTypes,
      getItemQuantityTypes(catalog)
    );
    setQtInputs(
      Object.fromEntries(qts.map((qt) => [qt.id, { qty: "", unitPrice: String(qt.price ?? 0) }]))
    );
    setWarning("");
  };

  const updateQtInput = (qtId: string, field: "qty" | "unitPrice", value: string) => {
    setQtInputs((prev) => ({
      ...prev,
      [qtId]: { ...prev[qtId], [field]: value },
    }));
  };

  // Check stock availability across all quantity types
  const hasSufficientStock = useMemo(() => {
    // No inventory row for this item in this store = nothing to sell.
    if (!selectedItem) return false;
    const quantities = selectedItem.quantities || {};
    for (const qt of selectedQuantityTypes) {
      const input = qtInputs[qt.id];
      if (!input) continue;
      const qty = parseFloat(input.qty) || 0;
      if (qty <= 0) continue;
      const available = quantities[qt.id] || 0;
      if (qty > available) return false;
    }
    return true;
  }, [selectedItem, selectedQuantityTypes, qtInputs]);

  const hasAnyQty = useMemo(
    () => selectedQuantityTypes.some((qt) => parseFloat(qtInputs[qt.id]?.qty ?? "0") > 0),
    [selectedQuantityTypes, qtInputs]
  );

  const totalAmount = useMemo(() => {
    return selectedQuantityTypes.reduce((sum, qt) => {
      const input = qtInputs[qt.id];
      if (!input) return sum;
      const qty = parseFloat(input.qty) || 0;
      const price = parseFloat(input.unitPrice) || 0;
      return sum + qty * price;
    }, 0);
  }, [selectedQuantityTypes, qtInputs]);

  const today = new Date().toISOString().split("T")[0];
  // Per-store view: a station's page must not surface another store's sales.
  const todaySales = useMemo(() => {
    return sales.filter((s: Transaction) => 
      s.storeId === storeId &&
      (s.createdAt?.toDate ? s.createdAt.toDate().toISOString().split("T")[0] === today : false)
    );
  }, [sales, storeId, today]);

  const totalTodayRevenue = todaySales.reduce((s, sale) => s + sale.totalAmount, 0);
  const totalTodayItems = useMemo(() => {
    return todaySales.reduce(
      (s, sale) => s + sale.items.reduce((si, item) => {
        const quantities = item.quantities as Record<string, number> || {};
        return si + Object.values(quantities).reduce((sum, q) => sum + q, 0);
      }, 0),
      0
    );
  }, [todaySales]);
  const avgSale = todaySales.length > 0 ? totalTodayRevenue / todaySales.length : 0;

  // Profit is snapshotted on each transaction at sale time; sales recorded
  // before cost prices existed carry no profit data (treated as 0).
  const totalTodayProfit = useMemo(
    () => todaySales.reduce((s, sale) => s + (sale.profit ?? 0), 0),
    [todaySales]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || !storeId || !user || !hasSufficientStock || !hasAnyQty) return;
    
    setSaving(true);
    try {
      const quantities: Record<string, number> = {};
      const unitPrices: Record<string, number> = {};
      let subtotal = 0;
      
      selectedQuantityTypes.forEach((qt) => {
        const input = qtInputs[qt.id];
        if (!input) return;
        const qty = parseFloat(input.qty) || 0;
        const price = parseFloat(input.unitPrice) || 0;
        if (qty <= 0) return;
        quantities[qt.id] = qty;
        unitPrices[qt.id] = price;
        subtotal += qty * price;
      });

      await recordSale(
        [{
          itemId: selectedItemId,
          itemName: selectedItem?.itemName || "Unknown",
          itemType: selectedItem?.itemType || "Unknown",
          quantities,
          unitPrices,
          subtotal,
        }],
        storeId,
        "CASH",
        "Walk-in Customer",
        "",
        user.id,
        user.name,
        ""
      );
      setQtInputs({});
      setSelectedItemId("");
      setItemSearch("");
      setWarning("");
    } catch (error) {
      console.error("Failed to record sale:", error);
      toast.error(toUserMessage(error, "Failed to record sale. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground">Record sales and deduct stock.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Record Sale</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Select Item *</Label>
              <div className="relative" ref={pickerAnchorRef}>
                <Input
                  placeholder="Tap to search items..."
                  value={itemPickerOpen ? itemSearch : selectedItemOption?.itemName ?? ""}
                  onChange={(e) => setItemSearch(e.target.value)}
                  onFocus={() => {
                    setItemPickerOpen(true);
                    if (selectedItemId) setItemSearch("");
                  }}
                />
                {itemPickerOpen && pickerPos && createPortal(
                  <>
                    {/* Invisible backdrop closes the picker on outside tap */}
                    <div
                      className="fixed inset-0 z-[70]"
                      onClick={() => setItemPickerOpen(false)}
                      aria-hidden="true"
                    />
                    <div
                      className="fixed z-[71] overflow-y-auto overscroll-contain rounded-2xl border border-hairline bg-background p-1 shadow-lg"
                      style={{
                        left: pickerPos.left,
                        width: pickerPos.width,
                        top: pickerPos.top,
                        bottom: pickerPos.bottom,
                        maxHeight: pickerPos.maxHeight,
                      }}
                    >
                      {filteredItems.length === 0 ? (
                        <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                          No items found. Add items from the Inventory page first.
                        </p>
                      ) : (
                        filteredItems.map((item) => {
                          const stock = stockForItem(item.itemId);
                          // Stock labels must resolve whether the row was
                          // written against the row's denormalized copy or
                          // the catalog's — the two can drift apart.
                          const rowQts = mergeQuantityTypes(
                            itemCatalog.find((c) => c.id === item.itemId)?.quantityTypes,
                            stock?.quantityTypes
                          );
                          return (
                            <button
                              key={item.itemId}
                              type="button"
                              onClick={() => handleItemSelect(item)}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors ${
                                selectedItemId === item.itemId ? "bg-accent" : ""
                              }`}
                            >
                              <span className="font-medium">{item.itemName}</span>
                              <span className="ml-2 text-muted-foreground">{item.itemType}</span>
                              {stock && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  (Stock: {formatQuantitiesShort(stock.quantities, rowQts)})
                                </span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </>,
                  document.body
                )}
              </div>
            </div>

            {/* Dynamic quantity type inputs */}
            {selectedItemId && selectedQuantityTypes.length > 0 && (
              <div className="space-y-3 rounded-2xl border border-hairline bg-canvas/40 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Quantities &amp; sale prices
                </p>
                {selectedQuantityTypes.map((qt) => (
                  <div key={qt.id} className="grid gap-3 sm:grid-cols-2 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs">Qty ({pluralize(qt.label)})</Label>
                      <Input
                        type="number"
                        min={0}
                        value={qtInputs[qt.id]?.qty ?? ""}
                        onChange={(e) => updateQtInput(qt.id, "qty", e.target.value)}
                        placeholder={`0 ${pluralize(qt.label)}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Sale Price per {singularize(qt.label)}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={qtInputs[qt.id]?.unitPrice ?? ""}
                        onChange={(e) => updateQtInput(qt.id, "unitPrice", e.target.value)}
                        placeholder={`Sale price per ${singularize(qt.label)}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedItemId && !hasSufficientStock && (
              <div className="flex items-center gap-2 rounded-2xl bg-surface-alt border border-hairline p-3 text-sm text-ink">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p>Insufficient stock for one or more quantity types.</p>
              </div>
            )}

            {hasAnyQty && (
              <div className="rounded-2xl bg-surface-alt border border-hairline p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Running total:</span>
                  <span className="font-medium">{formatCurrency(totalAmount, currency)}</span>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Running total:{" "}
                <span className="font-medium text-foreground">
                  {formatCurrency(totalAmount, currency)}
                </span>
              </p>
              <Button type="submit" disabled={saving || !selectedItemId || !hasAnyQty || !hasSufficientStock}>
                <ArrowUpFromLine className="mr-2 h-4 w-4" />
                {saving ? "Recording..." : "Record Sale"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Today's Sales Summary */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Revenue</p>
            <p className="text-2xl font-bold">{formatCurrency(totalTodayRevenue, currency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Profit</p>
            <p className="text-2xl font-bold">{formatCurrency(totalTodayProfit, currency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Items Sold</p>
            <p className="text-2xl font-bold">{totalTodayItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Average Sale</p>
            <p className="text-2xl font-bold">{formatCurrency(avgSale, currency)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today's Sales</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {todaySales.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <ArrowUpFromLine className="mx-auto mb-2 h-6 w-6" />
              <p>No sales today.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Time</TableHead>
                    <TableHead className="text-center">Items</TableHead>
                    <TableHead className="text-center">Store</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todaySales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="whitespace-nowrap text-center text-sm">
                        {sale.createdAt?.toDate && new Date(sale.createdAt.toDate()).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words text-center text-sm">
                        {sale.items.map((item) => item.itemName).join(", ")}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words text-center text-sm">{getStoreName(sale.storeId, stores)}</TableCell>
                      <TableCell className="whitespace-normal break-words text-center text-sm">
                        {sale.items.map((item) =>
                          formatQuantitiesShort(
                            item.quantities,
                            // Sale-time label snapshot first (immune to later
                            // catalog/row drift); historical lines recorded
                            // before snapshots existed fall back to every copy
                            // we still hold — across ALL stores, since rows of
                            // the same item can carry different type copies.
                            mergeQuantityTypes(
                              item.quantityTypes,
                              itemCatalog.find((c) => c.id === item.itemId)?.quantityTypes,
                              ...inventoryItems
                                .filter((r) => r.itemId === item.itemId)
                                .map((r) => r.quantityTypes)
                            )
                          )
                        ).join(", ")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center text-sm font-medium">
                        {formatCurrency(sale.totalAmount, currency)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center text-sm">
                        {sale.profit !== undefined ? formatCurrency(sale.profit, currency) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
