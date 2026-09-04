"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Shield, ArrowRight, Calendar, Loader2 } from "lucide-react";
import { getDocuments } from "@/lib/firebase/firestore";
import { FacilityLicense, Facility } from "@/types";

// The `licenses` collection currently holds two shapes:
//   1. The FacilityLicense schema (issuedAt/expiresAt as Firestore Timestamps).
//   2. The onboarding trial schema (trialStartedAt/trialEndsAt as ISO strings,
//      plus trialEndsAtTs as a Timestamp) — written before the type was finalized.
// Accept both so the page never crashes on a missing field.
type LicenseRow = Omit<FacilityLicense, "issuedAt" | "expiresAt"> & {
  issuedAt?: unknown;
  expiresAt?: unknown;
  trialStartedAt?: string;
  trialEndsAt?: string;
  trialEndsAtTs?: unknown;
  createdAt?: string;
};

function formatDate(value: unknown): string {
  if (value == null) return "N/A";
  let date: Date | null = null;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string") {
    const parsed = new Date(value);
    date = Number.isNaN(parsed.getTime()) ? null : parsed;
  } else if (
    typeof value === "object" &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    date = (value as { toDate: () => Date }).toDate();
  }
  if (!date || Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function LicensesPage() {
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [l, f] = await Promise.all([
          getDocuments<LicenseRow>("licenses"),
          getDocuments<Facility>("facilities"),
        ]);
        if (!cancelled) {
          setLicenses(l);
          setFacilities(f);
        }
      } catch (e) {
        console.error("Failed to load licenses:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const facilityMap = new Map(facilities.map((f) => [f.id, f]));

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
        <h1 className="text-heading-sm font-semibold tracking-heading-sm">Licenses</h1>
        <p className="text-muted-foreground">Manage license tiers and status.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Licenses</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {licenses.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Shield className="mx-auto mb-3 h-12 w-12" />
              <p>No licenses found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Facility</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {licenses.map((license) => {
                    const facility = facilityMap.get(license.facilityId);
                    return (
                      <TableRow key={license.id}>
                        <TableCell className="font-medium">
                          {facility?.name || license.facilityId}
                        </TableCell>
                        <TableCell className="capitalize">{license.tier}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`text-xs ${
                              license.status === "active"
                                ? "bg-ink text-paper"
                                : license.status === "trial"
                                ? "bg-canvas text-ink"
                                : license.status === "expired"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-surface-alt text-ink"
                            }`}
                          >
                            {license.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(license.issuedAt ?? license.trialStartedAt ?? license.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(license.expiresAt ?? license.trialEndsAtTs ?? license.trialEndsAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            Edit <ArrowRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
