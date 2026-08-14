"use client";

import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ClipboardList,
  Save,
  CheckCircle,
  AlertTriangle,
  Search,
  Plus,
  Trash2,
  Calculator,
  History,
  ArrowLeft,
} from "lucide-react";
import { MOCK_INVENTORY, MOCK_STORES, getStoreName, MockInventoryRow, MockItem } from "@/lib/mock-data";
import { useAuthStore } from "@/stores/auth-store";

// ── Types ─────────────────────────────────────────────────

type CountRow = {
  inventoryRow: MockInventoryRow;
  systemQtyPc: number;
  systemQtyCtn: number;
  countedQtyPc: string;
  countedQtyCtn: string;
  matched: boolean | null; // null if not yet counted
};

type StockTakeSession = {
  id: string;
  storeId: string;
  storeName: string;
  date: string;
  countedBy: string;
  items: { itemId: string; itemName: string; type: string; stockYear: string; systemPc: number; systemCtn: number; countedPc: number; countedCtn: number; variancePc: number; varianceCtn: number }[];
  newItemsAdded: { name: string; type: string; category: string; countedPc: number; countedCtn: number; unitPricePc: number; unitPriceCtn: number }[];
  itemsRemoved: string[];
  status: "in_progress" | "completed";
};

// In-memory session store (would be Firestore in production)
let savedSessions: StockTakeSession[] = [];

// ── New item form helper ──────────────────────────────────

function NewItemRow({ onAdd }: { onAdd: (item: Omit<MockItem, "id" | "lowStockThresholdPc" | "lowStockThresholdCtn"> & { countedPc: number; countedCtn: number }) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [category, setCategory] = useState("NEW_STOCK");
  const [countedPc, setCountedPc] = useState("");
  const [countedCtn, setCountedCtn] = useState("");
  const [unitPricePc, setUnitPricePc] = useState("");
  const [unitPriceCtn, setUnitPriceCtn] = useState("");

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({
      name: name.trim(),
      type: type.trim(),
      category,
      unitPricePc: parseFloat(unitPricePc) || 0,
      unitPriceCtn: parseFloat(unitPriceCtn) || 0,
      countedPc: parseInt(countedPc) || 0,
      countedCtn: parseInt(countedCtn) || 0,
    });
    setName(""); setType(""); setCountedPc(""); setCountedCtn("");
    setUnitPricePc(""); setUnitPriceCtn(""); setCategory("NEW_STOCK");
  };

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-hairline bg-surface-alt p-3">
      <div className="flex-1 min-w-[140px] space-y-1">
        <Label className="text-xs text-mid-gray">Item Name *</Label>
        <Input placeholder="e.g. Stapler" value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
      </div>
      <div className="w-28 space-y-1">
        <Label className="text-xs text-mid-gray">Type</Label>
        <Input placeholder="e.g. Metal" value={type} onChange={(e) => setType(e.target.value)} className="h-8 text-sm" />
      </div>
      <div className="w-32 space-y-1">
        <Label className="text-xs text-mid-gray">Year</Label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full h-8 rounded-2xl border border-transparent bg-canvas px-2 text-xs outline-none focus-visible:border-hairline focus-visible:ring-2 focus-visible:ring-hairline/40">
          <option value="NEW_STOCK">NEW STOCK</option>
          <option value="OLD_STOCK">OLD STOCK</option>
          <option value="2026">2026</option>
        </select>
      </div>
      <div className="w-20 space-y-1">
        <Label className="text-xs text-mid-gray">PC Qty</Label>
        <Input type="number" min={0} placeholder="0" value={countedPc} onChange={(e) => setCountedPc(e.target.value)} className="h-8 text-sm" />
      </div>
      <div className="w-20 space-y-1">
        <Label className="text-xs text-mid-gray">CTN Qty</Label>
        <Input type="number" min={0} placeholder="0" value={countedCtn} onChange={(e) => setCountedCtn(e.target.value)} className="h-8 text-sm" />
      </div>
      <div className="w-28 space-y-1">
        <Label className="text-xs text-mid-gray">Price PC</Label>
        <Input type="number" min={0} placeholder="0" value={unitPricePc} onChange={(e) => setUnitPricePc(e.target.value)} className="h-8 text-sm" />
      </div>
      <div className="w-28 space-y-1">
        <Label className="text-xs text-mid-gray">Price CTN</Label>
        <Input type="number" min={0} placeholder="0" value={unitPriceCtn} onChange={(e) => setUnitPriceCtn(e.target.value)} className="h-8 text-sm" />
      </div>
      <Button size="sm" onClick={handleAdd} disabled={!name.trim()} className="h-8 shrink-0">
        <Plus className="mr-1 h-3.5 w-3.5" /> Add
      </Button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────

export default function StockTakingPage() {
  const { user } = useAuthStore();
  const [view, setView] = useState<"new" | "history" | "active">("new");
  const [storeId, setStoreId] = useState("main-stores");
  const [searchQuery, setSearchQuery] = useState("");
  const [countRows, setCountRows] = useState<CountRow[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [newItems, setNewItems] = useState<(Omit<MockItem, "id" | "lowStockThresholdPc" | "lowStockThresholdCtn"> & { countedPc: number; countedCtn: number })[]>([]);
  const [removedItems, setRemovedItems] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);

  // Start a new session
  const startSession = useCallback(() => {
    const rows: CountRow[] = MOCK_INVENTORY
      .filter((inv) => inv.storeId === storeId)
      .map((inv) => ({
        inventoryRow: inv,
        systemQtyPc: inv.qtyPc,
        systemQtyCtn: inv.qtyCtn,
        countedQtyPc: "",
        countedQtyCtn: "",
        matched: null,
      }));
    setCountRows(rows);
    setNewItems([]);
    setRemovedItems(new Set());
    setSessionId(`ST-${Date.now()}`);
    setShowConfirm(false);
    setView("active");
  }, [storeId]);

  // Update a counted value
  const updateCount = (idx: number, field: "countedQtyPc" | "countedQtyCtn", value: string) => {
    setCountRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const updated = { ...r, [field]: value };
        const countedPc = field === "countedQtyPc" ? parseInt(value) || 0 : parseInt(r.countedQtyPc) || 0;
        const countedCtn = field === "countedQtyCtn" ? parseInt(value) || 0 : parseInt(r.countedQtyCtn) || 0;
        const hasCount = r.countedQtyPc !== "" || r.countedQtyCtn !== "" || value !== "";
        updated.matched = hasCount ? (countedPc === r.systemQtyPc && countedCtn === r.systemQtyCtn) : null;
        return updated;
      })
    );
  };

  // Quick-fill: set counted = system (for matching items)
  const fillAllMatch = () => {
    setCountRows((prev) =>
      prev.map((r) => ({
        ...r,
        countedQtyPc: String(r.systemQtyPc),
        countedQtyCtn: String(r.systemQtyCtn),
        matched: true,
      }))
    );
  };

  // Remove an inventory item
  const toggleRemoveItem = (rowId: string) => {
    setRemovedItems((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  // Remove a newly-added item
  const removeNewItem = (idx: number) => {
    setNewItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Add a new item discovered during stock-take
  const addNewItem = (item: Omit<MockItem, "id" | "lowStockThresholdPc" | "lowStockThresholdCtn"> & { countedPc: number; countedCtn: number }) => {
    setNewItems((prev) => [...prev, item]);
  };

  // Finalize the session
  const finalizeSession = () => {
    const session: StockTakeSession = {
      id: sessionId!,
      storeId,
      storeName: getStoreName(storeId),
      date: new Date().toISOString(),
      countedBy: user?.name ?? "Unknown",
      items: countRows
        .filter((r) => !removedItems.has(r.inventoryRow.id))
        .map((r) => ({
          itemId: r.inventoryRow.id,
          itemName: r.inventoryRow.name,
          type: r.inventoryRow.type,
          stockYear: r.inventoryRow.stockYear,
          systemPc: r.systemQtyPc,
          systemCtn: r.systemQtyCtn,
          countedPc: parseInt(r.countedQtyPc) || 0,
          countedCtn: parseInt(r.countedQtyCtn) || 0,
          variancePc: (parseInt(r.countedQtyPc) || 0) - r.systemQtyPc,
          varianceCtn: (parseInt(r.countedQtyCtn) || 0) - r.systemQtyCtn,
        })),
      newItemsAdded: [...newItems],
      itemsRemoved: Array.from(removedItems),
      status: "completed",
    };
    savedSessions = [session, ...savedSessions];
    setView("history");
    setShowConfirm(false);
  };

  // Derived stats
  const stats = useMemo(() => {
    const counted = countRows.filter((r) => r.matched !== null);
    const matched = counted.filter((r) => r.matched);
    const mismatched = counted.filter((r) => r.matched === false);
    const totalVariance = mismatched.reduce((s, r) => {
      const cpc = parseInt(r.countedQtyPc) || 0;
      const sPc = r.systemQtyPc;
      return s + (cpc - sPc);
    }, 0);
    return { total: countRows.length, counted: counted.length, matched: matched.length, mismatched: mismatched.length, notCounted: countRows.length - counted.length, totalVariance, removed: removedItems.size };
  }, [countRows, removedItems]);

  // Filter for search
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return countRows;
    const q = searchQuery.toLowerCase();
    return countRows.filter((r) => r.inventoryRow.name.toLowerCase().includes(q) || r.inventoryRow.type.toLowerCase().includes(q));
  }, [countRows, searchQuery]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading-sm font-semibold tracking-heading-sm">Stock Taking</h1>
        <p className="text-body text-mid-gray">
          Count physical stock and reconcile with system records.
        </p>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2">
        <Button
          variant={view === "new" || view === "active" ? "default" : "ghost"}
          size="sm"
          onClick={() => { if (view === "active") return; setView("new"); }}
        >
          <ClipboardList className="mr-1.5 h-4 w-4" />
          {view === "active" ? "Active Session" : "New Session"}
        </Button>
        <Button
          variant={view === "history" ? "default" : "ghost"}
          size="sm"
          onClick={() => setView("history")}
        >
          <History className="mr-1.5 h-4 w-4" />
          History ({savedSessions.length})
        </Button>
      </div>

      {/* ── NEW SESSION SETUP ─────────────────────────────── */}
      {view === "new" && (
        <Card>
          <CardHeader>
            <CardTitle>Start a New Stock Take</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Store</Label>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="h-9 w-full rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40"
              >
                {MOCK_STORES.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <p className="text-sm text-mid-gray">
              This will load all current inventory for <strong>{getStoreName(storeId)}</strong>.
              Count each item physically and enter the actual quantities you find.
            </p>
            <Button onClick={startSession}>
              <ClipboardList className="mr-2 h-4 w-4" /> Start Stock Take
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── ACTIVE SESSION ────────────────────────────────── */}
      {view === "active" && (
        <>
          {/* Stats bar */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-6">
            <Card className="py-3 px-4">
              <p className="text-caption font-medium uppercase tracking-caption text-mid-gray">Total Items</p>
              <p className="tabular-nums text-xl font-semibold">{stats.total}</p>
            </Card>
            <Card className="py-3 px-4">
              <p className="text-caption font-medium uppercase tracking-caption text-mid-gray">Counted</p>
              <p className="tabular-nums text-xl font-semibold">{stats.counted}/{stats.total}</p>
            </Card>
            <Card className="py-3 px-4">
              <p className="text-caption font-medium uppercase tracking-caption text-mid-gray">Matched</p>
              <p className="tabular-nums text-xl font-semibold text-primary">{stats.matched}</p>
            </Card>
            <Card className="py-3 px-4">
              <p className="text-caption font-medium uppercase tracking-caption text-mid-gray">Mismatched</p>
              <p className="tabular-nums text-xl font-semibold text-destructive">{stats.mismatched}</p>
            </Card>
            <Card className="py-3 px-4">
              <p className="text-caption font-medium uppercase tracking-caption text-mid-gray">Net Variance</p>
              <p className={`tabular-nums text-xl font-semibold ${stats.totalVariance > 0 ? "text-primary" : stats.totalVariance < 0 ? "text-destructive" : ""}`}>
                {stats.totalVariance > 0 ? "+" : ""}{stats.totalVariance}
              </p>
            </Card>
            <Card className="py-3 px-4">
              <p className="text-caption font-medium uppercase tracking-caption text-mid-gray">To Remove</p>
              <p className="tabular-nums text-xl font-semibold">{stats.removed}</p>
            </Card>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mid-gray" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={fillAllMatch}>
              <CheckCircle className="mr-1.5 h-4 w-4" /> Quick-fill All Match
            </Button>
          </div>

          {/* Count Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="hidden sm:table-cell">Type</TableHead>
                      <TableHead className="text-right">System PC</TableHead>
                      <TableHead className="text-right">System CTN</TableHead>
                      <TableHead className="text-right w-24">Counted PC</TableHead>
                      <TableHead className="text-right w-24">Counted CTN</TableHead>
                      <TableHead className="text-right w-16">Var PC</TableHead>
                      <TableHead className="text-right w-16">Var CTN</TableHead>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row, idx) => {
                      const cpc = parseInt(row.countedQtyPc) || 0;
                      const cctn = parseInt(row.countedQtyCtn) || 0;
                      const vpc = row.matched !== null ? cpc - row.systemQtyPc : 0;
                      const vctn = row.matched !== null ? cctn - row.systemQtyCtn : 0;
                      const isRemoved = removedItems.has(row.inventoryRow.id);

                      return (
                        <TableRow key={row.inventoryRow.id} className={isRemoved ? "opacity-40 line-through" : ""}>
                          <TableCell className="text-sm font-medium">{row.inventoryRow.name}</TableCell>
                          <TableCell className="hidden sm:table-cell text-sm text-mid-gray">{row.inventoryRow.type}</TableCell>
                          <TableCell className="text-right text-sm">{row.systemQtyPc}</TableCell>
                          <TableCell className="text-right text-sm">{row.systemQtyCtn}</TableCell>
                          <TableCell className="text-right p-1">
                            <Input
                              type="number"
                              min={0}
                              value={row.countedQtyPc}
                              onChange={(e) => updateCount(idx, "countedQtyPc", e.target.value)}
                              className="h-8 w-20 ml-auto text-sm text-center"
                              disabled={isRemoved}
                            />
                          </TableCell>
                          <TableCell className="text-right p-1">
                            <Input
                              type="number"
                              min={0}
                              value={row.countedQtyCtn}
                              onChange={(e) => updateCount(idx, "countedQtyCtn", e.target.value)}
                              className="h-8 w-20 ml-auto text-sm text-center"
                              disabled={isRemoved}
                            />
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {row.matched !== null && (
                              <span className={vpc > 0 ? "text-primary" : vpc < 0 ? "text-destructive" : ""}>
                                {vpc > 0 ? "+" : ""}{vpc}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {row.matched !== null && (
                              <span className={vctn > 0 ? "text-primary" : vctn < 0 ? "text-destructive" : ""}>
                                {vctn > 0 ? "+" : ""}{vctn}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.matched !== null && (
                              row.matched
                                ? <CheckCircle className="h-4 w-4 text-primary" />
                                : <AlertTriangle className="h-4 w-4 text-destructive" />
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => toggleRemoveItem(row.inventoryRow.id)}
                              title={isRemoved ? "Undo remove" : "Mark for removal"}
                            >
                              <Trash2 className={`h-3.5 w-3.5 ${isRemoved ? "text-destructive" : ""}`} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
            </CardContent>
          </Card>

          {/* New Items Discovered */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Items Found During Count
                {newItems.length > 0 && (
                  <Badge variant="default" className="ml-2 text-xs">{newItems.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <NewItemRow onAdd={addNewItem} />
              {newItems.length > 0 && (
                <div className="space-y-1">
                  {newItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between rounded-2xl border border-hairline px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium">{item.name}</span>
                        {item.type && <span className="ml-2 text-mid-gray">({item.type})</span>}
                        <span className="ml-3 text-xs text-mid-gray">
                          {item.countedPc}PC / {item.countedCtn}CTN
                        </span>
                        <span className="ml-2 text-xs text-mid-gray">{item.category}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeNewItem(i)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Finalize */}
          <div className="flex justify-between items-center">
            <Button variant="secondary" onClick={() => { setView("new"); setCountRows([]); }}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Cancel Session
            </Button>
            <div className="flex gap-2">
              {!showConfirm ? (
                <Button onClick={() => setShowConfirm(true)}>
                  <Save className="mr-2 h-4 w-4" /> Review & Finalize
                </Button>
              ) : (
                <>
                  <Button variant="secondary" onClick={() => setShowConfirm(false)}>Cancel</Button>
                  <Button onClick={finalizeSession} className="bg-destructive hover:bg-destructive/90">
                    <Calculator className="mr-2 h-4 w-4" />
                    Confirm & Save Stock Take
                  </Button>
                </>
              )}
            </div>
          </div>

          {showConfirm && (
            <Card className="border-hairline bg-surface-alt">
              <CardContent className="p-4">
                <p className="text-sm font-medium">Ready to finalize?</p>
                <ul className="mt-1 text-sm text-mid-gray space-y-0.5">
                  <li>&#8226; {stats.matched} items matched system quantities</li>
                  {stats.mismatched > 0 && <li>&#8226; {stats.mismatched} items have variances — system will be updated</li>}
                  {newItems.length > 0 && <li>&#8226; {newItems.length} new items will be added to inventory</li>}
                  {removedItems.size > 0 && <li>&#8226; {removedItems.size} items will be removed from inventory</li>}
                  {stats.notCounted > 0 && <li>&#8226; Warning: {stats.notCounted} items were not counted — they will keep current system quantities</li>}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── HISTORY ───────────────────────────────────────── */}
      {view === "history" && (
        <>
          {savedSessions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <History className="mb-3 h-10 w-10 text-mid-gray" />
                <p className="text-sm text-mid-gray">No stock-taking sessions yet.</p>
                <Button variant="secondary" className="mt-3" onClick={() => setView("new")}>
                  Start your first stock take
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {savedSessions.map((session) => {
                const totalItems = session.items.length + session.newItemsAdded.length;
                const withVariance = session.items.filter((i) => i.variancePc !== 0 || i.varianceCtn !== 0);
                return (
                  <Card key={session.id} className="transition-shadow hover:shadow-subtle-2">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold">{session.storeName}</p>
                          <p className="text-xs text-mid-gray">
                            {new Date(session.date).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                          <p className="text-xs text-mid-gray">by {session.countedBy}</p>
                        </div>
                        <Badge variant="default" className="text-xs">COMPLETED</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-mid-gray">
                        <span>{totalItems} items counted</span>
                        {withVariance.length > 0 && <span className="text-destructive font-medium">{withVariance.length} with variance</span>}
                        {session.newItemsAdded.length > 0 && <span className="text-primary font-medium">{session.newItemsAdded.length} new items added</span>}
                        {session.itemsRemoved.length > 0 && <span className="font-medium">{session.itemsRemoved.length} items removed</span>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
