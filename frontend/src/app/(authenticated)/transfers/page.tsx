"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight, Plus, ArrowRightLeft, Loader2 } from "lucide-react";
import { useInventoryStore } from "@/stores/inventory-store";
import { useAuthStore } from "@/stores/auth-store";
import { StockTransfer, Store } from "@/types";
import { getQuantityTypeLabel, mergeQuantityTypes } from "@/lib/qty-label";

type FilterStatus = "ALL" | "PENDING" | "IN_TRANSIT" | "COMPLETED" | "CANCELLED";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "border border-hairline bg-transparent text-ink",
  IN_TRANSIT: "bg-ink/10 text-ink",
  COMPLETED: "bg-ink text-paper",
  CANCELLED: "bg-canvas text-ink",
};

const FILTER_LABELS: Record<FilterStatus, string> = {
  ALL: "All",
  PENDING: "Pending",
  IN_TRANSIT: "In Transit",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function getStoreName(storeId: string, stores: Store[]): string {
  const store = stores.find((s) => s.id === storeId);
  return store?.name || storeId;
}

export default function TransfersPage() {
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const {
    transfers,
    stores,
    items,
    inventoryItems: itemCatalog,
    fetchTransfers,
    fetchStores,
    fetchItems,
    isLoadingTransfers,
  } = useInventoryStore();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);

  // Fetch data on mount
  useEffect(() => {
    if (user?.facilityId) {
      fetchTransfers();
      fetchStores();
      fetchItems();
    }
    setLoading(false);
  }, [user?.facilityId, fetchTransfers, fetchStores, fetchItems]);

  const filtered = useMemo(() => {
    if (filter === "ALL") return transfers;
    return transfers.filter((t: StockTransfer) => t.status === filter);
  }, [filter, transfers]);

  if (loading) {
    return (
      <div className="space-y-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-muted-foreground">Transfer stock between stores.</p>
        </div>
        <Link href="/transfers/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Transfer
          </Button>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(["ALL", "PENDING", "IN_TRANSIT", "COMPLETED", "CANCELLED"] as FilterStatus[]).map((s) => (
          <Button
            key={s}
            variant={filter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(s)}
          >
            {FILTER_LABELS[s]}
          </Button>
        ))}
      </div>

      {/* Transfers Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ArrowRightLeft className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No transfers found.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead className="hidden sm:table-cell">Items</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm">
                        {t.createdAt?.toDate && new Date(t.createdAt.toDate()).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {getStoreName(t.fromStoreId, stores)}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {getStoreName(t.toStoreId, stores)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">
                        {t.items.map((i) => {
                          // Transfer lines may be keyed against ids from
                          // either the catalog's or the row's copies.
                          const qts = mergeQuantityTypes(
                            itemCatalog.find((c) => c.id === i.itemId)?.quantityTypes,
                            items.find((r) => r.itemId === i.itemId)?.quantityTypes
                          );
                          const qty = Object.entries(i.quantities || {})
                            .map(([k, v]) => `${v} ${getQuantityTypeLabel(qts, k)}`)
                            .join(" / ");
                          return `${i.itemName} (${qty})`;
                        }).join(", ")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[t.status]}`}>
                          {t.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/transfers/${t.id}`}>
                          <Button variant="ghost" size="sm">
                            View <ArrowRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
