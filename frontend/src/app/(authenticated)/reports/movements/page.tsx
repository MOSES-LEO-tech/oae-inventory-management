"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInventoryStore } from "@/stores/inventory-store";
import { usePageStoreSelection } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import {
  resolveReportFacilityInfo,
  generateMovementsPdf,
  type ReportContext,
} from "@/lib/reports/pdf";
import { getQuantityTypeLabel, mergeQuantityTypes } from "@/lib/qty-label";

const MOVEMENT_BADGES: Record<string, string> = {
  IN: "bg-ink text-paper",
  OUT: "bg-canvas text-ink",
  TRANSFER_IN: "border border-hairline bg-transparent text-ink",
  TRANSFER_OUT: "border border-hairline bg-transparent text-ink",
  ADJUSTMENT: "bg-canvas text-ink",
};

export default function MovementsPage() {
  const { selectedStoreId, setSelectedStoreId } = usePageStoreSelection("reports-movements");
  const { movements, items, stores, inventoryItems: itemCatalog, fetchMovements, fetchItems, fetchStores, isLoading } = useInventoryStore();
  const { user, canAccessStore } = useAuthStore();
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Store switcher is a Main-store-only feature; secondary stores switch
  // stores exclusively on the Inventory page.
  const isMainStoreUser = useMemo(
    () => stores.some((s) => s.type === "main" && canAccessStore(s.id)),
    [stores, canAccessStore]
  );

  useEffect(() => {
    fetchMovements();
    fetchItems();
    fetchStores();
  }, []);

  const filtered = useMemo(() => {
    let rows = [...movements];
    if (selectedStoreId) rows = rows.filter((m) => m.storeId === selectedStoreId);
    if (typeFilter) rows = rows.filter((m) => m.type === typeFilter);
    if (dateFrom) rows = rows.filter((m) => m.createdAt.toDate() >= new Date(dateFrom));
    if (dateTo) rows = rows.filter((m) => m.createdAt.toDate() <= new Date(dateTo + "T23:59:59Z"));
    return rows.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  }, [movements, selectedStoreId, typeFilter, dateFrom, dateTo]);

  const totalIn = filtered.filter((m) => m.type === "IN").reduce((s, m) => s + Object.values(m.quantities ?? {}).reduce((a, b) => a + b, 0), 0);
  const totalOut = filtered.filter((m) => m.type === "OUT").reduce((s, m) => s + Object.values(m.quantities ?? {}).reduce((a, b) => a + b, 0), 0);
  const net = totalIn - totalOut;

  const getStoreName = (storeId: string) => {
    return stores.find((s) => s.id === storeId)?.name || storeId;
  };

  const getItemName = (itemId: string) => {
    return items.find((i) => i.itemId === itemId)?.itemName ?? "(removed item)";
  };

  const formatDateParam = (value: string) =>
    value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Start";

  const typeLabel = (type: string) =>
    type ? type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "All Types";

  const handleExportPdf = async () => {
    if (!user) return;
    setIsExporting(true);
    try {
      const info = await resolveReportFacilityInfo(user.facilityId);
      const ctx: ReportContext = {
        facilityName: info.name,
        currency: info.currency,
        generatedBy: user.name,
      };
      await generateMovementsPdf(ctx, {
        fileName: `movement-history-${new Date().toISOString().slice(0, 10)}.pdf`,
        periodLine: `${formatDateParam(dateFrom)} – ${dateTo ? formatDateParam(dateTo) : "Present"} · ${typeLabel(typeFilter)} · ${selectedStoreId ? getStoreName(selectedStoreId) : "All Stores"}`,
        summary: { totalIn, totalOut, net },
        rows: filtered.map((m) => ({
          date: m.createdAt.toDate(),
          itemName: getItemName(m.itemId),
          type: m.type.replace("_", " "),
          store: getStoreName(m.storeId),
          quantities: Object.entries(m.quantities ?? {}).map(([key, val]) => ({
            label: getQuantityTypeLabel(
              mergeQuantityTypes(
                itemCatalog.find((c) => c.id === m.itemId)?.quantityTypes,
                items.find((r) => r.itemId === m.itemId)?.quantityTypes
              ),
              key
            ),
            qty: val,
          })),
          performedBy: m.performedByName || "",
          notes: m.notes || "",
        })),
      });
      toast.success("Movement report downloaded");
    } catch (err) {
      console.error("[Reports] Movements PDF export failed:", err);
      toast.error("Could not generate the PDF report");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/reports" className="inline-flex items-center text-sm text-mid-gray hover:text-ink mb-2">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Reports
          </Link>
          <p className="text-body text-mid-gray">All stock in, out, and transfer records.</p>
        </div>
        <Button onClick={handleExportPdf} disabled={isExporting || filtered.length === 0}>
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export PDF
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ArrowDownToLine className="h-5 w-5 text-mid-gray" />
            <div>
              <p className="text-xs text-muted-foreground">Total IN</p>
              <p className="text-xl font-semibold text-ink">{totalIn}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ArrowUpFromLine className="h-5 w-5 text-mid-gray" />
            <div>
              <p className="text-xs text-muted-foreground">Total OUT</p>
              <p className="text-xl font-semibold text-ink">{totalOut}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ArrowRightLeft className="h-5 w-5 text-mid-gray" />
            <div>
              <p className="text-xs text-muted-foreground">Net Movement</p>
              <p className="text-xl font-semibold text-ink">{net}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
                aria-label="Date from"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
                aria-label="Date to"
              />
            </div>
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
            {isMainStoreUser && (
              <select
                value={selectedStoreId ?? ""}
                onChange={(e) => setSelectedStoreId(e.target.value || null)}
                className="h-9 rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40"
                aria-label="Filter by store"
              >
                <option value="">All Stores</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Date</TableHead>
                  <TableHead className="text-center">Item</TableHead>
                  <TableHead className="text-center">Type</TableHead>
                  <TableHead className="hidden sm:table-cell text-center">Store</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="hidden sm:table-cell text-center">By</TableHead>
                  <TableHead className="hidden md:table-cell text-center">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      <p className="text-sm text-muted-foreground mt-2">Loading...</p>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">
                      No movements found for the selected period
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((m) => {
                    const totalQty = Object.values(m.quantities ?? {}).reduce((a, b) => a + b, 0);
                    // Merge catalog + row copies — movements may be keyed
                    // against ids from either source.
                    const qts = mergeQuantityTypes(
                      itemCatalog.find((c) => c.id === m.itemId)?.quantityTypes,
                      items.find((r) => r.itemId === m.itemId)?.quantityTypes
                    );
                    const qtyBreakdown = Object.entries(m.quantities ?? {}).map(([key, val]) => `${val} ${getQuantityTypeLabel(qts, key)}`).join(" / ");
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="text-center text-sm">
                          {m.createdAt.toDate().toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-center text-sm font-medium">{getItemName(m.itemId)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className={`text-xs ${MOVEMENT_BADGES[m.type] || ""}`}>
                            {m.type.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-center text-sm">{getStoreName(m.storeId)}</TableCell>
                        <TableCell className="text-center text-sm tabular-nums">{qtyBreakdown || totalQty}</TableCell>
                        <TableCell className="hidden sm:table-cell text-center text-sm text-muted-foreground">{m.performedByName}</TableCell>
                        <TableCell className="hidden md:table-cell text-center text-sm text-muted-foreground">{m.notes || "—"}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}