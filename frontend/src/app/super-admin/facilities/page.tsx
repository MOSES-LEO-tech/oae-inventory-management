"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Building2, ArrowRight, Loader2 } from "lucide-react";
import { getDocuments } from "@/lib/firebase/firestore";
import { Facility } from "@/types";

export default function FacilitiesPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const f = await getDocuments<Facility>("facilities");
        if (!cancelled) setFacilities(f);
      } catch (e) {
        console.error("Failed to load facilities:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-heading-sm font-semibold tracking-heading-sm">Facilities</h1>
          <p className="text-muted-foreground">Manage all registered businesses.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-mid-gray" />
            <Input placeholder="Search facilities..." className="max-w-sm" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {facilities.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Building2 className="mx-auto mb-3 h-12 w-12" />
              <p>No facilities registered.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Facility Name</TableHead>
                    <TableHead>Business Type</TableHead>
                    <TableHead>Stores</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {facilities.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.name}</TableCell>
                      <TableCell className="text-muted-foreground">{f.businessType}</TableCell>
                      <TableCell>{f.stores?.length || 0}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-xs ${
                            f.licenseStatus === "active"
                              ? "bg-ink text-paper"
                              : f.licenseStatus === "trial"
                              ? "bg-canvas text-ink"
                              : f.licenseStatus === "expired"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-surface-alt text-ink"
                          }`}
                        >
                          {f.licenseStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {f.createdAt?.toDate && new Date(f.createdAt.toDate()).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/super-admin/facilities/${f.id}`}>
                          <Button variant="ghost" size="sm">
                            View <ArrowRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
