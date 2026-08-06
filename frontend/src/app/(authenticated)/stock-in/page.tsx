"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
                  <Label>Select Item *</Label>
                  <Input
                    placeholder="Search item..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                  />
                  <div className="max-h-40 overflow-y-auto rounded-2xl border border-hairline">
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

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Qty (PC)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={singleQtyPc}
                      onChange={(e) => setSingleQtyPc(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Qty (CTN)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={singleQtyCtn}
                      onChange={(e) => setSingleQtyCtn(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Store</Label>
                    <select
                      value={singleStore}
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
                <div className="overflow-x-auto">
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
                </div>

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
          <CardTitle>Today's Stock Ins</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {todayMovements.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <ArrowDownToLine className="mx-auto mb-2 h-6 w-6" />
              <p>No stock received today.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead className="text-right">Qty PC</TableHead>
                    <TableHead className="text-right">Qty CTN</TableHead>
                    <TableHead>By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayMovements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm">
                        {new Date(m.createdAt).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{m.itemName}</TableCell>
                      <TableCell className="text-sm">{getStoreName(m.storeId)}</TableCell>
                      <TableCell className="text-right text-sm">{m.qtyPc}</TableCell>
                      <TableCell className="text-right text-sm">{m.qtyCtn}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.performedBy}</TableCell>
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
