"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Plus, Bell, Moon, Sun, Loader2, LogOut, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/user-error";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInventoryStore } from "@/stores/inventory-store";
import { useAuthStore } from "@/stores/auth-store";
import { getFacility, updateFacilityProfile } from "@/lib/services/facility";
import { getDocument } from "@/lib/firebase/firestore";
import { sendPasswordReset, signOut } from "@/lib/firebase/auth";
import type { Currency, Facility, FacilityLicense, Store, FacilitySettings } from "@/types";

export default function SettingsPage() {
  const {
    stores,
    items,
    fetchStores,
    fetchInventory,
    addStore,
    updateStore,
  } = useInventoryStore();
  const { user, clearUser } = useAuthStore();

  // Duty-based section visibility (Medicore pattern): the page renders for
  // everyone (sign-out lives here); admin-only sections appear for admins
  // or users granted the matching duty by an admin.
  const canManageSettings =
    user?.role === "admin" || !!user?.duties?.manage_settings;
  const canManageStores =
    user?.role === "admin" || !!user?.duties?.manage_stores;
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  // next-themes resolves the theme client-side; guard until mounted to avoid hydration mismatch.
  const [themeMounted, setThemeMounted] = useState(false);
  useEffect(() => setThemeMounted(true), []);
  const darkModeEnabled = themeMounted && resolvedTheme === "dark";

  // Real data loads — replaces the previous mock list and stale-slice reads
  useEffect(() => {
    fetchStores();
    fetchInventory();
  }, [fetchStores, fetchInventory]);

  // License store limit (licenses/{facilityId}). A missing/unreadable license
  // fails open (no limit) so store management never gets bricked.
  const [licenseMaxStores, setLicenseMaxStores] = useState<number | null>(null);
  useEffect(() => {
    if (!canManageStores || !user?.facilityId) return;
    let cancelled = false;
    getDocument<FacilityLicense>("licenses", user.facilityId)
      .then((l) => {
        if (!cancelled) setLicenseMaxStores(l?.features?.maxStores ?? null);
      })
      .catch(() => {
        if (!cancelled) setLicenseMaxStores(null);
      });
    return () => {
      cancelled = true;
    };
  }, [canManageStores, user?.facilityId]);

  const [facility, setFacility] = useState<Facility | null>(null);

  // The `stores` slice is active-only (fetchStores filters); the facility doc
  // holds the full list including deactivated stores (needed for reactivation).
  const allStores: Store[] =
    facility?.stores && facility.stores.length > 0 ? facility.stores : stores;
  const activeStoreCount = allStores.filter((s) => s.isActive !== false).length;

  const validateStoreName = (name: string, excludeId?: string): string | null => {
    if (!name) return "Store name is required";
    if (name.length > 40) return "Store name must be 40 characters or fewer";
    const duplicate = allStores.some(
      (s) =>
        s.id !== excludeId &&
        s.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) return `A store named "${name}" already exists`;
    return null;
  };

  // A store that still holds stock cannot be deactivated (its quantities
  // would become unmanageable — no pickers or dashboards list it).
  const storeHasStock = (storeId: string) =>
    items.some(
      (i) =>
        i.storeId === storeId &&
        Object.values(i.quantities ?? {}).some((q) => q > 0)
    );

  // Re-read the facility doc after store mutations so the full-store list
  // (incl. isActive flags) stays fresh for the table below.
  const refreshFacilityStores = async () => {
    if (!user?.facilityId) return;
    try {
      const f = await getFacility(user.facilityId);
      if (f) setFacility(f);
    } catch {
      // Keep the previous snapshot; the slice mirror still reflects the change.
    }
  };

  const [showStoreForm, setShowStoreForm] = useState(false);
  const [storeForm, setStoreForm] = useState({ name: "", address: "" });
  const [addingStore, setAddingStore] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [editStoreForm, setEditStoreForm] = useState({ name: "", address: "" });
  const [savingStore, setSavingStore] = useState(false);

  const handleAddStore = async () => {
    if (!user?.facilityId) {
      toast.error("No facility linked to this account");
      return;
    }
    const name = storeForm.name.trim();
    const nameError = validateStoreName(name);
    if (nameError) {
      toast.error(nameError);
      return;
    }
    if (licenseMaxStores !== null && activeStoreCount >= licenseMaxStores) {
      toast.error(`Your plan allows up to ${licenseMaxStores} stores`);
      return;
    }
    try {
      setAddingStore(true);
      await addStore({
        name,
        type: stores.length === 0 ? "main" : "branch",
        address: storeForm.address.trim() || undefined,
        isActive: true,
      });
      toast.success(`Store "${name}" added`);
      setShowStoreForm(false);
      setStoreForm({ name: "", address: "" });
      await refreshFacilityStores();
    } catch (error) {
      console.error("Failed to add store:", error);
      toast.error(toUserMessage(error, "Failed to add store"));
    } finally {
      setAddingStore(false);
    }
  };

  const handleSaveStoreEdit = async () => {
    if (!editingStore) return;
    const name = editStoreForm.name.trim();
    const nameError = validateStoreName(name, editingStore.id);
    if (nameError) {
      toast.error(nameError);
      return;
    }
    try {
      setSavingStore(true);
      await updateStore(editingStore.id, { name, address: editStoreForm.address.trim() });
      toast.success(`Store "${name}" updated`);
      setEditingStore(null);
      await refreshFacilityStores();
    } catch (error) {
      console.error("Failed to update store:", error);
      toast.error(toUserMessage(error, "Failed to update store"));
    } finally {
      setSavingStore(false);
    }
  };

  const [togglingStoreId, setTogglingStoreId] = useState<string | null>(null);

  const handleToggleStoreActive = async (store: Store) => {
    const activating = store.isActive === false;
    if (!activating) {
      if (activeStoreCount <= 1) {
        toast.error("At least one active store is required");
        return;
      }
      if (storeHasStock(store.id)) {
        toast.error(`"${store.name}" still holds stock — sell or transfer it before deactivating`);
        return;
      }
    } else if (licenseMaxStores !== null && activeStoreCount >= licenseMaxStores) {
      toast.error(`Your plan allows up to ${licenseMaxStores} stores`);
      return;
    }
    try {
      setTogglingStoreId(store.id);
      await updateStore(store.id, { isActive: activating });
      toast.success(activating ? `"${store.name}" activated` : `"${store.name}" deactivated`);
      await refreshFacilityStores();
    } catch (error) {
      console.error("Failed to update store status:", error);
      toast.error(toUserMessage(error, "Failed to update store status"));
    } finally {
      setTogglingStoreId(null);
    }
  };

  // Business profile — Medicore-pattern Facility Profile section (admins and
  // manage_settings holders only; hidden for other staff).
  const [profileForm, setProfileForm] = useState<{ name: string; currency: Currency }>({
    name: "",
    currency: "UGX",
  });
  const [loadingFacility, setLoadingFacility] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user?.facilityId) {
      setLoadingFacility(false);
      return;
    }
    getFacility(user.facilityId)
      .then((f) => {
        if (cancelled || !f) return;
        setFacility(f);
        setProfileForm({ name: f.name ?? "", currency: f.currency ?? "UGX" });
      })
      .catch((error) => {
        console.error("[Settings] Facility load failed:", error);
      })
      .finally(() => {
        if (!cancelled) setLoadingFacility(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.facilityId]);

  const handleSaveProfile = async () => {
    if (!user?.facilityId) return;
    const name = profileForm.name.trim();
    if (!name) {
      toast.error("Business name is required");
      return;
    }
    try {
      setSavingProfile(true);
      await updateFacilityProfile(user.facilityId, {
        name,
        currency: profileForm.currency,
      });
      setFacility((prev) =>
        prev ? { ...prev, name, currency: profileForm.currency } : prev
      );
      // Push the new currency/name into the store immediately (bypass the
      // 60s read cache) so all pages re-format amounts without a reload.
      const { fetchFacilitySettings } = useInventoryStore.getState();
      await fetchFacilitySettings(true);
      toast.success("Business profile saved");
    } catch (error) {
      console.error("[Settings] Profile save failed:", error);
      toast.error("Could not save changes. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!user?.email) return;
    try {
      setSendingReset(true);
      await sendPasswordReset(user.email);
      toast.success(`Password reset link sent to ${user.email}`);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === "auth/too-many-requests") {
        toast.error("Too many attempts. Please try again later.");
      } else {
        console.error("[Settings] Password reset failed:", error);
        toast.error("Failed to send password reset email.");
      }
    } finally {
      setSendingReset(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await signOut();
      clearUser();
      router.push("/");
    } catch (error) {
      console.error("[Settings] Sign out failed:", error);
      toast.error("Failed to sign out. Please try again.");
      setSigningOut(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground">
          Manage your business profile, appearance, account, and stores.
        </p>
      </div>

      {/* Business Profile — admins and manage_settings holders edit
          name/currency; hidden for other staff (Medicore pattern). */}
      {canManageSettings && (
        <Card>
          <CardHeader>
            <CardTitle>Business Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="business-name" className="text-sm font-medium">
                Business Name
              </label>
              <Input
                id="business-name"
                value={profileForm.name}
                onChange={(e) =>
                  setProfileForm((prev) => ({ ...prev, name: e.target.value }))
                }
                disabled={loadingFacility || savingProfile}
                placeholder="Loading..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Default Currency</label>
              <p className="text-xs text-muted-foreground">
                New records default to this currency.
              </p>
              <Select
                value={profileForm.currency}
                onValueChange={(value) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    currency: value as Currency,
                  }))
                }
                disabled={loadingFacility || savingProfile}
              >
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UGX">UGX — Ugandan Shilling</SelectItem>
                  <SelectItem value="KES">KES — Kenyan Shilling</SelectItem>
                  <SelectItem value="USD">USD — US Dollar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              onClick={handleSaveProfile}
              disabled={savingProfile || loadingFacility}
            >
              {savingProfile ? (
                <>
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Appearance — moved here from the header (Legacy Medicore pattern) */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-hairline bg-canvas">
                {darkModeEnabled ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">Dark mode</p>
                <p className="text-xs text-muted-foreground">
                  Reduce glare in low-light environments.
                </p>
              </div>
            </div>
            <Switch
              checked={darkModeEnabled}
              disabled={!themeMounted}
              onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              aria-label="Toggle dark mode"
            />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      {canManageSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Low Stock Alerts</label>
              <p className="text-xs text-muted-foreground">
                Show a notification badge in the header when items fall below their threshold.
              </p>
              <Switch
                checked={facility?.settings?.lowStockAlertEnabled ?? true}
                onCheckedChange={async (enabled) => {
                  try {
                    await updateFacilityProfile(user?.facilityId ?? "", {
                      settings: {
                        ...facility?.settings,
                        lowStockAlertEnabled: enabled,
                      } as FacilitySettings,
                    });
                    toast.success(enabled ? "Low stock alerts enabled" : "Low stock alerts disabled");
                    // Refresh settings (force: the write above bypassed the cache)
                    const { fetchFacilitySettings } = useInventoryStore.getState();
                    await fetchFacilitySettings(true);
                  } catch (error) {
                    console.error("[Settings] Failed to update notification setting:", error);
                    toast.error("Failed to update setting");
                  }
                }}
                disabled={loadingFacility}
                aria-label="Toggle low stock alerts"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account & Security — Medicore pattern + password reset */}
      <Card>
        <CardHeader>
          <CardTitle>Account &amp; Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <Input
                value={
                  user ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : ""
                }
                disabled
              />
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-canvas px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Password</p>
              <p className="text-xs text-muted-foreground">
                We&apos;ll email a secure reset link to {user?.email ?? "your email"}.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSendPasswordReset}
              disabled={sendingReset || !user?.email}
            >
              {sendingReset && (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              )}
              {sendingReset ? "Sending..." : "Send Reset Link"}
            </Button>
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-canvas px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Sign out</p>
              <p className="text-xs text-muted-foreground">
                End your session on this device.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? (
                <>
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  Signing out...
                </>
              ) : (
                <>
                  <LogOut className="mr-1 h-3.5 w-3.5" />
                  Sign Out
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Edit Store dialog */}
      <Dialog
        open={editingStore !== null}
        onOpenChange={(open) => {
          if (!open) setEditingStore(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Store</DialogTitle>
            <DialogDescription>Update the store's name or address.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="edit-store-name" className="text-sm font-medium">
                Store Name
              </label>
              <Input
                id="edit-store-name"
                value={editStoreForm.name}
                onChange={(e) =>
                  setEditStoreForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-store-address" className="text-sm font-medium">
                Address
              </label>
              <Input
                id="edit-store-address"
                value={editStoreForm.address}
                onChange={(e) =>
                  setEditStoreForm((prev) => ({ ...prev, address: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingStore(null)} disabled={savingStore}>
              Cancel
            </Button>
            <Button onClick={handleSaveStoreEdit} disabled={savingStore}>
              {savingStore ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Store Management (duty-gated: manage_stores or admin) */}
      {canManageStores && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Store Management</CardTitle>
            <Button size="sm" onClick={() => setShowStoreForm((v) => !v)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add Store
            </Button>
          </CardHeader>
          {showStoreForm && (
            <div className="flex flex-col sm:flex-row gap-2 px-6 pb-4">
              <Input
                placeholder="Store name"
                value={storeForm.name}
                onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
              />
              <Input
                placeholder="Address (optional)"
                value={storeForm.address}
                onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })}
              />
              <Button size="sm" onClick={handleAddStore} disabled={addingStore}>
                {addingStore ? "Adding..." : "Save Store"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowStoreForm(false);
                  setStoreForm({ name: "", address: "" });
                }}
              >
                Cancel
              </Button>
            </div>
          )}
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Items Count</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allStores.map((store) => {
                    const itemCount = items.filter(i => i.storeId === store.id).length;
                    const active = store.isActive !== false;
                    const busy = togglingStoreId === store.id;
                    return (
                      <TableRow key={store.id}>
                        <TableCell className="text-sm font-medium">{store.name}</TableCell>
                        <TableCell>
                          <Badge className={active ? "bg-ink text-paper" : "bg-canvas text-ink"}>
                            {active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">{itemCount} items</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Edit store"
                              aria-label={`Edit ${store.name}`}
                              onClick={() => {
                                setEditingStore(store);
                                setEditStoreForm({ name: store.name, address: store.address ?? "" });
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              disabled={busy}
                              title={active ? "Deactivate store" : "Activate store"}
                              aria-label={`${active ? "Deactivate" : "Activate"} ${store.name}`}
                              onClick={() => handleToggleStoreActive(store)}
                            >
                              {busy ? "..." : active ? "Deactivate" : "Activate"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
