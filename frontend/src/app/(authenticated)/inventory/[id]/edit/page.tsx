"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Loader2, Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/user-error";
import { useInventoryStore } from "@/stores/inventory-store";
import type { ItemCategory, QuantityType } from "@/types";

const DEFAULT_QUANTITY_TYPES: QuantityType[] = [
  { id: "pcs", label: "Pieces", unit: "pcs", price: 0, isDefault: true, conversionFactor: 1 },
  { id: "ctn", label: "Carton", unit: "boxes", price: 0, isDefault: false, conversionFactor: 1 },
];

export default function EditItemPage() {
  const { id } = useParams<{ id: string }>();
  const { items, inventoryItems, fetchInventory, fetchItems, updateItem } = useInventoryStore();
  const [loading, setLoading] = useState(true);

  // URL id may be a CATALOG item id OR a legacy stock-row id — both must
  // resolve to the catalog item being edited (items-centric inventory list).
  const directItem = useMemo(() => inventoryItems.find((i) => i.id === id) ?? null, [inventoryItems, id]);
  const row = useMemo(() => items.find((i) => i.id === id) ?? null, [items, id]);
  const item = useMemo(
    () => directItem ?? (row ? inventoryItems.find((i) => i.id === row.itemId) ?? null : null),
    [inventoryItems, directItem, row]
  );

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchInventory(), fetchItems()]);
      setLoading(false);
    };
    loadData();
  }, [fetchInventory, fetchItems]);

  const [form, setForm] = useState({
    name: "",
    type: "",
    code: "",
    category: "OTHER",
    quantityTypes: DEFAULT_QUANTITY_TYPES.map(qt => ({ ...qt, id: crypto.randomUUID() })),
    thresholds: {} as Record<string, number>,
  });
  const [saving, setSaving] = useState(false);

  // Initialize form when the catalog item loads
  useEffect(() => {
    if (!item) return;

    // Initiating store: pricing is PER-STORE, so the form seeds from that
    // store's inventory row first (it carries the store's live prices),
    // falling back to the catalog copy (facility-wide default).
    const storeParam =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("store")
        : null;
    const scopedRow = storeParam
      ? items.find((r) => r.itemId === item.id && r.storeId === storeParam)
      : null;

    // Use quantityTypes if available, otherwise fall back to legacy fields
    let quantityTypes = scopedRow?.quantityTypes ?? item.quantityTypes;
    if (!quantityTypes || quantityTypes.length === 0) {
      quantityTypes = [
        { id: crypto.randomUUID(), label: "Pieces", unit: "pcs", price: item.unitPricePc ?? 0, isDefault: true, conversionFactor: 1 },
        { id: crypto.randomUUID(), label: "Carton", unit: "boxes", price: item.unitPriceCtn ?? 0, isDefault: false, conversionFactor: item.pcsPerCtn ?? 1 },
      ];
    } else {
      quantityTypes = quantityTypes.map(qt => ({ ...qt, id: qt.id || crypto.randomUUID() }));
    }

    // Seed thresholds: the initiating store's row copy first, then the
    // catalog copy (rows carry the 10-defaults from creation).
    const existingThresholds =
      scopedRow?.lowStockThresholds ?? item.lowStockThresholds ?? {};

    setForm({
      name: item.name,
      type: item.type,
      code: item.code ?? "",
      category: item.category,
      quantityTypes,
      thresholds: Object.fromEntries(
        quantityTypes.map(qt => [qt.id, existingThresholds[qt.id] ?? 0])
      ),
    });
  }, [item, items]);

  const updateField = (field: string, value: string | null) => {
    setForm((prev) => ({ ...prev, [field]: value ?? "" }));
  };

  const updateQuantityType = (index: number, field: keyof QuantityType, value: string | number | boolean) => {
    setForm((prev) => {
      const newQuantityTypes = [...prev.quantityTypes];
      newQuantityTypes[index] = { ...newQuantityTypes[index], [field]: value };
      return { ...prev, quantityTypes: newQuantityTypes };
    });
  };

  const addQuantityType = () => {
    setForm((prev) => ({
      ...prev,
      quantityTypes: [
        ...prev.quantityTypes,
        {
          id: crypto.randomUUID(),
          label: "",
          unit: "custom",
          customUnit: "",
          price: 0,
          isDefault: false,
          conversionFactor: 1,
        },
      ],
    }));
  };

  const removeQuantityType = (index: number) => {
    if (form.quantityTypes.length <= 1) {
      toast.error("At least one quantity type is required");
      return;
    }
    setForm((prev) => ({
      ...prev,
      quantityTypes: prev.quantityTypes.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;

    // Normalize quantity types: ensure a default exists (the first type is
    // the base unit, matching the Add page) and the default's conversion is 1.
    const hasDefault = form.quantityTypes.some(qt => qt.isDefault);
    // Omit blank cost prices so Firestore never receives an `undefined`
    // nested field value inside quantityTypes
    const quantityTypes = form.quantityTypes.map((qt, i) => {
      const isDefault = hasDefault ? qt.isDefault : i === 0;
      const { costPrice, ...rest } = qt;
      return {
        ...rest,
        isDefault,
        conversionFactor: isDefault ? 1 : qt.conversionFactor,
        ...(costPrice !== undefined && costPrice > 0 ? { costPrice } : {}),
      };
    });

    setSaving(true);
    try {
      // Use first quantity type as legacy fields for backward compatibility
      const defaultQtyType = quantityTypes.find(qt => qt.isDefault) || quantityTypes[0];
      const secondQtyType = quantityTypes.find(qt => !qt.isDefault) || quantityTypes[1];
      const lowStockThresholds = Object.fromEntries(
        quantityTypes.map(qt => [qt.id, form.thresholds[qt.id] ?? 0])
      );

      // Initiating store context: `?store=` from the inventory page (active
      // store filter) or notification bell, else the resolved stock row's own
      // store. Pricing/thresholds are written only to that store's inventory
      // doc; with no store context, only the catalog is repriced.
      const storeParam =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("store")
          : null;
      const scopedStoreId = storeParam ?? row?.storeId ?? undefined;

      await updateItem(item.id, {
        name: form.name.trim(),
        type: form.type,
        code: form.code || undefined,
        category: form.category as ItemCategory,
        unitPricePc: defaultQtyType.price,
        unitPriceCtn: secondQtyType?.price || 0,
        pcsPerCtn: secondQtyType?.conversionFactor || 1,
        lowStockThresholdPc: lowStockThresholds[defaultQtyType.id] ?? 0,
        lowStockThresholdCtn: secondQtyType ? lowStockThresholds[secondQtyType.id] ?? 0 : 0,
        quantityTypes,
        lowStockThresholds,
      }, { storeId: scopedStoreId });
      toast.success("Item updated successfully");
    } catch (error) {
      console.error("Failed to update item:", error);
      toast.error(toUserMessage(error, "Failed to update item. Please try again."));
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
        <p className="text-muted-foreground">This item does not exist.</p>
        <Link href="/inventory"><Button>Back to Inventory</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/inventory" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Inventory
        </Link>
        <p className="text-muted-foreground">Update details for "{item.name}".</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Item Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Item Name *</Label>
                <Input id="name" value={form.name} onChange={(e) => updateField("name", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type / Variant *</Label>
                <Input id="type" value={form.type} onChange={(e) => updateField("type", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code (Optional)</Label>
                <Input id="code" value={form.code} onChange={(e) => updateField("code", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Input id="category" value={form.category} onChange={(e) => updateField("category", e.target.value)} required />
              </div>

              {/* Quantity Types Builder */}
              <div className="space-y-4 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <Label>Quantity Types & Pricing *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addQuantityType}>
                    <Plus className="mr-1 h-4 w-4" /> Add Type
                  </Button>
                </div>
                <div className="space-y-3">
                  {form.quantityTypes.map((qtyType, index) => (
                    <div key={qtyType.id} className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30">
                      <GripVertical className="mt-1 h-5 w-5 text-muted-foreground cursor-grab" />
                      <div className="flex-1 space-y-2 grid gap-2 sm:grid-cols-5">
                        <div className="space-y-1">
                          <Label htmlFor={`qty-label-${index}`} className="text-xs">Label *</Label>
                          <Input
                            id={`qty-label-${index}`}
                            placeholder="e.g., Pieces, Box, Pack"
                            value={qtyType.label}
                            onChange={(e) => updateQuantityType(index, "label", e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`qty-unit-${index}`} className="text-xs">Unit *</Label>
                          <Select
                            value={qtyType.unit}
                            onValueChange={(value) => value && updateQuantityType(index, "unit", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                              <SelectItem value="boxes">Carton (boxes)</SelectItem>
                              <SelectItem value="meters">Meters</SelectItem>
                              <SelectItem value="kg">Kilograms</SelectItem>
                              <SelectItem value="liters">Liters</SelectItem>
                              <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {qtyType.unit === "custom" && (
                          <div className="space-y-1">
                            <Label htmlFor={`qty-custom-${index}`} className="text-xs">Custom Unit *</Label>
                            <Input
                              id={`qty-custom-${index}`}
                              placeholder="e.g., dozen, gross"
                              value={qtyType.customUnit || ""}
                              onChange={(e) => updateQuantityType(index, "customUnit", e.target.value)}
                            />
                          </div>
                        )}
                        {!qtyType.isDefault && (
                          <div className="space-y-1">
                            <Label htmlFor={`qty-conv-${index}`} className="text-xs">Pcs per {qtyType.label || "unit"} *</Label>
                            <Input
                              id={`qty-conv-${index}`}
                              type="number"
                              min={1}
                              step={1}
                              placeholder="e.g., 50"
                              value={qtyType.conversionFactor && qtyType.conversionFactor > 1 ? qtyType.conversionFactor : ""}
                              onChange={(e) => {
                                const val = e.target.value === "" ? 1 : Math.max(1, Math.floor(Number(e.target.value)));
                                updateQuantityType(index, "conversionFactor", val || 1);
                              }}
                              required
                            />
                          </div>
                        )}
                        <div className="space-y-1">
                          <Label htmlFor={`qty-price-${index}`} className="text-xs">Sale Price *</Label>
                          <Input
                            id={`qty-price-${index}`}
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="0.00"
                            value={qtyType.price}
                            onChange={(e) => updateQuantityType(index, "price", Number(e.target.value) || 0)}
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`qty-cost-${index}`} className="text-xs">Cost Price</Label>
                          <Input
                            id={`qty-cost-${index}`}
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="0.00"
                            value={qtyType.costPrice ? qtyType.costPrice : ""}
                            onChange={(e) => updateQuantityType(index, "costPrice", Number(e.target.value) || 0)}
                          />
                        </div>
                        {form.quantityTypes.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => removeQuantityType(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  The first quantity type is the base unit. Add additional types for different packaging (e.g., Box of 12, Pack of 6).
                </p>
              </div>

              {/* Low Stock Thresholds */}
              <div className="space-y-3 sm:col-span-2">
                <Label>Low Stock Thresholds</Label>
                <div className="grid gap-3 sm:grid-cols-3">
                  {form.quantityTypes.map((qtyType, index) => (
                    <div key={qtyType.id} className="space-y-1">
                      <Label htmlFor={`qty-threshold-${index}`} className="text-xs">
                        {qtyType.label || `Type ${index + 1}`}
                      </Label>
                      <Input
                        id={`qty-threshold-${index}`}
                        type="number"
                        min={0}
                        step={1}
                        placeholder="e.g., 10"
                        value={form.thresholds[qtyType.id] ? form.thresholds[qtyType.id] : ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? 0 : Number(e.target.value);
                          setForm((prev) => ({
                            ...prev,
                            thresholds: { ...prev.thresholds, [qtyType.id]: val || 0 },
                          }));
                        }}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Get a low stock alert when available stock of a type falls to this level or below. Leave 0 (or empty) to disable alerts for that type.
                </p>
              </div>

            </div>

            <div className="flex justify-end gap-3">
              <Link href="/inventory"><Button variant="outline" type="button">Cancel</Button></Link>
              <Button type="submit" disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
