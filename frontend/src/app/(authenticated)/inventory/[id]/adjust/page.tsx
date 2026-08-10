"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Save } from "lucide-react";
import { MOCK_INVENTORY, MOCK_ITEMS, getStoreName } from "@/lib/mock-data";
import { adjustmentSchema, flattenValidationErrors, type ValidationErrors } from "@/lib/validation";

export default function AdjustStockPage() {
  const { id } = useParams<{ id: string }>();
  const row = MOCK_INVENTORY.find((i) => i.id === id);
  const item = row ? MOCK_ITEMS.find((i) => i.id === row.id) : undefined;

  const [adjPc, setAdjPc] = useState(0);
  const [adjCtn, setAdjCtn] = useState(0);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = adjustmentSchema.safeParse({ adjPc, adjCtn, reason, currentPc: row?.qtyPc ?? 0, currentCtn: row?.qtyCtn ?? 0 });
    if (!result.success) {
      setErrors(flattenValidationErrors(result.error));
      return;
    }
    setErrors({});
    setSaving(true);
    setTimeout(() => {
      alert("Stock adjustment would be saved (dev mode)");
      setSaving(false);
    }, 500);
  };

  if (!row || !item) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Item Not Found</h1>
        <Link href="/inventory"><Button>Back to Inventory</Button></Link>
      </div>
    );
  }

  const newQtyPc = row.qtyPc + adjPc;
  const newQtyCtn = row.qtyCtn + adjCtn;

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ label: "Inventory", href: "/inventory" }, { label: "Adjust Stock" }]} />
        <h1 className="text-heading-sm font-semibold tracking-heading-sm">Adjust Stock</h1>
        <p className="text-body text-mid-gray">Manually correct stock levels for {row.name} ({row.type}).</p>
      </div>

      {/* Current balance */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-muted-foreground">Store</p>
              <p className="text-sm font-medium">{getStoreName(row.storeId)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Stock Year</p>
              <p className="text-sm font-medium">{row.stockYear}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Current PC</p>
              <p className="text-lg font-bold">{row.qtyPc}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Current CTN</p>
              <p className="text-lg font-bold">{row.qtyCtn}</p>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="adjPc">Adjustment (PC)</Label>
                <Input
                  id="adjPc"
                  type="number"
                  value={adjPc}
                  onChange={(e) => setAdjPc(parseInt(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">
                  Positive = add, Negative = remove
                </p>
                {errors.adjPc && <p className="text-sm text-destructive" role="alert">{errors.adjPc}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjCtn">Adjustment (CTN)</Label>
                <Input
                  id="adjCtn"
                  type="number"
                  value={adjCtn}
                  onChange={(e) => setAdjCtn(parseInt(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">
                  Positive = add, Negative = remove
                </p>
                {errors.adjCtn && <p className="text-sm text-destructive" role="alert">{errors.adjCtn}</p>}
              </div>
            </div>

            {/* New balance preview */}
            <div className="rounded-2xl bg-surface-alt p-4">
              <p className="text-sm font-medium mb-2">New Balance Preview</p>
              <div className="flex gap-6">
                <div>
                  <span className="text-xs text-muted-foreground">PC: </span>
                  <span className={`font-bold ${newQtyPc < 0 ? "text-destructive" : ""}`}>
                    {newQtyPc}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">CTN: </span>
                  <span className={`font-bold ${newQtyCtn < 0 ? "text-destructive" : ""}`}>
                    {newQtyCtn}
                  </span>
                </div>
              </div>
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
              {errors.reason && <p className="text-sm text-destructive" role="alert">{errors.reason}</p>}
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
