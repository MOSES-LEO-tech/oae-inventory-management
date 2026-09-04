"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Store,
  Users,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { getFacilityDocument, getFacilityDocuments, getDocument } from "@/lib/firebase/firestore";
import { Facility, FacilityLicense, FacilityUser } from "@/types";

export default function FacilityDetailPage() {
  const params = useParams<{ facilityId: string }>();
  const facilityId = params.facilityId;

  const [facilityDoc, setFacilityDoc] = useState<Facility | null>(null);
  const [users, setUsers] = useState<FacilityUser[]>([]);
  const [licenses, setLicenses] = useState<FacilityLicense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!facilityId) return;
    let cancelled = false;
    (async () => {
      try {
        const [f, u, l] = await Promise.all([
          getFacilityDocument<Facility>(facilityId, "", facilityId),
          getFacilityDocuments<FacilityUser>(facilityId, "users"),
          // Licenses live at top-level licenses/{facilityId} (same doc auth.ts reads);
          // the old nested facilities/{fid}/licenses subcollection is never written.
          getDocument<FacilityLicense>("licenses", facilityId),
        ]);
        if (!cancelled) {
          setFacilityDoc(f);
          setUsers(u);
          setLicenses(l ? [l] : []);
        }
      } catch (e) {
        console.error("Failed to load facility detail:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [facilityId]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!facilityDoc) {
    return (
      <div className="space-y-6">
        <Link href="/super-admin/facilities">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Building2 className="mx-auto mb-3 h-12 w-12" />
            <p>Facility not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const license = licenses[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/super-admin/facilities">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-heading-sm font-semibold tracking-heading-sm">{facilityDoc.name}</h1>
          <p className="text-muted-foreground">{facilityDoc.businessType} business</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Business Type</p>
            <p className="text-lg font-semibold capitalize">{facilityDoc.businessType}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Stores</p>
            <p className="text-lg font-semibold">{facilityDoc.stores?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Staff</p>
            <p className="text-lg font-semibold">{users.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">License Status</p>
            <p className="text-lg font-semibold capitalize">{license?.status || "N/A"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Facility Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{facilityDoc.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{facilityDoc.adminEmail}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span className="font-medium">{facilityDoc.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Currency</span>
              <span className="font-medium">{facilityDoc.currency}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Address</span>
              <span className="font-medium">{facilityDoc.address || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trial Ends</span>
              <span className="font-medium">
                {facilityDoc.trialEndsAt
                  ? new Date(facilityDoc.trialEndsAt.toDate()).toLocaleDateString()
                  : "N/A"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Staff Members</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {users.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <Users className="mx-auto mb-2 h-8 w-8" />
                <p>No staff members.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-hairline">
                      <th className="text-left font-medium py-2 px-4">Name</th>
                      <th className="text-left font-medium py-2 px-4">Role</th>
                      <th className="text-left font-medium py-2 px-4">Job Title</th>
                      <th className="text-right font-medium py-2 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-hairline">
                        <td className="py-2 px-4 font-medium">{u.name}</td>
                        <td className="py-2 px-4">
                          <Badge variant="secondary" className="text-xs">
                            {u.role}
                          </Badge>
                        </td>
                        <td className="py-2 px-4 text-muted-foreground">{u.jobTitle}</td>
                        <td className="text-right py-2 px-4">
                          <Badge
                            variant="secondary"
                            className={`text-xs ${u.active ? "bg-ink text-paper" : "bg-canvas text-ink"}`}
                          >
                            {u.active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stores</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {facilityDoc.stores && facilityDoc.stores.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline">
                    <th className="text-left font-medium py-2 px-4">Store Name</th>
                    <th className="text-left font-medium py-2 px-4">Type</th>
                    <th className="text-left font-medium py-2 px-4">Address</th>
                    <th className="text-right font-medium py-2 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {facilityDoc.stores.map((store) => (
                    <tr key={store.id} className="border-b border-hairline">
                      <td className="py-2 px-4 font-medium">{store.name}</td>
                      <td className="py-2 px-4 text-muted-foreground">{store.type}</td>
                      <td className="py-2 px-4 text-muted-foreground">{store.address || "N/A"}</td>
                      <td className="text-right py-2 px-4">
                        <Badge
                          variant="secondary"
                          className={`text-xs ${store.isActive ? "bg-ink text-paper" : "bg-canvas text-ink"}`}
                        >
                          {store.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-muted-foreground">
              <Store className="mx-auto mb-2 h-8 w-8" />
              <p>No stores configured.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
