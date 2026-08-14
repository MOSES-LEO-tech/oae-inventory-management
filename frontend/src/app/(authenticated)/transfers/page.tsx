"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
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
import { ArrowRight, Plus, ArrowRightLeft } from "lucide-react";
import { MOCK_TRANSFERS, getStoreName } from "@/lib/mock-data";

type FilterStatus = "ALL" | "PENDING" | "COMPLETED" | "CANCELLED";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "border border-hairline bg-transparent text-ink",
  COMPLETED: "bg-ink text-paper",
  CANCELLED: "bg-canvas text-ink",
};

export default function TransfersPage() {
  const [filter, setFilter] = useState<FilterStatus>("ALL");

  const filtered = useMemo(() => {
    if (filter === "ALL") return MOCK_TRANSFERS;
    return MOCK_TRANSFERS.filter((t) => t.status === filter);
  }, [filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-heading-sm font-semibold tracking-heading-sm">Stock Transfers</h1>
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
        {(["ALL", "PENDING", "COMPLETED", "CANCELLED"] as FilterStatus[]).map((s) => (
          <Button
            key={s}
            variant={filter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(s)}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
          </Button>
        ))}
      </div>

      {/* Transfers Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<ArrowRightLeft className="h-10 w-10" />}
              title="No transfers found"
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
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
                    <TableCell>
                      {new Date(t.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {getStoreName(t.fromStoreId)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {getStoreName(t.toStoreId)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {t.items.map((i) => `${i.itemName} (${i.qtyPc}PC)`).join(", ")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[t.status]}`}>
                        {t.status}
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
