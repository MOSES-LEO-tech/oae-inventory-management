"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save } from "lucide-react";

export default function AddItemPage() {
  const [form, setForm] = useState({
    name: "",
    type: "",
    code: "",
    category: "2026",
    unitPricePc: "",
    unitPriceCtn: "",
    lowStockThresholdPc: "",
    lowStockThresholdCtn: "",
  });
  const [saving, setSaving] = useState(false);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      alert("Item would be saved to Firestore (dev mode)");
      setSaving(false);
    }, 500);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/inventory" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Inventory
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Add New Item</h1>
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
                <Label htmlFor="category">Stock Year *</Label>
                <select
                  id="category"
                  value={form.category}
                  onChange={(e) => updateField("category", e.target.value)}
                  className="w-full h-9 rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40"
                >
                  <option value="OLD_STOCK">OLD STOCK</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitPricePc">Unit Price (PC) *</Label>
                <Input
                  id="unitPricePc"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.unitPricePc}
                  onChange={(e) => updateField("unitPricePc", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitPriceCtn">Unit Price (CTN) *</Label>
                <Input
                  id="unitPriceCtn"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.unitPriceCtn}
                  onChange={(e) => updateField("unitPriceCtn", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lowStockPc">Low Stock Threshold (PC)</Label>
                <Input
                  id="lowStockPc"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.lowStockThresholdPc}
                  onChange={(e) => updateField("lowStockThresholdPc", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lowStockCtn">Low Stock Threshold (CTN)</Label>
                <Input
                  id="lowStockCtn"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.lowStockThresholdCtn}
                  onChange={(e) => updateField("lowStockThresholdCtn", e.target.value)}
                />
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
