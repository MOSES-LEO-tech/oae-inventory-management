"use client";

// Staff activity monitoring (Medicore pattern): a derived feed built from the
// attribution fields already written on every business document —
// StockMovement.performedBy, Transaction.performedBy, StockTransfer.requestedBy.
// No separate log collection is needed; this page reads the same slices the
// dashboard uses and filters them by date range and staff member.

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Users } from "lucide-react";
import { useInventoryStore } from "@/stores/inventory-store";
import { useAuthStore } from "@/stores/auth-store";
import type { Timestamp as FsTimestamp } from "firebase/firestore";
import type { QuantityType } from "@/types";
import { getQuantityTypeLabel, mergeQuantityTypes } from "@/lib/qty-label";

const PAGE_SIZE = 25;

interface ActivityEntry {
  id: string;
  at: Date;
  staffId: string;
  staffName: string;
  action: string; // badge label
  badgeCls: string;
  summary: string;
  amount?: number;
}

const BADGE_SOLID = "bg-ink text-paper";
const BADGE_SOFT = "bg-canvas text-ink";
const BADGE_OUTLINE = "border border-hairline bg-transparent text-ink";

const formatUGX = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-UG", { style: "currency", currency }).format(amount);

const formatWhen = (d: Date) =>
  d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const toDateInputValue = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function StaffActivityPage() {
  const { user, hasDuty } = useAuthStore();
  const canView = !!user && (user.role === "admin" || hasDuty("manage_users"));
  const {
    users,
    stores,
    items,
    inventoryItems,
    movements,
    sales,
    transfers,
    isLoading,
    facilitySettings,
    fetchAll,
  } = useInventoryStore();
  const currency = facilitySettings?.currency ?? "UGX";

  const activeUsers = useMemo(() => users.filter((u) => u.active), [users]);

  // Filters — default window is the last 7 days.
  const weekAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  }, []);
  const [fromDate, setFromDate] = useState(toDateInputValue(weekAgo));
  const [toDate, setToDate] = useState(toDateInputValue(new Date()));
  const [staffId, setStaffId] = useState("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    if (canView) fetchAll();
  }, [canView, fetchAll]);

  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? id;
  const itemName = (id: string) =>
    items.find((r) => r.itemId === id)?.itemName ?? "(removed item)";

  // Quantity labels resolve through the item's quantity types so raw
  // quantity-type ids (or legacy ids) never leak into the feed. Merge the
  // record's write-time snapshot with the catalog copy and ALL inventory-row
  // copies — any store's row can carry the type set the record was keyed
  // against, and first-match lookup breaks when copies drift.
  const qtsFor = (itemId: string, snap?: QuantityType[]) =>
    mergeQuantityTypes(
      snap,
      inventoryItems.find((c) => c.id === itemId)?.quantityTypes,
      ...items.filter((r) => r.itemId === itemId).map((r) => r.quantityTypes)
    );

  const formatQty = (
    quantities: Record<string, number> | undefined,
    quantityTypes: QuantityType[] | undefined
  ) =>
    quantities
      ? Object.entries(quantities)
          .map(([k, v]) => `${v} ${getQuantityTypeLabel(quantityTypes, k).toUpperCase()}`)
          .join(" / ")
      : "—";

  // Derive the unified feed from attributed collections.
  const entries = useMemo<ActivityEntry[]>(() => {
    const list: ActivityEntry[] = [];

    for (const m of movements) {
      if (!m.performedBy) continue;
      const qty = formatQty(m.quantities, qtsFor(m.itemId, m.quantityTypes));
      let action = "";
      let summary = "";
      switch (m.type) {
        case "IN":
          action = "Stock In";
          summary = `Received ${qty} · ${itemName(m.itemId)}`;
          break;
        case "OUT":
          action = "Stock Out";
          summary = `Issued ${qty} · ${itemName(m.itemId)}`;
          break;
        case "ADJUSTMENT":
          action = "Adjustment";
          summary = `Adjusted to ${qty} · ${itemName(m.itemId)}`;
          break;
        case "TRANSFER_IN":
          action = "Transfer In";
          summary = `Received ${qty} into ${storeName(m.storeId)}`;
          break;
        case "TRANSFER_OUT":
          action = "Transfer Out";
          summary = `Sent ${qty} from ${storeName(m.storeId)}`;
          break;
        default:
          continue;
      }
      list.push({
        id: `mv-${m.id}`,
        at: (m.createdAt as FsTimestamp).toDate(),
        staffId: m.performedBy,
        staffName: m.performedByName,
        action,
        badgeCls: m.type === "IN" ? BADGE_SOLID : BADGE_SOFT,
        summary,
      });
    }

    for (const t of sales) {
      if (t.type !== "SALE") continue;
      if (t.status === "CANCELLED" || t.status === "REFUNDED") continue;
      list.push({
        id: `tx-${t.id}`,
        at: (t.createdAt as FsTimestamp).toDate(),
        staffId: t.performedBy,
        staffName: t.performedByName,
        action: "Sale",
        badgeCls: BADGE_SOLID,
        summary: `Sold ${t.items.length} line${t.items.length === 1 ? "" : "s"} at ${storeName(t.storeId)}`,
        amount: t.totalAmount,
      });
    }

    for (const tr of transfers) {
      list.push({
        id: `tr-${tr.id}`,
        at: (tr.createdAt as FsTimestamp).toDate(),
        staffId: tr.requestedBy,
        staffName: tr.requestedByName,
        action: "Transfer",
        badgeCls: BADGE_OUTLINE,
        summary: `Requested ${storeName(tr.fromStoreId)} → ${storeName(tr.toStoreId)} (${tr.status.toLowerCase()})`,
      });
    }

    return list.sort((a, b) => b.at.getTime() - a.at.getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movements, sales, transfers, items, stores]);

  // Date-range + staff filtering (inputs empty = unbounded).
  const filtered = useMemo(() => {
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59.999`) : null;
    return entries.filter((e) => {
      if (from && e.at < from) return false;
      if (to && e.at > to) return false;
      if (staffId !== "all" && e.staffId !== staffId) return false;
      return true;
    });
  }, [entries, fromDate, toDate, staffId]);

  const visible = filtered.slice(0, visibleCount);

  // Grouped view (All Staff): one section per member, newest activity first.
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; rows: ActivityEntry[] }>();
    for (const e of visible) {
      const g = map.get(e.staffId);
      if (g) g.rows.push(e);
      else map.set(e.staffId, { name: e.staffName, rows: [e] });
    }
    return [...map.values()].sort(
      (a, b) => b.rows[0].at.getTime() - a.rows[0].at.getTime()
    );
  }, [visible]);

  useEffect(() => setVisibleCount(PAGE_SIZE), [fromDate, toDate, staffId]);

  if (!canView) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">Staff activity is restricted</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Only administrators can monitor staff activity.
          </p>
        </CardContent>
      </Card>
    );
  }

  const selectCls =
    "h-9 rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40";

  const amountCell = (amount?: number) =>
    amount !== undefined ? (
      <TableCell className="text-right text-sm tabular-nums">{formatUGX(amount, currency)}</TableCell>
    ) : (
      <TableCell className="text-right text-sm text-mid-gray">—</TableCell>
    );

  const activityTable = (rows: ActivityEntry[], showStaff: boolean) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-center">Time</TableHead>
            {showStaff && <TableHead className="hidden sm:table-cell text-center">Staff</TableHead>}
            <TableHead className="text-center">Action</TableHead>
            <TableHead className="text-left">Details</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="whitespace-nowrap text-center text-sm text-mid-gray">
                {formatWhen(e.at)}
              </TableCell>
              {showStaff && (
                <TableCell className="hidden sm:table-cell text-center text-sm font-medium">
                  {e.staffName}
                </TableCell>
              )}
              <TableCell className="text-center">
                <Badge variant="secondary" className={`text-xs ${e.badgeCls}`}>
                  {e.action}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">{e.summary}</TableCell>
              {amountCell(e.amount)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="actFrom">From</Label>
            <Input
              id="actFrom"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={`${selectCls} w-full sm:w-40`}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="actTo">To</Label>
            <Input
              id="actTo"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className={`${selectCls} w-full sm:w-40`}
            />
          </div>
          <div className="space-y-1.5 sm:min-w-48 sm:flex-1">
            <Label htmlFor="actStaff">Staff</Label>
            <select
              id="actStaff"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className={`${selectCls} w-full`}
            >
              <option value="all">All Staff</option>
              {activeUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Feed */}
      {isLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Loading activity…</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No activity in this period.</p>
            <p className="text-xs text-muted-foreground">
              Widen the date range or select another staff member.
            </p>
          </CardContent>
        </Card>
      ) : staffId === "all" ? (
        <div className="space-y-4">
          {grouped.map((g) => (
            <Card key={g.name}>
              <CardContent className="p-0">
                <div className="border-b border-hairline px-4 py-3">
                  <p className="text-sm font-semibold">{g.name}</p>
                  <p className="text-xs text-mid-gray">
                    {g.rows.length} action{g.rows.length === 1 ? "" : "s"} shown
                  </p>
                </div>
                {activityTable(g.rows, false)}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">{activityTable(visible, false)}</CardContent>
        </Card>
      )}

      {/* Load more */}
      {filtered.length > visibleCount && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
            Load more ({filtered.length - visibleCount} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}
