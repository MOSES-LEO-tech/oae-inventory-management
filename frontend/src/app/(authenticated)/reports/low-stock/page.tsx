"use client";

import { useState, useMemo, useEffect } from "react";
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
import { ArrowLeft, AlertTriangle, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInventoryStore } from "@/stores/inventory-store";
import { usePageStoreSelection } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import {
  resolveReportFacilityInfo,
  generateLowStockPdf,
  type ReportContext,
} from "@/lib/reports/pdf";

export default function LowStockPage() {
  const { selectedStoreId, setSelectedStoreId } = usePageStoreSelection("reports-low-stock");
  const { items, inventoryItems, stores, fetchInventory, fetchItems, fetchStores, isLoading } = useInventoryStore();
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
    fetchItems();
    fetchStores();
  }, []);

  const lowStockItems = useMemo(() => {
    let rows = items;
    if (selectedStoreId) rows = rows.filter((i) => i.storeId === selectedStoreId);
    return rows.filter((item) => {
      const qtyTypes = item.quantityTypes ?? [];
      const quantities = item.quantities ?? {};
      const thresholds = item.lowStockThresholds ?? {};
      return qtyTypes.some(qt => {
        const qty = quantities[qt.id] ?? 0;
        const threshold = thresholds[qt.id] ?? 0;
        return threshold > 0 && qty <= threshold;
      });
    }).sort((a, b) => {
      const aQty = a.quantities?.[a.quantityTypes?.[0]?.id ?? ""] ?? 0;
      const bQty = b.quantities?.[b.quantityTypes?.[0]?.id ?? ""] ?? 0;
      return aQty - bQty;
    });
  }, [items, selectedStoreId]);

  const getStoreName = (storeId: string) => {
    return stores.find((s) => s.id === storeId)?.name || storeId;
  };

  const criticalCount = lowStockItems.filter((row) => {
    const qtyTypes = row.quantityTypes ?? [];
    const quantities = row.quantities ?? {};
    return qtyTypes.some(qt => quantities[qt.id] === 0);
  }).length;

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
      await generateLowStockPdf(ctx, {
        fileName: `low-stock-${new Date().toISOString().slice(0, 10)}.pdf`,
        periodLine: selectedStoreId ? getStoreName(selectedStoreId) : "All Stores",
        criticalCount,
        lowCount: lowStockItems.length - criticalCount,
        rows: lowStockItems.map((row) => {
          const qtyTypes = row.quantityTypes ?? [];
          const quantities = row.quantities ?? {};
          const thresholds = row.lowStockThresholds ?? {};
          const isCritical = qtyTypes.some(qt => quantities[qt.id] === 0);
          return {
            name: row.itemName,
            type: row.itemType,
            store: getStoreName(row.storeId),
            quantities: qtyTypes.map(qt => ({
              label: qt.label,
              qty: quantities[qt.id] ?? 0,
              threshold: thresholds[qt.id] ?? 0,
            })),
            status: isCritical ? "Critical" : "Low",
          };
        }),
      });
      toast.success("Low stock report downloaded");
    } catch (err) {
      console.error("[Reports] Low stock PDF export failed:", err);
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
          <p className="text-body text-mid-gray">Items below their configured threshold.</p>
        </div>
        <Button onClick={handleExportPdf} disabled={isExporting || lowStockItems.length === 0}>
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export PDF
        </Button>
      </div>

      {/* Alert Banner — monochromatic tonal panel */}
      <Card className="border-hairline bg-surface-alt">
        <CardContent className="p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-ink" />
          <p className="text-sm font-medium text-ink">
            {lowStockItems.length} {lowStockItems.length === 1 ? "item needs" : "items need"} restocking
          </p>
        </CardContent>
      </Card>

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
                  {(() => {
                    const firstItem = lowStockItems[0];
                    if (firstItem?.quantityTypes?.length) {
                      return firstItem.quantityTypes.flatMap(qt => [
                        <TableHead key={qt.id} className="text-center">Current {qt.label}</TableHead>,
                        <TableHead key={`th-${qt.id}`} className="text-center">Threshold {qt.label}</TableHead>,
                      ]);
                    }
                    return [
                      <TableHead key="pc" className="text-center">Current PC</TableHead>,
                      <TableHead key="th-pc" className="text-center">Threshold PC</TableHead>,
                      <TableHead key="ctn" className="text-center">Current CTN</TableHead>,
                      <TableHead key="th-ctn" className="text-center">Threshold CTN</TableHead>,
                    ];
                  })()}
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      <p className="text-sm text-muted-foreground mt-2">Loading...</p>
                    </TableCell>
                  </TableRow>
                ) : lowStockItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-sm text-muted-foreground">
                      No low stock items found
                    </TableCell>
                  </TableRow>
                ) : (
                  lowStockItems.map((row) => {
                    const qtyTypes = row.quantityTypes ?? [];
                    const quantities = row.quantities ?? {};
                    const thresholds = row.lowStockThresholds ?? {};
                    const isCritical = qtyTypes.some(qt => quantities[qt.id] === 0);
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="text-center text-sm font-medium">{row.itemName}</TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">{row.itemType}</TableCell>
                        <TableCell className="hidden sm:table-cell text-center text-sm">{getStoreName(row.storeId)}</TableCell>
                        {qtyTypes.map(qt => (
                          <>
                            <TableCell key={qt.id} className="text-center text-sm font-bold tabular-nums">
                              {quantities[qt.id] ?? 0}
                            </TableCell>
                            <TableCell key={`th-${qt.id}`} className="text-center text-sm text-muted-foreground tabular-nums">
                              {thresholds[qt.id] ?? 0}
                            </TableCell>
                          </>
                        ))}
                        <TableCell className="text-center">
                          <Badge variant="secondary" className={`text-xs ${
                            isCritical
                              ? "bg-ink text-paper"
                              : "border border-hairline bg-transparent text-ink"
                          }`}>
                            {isCritical ? "Critical" : "Low"}
                          </Badge>
                        </TableCell>
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
