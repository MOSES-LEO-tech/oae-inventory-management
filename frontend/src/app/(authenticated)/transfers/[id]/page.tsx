"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
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
import { ArrowLeft, PackageCheck, Truck, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/user-error";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useInventoryStore } from "@/stores/inventory-store";
import { useAuthStore } from "@/stores/auth-store";
import { StockTransfer, Store } from "@/types";
import { getQuantityTypeLabel, mergeQuantityTypes } from "@/lib/qty-label";

const STATUS_BADGES: Record<string, string> = {
  PENDING: "border border-hairline bg-transparent text-ink",
  IN_TRANSIT: "bg-ink/10 text-ink",
  COMPLETED: "bg-ink text-paper",
  CANCELLED: "bg-canvas text-ink",
};

function getStoreName(storeId: string, stores: Store[]): string {
  const store = stores.find((s) => s.id === storeId);
  return store?.name || storeId;
}

export default function TransferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const {
    transfers,
    stores,
    items,
    inventoryItems: itemCatalog,
    fetchTransfers,
    fetchStores,
    fetchItems,
    dispatchTransfer,
    completeTransfer,
    cancelTransfer,
  } = useInventoryStore();
  const { user, canAccessStore } = useAuthStore();
  const [transfer, setTransfer] = useState<StockTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [confirmDispatch, setConfirmDispatch] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptQuantities, setReceiptQuantities] = useState<Record<string, Record<string, number>>>({});
  const [cancelling, setCancelling] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Quantity-type label for a transfer line (catalog or row copy ids).
  const qtyLabel = (itemId: string, qtyTypeId: string) =>
    getQuantityTypeLabel(
      mergeQuantityTypes(
        itemCatalog.find((c) => c.id === itemId)?.quantityTypes,
        items.find((r) => r.itemId === itemId)?.quantityTypes
      ),
      qtyTypeId
    );

  // Fetch data and find the specific transfer
  useEffect(() => {
    const loadData = async () => {
      if (user?.facilityId) {
        await fetchTransfers();
        await fetchStores();
        await fetchItems();
        const found = transfers.find((t: StockTransfer) => t.id === id);
        setTransfer(found || null);
      }
      setLoading(false);
    };
    loadData();
  }, [id, user?.facilityId, fetchTransfers, fetchStores, fetchItems, transfers]);

  // Success path: toast + refetch — the effect above re-derives `transfer`
  // from the refreshed slice, so no window.location.reload() is needed.
  const handleDispatchConfirmed = async () => {
    if (!user) return;
    try {
      setDispatching(true);
      await dispatchTransfer(transfer!.id, user.id, user.name);
      toast.success("Transfer dispatched — stock is in transit");
      setConfirmDispatch(false);
      await fetchTransfers();
    } catch (error) {
      console.error("Failed to dispatch transfer:", error);
      toast.error(toUserMessage(error, "Failed to dispatch transfer"));
    } finally {
      setDispatching(false);
    }
  };

  const openReceipt = () => {
    // Prefill with the dispatched quantities — the receiver confirms or corrects.
    const initial: Record<string, Record<string, number>> = {};
    transfer!.items.forEach((item) => {
      initial[item.itemId] = { ...(item.quantities || {}) };
    });
    setReceiptQuantities(initial);
    setReceiptOpen(true);
  };

  const handleComplete = async () => {
    if (!user) return;
    try {
      setCompleting(true);
      await completeTransfer(
        transfer!.id,
        transfer!.items.map((item) => ({
          itemId: item.itemId,
          quantities: { ...(receiptQuantities[item.itemId] || item.quantities) },
        })),
        user.id,
        user.name
      );
      toast.success("Receipt confirmed — transfer completed");
      setReceiptOpen(false);
      await fetchTransfers();
    } catch (error) {
      console.error("Failed to complete transfer:", error);
      toast.error(toUserMessage(error, "Failed to complete transfer"));
    } finally {
      setCompleting(false);
    }
  };

  const handleCancelConfirmed = async () => {
    if (!user) return;
    try {
      setCancelling(true);
      await cancelTransfer(transfer!.id, user.id, user.name, cancelReason.trim());
      toast.success("Transfer cancelled");
      setCancelOpen(false);
      setCancelReason("");
      await fetchTransfers();
    } catch (error) {
      console.error("Failed to cancel transfer:", error);
      toast.error(toUserMessage(error, "Failed to cancel transfer"));
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
        <Link href="/transfers" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Transfers
        </Link>
        <p className="text-muted-foreground">Transfer request #{transfer.id}</p>
      </div>

      {/* Info Card */}
      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant="secondary" className={`mt-1 text-xs ${STATUS_BADGES[transfer.status]}`}>
                {transfer.status.replace("_", " ")}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">From</p>
              <p className="text-sm font-medium">{getStoreName(transfer.fromStoreId, stores)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">To</p>
              <p className="text-sm font-medium">{getStoreName(transfer.toStoreId, stores)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Requested</p>
              <p className="text-sm font-medium">
                {transfer.createdAt?.toDate && new Date(transfer.createdAt.toDate()).toLocaleDateString("en-GB", {
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
                <TableHead className="text-right">Quantities</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfer.items.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="text-sm font-medium">{item.itemName}</TableCell>
                  <TableCell className="text-right text-sm">
                    {Object.entries(item.quantities || {}).map(([k, v]) => (
                      <span key={k} className="mr-2">
                        {v} {qtyLabel(item.itemId, k)}
                      </span>
                    ))}
                    {item.receivedQuantities && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {Object.entries(item.receivedQuantities).map(([k, v]) => (
                          <span key={k} className="mr-2">
                            Received: {v} {qtyLabel(item.itemId, k)}
                          </span>
                        ))}
                      </div>
                    )}
                  </TableCell>
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
          {canAccessStore(transfer.fromStoreId) && (
            <Button onClick={() => setConfirmDispatch(true)} disabled={dispatching || cancelling}>
              {dispatching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Truck className="mr-2 h-4 w-4" />
              )}
              {dispatching ? "Dispatching..." : "Dispatch Transfer"}
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={() => setCancelOpen(true)}
            disabled={dispatching || cancelling}
          >
            <XCircle className="mr-2 h-4 w-4" /> Cancel Transfer
          </Button>
        </div>
      )}

      {transfer.status === "IN_TRANSIT" && (
        <div className="flex gap-3">
          {canAccessStore(transfer.toStoreId) && (
            <Button onClick={openReceipt} disabled={completing || cancelling}>
              {completing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PackageCheck className="mr-2 h-4 w-4" />
              )}
              Confirm Receipt
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={() => setCancelOpen(true)}
            disabled={completing || cancelling}
          >
            <XCircle className="mr-2 h-4 w-4" /> Cancel Transfer
          </Button>
        </div>
      )}

      {transfer.status === "COMPLETED" && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Transfer completed successfully</p>
            {transfer.receivedByName && (
              <p className="mt-1 text-sm">
                Received by {transfer.receivedByName}
                {transfer.receivedAt?.toDate && (
                  <> on {new Date(transfer.receivedAt.toDate()).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}</>
                )}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {transfer.status === "CANCELLED" && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Transfer cancelled</p>
            {transfer.cancelReason && <p className="mt-1 text-sm">Reason: {transfer.cancelReason}</p>}
            {transfer.cancelledByName && (
              <p className="mt-1 text-xs text-muted-foreground">
                Cancelled by {transfer.cancelledByName}
                {transfer.cancelledAt?.toDate && (
                  <> on {new Date(transfer.cancelledAt.toDate()).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}</>
                )}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmDispatch}
        onOpenChange={setConfirmDispatch}
        title="Dispatch this transfer?"
        message={`Stock will leave "${getStoreName(transfer.fromStoreId, stores)}" and the transfer will be marked IN TRANSIT.`}
        confirmLabel={dispatching ? "Dispatching..." : "Dispatch"}
        loading={dispatching}
        onConfirm={handleDispatchConfirmed}
      />

      {/* Receipt dialog — actual quantities; variances are logged as adjustments */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm receipt</DialogTitle>
            <DialogDescription>
              Enter the actual quantities received at {getStoreName(transfer.toStoreId, stores)}. Differences from the dispatched amounts are logged as adjustments.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1">
            {transfer.items.map((item, idx) => (
              <div key={idx} className="space-y-2">
                <p className="text-sm font-medium">{item.itemName}</p>
                {Object.entries(item.quantities || {}).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3">
                    <Label className="text-xs text-muted-foreground">
                      {qtyLabel(item.itemId, k)} (sent {v})
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      className="w-24 text-right"
                      value={receiptQuantities[item.itemId]?.[k] ?? v}
                      onChange={(e) => {
                        const parsed = Math.max(0, parseInt(e.target.value, 10) || 0);
                        setReceiptQuantities((prev) => ({
                          ...prev,
                          [item.itemId]: { ...(prev[item.itemId] || item.quantities), [k]: parsed },
                        }));
                      }}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiptOpen(false)} disabled={completing}>
              Back
            </Button>
            <Button onClick={handleComplete} disabled={completing}>
              {completing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PackageCheck className="mr-2 h-4 w-4" />
              )}
              {completing ? "Confirming..." : "Confirm Receipt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel dialog — reason required */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this transfer?</DialogTitle>
            <DialogDescription>
              {transfer.status === "IN_TRANSIT"
                ? `Stock is in transit and will be returned to "${getStoreName(transfer.fromStoreId, stores)}". This cannot be undone.`
                : `The request will be marked CANCELLED. Stock remains at "${getStoreName(transfer.fromStoreId, stores)}". This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Reason (required)</Label>
            <Textarea
              id="cancel-reason"
              rows={3}
              placeholder="e.g. Vehicle breakdown, wrong items requested..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={cancelling}>
              Keep Transfer
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelConfirmed}
              disabled={cancelling || !cancelReason.trim()}
            >
              {cancelling ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              {cancelling ? "Cancelling..." : "Cancel Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
