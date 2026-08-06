"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";
import { MOCK_INVENTORY, MOCK_ITEMS, formatCurrency, getStoreName } from "@/lib/mock-data";

export default function AdjustStockPage() {
  const { id } = useParams<{ id: string }>();
  const row = MOCK_INVENTORY.find((i) => i.id === id);
  const item = row ? MOCK_ITEMS.find((i) => i.id === row.id) : undefined;

  const [adjPc, setAdjPc] = useState(0);
  const [adjCtn, setAdjCtn] = useState(0);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
        <Link href="/inventory" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Inventory
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Adjust Stock</h1>
        <p className="text-muted-foreground">Manually correct stock levels for "{row.name}" ({row.type}).</p>
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
