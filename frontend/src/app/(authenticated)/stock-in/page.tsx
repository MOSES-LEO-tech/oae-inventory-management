"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Save, ArrowDownToLine } from "lucide-react";
import { MOCK_ITEMS, MOCK_MOVEMENTS, MOCK_STORES, getStoreName } from "@/lib/mock-data";
import { flattenValidationErrors, stockInSchema, type ValidationErrors } from "@/lib/validation";

type BulkRow = { itemId: string; qtyPc: string; qtyCtn: string; storeId: string };

export default function StockInPage() {
  // Single entry
  const [singleItemId, setSingleItemId] = useState("");
  const [singleQtyPc, setSingleQtyPc] = useState("");
  const [singleQtyCtn, setSingleQtyCtn] = useState("");
  const [singleStore, setSingleStore] = useState("main-stores");
  const [singleNotes, setSingleNotes] = useState("");
  const [singleSaving, setSingleSaving] = useState(false);

  // Bulk entry
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([
    { itemId: "", qtyPc: "", qtyCtn: "", storeId: "main-stores" },
  ]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [singleErrors, setSingleErrors] = useState<ValidationErrors>({});
  const [bulkError, setBulkError] = useState("");

  // Search
  const [itemSearch, setItemSearch] = useState("");
  const filteredItems = useMemo(() => {
    if (!itemSearch) return MOCK_ITEMS.slice(0, 10);
    const q = itemSearch.toLowerCase();
    return MOCK_ITEMS.filter(
      (i) => i.name.toLowerCase().includes(q) || i.type.toLowerCase().includes(q)
    );
  }, [itemSearch]);

  const todayMovements = MOCK_MOVEMENTS.filter(
    (m) => m.type === "IN" && m.createdAt.startsWith(new Date().toISOString().split("T")[0])
  );

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = stockInSchema.safeParse({ itemId: singleItemId, qtyPc: singleQtyPc, qtyCtn: singleQtyCtn, storeId: singleStore });
    if (!result.success) {
      setSingleErrors(flattenValidationErrors(result.error));
      return;
    }
    setSingleErrors({});
    setSingleSaving(true);
    setTimeout(() => {
      alert("Stock in recorded (dev mode)");
      setSingleSaving(false);
      setSingleQtyPc("");
      setSingleQtyCtn("");
      setSingleNotes("");
    }, 500);
  };

  const addBulkRow = () => {
    setBulkRows((prev) => [
      ...prev,
      { itemId: "", qtyPc: "", qtyCtn: "", storeId: "main-stores" },
    ]);
  };

  const removeBulkRow = (index: number) => {
    setBulkRows((prev) => prev.filter((_, i) => i !== index));
  };

  const updateBulkRow = (index: number, field: keyof BulkRow, value: string) => {
    setBulkRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const invalidRow = bulkRows.findIndex((row) => !stockInSchema.safeParse(row).success);
    if (invalidRow !== -1) {
      setBulkError(`Complete item ${invalidRow + 1} with an item and a positive quantity.`);
      return;
    }
    setBulkError("");
    setBulkSaving(true);
    setTimeout(() => {
      alert(`${bulkRows.length} items recorded (dev mode)`);
      setBulkSaving(false);
    }, 500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading-sm font-semibold tracking-heading-sm">Stock In</h1>
        <p className="text-muted-foreground">Record incoming stock purchases.</p>
      </div>

      <Tabs defaultValue="single">
        <TabsList>
          <TabsTrigger value="single">Single Entry</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Entry</TabsTrigger>
        </TabsList>

        {/* Single Entry */}
        <TabsContent value="single" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Record Incoming Stock</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSingleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="stock-in-item-search">Select Item *</Label>
                  <div className="rounded-2xl border border-hairline overflow-hidden">
                    <Input
                      id="stock-in-item-search"
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
                        onClick={() => {
                          setSingleItemId(item.id);
                          setItemSearch(item.name + " " + item.type);
                        }}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors ${
                          singleItemId === item.id ? "bg-accent" : ""
                        }`}
                      >
                        <span className="font-medium">{item.name}</span>
                        <span className="ml-2 text-muted-foreground">{item.type}</span>
                      </button>
                    ))}
                  </div>
                  </div>
                  {singleErrors.itemId && <p className="text-sm text-destructive" role="alert">{singleErrors.itemId}</p>}
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="stock-in-qty-pc">Qty (PC)</Label>
                    <Input
                      type="number"
                      id="stock-in-qty-pc"
                      min={0}
                      value={singleQtyPc}
                      onChange={(e) => setSingleQtyPc(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stock-in-qty-ctn">Qty (CTN)</Label>
                    <Input
                      type="number"
                      id="stock-in-qty-ctn"
                      min={0}
                      value={singleQtyCtn}
                      onChange={(e) => setSingleQtyCtn(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stock-in-store">Store</Label>
                    <select
                      value={singleStore}
                      id="stock-in-store"
                      onChange={(e) => setSingleStore(e.target.value)}
                      className="w-full h-9 rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40"
                    >
                      {MOCK_STORES.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea
                    placeholder="Any notes about this stock entry..."
                    value={singleNotes}
                    onChange={(e) => setSingleNotes(e.target.value)}
                    rows={2}
                  />
                </div>

                <Button type="submit" disabled={singleSaving || !singleItemId}>
                  <Save className="mr-2 h-4 w-4" />
                  {singleSaving ? "Recording..." : "Record Stock In"}
                </Button>
                {singleErrors.qtyPc && <p className="text-sm text-destructive" role="alert">{singleErrors.qtyPc}</p>}
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk Entry */}
        <TabsContent value="bulk" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Stock Entry</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBulkSubmit} className="space-y-4">
                {bulkError && <p className="text-sm text-destructive" role="alert">{bulkError}</p>}
                <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="w-24">Qty PC</TableHead>
                        <TableHead className="w-24">Qty CTN</TableHead>
                        <TableHead className="w-36">Store</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bulkRows.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <select
                              value={row.itemId}
                              onChange={(e) => updateBulkRow(idx, "itemId", e.target.value)}
                              className="w-full h-9 rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40"
                            >
                              <option value="">Select item...</option>
                              {MOCK_ITEMS.map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.name} ({i.type})
                                </option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              value={row.qtyPc}
                              onChange={(e) => updateBulkRow(idx, "qtyPc", e.target.value)}
                              placeholder="0"
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              value={row.qtyCtn}
                              onChange={(e) => updateBulkRow(idx, "qtyCtn", e.target.value)}
                              placeholder="0"
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell>
                            <select
                              value={row.storeId}
                              onChange={(e) => updateBulkRow(idx, "storeId", e.target.value)}
                              className="w-full h-9 rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40"
                            >
                              {MOCK_STORES.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell>
                            {bulkRows.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeBulkRow(idx)}
                                aria-label="Remove row"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex items-center gap-3">
                  <Button type="button" variant="outline" onClick={addBulkRow}>
                    <Plus className="mr-2 h-4 w-4" /> Add Row
                  </Button>
                  <Button type="submit" disabled={bulkSaving}>
                    <Save className="mr-2 h-4 w-4" />
                    {bulkSaving ? "Recording..." : "Record All"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recent Stock Ins */}
      <Card>
        <CardHeader>
          <CardTitle>Today&rsquo;s Stock Ins</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {todayMovements.length === 0 ? (
            <EmptyState
              icon={<ArrowDownToLine className="h-10 w-10" />}
              title="No stock received today"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="hidden sm:table-cell">Store</TableHead>
                  <TableHead className="text-right">Qty PC</TableHead>
                  <TableHead className="text-right">Qty CTN</TableHead>
                  <TableHead className="hidden sm:table-cell">By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayMovements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      {new Date(m.createdAt).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="font-medium">{m.itemName}</TableCell>
                    <TableCell className="hidden sm:table-cell">{getStoreName(m.storeId)}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.qtyPc}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.qtyCtn}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{m.performedBy}</TableCell>
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
