"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { PrintButton } from "@/components/ui/print-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft } from "lucide-react";
import { MOCK_MOVEMENTS, MOCK_STORES, getStoreName } from "@/lib/mock-data";
import { useUIStore } from "@/stores/ui-store";

const MOVEMENT_BADGES: Record<string, string> = {
  IN: "bg-ink text-paper",
  OUT: "bg-canvas text-ink",
  TRANSFER_IN: "border border-hairline bg-transparent text-ink",
  TRANSFER_OUT: "border border-hairline bg-transparent text-ink",
  ADJUSTMENT: "bg-canvas text-ink",
};

export default function MovementsPage() {
  const { selectedStoreId, setSelectedStoreId } = useUIStore();
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const dateError = dateFrom && dateTo && dateFrom > dateTo ? "The start date must be before the end date." : "";

  const filtered = useMemo(() => {
    let rows = [...MOCK_MOVEMENTS];
    if (selectedStoreId) rows = rows.filter((m) => m.storeId === selectedStoreId);
    if (typeFilter) rows = rows.filter((m) => m.type === typeFilter);
    if (dateFrom && !dateError) rows = rows.filter((m) => m.createdAt >= dateFrom);
    if (dateTo && !dateError) rows = rows.filter((m) => m.createdAt <= dateTo + "T23:59:59Z");
    return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [selectedStoreId, typeFilter, dateFrom, dateTo, dateError]);

  const totalIn = filtered.filter((m) => m.type === "IN").reduce((s, m) => s + m.qtyPc, 0);
  const totalOut = filtered.filter((m) => m.type === "OUT").reduce((s, m) => s + m.qtyPc, 0);
  const net = totalIn - totalOut;

  return (
    <div className="space-y-6" data-print-content="true">
      <div className="flex items-start justify-between gap-4">
        <div>
        <Link href="/reports" className="inline-flex items-center text-sm text-mid-gray hover:text-ink mb-2">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Reports
        </Link>
        <h1 className="text-heading-sm font-semibold tracking-heading-sm">Movement History</h1>
        <p className="text-body text-mid-gray">All stock in, out, and transfer records.</p>
        </div>
        <div data-print-hide="true"><PrintButton /></div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ArrowDownToLine className="h-5 w-5 text-mid-gray" />
            <div>
              <p className="text-caption font-medium uppercase tracking-caption text-mid-gray">Total IN</p>
              <p className="tabular-nums text-xl font-semibold text-ink">{totalIn}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ArrowUpFromLine className="h-5 w-5 text-mid-gray" />
            <div>
              <p className="text-caption font-medium uppercase tracking-caption text-mid-gray">Total OUT</p>
              <p className="tabular-nums text-xl font-semibold text-ink">{totalOut}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ArrowRightLeft className="h-5 w-5 text-mid-gray" />
            <div>
              <p className="text-caption font-medium uppercase tracking-caption text-mid-gray">Net Movement</p>
              <p className="tabular-nums text-xl font-semibold text-ink">{net}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card data-print-hide="true">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-40"
              aria-label="Date from"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-40"
              aria-label="Date to"
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40"
              aria-label="Filter by type"
            >
              <option value="">All Types</option>
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
              <option value="TRANSFER_IN">Transfer In</option>
              <option value="TRANSFER_OUT">Transfer Out</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </select>
            <select
              value={selectedStoreId ?? ""}
              onChange={(e) => setSelectedStoreId(e.target.value || null)}
              className="h-9 rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40"
              aria-label="Filter by store"
            >
              <option value="">All Stores</option>
              {MOCK_STORES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {dateError && <p className="mt-3 text-sm text-destructive" role="alert">{dateError}</p>}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? <EmptyState icon={<ArrowRightLeft className="h-10 w-10" />} title="No movement records" description="Adjust the filters to see stock activity." /> : <Table>
            <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden sm:table-cell">Store</TableHead>
                  <TableHead className="text-right">Qty PC</TableHead>
                  <TableHead className="text-right">Qty CTN</TableHead>
                  <TableHead className="hidden sm:table-cell">By</TableHead>
                  <TableHead className="hidden md:table-cell">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-sm">
                      {new Date(m.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{m.itemName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-xs ${MOVEMENT_BADGES[m.type] || ""}`}>
                        {m.type.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">{getStoreName(m.storeId)}</TableCell>
                    <TableCell className="text-right text-sm">{m.qtyPc}</TableCell>
                    <TableCell className="text-right text-sm">{m.qtyCtn}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{m.performedBy}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{m.notes || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>}
        </CardContent>
      </Card>
    </div>
  );
}
