"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Bell, BellRing, AlertTriangle, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInventoryStore } from "@/stores/inventory-store";
import { useAuthStore } from "@/stores/auth-store";
import { QuantityType } from "@/types";
import { getQuantityTypeLabel, mergeQuantityTypes } from "@/lib/qty-label";

interface LowStockAlert {
  id: string;
  itemName: string;
  itemType: string;
  storeId: string;
  quantities: Record<string, number>;
  thresholds: Record<string, number>;
  quantityTypes: QuantityType[];
  isCritical: boolean;
  // Snapshot of the alert's quantities + thresholds: restocking while still
  // low produces a new signature, so the updated alert re-appears unread.
  signature: string;
}

export function NotificationBell() {
  const { user } = useAuthStore();
  const {
    items,
    inventoryItems,
    stores,
    facilitySettings,
    fetchInventory,
    fetchItems,
    fetchStores,
    fetchFacilitySettings,
  } = useInventoryStore();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const isEnabled = facilitySettings?.lowStockAlertEnabled ?? true;

  // Record keys are quantity-type IDs — resolve each to its readable label
  // against the merged catalog + row copies so raw ids never leak.
  const formatQty = (quantities: Record<string, number>, quantityTypes: QuantityType[]) =>
    Object.entries(quantities)
      .map(([k, v]) => `${v} ${getQuantityTypeLabel(quantityTypes, k)}`)
      .join(" / ");

  const formatThresholds = (thresholds: Record<string, number>, quantityTypes: QuantityType[]) =>
    Object.entries(thresholds)
      .map(([k, v]) => `${v} ${getQuantityTypeLabel(quantityTypes, k)}`)
      .join(" / ");

  // ── Alert derivation (reactive) ──────────────────────────────────────────
  // Alerts are derived from the live inventory slices instead of a local
  // snapshot: stock in/out/adjust/transfer mirror into `items` immediately
  // (online and offline), so the dialog updates in the same render cycle —
  // no polling delay, and no missed update when a fetch is cache-deduped.
  const alerts = useMemo<LowStockAlert[]>(() => {
    if (!isEnabled || !user?.facilityId) return [];

    // Only quantity types the admin actually gave a threshold (> 0)
    // participate in alerting — zero/absent thresholds mean "never alert
    // for this type", which stops items from alerting forever.
    const isLow = (
      quantities: Record<string, number>,
      thresholds: Record<string, number>
    ) => {
      const keys = new Set([...Object.keys(quantities), ...Object.keys(thresholds)]);
      return [...keys].some(
        (key) => (thresholds[key] ?? 0) > 0 && (quantities[key] ?? 0) <= (thresholds[key] ?? 0)
      );
    };

    // Per-store scoping: admins and users with an empty storeIds grant
    // oversee the whole facility; everyone else sees ONLY their granted
    // stores' alerts — never another store's.
    const scopedItems =
      user.role === "admin" || !user.storeIds || user.storeIds.length === 0
        ? items
        : items.filter((item) => user.storeIds!.includes(item.storeId));

    return scopedItems
      .filter((item) => isLow(item.quantities ?? {}, item.lowStockThresholds ?? {}))
      .map((item) => {
        const quantities = item.quantities ?? {};
        const thresholds = item.lowStockThresholds ?? {};
        const keys = new Set([...Object.keys(quantities), ...Object.keys(thresholds)]);
        // Critical: any thresholded type is completely out of stock.
        const isCritical = [...keys].some(
          (key) => (thresholds[key] ?? 0) > 0 && (quantities[key] ?? 0) === 0
        );
        const catalogItem = inventoryItems.find((c) => c.id === item.itemId);
        return {
          id: item.id,
          itemName: item.itemName,
          itemType: item.itemType,
          storeId: item.storeId,
          quantities,
          thresholds,
          quantityTypes: mergeQuantityTypes(catalogItem?.quantityTypes, item.quantityTypes ?? []),
          isCritical,
          signature: JSON.stringify({ q: quantities, t: thresholds }),
        };
      })
      .sort((a, b) => {
        if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1;
        const aTotal = Object.values(a.quantities).reduce((sum, q) => sum + q, 0);
        const bTotal = Object.values(b.quantities).reduce((sum, q) => sum + q, 0);
        return aTotal - bTotal;
      });
  }, [items, inventoryItems, isEnabled, user]);

  // ── Read (dismiss) state ─────────────────────────────────────────────────
  // Per-user, persisted locally. A dismissal stores the alert's signature:
  // the alert stays hidden while its numbers are unchanged, but restocking
  // to a new (still-low) level re-alerts with the updated numbers.
  const readStorageKey =
    user?.facilityId && user ? `inv-read-alerts:${user.facilityId}:${user.id}` : null;
  const [readSignatures, setReadSignatures] = useState<Record<string, string>>({});
  const [readLoaded, setReadLoaded] = useState(false);

  useEffect(() => {
    if (!readStorageKey) return;
    try {
      const raw = localStorage.getItem(readStorageKey);
      if (raw) setReadSignatures(JSON.parse(raw) as Record<string, string>);
    } catch {
      // Corrupt entry — start clean rather than crash the bell.
    }
    setReadLoaded(true);
  }, [readStorageKey]);

  const persistRead = useCallback(
    (next: Record<string, string>) => {
      if (!readStorageKey) return;
      try {
        localStorage.setItem(readStorageKey, JSON.stringify(next));
      } catch {
        // Over quota — dismissal stays session-local.
      }
    },
    [readStorageKey]
  );

  const markRead = useCallback(
    (alert: LowStockAlert) => {
      setReadSignatures((prev) => {
        const next = { ...prev, [alert.id]: alert.signature };
        persistRead(next);
        return next;
      });
    },
    [persistRead]
  );

  // A resolved alert's dismissal marker is stale: prune it so a future
  // relapse re-alerts instead of being silently swallowed forever.
  useEffect(() => {
    if (!readLoaded) return;
    const lowIds = new Set(alerts.map((a) => a.id));
    const stale = Object.keys(readSignatures).filter((id) => !lowIds.has(id));
    if (stale.length === 0) return;
    setReadSignatures((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([id]) => lowIds.has(id))
      );
      persistRead(next);
      return next;
    });
  }, [alerts, readLoaded, readSignatures, persistRead]);

  const visibleAlerts = useMemo(
    () => alerts.filter((a) => readSignatures[a.id] !== a.signature),
    [alerts, readSignatures]
  );
  const unreadCount = visibleAlerts.length;

  // ── Data refresh (fetches only; alerts stay reactive) ────────────────────
  // All fetches are deduped by the store's 60s read cache, so refreshes are
  // free while the cache is warm. We refresh on mount and when the dialog is
  // opened — the old always-on 60s poll is gone (it cost reads even with the
  // dialog closed, and its deduped fetches were the "never updates" bug).
  const refresh = useCallback(
    async (silent = true) => {
      if (!isEnabled || !user?.facilityId) {
        if (!silent) setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      try {
        setError(null);
        await Promise.all([
          fetchInventory(),
          fetchItems(),
          fetchStores(),
          fetchFacilitySettings(),
        ]);
      } catch (err) {
        console.error("[NotificationBell] Failed to check low stock:", err);
        // Never present a fetch failure as "no low stock" — surface it.
        setError("Couldn't check stock levels.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [isEnabled, user?.facilityId, fetchInventory, fetchItems, fetchStores, fetchFacilitySettings]
  );

  useEffect(() => {
    refresh(false);
  }, [refresh]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const getStoreName = (storeId: string) => {
    return stores.find((s) => s.id === storeId)?.name || storeId;
  };

  // No facility (e.g. super-admin) means there is nothing to check — the
  // bell would otherwise sit dead and unexplained.
  if (!isEnabled || !user?.facilityId) return null;

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen(!open)}
        aria-label={`Low stock alerts: ${unreadCount}`}
        disabled={loading}
      >
        {unreadCount > 0 ? (
          <BellRing className="h-5 w-5 text-amber-500" />
        ) : (
          <Bell className="h-5 w-5" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
        {loading && <Loader2 className="absolute -top-1 -right-1 h-3 w-3 animate-spin text-muted-foreground" />}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 border border-hairline rounded-lg shadow-lg bg-popover z-50">
          <div className="flex items-center justify-between p-3 border-b border-hairline">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="font-medium text-sm">Low Stock Alerts</span>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="ml-2 text-sm text-muted-foreground">Checking stock...</span>
            </div>
          ) : error ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => refresh(false)}
              >
                Try again
              </Button>
            </div>
          ) : visibleAlerts.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No low stock items
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {visibleAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-stretch border-b last:border-b-0 ${
                    alert.isCritical ? "bg-red-50/50 dark:bg-red-950/20" : ""
                  }`}
                >
                  <Link
                    href={`/inventory/${alert.id}/edit${alert.storeId ? `?store=${alert.storeId}` : ""}`}
                    className="flex-1 min-w-0 px-4 py-3 text-sm hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      {alert.isCritical && (
                        <span className="mt-1.5 flex h-2 w-2 shrink-0 rounded-full bg-red-500" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{alert.itemName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {alert.itemType} · {getStoreName(alert.storeId)}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs">
                          <span className={`font-medium ${alert.isCritical ? "text-red-600" : "text-amber-600"}`}>
                            {formatQty(alert.quantities, alert.quantityTypes)}
                          </span>
                          <span className="text-muted-foreground">(Threshold: {formatThresholds(alert.thresholds, alert.quantityTypes)})</span>
                        </div>
                        {alert.isCritical && (
                          <span className="inline-block mt-1 rounded bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-400">
                            Critical — Out of Stock
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => markRead(alert)}
                    className="shrink-0 px-3 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={`Mark "${alert.itemName}" alert as read`}
                    title="Mark as read"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
