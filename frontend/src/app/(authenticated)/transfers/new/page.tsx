"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Save, Loader2 } from "lucide-react";
import { useInventoryStore } from "@/stores/inventory-store";
import { useAuthStore } from "@/stores/auth-store";
import { Item, Store, QuantityType } from "@/types";
import { getQuantityTypeLabel, mergeQuantityTypes } from "@/lib/qty-label";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/user-error";

type TransferRow = { 
  itemId: string; 
  itemName: string; 
  itemType: string; 
  quantities: Record<string, number>;
};

export default function NewTransferPage() {
  const { items, inventoryItems, stores, fetchInventory, fetchItems, fetchStores, createTransfer, isLoadingItems, isLoadingStores } = useInventoryStore();
  const { user } = useAuthStore();
  const [fromStore, setFromStore] = useState("");
  const [toStore, setToStore] = useState("");
  const [rows, setRows] = useState<TransferRow[]>([{ itemId: "", itemName: "", itemType: "", quantities: {} }]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Fetch data on mount
  useEffect(() => {
    if (user?.facilityId) {
      // Inventory rows (per store) drive the picker — transfers move existing stock
      fetchInventory();
      // Catalog quantity types back label resolution when row copies drift
      fetchItems();
      fetchStores();
    }
    setLoading(false);
  }, [user?.facilityId, fetchInventory, fetchStores]);

  // Set default stores when loaded
  useEffect(() => {
    if (stores.length >= 2) {
      if (!fromStore) setFromStore(stores[0].id);
      if (!toStore) setToStore(stores[1].id);
    }
  }, [stores, fromStore, toStore]);

  const handleFromStoreChange = (val: string) => {
    setFromStore(val);
    if (val === toStore) setError("Cannot transfer from same store to same store.");
    else setError("");
  };

  const handleToStoreChange = (val: string) => {
    setToStore(val);
    if (val === fromStore) setError("Cannot transfer from same store to same store.");
    else setError("");
  };

  const addRow = () => setRows((p) => [...p, { itemId: "", itemName: "", itemType: "", quantities: {} }]);
  const removeRow = (i: number) => setRows((p) => p.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: keyof TransferRow, value: string | Record<string, number>) =>
    setRows((p) => { const n = [...p]; n[i] = { ...n[i], [field]: value }; return n; });
  
  const updateRowQuantity = (i: number, qtyTypeId: string, value: number) =>
    setRows((p) => { 
      const n = [...p]; 
      n[i] = { 
        ...n[i], 
        quantities: { ...n[i].quantities, [qtyTypeId]: value } 
      }; 
      return n; 
    });

  // Legacy fallback quantity types for items that don't have quantityTypes set
const LEGACY_QTS: QuantityType[] = [
  { id: "pcs", label: "Pieces", unit: "pcs", price: 0, isDefault: true, conversionFactor: 1 },
  { id: "ctn", label: "Carton", unit: "boxes", price: 0, isDefault: false, conversionFactor: 1 },
];

function getItemQuantityTypes(item: { itemId: string; itemName: string; itemType: string; quantityTypes?: QuantityType[]; unitPricePc?: number; unitPriceCtn?: number; pcsPerCtn?: number; quantities?: Record<string, number> } | undefined): QuantityType[] {
  if (!item) return LEGACY_QTS;
  if (item.quantityTypes && item.quantityTypes.length > 0) return item.quantityTypes;
  return [
    { id: "pcs", label: "Pieces", unit: "pcs", price: item.unitPricePc || 0, isDefault: true, conversionFactor: 1 },
    { id: "ctn", label: "Carton", unit: "boxes", price: item.unitPriceCtn || 0, isDefault: false, conversionFactor: item.pcsPerCtn || 1 },
  ];
}

// Available stock of an item in the ORIGIN store (transfers move existing stock only).
const availableFor = (itemId: string) =>
  items.find((i) => i.itemId === itemId && i.storeId === fromStore);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fromStore === toStore) { setError("Cannot transfer from same store to same store."); return; }
    if (!user) return;
    
    setSaving(true);
    try {
      // Filter rows that have itemId and at least one quantity > 0
      const validRows = rows.filter(r => 
        r.itemId && Object.values(r.quantities).some(q => q > 0)
      );
      if (validRows.length === 0) {
        setError("Please add at least one item with quantity.");
        setSaving(false);
        return;
      }

      // Validate requested quantities against available origin-store stock
      const requested = new Map<string, { quantities: Record<string, number>; name: string }>();
      for (const r of validRows) {
        const acc = requested.get(r.itemId) || { quantities: {}, name: r.itemName };
        for (const [qtyTypeId, qty] of Object.entries(r.quantities)) {
          if (qty > 0) {
            acc.quantities[qtyTypeId] = (acc.quantities[qtyTypeId] || 0) + qty;
          }
        }
        requested.set(r.itemId, acc);
      }
      const shortages = [...requested.entries()].flatMap(([itemId, req]) => {
        const avail = availableFor(itemId);
        if (!avail) return [`${req.name}: no stock in origin store`];
        
        const availQuantities = avail.quantities || {};
        const qts = mergeQuantityTypes(
          inventoryItems.find((c) => c.id === itemId)?.quantityTypes,
          getItemQuantityTypes(
            items.find((i) => i.itemId === itemId && i.storeId === fromStore)
          )
        );
        for (const [qtyTypeId, qty] of Object.entries(req.quantities)) {
          const available = availQuantities[qtyTypeId] || 0;
          if (qty > available) {
            const label = getQuantityTypeLabel(qts, qtyTypeId);
            return [`${req.name}: requested ${qty} ${label}, available ${available} ${label}`];
          }
        }
        return [];
      });
      if (shortages.length > 0) {
        setError(`Insufficient origin stock — ${shortages.join("; ")}`);
        setSaving(false);
        return;
      }

      await createTransfer(
        fromStore,
        toStore,
        validRows.map(r => ({
          itemId: r.itemId,
          itemName: r.itemName,
          itemType: r.itemType,
          quantities: r.quantities,
        })),
        notes,
        user.id,
        user.name
      );
      toast.success("Transfer requested successfully");
      setRows([{ itemId: "", itemName: "", itemType: "", quantities: {} }]);
      setNotes("");
    } catch (error) {
      console.error("Failed to create transfer:", error);
      toast.error(toUserMessage(error, "Failed to create transfer. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/transfers" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Transfers
        </Link>
        <p className="text-muted-foreground">Request a stock transfer between stores.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transfer Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>From Store *</Label>
                <select value={fromStore} onChange={(e) => handleFromStoreChange(e.target.value)} className="w-full h-9 rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40">
                  {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>To Store *</Label>
                <select value={toStore} onChange={(e) => handleToStoreChange(e.target.value)} className="w-full h-9 rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40">
                  {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div>
              <Label>Items</Label>
              <div className="mt-2 space-y-2">
                {rows.map((row, idx) => {
                    const selectedItem = row.itemId ? items.find((i) => i.itemId === row.itemId && i.storeId === fromStore) : undefined;
                    const quantityTypes = mergeQuantityTypes(
                      inventoryItems.find((c) => c.id === row.itemId)?.quantityTypes,
                      getItemQuantityTypes(selectedItem)
                    );

                    return (
                      <div key={idx} className="space-y-2">
                        <select value={row.itemId} onChange={(e) => {
                          const item = items.find((i) => i.itemId === e.target.value && i.storeId === fromStore);
                          updateRow(idx, "itemId", e.target.value);
                          if (item) {
                            updateRow(idx, "itemName", item.itemName);
                            updateRow(idx, "itemType", item.itemType);
                            updateRow(idx, "quantities", {});
                          }
                        }} className="w-full h-9 rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40">
                          <option value="">Select item...</option>
                          {items
                            .filter((i) => i.storeId === fromStore)
                            .map((i) => {
                              // Resolve quantity types per item — the row-level
                              // fallback above can't resolve keys for a fresh row.
                              const optQts = mergeQuantityTypes(
                                inventoryItems.find((c) => c.id === i.itemId)?.quantityTypes,
                                getItemQuantityTypes(i)
                              );
                              const optQty = Object.entries(i.quantities || {})
                                .map(([k, v]) => `${v} ${getQuantityTypeLabel(optQts, k)}`)
                                .join(" / ");
                              return (
                                <option key={i.id} value={i.itemId}>
                                  {i.itemName} ({i.itemType}) — {optQty}
                                </option>
                              );
                            })}
                        </select>
                        {selectedItem && (
                          <div className="flex flex-wrap gap-2">
                            {quantityTypes.map((qt) => (
                              <div key={qt.id} className="flex items-center gap-1">
                                <Label className="text-xs text-muted-foreground whitespace-nowrap">{qt.label}</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={row.quantities[qt.id] || ""}
                                  onChange={(e) => updateRowQuantity(idx, qt.id, parseInt(e.target.value) || 0)}
                                  placeholder={qt.id.toUpperCase()}
                                  className="w-20"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                        {rows.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(idx)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
              </div>
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addRow}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add Item
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Optional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            <div className="flex justify-end gap-3">
              <Link href="/transfers"><Button variant="outline" type="button">Cancel</Button></Link>
              <Button type="submit" disabled={saving || !!error}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Requesting..." : "Request Transfer"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
