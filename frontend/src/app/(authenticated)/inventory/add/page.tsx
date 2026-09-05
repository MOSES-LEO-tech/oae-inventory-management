"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/user-error";
import { useAuthStore } from "@/stores/auth-store";
import { useInventoryStore } from "@/stores/inventory-store";
import type { ItemCategory, QuantityType } from "@/types";

const DEFAULT_QUANTITY_TYPES: QuantityType[] = [
  { id: "pcs", label: "Pieces", unit: "pcs", price: 0, isDefault: true, conversionFactor: 1 },
];

export default function AddItemPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    type: "",
    code: "",
    category: "OTHER",
    quantityTypes: DEFAULT_QUANTITY_TYPES.map(qt => ({ ...qt, id: crypto.randomUUID() })),
    thresholds: {} as Record<string, number>,
  });
  const [saving, setSaving] = useState(false);
  const [userLoaded, setUserLoaded] = useState(false);

  const updateField = (field: string, value: string | null) => {
    setForm((prev) => ({ ...prev, [field]: value ?? "" }));
  };

  const updateQuantityType = (index: number, field: keyof QuantityType, value: string | number | boolean) => {
    setForm((prev) => {
      const newQuantityTypes = [...prev.quantityTypes];
      newQuantityTypes[index] = { ...newQuantityTypes[index], [field]: value };
      // Auto-set first as default
      if (field === "isDefault" && value === true) {
        newQuantityTypes.forEach((qt, i) => {
          qt.isDefault = i === index;
          if (i === index) qt.conversionFactor = 1;
        });
      }
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
          unit: "pcs",
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

  // Wait for auth store to hydrate
  useEffect(() => {
    const unsubscribe = useAuthStore.subscribe((state) => {
      if (state.user) setUserLoaded(true);
    });
    if (useAuthStore.getState().user) setUserLoaded(true);
    return unsubscribe;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { user } = useAuthStore.getState();
    if (!userLoaded || !user?.facilityId) {
      toast.error("Your session has no facility. Please sign in again.");
      return;
    }

    // Validate quantity types
    const hasDefault = form.quantityTypes.some(qt => qt.isDefault);
    if (!hasDefault) {
      toast.error("At least one quantity type must be marked as default");
      return;
    }

    // Set conversion factor for default to 1; omit blank cost prices so
    // Firestore never receives an `undefined` nested field value
    const quantityTypes = form.quantityTypes.map(qt => {
      const { costPrice, ...rest } = qt;
      return {
        ...rest,
        conversionFactor: qt.isDefault ? 1 : qt.conversionFactor,
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

      await useInventoryStore.getState().addItem({
        facilityId: user.facilityId,
        name: form.name.trim(),
        type: form.type.trim(),
        code: form.code.trim() || undefined,
        category: form.category as ItemCategory,
        unitPricePc: defaultQtyType.price,
        unitPriceCtn: secondQtyType?.price || 0,
        pcsPerCtn: secondQtyType?.conversionFactor || 1,
        lowStockThresholdPc: lowStockThresholds[defaultQtyType.id] ?? 0,
        lowStockThresholdCtn: secondQtyType ? lowStockThresholds[secondQtyType.id] ?? 0 : 0,
        quantityTypes,
        lowStockThresholds,
        createdBy: user.id,
      });
      toast.success("Item added to catalog");
      router.push("/inventory");
    } catch (err) {
      console.error("Failed to add item:", err);
      toast.error(toUserMessage(err, "Failed to save item"));
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/inventory" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Inventory
        </Link>
        <p className="text-muted-foreground">Add a new item to the inventory catalog.</p>
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
                <Input
                  id="name"
                  placeholder="e.g., Ball point pens, Dolphin"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type / Variant *</Label>
                <Input
                  id="type"
                  placeholder="e.g., Blue, 12mm, 2Q"
                  value={form.type}
                  onChange={(e) => updateField("type", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code (Optional)</Label>
                <Input
                  id="code"
                  placeholder="e.g., 60x90"
                  value={form.code}
                  onChange={(e) => updateField("code", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Input
                  id="category"
                  placeholder="e.g., Pens, Paper, Paints"
                  value={form.category === "OTHER" ? "" : form.category}
                  onChange={(e) => updateField("category", e.target.value)}
                  required
                />
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
                            value={qtyType.price === 0 ? "" : qtyType.price}
                            onChange={(e) => {
                              const val = e.target.value === "" ? 0 : Number(e.target.value);
                              updateQuantityType(index, "price", val || 0);
                            }}
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
                            onChange={(e) => {
                              const val = e.target.value === "" ? 0 : Number(e.target.value);
                              updateQuantityType(index, "costPrice", val || 0);
                            }}
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
              <Link href="/inventory">
                <Button variant="outline" type="button">Cancel</Button>
              </Link>
              <Button type="submit" disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Item"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
