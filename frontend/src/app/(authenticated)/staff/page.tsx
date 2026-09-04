"use client";

// Staff management (Medicore pattern): admins invite staff via Firebase
// email sign-in links, edit details, adjust duties, and deactivate/reactivate
// members. Invited members appear immediately as "Invited" placeholders and
// materialize into real accounts when they complete the link from their inbox.

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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  ShieldCheck,
  UserX,
  Archive,
  RotateCcw,
  Loader2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/user-error";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useInventoryStore } from "@/stores/inventory-store";
import { useAuthStore, JOB_TITLE_DUTIES, getDutiesForJobTitle } from "@/stores/auth-store";
import type { DutyGrants, FacilityUser } from "@/types";

const DUTY_GROUPS: Array<{ label: string; keys: Array<keyof DutyGrants> }> = [
  {
    label: "Inventory",
    keys: ["view_inventory", "manage_inventory", "manage_stock_levels", "manage_transfers"],
  },
  { label: "Sales", keys: ["record_sales", "view_sales", "manage_sales"] },
  { label: "Reports", keys: ["view_reports", "export_reports"] },
  {
    label: "Administration",
    keys: ["manage_users", "manage_stores", "manage_settings", "admin"],
  },
];

const DUTY_LABELS: Record<keyof DutyGrants, string> = {
  view_inventory: "View inventory",
  manage_inventory: "Manage items & adjustments",
  manage_stock_levels: "Stock in / stock out",
  manage_transfers: "Inter-store transfers",
  record_sales: "Record sales",
  view_sales: "View sales history",
  manage_sales: "Void & refund sales",
  view_reports: "View reports",
  export_reports: "Export reports",
  manage_users: "Invite & manage staff",
  manage_stores: "Manage stores",
  manage_settings: "Manage settings",
  admin: "Full admin access",
};

const selectCls =
  "h-9 rounded-2xl border border-transparent bg-canvas px-3 text-sm outline-none transition-colors focus-visible:border-hairline focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-hairline/40";

const emptyDuties = (): DutyGrants => ({
  view_inventory: false,
  manage_inventory: false,
  manage_stock_levels: false,
  manage_transfers: false,
  record_sales: false,
  view_sales: false,
  manage_sales: false,
  view_reports: false,
  export_reports: false,
  manage_users: false,
  manage_stores: false,
  manage_settings: false,
  admin: false,
});

export default function StaffPage() {
  const { user, hasDuty } = useAuthStore();
  const canManage = !!user && (user.role === "admin" || hasDuty("manage_users"));
  const { users, stores, isLoadingUsers, fetchUsers, fetchStores, inviteStaff, updateStaffUser, setStaffDuties, setStaffActive } =
    useInventoryStore();

  const activeUsers = useMemo(() => users.filter((u) => u.active), [users]);
  const deactivatedUsers = useMemo(() => users.filter((u) => !u.active), [users]);

  // Add (invite) dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", email: "", phone: "", jobTitle: "Sales Clerk" });
  const [addDuties, setAddDuties] = useState<DutyGrants>(() => getDutiesForJobTitle("Sales Clerk"));
  const [addStores, setAddStores] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);

  // Edit dialog state
  const [editTarget, setEditTarget] = useState<FacilityUser | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", jobTitle: "" });
  const [editStores, setEditStores] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // Duties dialog state
  const [dutiesTarget, setDutiesTarget] = useState<FacilityUser | null>(null);
  const [dutiesDraft, setDutiesDraft] = useState<DutyGrants>(emptyDuties());
  const [savingDuties, setSavingDuties] = useState(false);

  // Deactivate + bin state
  const [deactivateTarget, setDeactivateTarget] = useState<FacilityUser | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [binOpen, setBinOpen] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchStores();
  }, [fetchUsers, fetchStores]);

  if (!canManage) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">Staff management is restricted</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Only administrators and members with the &quot;Manage staff&quot; duty can access this page.
          </p>
        </CardContent>
      </Card>
    );
  }

  const openAdd = () => {
    setAddForm({ name: "", email: "", phone: "", jobTitle: "Sales Clerk" });
    setAddDuties(getDutiesForJobTitle("Sales Clerk"));
    setAddStores([]);
    setAddOpen(true);
  };

  const handleJobTitleChange = (jobTitle: string) => {
    setAddForm((f) => ({ ...f, jobTitle }));
    setAddDuties(getDutiesForJobTitle(jobTitle));
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const name = addForm.name.trim();
    const email = addForm.email.trim().toLowerCase();
    if (!name) return toast.error("Staff name is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("Enter a valid email address");
    try {
      setInviting(true);
      await inviteStaff(
        {
          name,
          email,
          phone: addForm.phone.trim() || undefined,
          jobTitle: addForm.jobTitle,
          duties: addDuties,
          storeIds: addStores,
        },
        user.id
      );
      toast.success(`Invitation sent to ${email}`);
      setAddOpen(false);
    } catch (error) {
      console.error("Failed to invite staff:", error);
      toast.error(toUserMessage(error, "Failed to send invitation"));
    } finally {
      setInviting(false);
    }
  };

  const openEdit = (u: FacilityUser) => {
    setEditForm({ name: u.name, phone: u.phone ?? "", jobTitle: u.jobTitle });
    setEditStores(u.storeIds ?? []);
    setEditTarget(u);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    if (!editForm.name.trim()) return toast.error("Staff name is required");
    try {
      setSavingEdit(true);
      await updateStaffUser(editTarget.id, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || undefined,
        jobTitle: editForm.jobTitle,
        storeIds: editStores,
      });
      toast.success(`${editForm.name.trim()} updated`);
      setEditTarget(null);
    } catch (error) {
      console.error("Failed to update staff:", error);
      toast.error(toUserMessage(error, "Failed to update staff"));
    } finally {
      setSavingEdit(false);
    }
  };

  const openDuties = (u: FacilityUser) => {
    setDutiesDraft({ ...emptyDuties(), ...u.duties });
    setDutiesTarget(u);
  };

  const handleSaveDuties = async () => {
    if (!dutiesTarget) return;
    try {
      setSavingDuties(true);
      await setStaffDuties(dutiesTarget.id, dutiesDraft);
      toast.success(`Duties updated for ${dutiesTarget.name}`);
      setDutiesTarget(null);
    } catch (error) {
      console.error("Failed to update duties:", error);
      toast.error(toUserMessage(error, "Failed to update duties"));
    } finally {
      setSavingDuties(false);
    }
  };

  const toggleDraftDuty = (key: keyof DutyGrants, on: boolean) =>
    setDutiesDraft((d) => ({ ...d, [key]: on }));

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    try {
      setDeactivating(true);
      await setStaffActive(deactivateTarget.id, false);
      toast.success(`${deactivateTarget.name} deactivated`);
      setDeactivateTarget(null);
    } catch (error) {
      console.error("Failed to deactivate staff:", error);
      toast.error(toUserMessage(error, "Failed to deactivate staff"));
    } finally {
      setDeactivating(false);
    }
  };

  const handleReactivate = async (u: FacilityUser) => {
    try {
      await setStaffActive(u.id, true);
      toast.success(`${u.name} reactivated`);
    } catch (error) {
      console.error("Failed to reactivate staff:", error);
      toast.error(toUserMessage(error, "Failed to reactivate staff"));
    }
  };

  const dutyCount = (d: DutyGrants) => Object.values(d).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground">
          {activeUsers.length} active · {deactivatedUsers.length} deactivated
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setBinOpen(true)} disabled={deactivatedUsers.length === 0}>
            <Archive className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Deactivated</span>
            <span className="sm:hidden">Bin</span>
          </Button>
          <Button onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" /> Add Staff
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoadingUsers ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Loading staff…</p>
          </CardContent>
        </Card>
      ) : activeUsers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No staff yet.</p>
            <p className="text-xs text-muted-foreground">
              Invite your first team member with the Add Staff button.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Name</TableHead>
                    <TableHead className="hidden sm:table-cell text-center">Email</TableHead>
                    <TableHead className="hidden md:table-cell text-center">Job Title</TableHead>
                    <TableHead className="text-center">Duties</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="text-center text-sm font-medium">{u.name}</TableCell>
                      <TableCell className="hidden sm:table-cell text-center text-sm text-mid-gray">
                        {u.email}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-center text-sm text-mid-gray">
                        {u.jobTitle}
                      </TableCell>
                      <TableCell className="text-center text-sm tabular-nums text-mid-gray">
                        {dutyCount(u.duties)} of {DUTY_GROUPS.reduce((s, g) => s + g.keys.length, 0)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="secondary"
                          className={`text-xs ${
                            u.onboarded
                              ? "bg-ink text-paper"
                              : "border border-hairline bg-transparent text-ink"
                          }`}
                        >
                          {u.onboarded ? "Active" : "Invited"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Edit staff member"
                            onClick={() => openEdit(u)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Adjust duties"
                            onClick={() => openDuties(u)}
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Deactivate"
                            disabled={u.id === user?.id}
                            onClick={() => setDeactivateTarget(u)}
                          >
                            <UserX className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Staff dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => !o && setAddOpen(false)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Staff</DialogTitle>
            <DialogDescription>
              An email sign-in link will be sent. They appear here immediately and activate their
              account from their inbox.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="staffName">Name *</Label>
              <Input
                id="staffName"
                required
                placeholder="e.g., Sarah Nakato"
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staffEmail">Email *</Label>
              <Input
                id="staffEmail"
                type="email"
                required
                placeholder="name@example.com"
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="staffPhone">Phone</Label>
                <Input
                  id="staffPhone"
                  type="tel"
                  placeholder="+256 …"
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staffJobTitle">Job Title *</Label>
                <select
                  id="staffJobTitle"
                  value={addForm.jobTitle}
                  onChange={(e) => handleJobTitleChange(e.target.value)}
                  className={`${selectCls} w-full`}
                >
                  {Object.keys(JOB_TITLE_DUTIES).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Store access */}
            {stores.length > 0 && (
              <div className="space-y-1.5">
                <Label>Store access</Label>
                <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-2xl border border-hairline bg-canvas p-3">
                  {stores.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={addStores.includes(s.id)}
                        onCheckedChange={(v) =>
                          setAddStores((prev) =>
                            v ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                          )
                        }
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave empty for access to all stores.
                </p>
              </div>
            )}

            {/* Duties preset preview — editable */}
            <div className="space-y-1.5">
              <Label>Duties (from job title — adjustable)</Label>
              <div className="space-y-3 rounded-2xl border border-hairline bg-canvas p-3">
                {DUTY_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {group.label}
                    </p>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {group.keys.map((key) => (
                        <label key={key} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={addDuties[key]}
                            onCheckedChange={(v) =>
                              setAddDuties((d) => ({ ...d, [key]: v === true }))
                            }
                          />
                          {DUTY_LABELS[key]}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={inviting}>
                {inviting ? "Sending…" : "Send invitation"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit staff member</DialogTitle>
            <DialogDescription>{editTarget?.email}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="editName">Name *</Label>
              <Input
                id="editName"
                required
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editPhone">Phone</Label>
              <Input
                id="editPhone"
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editJobTitle">Job Title</Label>
              <select
                id="editJobTitle"
                value={editForm.jobTitle}
                onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })}
                className={`${selectCls} w-full`}
              >
                {Array.from(new Set([...Object.keys(JOB_TITLE_DUTIES), editForm.jobTitle])).map(
                  (t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* Store access */}
            {stores.length > 0 && (
              <div className="space-y-1.5">
                <Label>Store access</Label>
                <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-2xl border border-hairline bg-canvas p-3">
                  {stores.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={editStores.includes(s.id)}
                        onCheckedChange={(v) =>
                          setEditStores((prev) =>
                            v ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                          )
                        }
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave empty for access to all stores.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={savingEdit}>
                {savingEdit ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Duties dialog */}
      <Dialog open={!!dutiesTarget} onOpenChange={(o) => !o && setDutiesTarget(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Duties — {dutiesTarget?.name}</DialogTitle>
            <DialogDescription>
              Control exactly what this member can do.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setDutiesDraft(() => {
                    const all = emptyDuties();
                    (Object.keys(all) as Array<keyof DutyGrants>).forEach((k) => (all[k] = true));
                    return all;
                  })
                }
              >
                Select all
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setDutiesDraft(emptyDuties())}>
                Clear all
              </Button>
            </div>
            {DUTY_GROUPS.map((group) => (
              <div key={group.label} className="rounded-2xl border border-hairline bg-canvas p-3">
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {group.keys.map((key) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={dutiesDraft[key]}
                        onCheckedChange={(v) => toggleDraftDuty(key, v === true)}
                      />
                      {DUTY_LABELS[key]}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDutiesTarget(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveDuties} disabled={savingDuties}>
                {savingDuties ? "Saving…" : "Save duties"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deactivated bin */}
      <Dialog open={binOpen} onOpenChange={setBinOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Deactivated staff</DialogTitle>
            <DialogDescription>
              Deactivated members cannot sign in. Reactivate to restore access.
            </DialogDescription>
          </DialogHeader>
          {deactivatedUsers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No deactivated staff.</p>
          ) : (
            <ul className="space-y-1.5">
              {deactivatedUsers.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between rounded-xl border border-hairline px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{u.name}</p>
                    <p className="truncate text-xs text-mid-gray">{u.email}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleReactivate(u)}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reactivate
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {/* Deactivate confirmation */}
      <ConfirmDialog
        open={!!deactivateTarget}
        onOpenChange={(o) => !o && setDeactivateTarget(null)}
        title="Deactivate staff member"
        message={`Deactivate "${deactivateTarget?.name}"? They will no longer be able to sign in. You can reactivate them later from the Deactivated bin.`}
        confirmLabel="Deactivate"
        confirmVariant="destructive"
        loading={deactivating}
        onConfirm={handleDeactivate}
      />
    </div>
  );
}
