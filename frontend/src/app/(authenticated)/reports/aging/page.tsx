"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Clock, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInventoryStore } from "@/stores/inventory-store";
import { usePageStoreSelection } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import {
  resolveReportFacilityInfo,
  generateAgingPdf,
  type ReportContext,
} from "@/lib/reports/pdf";

export default function AgingReportPage() {
  const { selectedStoreId, setSelectedStoreId } = usePageStoreSelection("reports-aging");
  const { items, stores, fetchInventory, fetchStores, fetchFacilitySettings, facilitySettings, isLoading } = useInventoryStore();
  const { user, canAccessStore } = useAuthStore();
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

  const grouped = useMemo(() => {
    let rows = items;
    if (selectedStoreId) rows = rows.filter((i) => i.storeId === selectedStoreId);

    const groups = new Map<string, typeof rows>();
    rows.forEach((row) => {
      const group = groups.get(row.stockYear) ?? [];
      group.push(row);
      groups.set(row.stockYear, group);
    });

    const result = Array.from(groups.entries()).map(([year, items]) => {
      const totalValue = items.reduce((s, i) => {
        const value = i.quantityTypes?.reduce((sum, qt) => {
          const qty = i.quantities?.[qt.id] ?? 0;
          return sum + qty * (qt.costPrice ?? 0);
        }, 0) ?? 0;
        return s + value;
      }, 0);
      return { year, items, totalValue };
    });

    return result.sort((a, b) => b.totalValue - a.totalValue);
  }, [items, selectedStoreId]);

  const grandTotal = grouped.reduce((s, g) => s + g.totalValue, 0);

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
      await generateAgingPdf(ctx, {
        fileName: `stock-aging-${new Date().toISOString().slice(0, 10)}.pdf`,
        periodLine: selectedStoreId ? getStoreName(selectedStoreId) : "All Stores",
        groups: grouped.map((group) => ({
          year: group.year,
          itemCount: group.items.length,
          subtotal: group.totalValue,
          rows: group.items.map((row) => {
            const qtySummary = row.quantityTypes?.map(qt => ({
              label: qt.label,
              qty: row.quantities?.[qt.id] ?? 0,
              cost: qt.costPrice ?? 0,
            })) ?? [];
            const value = qtySummary.reduce((s, q) => s + q.qty * q.cost, 0);
            return {
              name: row.itemName,
              type: row.itemType,
              store: getStoreName(row.storeId),
              quantities: qtySummary,
              value,
            };
          }),
        })),
        totalValue: grandTotal,
      });
      toast.success("Stock aging report downloaded");
    } catch (err) {
      console.error("[Reports] Aging PDF export failed:", err);
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
          <Link href="/reports" className="inline-flex items-center text-sm text-mid-gray hover:text-ink mb-2">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Reports
          </Link>
          <p className="text-body text-mid-gray">Stock grouped by year and category.</p>
        </div>
        <Button onClick={handleExportPdf} disabled={isExporting || grouped.length === 0}>
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export PDF
        </Button>
      </div>

      {/* Filter */}
      {isMainStoreUser && (
        <div>
          <select
            value={selectedStoreId ?? ""}
            onChange={(e) => setSelectedStoreId(e.target.value || null)}
            className="h-9 rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40"
            aria-label="Filter by store"
          >
            <option value="">All Stores</option>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      {/* Groups */}
      {grouped.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No inventory data found
          </CardContent>
        </Card>
      ) : (
        grouped.map((group) => (
          <Card key={group.year}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">{group.year}</CardTitle>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline">{group.items.length} items</Badge>
                <span className="text-sm font-bold">{formatCurrency(group.totalValue)}</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center">Item Name</TableHead>
                      <TableHead className="text-center">Type</TableHead>
                      <TableHead className="hidden sm:table-cell text-center">Store</TableHead>
                      {(() => {
                        const firstItem = group.items[0];
                        if (firstItem?.quantityTypes?.length) {
                          return firstItem.quantityTypes.map(qt => (
                            <TableHead key={qt.id} className="text-center">Qty {qt.label}</TableHead>
                          ));
                        }
                        return [
                          <TableHead key="pcs" className="text-center">Qty PC</TableHead>,
                          <TableHead key="ctn" className="text-center">Qty CTN</TableHead>,
                        ];
                      })()}
                      <TableHead className="text-center">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.items.map((row) => {
                      const value = row.quantityTypes?.reduce((sum, qt) => {
                        const qty = row.quantities?.[qt.id] ?? 0;
                        return sum + qty * (qt.costPrice ?? 0);
                      }, 0) ?? 0;
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="text-center text-sm font-medium">{row.itemName}</TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">{row.itemType}</TableCell>
                          <TableCell className="hidden sm:table-cell text-center text-sm">{getStoreName(row.storeId)}</TableCell>
                          {row.quantityTypes?.map((qt) => (
                            <TableCell key={qt.id} className="text-center text-sm tabular-nums">
                              {row.quantities?.[qt.id] ?? 0}
                            </TableCell>
                          ))}
                          <TableCell className="text-center text-sm font-medium tabular-nums">{formatCurrency(value)}</TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm font-bold">Subtotal</TableCell>
                      <TableCell className="text-center text-sm font-bold tabular-nums">{formatCurrency(group.totalValue)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Grand Total */}
      <Card>
        <CardContent className="p-4 flex justify-between items-center">
          <span className="text-sm font-bold">Grand Total</span>
          <span className="text-lg font-bold">{formatCurrency(grandTotal)}</span>
        </CardContent>
      </Card>
    </div>
  );
}