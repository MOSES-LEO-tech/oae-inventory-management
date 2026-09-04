"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Users,
  FileText,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  ArrowRight,
  Settings,
  Store,
  Shield,
  Activity,
  Loader2,
} from "lucide-react";
import { getDocuments } from "@/lib/firebase/firestore";
import { Facility, FacilityLicense } from "@/types";

export default function SuperAdminDashboardPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [licenses, setLicenses] = useState<FacilityLicense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [f, l] = await Promise.all([
          getDocuments<Facility>("facilities"),
          getDocuments<FacilityLicense>("licenses"),
        ]);
        if (!cancelled) {
          setFacilities(f);
          setLicenses(l);
        }
      } catch (e) {
        console.error("Failed to load super-admin dashboard:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Calculate stats
  const totalFacilities = facilities.length;
  const activeLicenses = licenses.filter((l) => l.status === "active").length;
  const trialLicenses = licenses.filter((l) => l.status === "trial").length;
  const expiredLicenses = licenses.filter((l) => l.status === "expired").length;
  const suspendedLicenses = licenses.filter((l) => l.status === "suspended").length;

  const totalStores = facilities.reduce((sum, f) => sum + (f.stores?.length || 0), 0);
  const stationaryFacilities = facilities.filter((f) => f.businessType === "stationary" || f.businessType === "both").length;
  const hardwareFacilities = facilities.filter((f) => f.businessType === "hardware" || f.businessType === "both").length;

  const stats = [
    {
      title: "Total Facilities",
      value: totalFacilities,
      icon: Building2,
      desc: "Registered businesses",
    },
    {
      title: "Active Licenses",
      value: activeLicenses,
      icon: Shield,
      desc: "Currently active",
    },
    {
      title: "Trial Licenses",
      value: trialLicenses,
      icon: Clock,
      desc: "In trial period",
    },
    {
      title: "Total Stores",
      value: totalStores,
      icon: Store,
      desc: "Across all facilities",
    },
    {
      title: "Stationary Businesses",
      value: stationaryFacilities,
      icon: TrendingUp,
      desc: "Primary target market",
    },
    {
      title: "Hardware Businesses",
      value: hardwareFacilities,
      icon: Building2,
      desc: "Secondary market",
    },
  ];

  const recentFacilities = [...facilities]
    .sort((a, b) => new Date(b.createdAt.toDate()).getTime() - new Date(a.createdAt.toDate()).getTime())
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading-sm font-semibold tracking-heading-sm">SuperAdmin Dashboard</h1>
        <p className="text-muted-foreground">Platform overview and management.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat) => (
          <Card key={stat.title} className="transition-shadow hover:shadow-subtle-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-caption font-medium uppercase tracking-caption text-mid-gray">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-mid-gray" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight">{stat.value}</div>
              <p className="mt-1 text-xs text-mid-gray">{stat.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* License Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>License Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-ink" />
                  <span className="text-sm">Active</span>
                </div>
                <span className="font-medium">{activeLicenses}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-canvas border border-hairline" />
                  <span className="text-sm">Trial</span>
                </div>
                <span className="font-medium">{trialLicenses}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-surface-alt border border-hairline" />
                  <span className="text-sm">Expired</span>
                </div>
                <span className="font-medium">{expiredLicenses}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-destructive" />
                  <span className="text-sm">Suspended</span>
                </div>
                <span className="font-medium">{suspendedLicenses}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Facilities */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Facilities</CardTitle>
            <Link href="/super-admin/facilities">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentFacilities.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <Building2 className="mx-auto mb-2 h-8 w-8" />
                <p>No facilities registered.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-hairline">
                      <th className="text-left font-medium py-2 px-4">Facility</th>
                      <th className="text-left font-medium py-2 px-4">Type</th>
                      <th className="text-left font-medium py-2 px-4">Status</th>
                      <th className="text-right font-medium py-2 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentFacilities.map((f) => (
                      <tr key={f.id} className="border-b border-hairline hover:bg-canvas/50">
                        <td className="py-2 px-4 font-medium">{f.name}</td>
                        <td className="py-2 px-4 text-muted-foreground">{f.businessType}</td>
                        <td className="py-2 px-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            f.licenseStatus === "active" ? "bg-ink text-paper" :
                            f.licenseStatus === "trial" ? "bg-canvas text-ink" :
                            f.licenseStatus === "expired" ? "bg-destructive/10 text-destructive" :
                            "bg-surface-alt text-ink"
                          }`}>
                            {f.licenseStatus}
                          </span>
                        </td>
                        <td className="text-right py-2 px-4">
                          <Link href={`/super-admin/facilities/${f.id}`}>
                            <Button variant="ghost" size="sm">View</Button>
                          </Link>
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

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/super-admin/facilities", label: "Manage Facilities", icon: Building2, desc: "View and manage all facilities" },
          { href: "/super-admin/licenses", label: "Licenses", icon: Shield, desc: "Manage license tiers and status" },
          { href: "/super-admin/invoices", label: "Invoices", icon: FileText, desc: "Generate and track invoices" },
          { href: "/super-admin/notifications", label: "Notifications", icon: Activity, desc: "Send platform-wide notifications" },
        ].map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="cursor-pointer transition-shadow hover:shadow-subtle-2">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-canvas">
                  <link.icon className="h-5 w-5 text-ink" />
                </div>
                <div>
                  <p className="text-sm font-medium">{link.label}</p>
                  <p className="text-xs text-mid-gray">{link.desc}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
