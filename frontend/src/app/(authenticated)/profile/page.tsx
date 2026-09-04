"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Pencil, Save, Mail, Phone, Building, Shield, Clock, MapPin } from "lucide-react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/user-error";
import { useAuthStore } from "@/stores/auth-store";
import { updateFacilityDocument } from "@/lib/firebase/firestore";

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });

  if (!user) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Loading user profile...</p>
      </div>
    );
  }

  const handleSave = async () => {
    if (!user) return;
    if (!user.facilityId) {
      toast.error("No facility linked to this account");
      return;
    }
    const name = formData.name.trim();
    if (!name) {
      toast.error("Name cannot be empty");
      return;
    }
    try {
      setIsSaving(true);
      // User docs live at facilities/{fid}/users/{uid} — same path resolveUserSession reads
      const payload: { name: string; phone?: string } = { name };
      const phone = formData.phone.trim();
      if (phone) payload.phone = phone;
      await updateFacilityDocument(user.facilityId, "users", user.id, payload);
      setUser({ ...user, name, phone });
      setIsEditing(false);
      toast.success("Profile updated");
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast.error(toUserMessage(error, "Failed to update profile"));
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground">Manage your account settings.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="p-6 text-center">
            <Avatar className="h-24 w-24 mx-auto mb-4">
              <AvatarFallback className="text-2xl">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <h3 className="font-semibold text-lg">{user.name}</h3>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <div className="mt-3">
              <Badge
                variant="secondary"
                className={`text-xs ${user.role === "admin" ? "bg-ink text-paper" : "bg-canvas text-ink"}`}
              >
                {user.role}
              </Badge>
            </div>
            <Separator className="my-4" />
            <div className="text-left space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Job Title</span>
                <span className="font-medium">{user.jobTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Facility ID</span>
                <span className="font-medium text-xs">{user.facilityId}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Account Information</CardTitle>
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" /> {isSaving ? "Saving..." : "Save"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                {isEditing ? (
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                ) : (
                  <div className="flex items-center h-9 pl-3 rounded-2xl bg-canvas text-sm">
                    {user.name}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="flex items-center h-9 pl-3 rounded-2xl bg-canvas text-sm text-muted-foreground">
                  {user.email}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                {isEditing ? (
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Add phone number"
                  />
                ) : (
                  <div className="flex items-center h-9 pl-3 rounded-2xl bg-canvas text-sm">
                    {user.phone || "Not set"}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <div className="flex items-center h-9">
                  <Badge
                    variant="secondary"
                    className={`text-xs ${user.role === "admin" ? "bg-ink text-paper" : "bg-canvas text-ink"}`}
                  >
                    {user.role}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-mid-gray" />
                <div>
                  <p className="text-muted-foreground">Job Title</p>
                  <p className="font-medium">{user.jobTitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-mid-gray" />
                <div>
                  <p className="text-muted-foreground">Access Stores</p>
                  <p className="font-medium">
                    {user.storeIds?.length || 0} store{(user.storeIds?.length || 0) !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-mid-gray" />
                <div>
                  <p className="text-muted-foreground">Account Created</p>
                  <p className="font-medium">
                    {user.createdAt ? new Date(user.createdAt.toDate()).toLocaleDateString() : "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-mid-gray" />
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-medium">{user.active ? "Active" : "Inactive"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}