"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import { MOCK_ITEMS, MOCK_STORES } from "@/lib/mock-data";

type TransferRow = { itemId: string; qtyPc: string; qtyCtn: string };

export default function NewTransferPage() {
  const [fromStore, setFromStore] = useState("main-stores");
  const [toStore, setToStore] = useState("store-b");
  const [rows, setRows] = useState<TransferRow[]>([{ itemId: "", qtyPc: "", qtyCtn: "" }]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleFromStoreChange = (val: string) => {
    setFromStore(val);
    if (val === toStore) setError("Cannot transfer from same store to same store.");
    else setError("");
  };

  const handleToStoreChange = (val: string) => {
    setToStore(val);
    if (val === fromStore) setError("Cannot transfer from same store to same store.");
    else setError("");
  };

  const addRow = () => setRows((p) => [...p, { itemId: "", qtyPc: "", qtyCtn: "" }]);
  const removeRow = (i: number) => setRows((p) => p.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: keyof TransferRow, value: string) =>
    setRows((p) => { const n = [...p]; n[i] = { ...n[i], [field]: value }; return n; });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (fromStore === toStore) { setError("Cannot transfer from same store to same store."); return; }
    setSaving(true);
    setTimeout(() => {
      alert("Transfer requested (dev mode)");
      setSaving(false);
    }, 500);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/transfers" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Transfers
        </Link>
        <h1 className="text-heading-sm font-semibold tracking-heading-sm">New Transfer</h1>
        <p className="text-muted-foreground">Request a stock transfer between stores.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transfer Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>From Store *</Label>
                <select value={fromStore} onChange={(e) => handleFromStoreChange(e.target.value)} className="w-full h-9 rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40">
                  {MOCK_STORES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>To Store *</Label>
                <select value={toStore} onChange={(e) => handleToStoreChange(e.target.value)} className="w-full h-9 rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40">
                  {MOCK_STORES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div>
              <Label>Items</Label>
              <div className="mt-2 space-y-2">
                {rows.map((row, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <select value={row.itemId} onChange={(e) => updateRow(idx, "itemId", e.target.value)} className="flex-1 h-9 rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40">
                      <option value="">Select item...</option>
                      {MOCK_ITEMS.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.type})</option>)}
                    </select>
                    <Input type="number" min={0} value={row.qtyPc} onChange={(e) => updateRow(idx, "qtyPc", e.target.value)} placeholder="PC" className="w-24" />
                    <Input type="number" min={0} value={row.qtyCtn} onChange={(e) => updateRow(idx, "qtyCtn", e.target.value)} placeholder="CTN" className="w-24" />
                    {rows.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    )}
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addRow}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add Item
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Optional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            <div className="flex justify-end gap-3">
              <Link href="/transfers"><Button variant="outline" type="button">Cancel</Button></Link>
              <Button type="submit" disabled={saving || !!error}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Requesting..." : "Request Transfer"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
