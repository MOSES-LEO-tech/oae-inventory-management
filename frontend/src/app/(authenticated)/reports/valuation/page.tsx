"use client";

import { useState, useMemo, useEffect, Fragment } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, DollarSign, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInventoryStore } from "@/stores/inventory-store";
import { usePageStoreSelection } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import {
  resolveReportFacilityInfo,
  generateValuationPdf,
  type ReportContext,
} from "@/lib/reports/pdf";

export default function ValuationPage() {
  const { selectedStoreId, setSelectedStoreId } = usePageStoreSelection("reports-valuation");
  const { items, stores, fetchInventory, fetchStores, fetchFacilitySettings, facilitySettings, isLoading } = useInventoryStore();
  const { user, canAccessStore } = useAuthStore();
  const [yearFilter, setYearFilter] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Store switcher is a Main-store-only feature; secondary stores switch
  // stores exclusively on the Inventory page.
  const isMainStoreUser = useMemo(
    () => stores.some((s) => s.type === "main" && canAccessStore(s.id)),
    [stores, canAccessStore]
  );

  useEffect(() => {
    fetchInventory();
    fetchStores();
    fetchFacilitySettings();
  }, []);

  const years = useMemo(() => {
    const s = new Set(items.map((i) => i.stockYear));
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    let rows = items;
    if (selectedStoreId) rows = rows.filter((i) => i.storeId === selectedStoreId);
    if (yearFilter) rows = rows.filter((i) => i.stockYear === yearFilter);
    return rows;
  }, [items, selectedStoreId, yearFilter]);

  const totalValue = filtered.reduce((s, i) => {
    const itemValue = i.quantityTypes?.reduce((sum, qt) => {
      const qty = i.quantities?.[qt.id] ?? 0;
      return sum + qty * (qt.costPrice ?? 0);
    }, 0) ?? 0;
    return s + itemValue;
  }, 0);

  const getStoreName = (storeId: string) => {
    return stores.find((s) => s.id === storeId)?.name || storeId;
  };

  const currency = facilitySettings?.currency ?? "UGX";
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", { style: "currency", currency }).format(amount);
  };

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
      await generateValuationPdf(ctx, {
        fileName: `stock-valuation-${new Date().toISOString().slice(0, 10)}.pdf`,
        periodLine: `${selectedStoreId ? getStoreName(selectedStoreId) : "All Stores"} · ${yearFilter || "All Years"}`,
        rows: filtered.map((row) => {
          const quantities = row.quantityTypes?.map(qt => ({
            label: qt.label,
            qty: row.quantities?.[qt.id] ?? 0,
            cost: qt.costPrice ?? 0,
          })) ?? [];
          const value = quantities.reduce((s, q) => s + q.qty * q.cost, 0);
          return {
            name: row.itemName,
            type: row.itemType,
            store: getStoreName(row.storeId),
            year: row.stockYear,
            quantities,
            value,
          };
        }),
        totalValue,
      });
      toast.success("Valuation report downloaded");
    } catch (err) {
      console.error("[Reports] Valuation PDF export failed:", err);
      toast.error("Could not generate the PDF report");
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/reports" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Reports
          </Link>
          <p className="text-muted-foreground">Total value of stock per item and store.</p>
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
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
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="h-9 rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40"
          aria-label="Filter by stock year"
        >
          <option value="">All Years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Total Value */}
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <DollarSign className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Total Inventory Value</p>
            <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
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
                  <TableHead className="text-center">Item Name</TableHead>
                  <TableHead className="text-center">Type</TableHead>
                  <TableHead className="hidden sm:table-cell text-center">Store</TableHead>
                  <TableHead className="hidden sm:table-cell text-center">Year</TableHead>
                  {(() => {
                    const firstRow = filtered[0];
                    if (firstRow?.quantityTypes?.length) {
                      return firstRow.quantityTypes.flatMap(qt => [
                        <TableHead key={qt.id} className="text-center">Qty {qt.label}</TableHead>,
                        <TableHead key={`p-${qt.id}`} className="text-center">Cost {qt.label}</TableHead>,
                      ]);
                    }
                    return [
                      <TableHead key="pc" className="text-center">Qty PC</TableHead>,
                      <TableHead key="p-pc" className="text-center">Cost PC</TableHead>,
                      <TableHead key="ctn" className="text-center">Qty CTN</TableHead>,
                      <TableHead key="p-ctn" className="text-center">Cost CTN</TableHead>,
                    ];
                  })()}
                  <TableHead className="text-center font-bold">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-sm text-muted-foreground">
                      No inventory data found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => {
                    const quantities = row.quantityTypes?.map(qt => ({
                      id: qt.id,
                      label: qt.label,
                      qty: row.quantities?.[qt.id] ?? 0,
                      cost: qt.costPrice ?? 0,
                    })) ?? [];
                    const value = quantities.reduce((s, q) => s + q.qty * q.cost, 0);
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="text-center text-sm font-medium">{row.itemName}</TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">{row.itemType}</TableCell>
                        <TableCell className="hidden sm:table-cell text-center text-sm">{getStoreName(row.storeId)}</TableCell>
                        <TableCell className="hidden sm:table-cell text-center text-sm">
                          <Badge variant="outline" className="text-xs">{row.stockYear}</Badge>
                        </TableCell>
                        {quantities.map(q => (
                          <Fragment key={q.id}>
                            <TableCell className="text-center text-sm tabular-nums">{q.qty}</TableCell>
                            <TableCell className="text-center text-sm tabular-nums">{formatCurrency(q.cost)}</TableCell>
                          </Fragment>
                        ))}
                        <TableCell className="text-center text-sm font-medium tabular-nums">{formatCurrency(value)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
                {/* Grand Total */}
                {filtered.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center font-bold text-sm">Grand Total</TableCell>
                    <TableCell className="text-center font-bold text-sm tabular-nums">{formatCurrency(totalValue)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}