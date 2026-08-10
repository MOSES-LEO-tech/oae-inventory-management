"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
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
import { ArrowUpFromLine, AlertCircle } from "lucide-react";
import { MOCK_ITEMS, MOCK_SALES, MOCK_STORES, MOCK_INVENTORY, formatCurrency, getStoreName } from "@/lib/mock-data";
import { flattenValidationErrors, stockOutSchema, type ValidationErrors } from "@/lib/validation";

export default function StockOutPage() {
  const [selectedItemId, setSelectedItemId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [qtyPc, setQtyPc] = useState("");
  const [qtyCtn, setQtyCtn] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [storeId, setStoreId] = useState("main-stores");
  const [saving, setSaving] = useState(false);
  const [warning, setWarning] = useState("");
  const [errors, setErrors] = useState<ValidationErrors>({});

  const filteredItems = useMemo(() => {
    if (!itemSearch) return MOCK_ITEMS.slice(0, 10);
    const q = itemSearch.toLowerCase();
    return MOCK_ITEMS.filter(
      (i) => i.name.toLowerCase().includes(q) || i.type.toLowerCase().includes(q)
    );
  }, [itemSearch]);

  const stock = MOCK_INVENTORY.find(
    (i) => i.id === selectedItemId && i.storeId === storeId
  );

  const handleItemSelect = (item: typeof MOCK_ITEMS[0]) => {
    setSelectedItemId(item.id);
    setItemSearch(item.name + " " + item.type);
    setUnitPrice(item.unitPricePc.toString());
    setQtyPc("");
    setQtyCtn("");
    setWarning("");
  };

  const handleQtyChange = (field: "pc" | "ctn", value: string) => {
    if (field === "pc") setQtyPc(value);
    else setQtyCtn(value);

    const pc = field === "pc" ? parseInt(value) || 0 : parseInt(qtyPc) || 0;
    const ctn = field === "ctn" ? parseInt(value) || 0 : parseInt(qtyCtn) || 0;

    if (stock) {
      if (pc > stock.qtyPc || ctn > stock.qtyCtn) {
        setWarning(`Insufficient stock. Available: ${stock.qtyPc}PC / ${stock.qtyCtn}CTN`);
      } else {
        setWarning("");
      }
    }
  };

  const todaySales = MOCK_SALES.filter((s) =>
    s.createdAt.startsWith(new Date().toISOString().split("T")[0])
  );

  const totalTodayRevenue = todaySales.reduce((s, sale) => s + sale.totalAmount, 0);
  const totalTodayItems = todaySales.reduce(
    (s, sale) => s + sale.items.reduce((si, item) => si + item.qtyPc, 0),
    0
  );
  const avgSale = todaySales.length > 0 ? totalTodayRevenue / todaySales.length : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = stockOutSchema.safeParse({ selectedItemId, itemId: selectedItemId, qtyPc, qtyCtn, unitPrice, storeId });
    if (!result.success) {
      setErrors(flattenValidationErrors(result.error));
      return;
    }
    setErrors({});
    setSaving(true);
    setTimeout(() => {
      alert("Sale recorded (dev mode)");
      setSaving(false);
      setQtyPc("");
      setQtyCtn("");
    }, 500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading-sm font-semibold tracking-heading-sm">Stock Out</h1>
        <p className="text-muted-foreground">Record sales and deduct stock.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Record Sale</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stock-out-item-search">Select Item *</Label>
              <div className="rounded-2xl border border-hairline overflow-hidden">
                <Input
                  id="stock-out-item-search"
                  aria-label="Search items"
                  placeholder="Search item…"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="border-0 rounded-none"
                />
                <div className="max-h-40 overflow-y-auto border-t border-hairline">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleItemSelect(item)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors ${
                      selectedItemId === item.id ? "bg-accent" : ""
                    }`}
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="ml-2 text-muted-foreground">{item.type}</span>
                    {stock && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (Stock: {stock.qtyPc}PC / {stock.qtyCtn}CTN)
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {errors.itemId && <p className="text-sm text-destructive" role="alert">{errors.itemId}</p>}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="stock-out-qty-pc">Qty (PC) *</Label>
                <Input
                  type="number"
                  id="stock-out-qty-pc"
                  min={0}
                  value={qtyPc}
                  onChange={(e) => handleQtyChange("pc", e.target.value)}
                  placeholder="0"
                  required
                />
                {errors.qtyPc && <p className="text-sm text-destructive" role="alert">{errors.qtyPc}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock-out-qty-ctn">Qty (CTN) *</Label>
                <Input
                  type="number"
                  id="stock-out-qty-ctn"
                  min={0}
                  value={qtyCtn}
                  onChange={(e) => handleQtyChange("ctn", e.target.value)}
                  placeholder="0"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock-out-unit-price">Unit Price (UGX)</Label>
                <Input
                  type="number"
                  id="stock-out-unit-price"
                  min={0}
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="Auto-filled"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock-out-store">Store</Label>
              <select
                value={storeId}
                id="stock-out-store"
                onChange={(e) => setStoreId(e.target.value)}
                className="w-full h-9 rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40"
              >
                {MOCK_STORES.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {warning && (
              <div className="flex items-center gap-2 rounded-2xl bg-surface-alt border border-hairline p-3 text-sm text-ink" role="alert" aria-live="polite">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p>{warning}</p>
              </div>
            )}

            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Running total:{" "}
                <span className="font-medium text-foreground">
                  {formatCurrency((parseInt(qtyPc) || 0) * (parseInt(unitPrice) || 0))}
                </span>
              </p>
              <Button type="submit" disabled={saving || !selectedItemId || !!warning}>
                <ArrowUpFromLine className="mr-2 h-4 w-4" />
                {saving ? "Recording..." : "Record Sale"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Today's Sales Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Revenue</p>
            <p className="tabular-nums text-2xl font-bold">{formatCurrency(totalTodayRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Items Sold</p>
            <p className="tabular-nums text-2xl font-bold">{totalTodayItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Average Sale</p>
            <p className="tabular-nums text-2xl font-bold">{formatCurrency(avgSale)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today&rsquo;s Sales</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {todaySales.length === 0 ? (
            <EmptyState
              icon={<ArrowUpFromLine className="h-10 w-10" />}
              title="No sales today"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todaySales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>
                      {new Date(sale.createdAt).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      {sale.items.map((item) => item.itemName).join(", ")}
                    </TableCell>
                    <TableCell>{getStoreName(sale.storeId)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {sale.items.reduce((s, i) => s + i.qtyPc, 0)}PC
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(sale.totalAmount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
