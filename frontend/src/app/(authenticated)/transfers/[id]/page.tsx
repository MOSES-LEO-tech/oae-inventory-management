"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { CheckCircle, XCircle } from "lucide-react";
import { MOCK_TRANSFERS, getStoreName } from "@/lib/mock-data";

const STATUS_BADGES: Record<string, string> = {
  PENDING: "border border-hairline bg-transparent text-ink",
  COMPLETED: "bg-ink text-paper",
  CANCELLED: "bg-canvas text-ink",
};

export default function TransferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const transfer = MOCK_TRANSFERS.find((t) => t.id === id);

  if (!transfer) {
    return (
      <div className="space-y-6">
        <h1 className="text-heading-sm font-semibold tracking-heading-sm">Transfer Not Found</h1>
        <Link href="/transfers"><Button>Back to Transfers</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ label: "Transfers", href: "/transfers" }, { label: "Transfer Details" }]} />
        <h1 className="text-heading-sm font-semibold tracking-heading-sm">Transfer Details</h1>
        <p className="text-body text-mid-gray">Transfer request #{transfer.id}</p>
      </div>

      {/* Info Card */}
      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant="secondary" className={`mt-1 text-xs ${STATUS_BADGES[transfer.status]}`}>
                {transfer.status}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">From</p>
              <p className="text-sm font-medium">{getStoreName(transfer.fromStoreId)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">To</p>
              <p className="text-sm font-medium">{getStoreName(transfer.toStoreId)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Requested</p>
              <p className="text-sm font-medium">
                {new Date(transfer.createdAt).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transfer Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Name</TableHead>
                <TableHead className="text-right">Qty PC</TableHead>
                <TableHead className="text-right">Qty CTN</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfer.items.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{item.itemName}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.qtyPc}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.qtyCtn}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Notes */}
      {transfer.notes && (
        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm">{transfer.notes}</p></CardContent>
        </Card>
      )}

      {/* Actions */}
      {transfer.status === "PENDING" && (
        <div className="flex gap-3">
          <Button onClick={() => alert("Transfer completed (dev mode)")}>
            <CheckCircle className="mr-2 h-4 w-4" /> Complete Transfer
          </Button>
          <Button variant="destructive" onClick={() => alert("Transfer cancelled (dev mode)")}>
            <XCircle className="mr-2 h-4 w-4" /> Cancel Transfer
          </Button>
        </div>
      )}

      {transfer.status === "COMPLETED" && transfer.completedAt && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Completed by <span className="font-medium text-foreground">{transfer.completedBy}</span> on {new Date(transfer.completedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
