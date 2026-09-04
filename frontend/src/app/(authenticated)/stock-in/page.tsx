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
import { ArrowDownToLine, AlertCircle, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/user-error";
import { useInventoryStore } from "@/stores/inventory-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePageStoreSelection } from "@/stores/ui-store";
import { Item, StockMovement, Store, QuantityType } from "@/types";
import { mergeQuantityTypes } from "@/lib/qty-label";

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
  { id: "ctn", label: "Carton", unit: "boxes", price: 0, isDefault: false, conversionFactor: 1 },
];

function getItemQuantityTypes(item: Item | undefined): QuantityType[] {
  if (!item) return LEGACY_QTS;
  if (item.quantityTypes && item.quantityTypes.length > 0) return item.quantityTypes;
  return [
    { id: "pcs", label: "Pieces", unit: "pcs", price: item.unitPricePc, isDefault: true, conversionFactor: 1 },
    { id: "ctn", label: "Carton", unit: "boxes", price: item.unitPriceCtn, isDefault: false, conversionFactor: item.pcsPerCtn || 1 },
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

export default function StockInPage() {
  const [selectedItemId, setSelectedItemId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  // Dynamic quantity / unit cost state, keyed by quantity type id
  const [qtInputs, setQtInputs] = useState<Record<string, { qty: string; unitCost: string }>>({});
  const [storeId, setStoreId] = useState("");
  const [supplier, setSupplier] = useState("");
  const [saving, setSaving] = useState(false);

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
    movements,
    isLoadingItems,
    isLoadingStores,
    isLoadingMovements,
    facilitySettings,
    fetchItems,
    fetchStores,
    fetchInventory,
    fetchMovements,
    fetchFacilitySettings,
    addStockIn,
  } = useInventoryStore();

  const { user, canAccessStore } = useAuthStore();
  // Page-scoped selection: stock-in is never driven by other pages'
  // switchers. Null = first accessible store (below).
  const { selectedStoreId } = usePageStoreSelection("stock-in");
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
      fetchMovements(undefined, 20);
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

  // Picker options come from the items catalog (one per catalog doc) so brand-new
  // items without a stock row are still selectable — addStockIn find-or-creates.
  // Offline fallback: if the catalog is empty, derive options from the
  // denormalized inventory rows so existing stock stays workable.
  const pickerItems = useMemo(() => {
    if (itemCatalog.length > 0) {
      return itemCatalog.map((c) => ({
        itemId: c.id,
        itemName: c.name,
        itemType: c.type,
      }));
    }
    const seen = new Set<string>();
    return inventoryItems
      .filter((i) => (seen.has(i.itemId) ? false : (seen.add(i.itemId), true)))
      .map((i) => ({ itemId: i.itemId, itemName: i.itemName, itemType: i.itemType }));
  }, [itemCatalog, inventoryItems]);

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

  // The full Item document for the selected item (for quantity types / pricing).
  const selectedCatalogItem: Item | undefined = useMemo(
    () => itemCatalog.find((i) => i.id === selectedItemId),
    [itemCatalog, selectedItemId]
  );

  const selectedQuantityTypes = useMemo(
    () => getItemQuantityTypes(selectedCatalogItem),
    [selectedCatalogItem]
  );

  const selectedItem = inventoryItems.find(
    (i) => i.itemId === selectedItemId && i.storeId === storeId
  );

  const handleItemSelect = (item: { itemId: string; itemName: string; itemType: string }) => {
    setSelectedItemId(item.itemId);
    setItemPickerOpen(false);
    // Reset all quantity type inputs when switching items
    setQtInputs({});
  };

  const updateQtInput = (qtId: string, field: "qty" | "unitCost", value: string) => {
    setQtInputs((prev) => ({
      ...prev,
      [qtId]: { ...prev[qtId], [field]: value },
    }));
  };

  // Total cost across all quantity types
  const totalCost = useMemo(() => {
    return selectedQuantityTypes.reduce((sum, qt) => {
      const input = qtInputs[qt.id];
      if (!input) return sum;
      const qty = parseFloat(input.qty) || 0;
      const cost = parseFloat(input.unitCost) || 0;
      return sum + qty * cost;
    }, 0);
  }, [selectedQuantityTypes, qtInputs]);

  const hasAnyQty = useMemo(
    () => selectedQuantityTypes.some((qt) => parseFloat(qtInputs[qt.id]?.qty ?? "0") > 0),
    [selectedQuantityTypes, qtInputs]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || !storeId || !user) return;

    // Build quantities and unitCosts records from dynamic quantity types
    const quantities: Record<string, number> = {};
    const unitCosts: Record<string, number> = {};
    let hasAnyQty = false;

    selectedQuantityTypes.forEach((qt) => {
      const input = qtInputs[qt.id];
      if (!input) return;
      const qty = parseFloat(input.qty) || 0;
      const cost = parseFloat(input.unitCost) || 0;
      if (qty <= 0) return;
      hasAnyQty = true;
      quantities[qt.id] = qty;
      unitCosts[qt.id] = cost || 0;
    });

    if (!hasAnyQty) {
      toast.error("Please enter a quantity for at least one unit type.");
      return;
    }

    setSaving(true);
    try {
      const notes = `Stock in from ${supplier}`;
      await addStockIn(
        selectedItemId,
        storeId,
        quantities,
        unitCosts,
        supplier,
        notes,
        user.id,
        user.name
      );
      setQtInputs({});
      setSupplier("");
      setSelectedItemId("");
      setItemSearch("");
    } catch (error) {
      console.error("Failed to record stock in:", error);
      toast.error(toUserMessage(error, "Failed to record stock in. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  // Helper to format quantities for display. Record keys are quantity-type
  // IDs — resolve each to its readable label. Legacy keys ("pcs"/"ctn")
  // predate quantity types and have no catalog entry, so they fall back to
  // the uppercased key.
  const formatQty = (quantities: Record<string, number>, quantityTypes: QuantityType[]) =>
    Object.entries(quantities)
      .map(([k, v]) => `${v} ${quantityTypes.find((qt) => qt.id === k)?.label ?? k.toUpperCase()}`)
      .join(" / ");

  // Get recent IN movements
  const recentStockIn = useMemo(() => {
    return movements
      .filter((m: StockMovement) => m.type === "IN")
      .slice(0, 10)
      .map((m) => {
        const item = inventoryItems.find((i) => i.itemId === m.itemId || i.id === m.itemId);
        // Merge every live source: the movement's write-time snapshot, the
        // catalog copy, and ALL inventory-row copies — any store's row can
        // carry the type set the record was keyed against; first-match
        // lookup breaks when copies drift between stores.
        const qtyTypes = mergeQuantityTypes(
          m.quantityTypes,
          itemCatalog.find((c) => c.id === m.itemId)?.quantityTypes,
          ...inventoryItems.filter((r) => r.itemId === m.itemId).map((r) => r.quantityTypes)
        );
        return {
          id: m.id,
          itemName: item?.itemName || "Unknown",
          type: m.type,
          qty: formatQty(m.quantities || {}, qtyTypes),
          supplier: m.notes?.replace("Stock in from ", "")?.split(" — also:")[0] || "Unknown",
          storeId: m.storeId,
          date: m.createdAt?.toDate ? m.createdAt.toDate().toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        };
      });
  }, [movements, inventoryItems, itemCatalog]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground">Record incoming stock from suppliers.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Record Stock In</CardTitle>
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
                          const qtyTypes = getItemQuantityTypes(itemCatalog.find((c) => c.id === item.itemId));
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
                                  (Current: {formatQty(stock.quantities || {}, qtyTypes)})
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
                  Quantities &amp; cost prices
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
                      <Label className="text-xs">Cost Price per {singularize(qt.label)}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={qtInputs[qt.id]?.unitCost ?? ""}
                        onChange={(e) => updateQtInput(qt.id, "unitCost", e.target.value)}
                        placeholder={`Cost per ${singularize(qt.label)}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label>Supplier</Label>
              <Input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Supplier name"
              />
            </div>

            {hasAnyQty && (
              <div className="rounded-2xl bg-surface-alt border border-hairline p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Cost:</span>
                  <span className="font-medium">{formatCurrency(totalCost, currency)}</span>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Running total:{" "}
                <span className="font-medium text-foreground">
                  {formatCurrency(totalCost, currency)}
                </span>
              </p>
              <Button type="submit" disabled={saving || !selectedItemId || !hasAnyQty}>
                <ArrowDownToLine className="mr-2 h-4 w-4" />
                {saving ? "Recording..." : "Record Stock In"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Stock In</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentStockIn.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <ArrowDownToLine className="mx-auto mb-2 h-8 w-8" />
              <p>No recent stock in.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Date</TableHead>
                    <TableHead className="text-center">Item</TableHead>
                    <TableHead className="text-center">Supplier</TableHead>
                    <TableHead className="text-center">Store</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentStockIn.map((si) => (
                    <TableRow key={si.id}>
                      <TableCell className="whitespace-nowrap text-center text-sm">
                        {new Date(si.date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words text-center text-sm font-medium">{si.itemName}</TableCell>
                      <TableCell className="whitespace-normal break-words text-center text-sm text-muted-foreground">{si.supplier}</TableCell>
                      <TableCell className="whitespace-normal break-words text-center text-sm">{getStoreName(si.storeId, stores)}</TableCell>
                      <TableCell className="whitespace-nowrap text-center text-sm tabular-nums">
                        {si.qty}
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