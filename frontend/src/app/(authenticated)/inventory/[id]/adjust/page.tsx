"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Loader2, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/user-error";
import { useInventoryStore } from "@/stores/inventory-store";
import { useAuthStore } from "@/stores/auth-store";
import { Store } from "@/types";
import { formatQuantities, mergeQuantityTypes } from "@/lib/qty-label";

function getStoreName(storeId: string, stores: Store[]): string {
  const store = stores.find((s) => s.id === storeId);
  return store?.name || storeId;
}

export default function AdjustStockPage() {
  const { id } = useParams<{ id: string }>();
  const { items, inventoryItems, stores, fetchInventory, fetchItems, adjustStock } = useInventoryStore();
  const { user } = useAuthStore();
  // URL id is the INVENTORY row doc id — resolve against the inventory slice
  const item = useMemo(() => items.find((i) => i.id === id) ?? null, [items, id]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchInventory(), fetchItems()]);
      setLoading(false);
    };
    loadData();
  }, [id, fetchInventory]);

  // Dynamic adjustment state, keyed by quantity type id
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !user) return;
    
    // Filter out zero adjustments
    const nonZeroAdjustments = Object.fromEntries(
      Object.entries(adjustments).filter(([, v]) => v !== 0)
    );
    if (Object.keys(nonZeroAdjustments).length === 0) {
      toast.error("Please enter at least one adjustment");
      return;
    }

    setSaving(true);
    try {
      await adjustStock(
        item.id,
        nonZeroAdjustments,
        reason,
        user.id,
        user.name
      );
      toast.success("Stock adjustment saved successfully");
      setAdjustments({});
      setReason("");
    } catch (error) {
      console.error("Failed to save adjustment:", error);
      toast.error(toUserMessage(error, "Failed to save adjustment. Please try again."));
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

  if (!item) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Item Not Found</h1>
        <Link href="/inventory"><Button>Back to Inventory</Button></Link>
      </div>
    );
  }

  const quantities = item.quantities || {};
  // Merge catalog + row copies so every recorded quantity key resolves and
  // stays adjustable — the two copies can drift apart.
  const quantityTypes = mergeQuantityTypes(
    inventoryItems.find((c) => c.id === item.itemId)?.quantityTypes,
    item.quantityTypes
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/inventory" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Inventory
        </Link>
        <p className="text-muted-foreground">Manually correct stock levels for "{item.itemName}" ({item.itemType}).</p>
      </div>

      {/* Current balance */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-muted-foreground">Item Code</p>
              <p className="text-sm font-medium">{item.itemCode || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Store</p>
              <p className="text-sm font-medium">{getStoreName(item.storeId, stores)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Current Stock</p>
              <p className="text-sm font-bold">
                {formatQuantities(quantities, quantityTypes) || "0"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Low Stock Thresholds</p>
              <p className="text-sm font-bold">
                {formatQuantities(item.lowStockThresholds, quantityTypes) || "N/A"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Adjustment form */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Adjustment</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <p className="text-sm font-medium">Adjust quantities by quantity type</p>
              {quantityTypes.length > 0 ? (
                quantityTypes.map((qt) => {
                  const currentQty = quantities[qt.id] || 0;
                  const adjQty = adjustments[qt.id] || 0;
                  const newQty = currentQty + adjQty;
                  return (
                    <div key={qt.id} className="rounded-2xl border border-hairline bg-canvas/40 p-3 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] items-center">
                      <div className="space-y-1">
                        {/* unit can be the literal enum "custom" (real name lives in
                            customUnit / label) — never render the word "custom" */}
                        <Label className="text-xs">{qt.unit === "custom" ? qt.label : `${qt.label} (${qt.unit})`}</Label>
                        <p className="text-sm">Current: <span className="font-medium">{currentQty}</span></p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="icon" onClick={() => setAdjustments(prev => ({ ...prev, [qt.id]: (prev[qt.id] || 0) - 1 }))}><Minus className="h-4 w-4" /></Button>
                        <Input
                          type="number"
                          value={adjQty}
                          onChange={(e) => setAdjustments(prev => ({ ...prev, [qt.id]: parseInt(e.target.value) || 0 }))}
                          className="w-20 text-center"
                        />
                        <Button type="button" variant="outline" size="icon" onClick={() => setAdjustments(prev => ({ ...prev, [qt.id]: (prev[qt.id] || 0) + 1 }))}><Plus className="h-4 w-4" /></Button>
                      </div>
                      <div className="text-sm">
                        <span className="text-xs text-muted-foreground">New: </span>
                        <span className={`font-bold ${newQty < 0 ? "text-destructive" : ""}`}>
                          {newQty}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Threshold: {item.lowStockThresholds?.[qt.id] || 0}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">No quantity types defined for this item.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Adjustment *</Label>
              <Textarea
                id="reason"
                placeholder="e.g., Found damaged stock, Stock count correction"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Link href="/inventory"><Button variant="outline" type="button">Cancel</Button></Link>
              <Button type="submit" disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Adjustment"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}