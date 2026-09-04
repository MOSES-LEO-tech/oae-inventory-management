"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Loader2, Download, DollarSign, TrendingUp, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInventoryStore } from "@/stores/inventory-store";
import { usePageStoreSelection } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import {
  resolveReportFacilityInfo,
  generateProfitsPdf,
  type ReportContext,
} from "@/lib/reports/pdf";

export default function ProfitsPage() {
  const { selectedStoreId, setSelectedStoreId } = usePageStoreSelection("reports-profits");
  const { sales, stores, facilitySettings, fetchSales, fetchStores, fetchFacilitySettings, isLoading } = useInventoryStore();
  const { user, canAccessStore } = useAuthStore();
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
    fetchSales();
    fetchStores();
    fetchFacilitySettings();
  }, []);

  const filtered = useMemo(() => {
    let rows = [...sales];
    if (selectedStoreId) rows = rows.filter((s) => s.storeId === selectedStoreId);
    if (dateFrom) rows = rows.filter((s) => s.createdAt.toDate() >= new Date(dateFrom));
    if (dateTo) rows = rows.filter((s) => s.createdAt.toDate() <= new Date(dateTo + "T23:59:59Z"));
    return rows.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  }, [sales, selectedStoreId, dateFrom, dateTo]);

  const totalRevenue = filtered.reduce((s, sale) => s + sale.totalAmount, 0);
  // Profit is snapshotted per transaction at sale time; sales recorded
  // before cost prices existed carry no profit data (treated as 0).
  const totalProfit = filtered.reduce((s, sale) => s + (sale.profit ?? 0), 0);
  const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const getStoreName = (storeId: string) => {
    return stores.find((st) => st.id === storeId)?.name || storeId;
  };

  const formatDateParam = (value: string) =>
    value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Start";

  const currency = facilitySettings?.currency ?? "UGX";
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-UG", { style: "currency", currency, minimumFractionDigits: 0 }).format(amount);

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
      await generateProfitsPdf(ctx, {
        fileName: `profits-report-${new Date().toISOString().slice(0, 10)}.pdf`,
        periodLine: `${formatDateParam(dateFrom)} – ${dateTo ? formatDateParam(dateTo) : "Present"} · ${selectedStoreId ? getStoreName(selectedStoreId) : "All Stores"}`,
        summary: { totalRevenue, totalProfit, margin },
        rows: filtered.map((sale) => ({
          date: sale.createdAt.toDate(),
          items: sale.items.map((item) => item.itemName).join(", "),
          store: getStoreName(sale.storeId),
          revenue: sale.totalAmount,
          profit: sale.profit ?? null,
        })),
      });
      toast.success("Profits report downloaded");
    } catch (err) {
      console.error("[Reports] Profits PDF export failed:", err);
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
          <p className="text-body text-mid-gray">Profit recorded on each sale.</p>
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
            <DollarSign className="h-5 w-5 text-mid-gray" />
            <div>
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="text-xl font-semibold text-ink">{formatCurrency(totalRevenue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-mid-gray" />
            <div>
              <p className="text-xs text-muted-foreground">Total Profit</p>
              <p className="text-xl font-semibold text-ink">{formatCurrency(totalProfit)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Percent className="h-5 w-5 text-mid-gray" />
            <div>
              <p className="text-xs text-muted-foreground">Profit Margin</p>
              <p className="text-xl font-semibold text-ink">{margin.toFixed(1)}%</p>
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
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="hidden sm:table-cell text-center">Store</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      <p className="text-sm text-muted-foreground mt-2">Loading...</p>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">
                      No sales found for the selected period
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="text-center text-sm">
                        {sale.createdAt.toDate().toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-center text-sm font-medium">
                        {sale.items.map((item) => item.itemName).join(", ")}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-center text-sm">{getStoreName(sale.storeId)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{formatCurrency(sale.totalAmount)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {sale.profit !== undefined ? formatCurrency(sale.profit) : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
