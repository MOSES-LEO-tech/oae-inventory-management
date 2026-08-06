"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, History, AlertTriangle, TrendingUp, Clock, ArrowRight } from "lucide-react";

const reports = [
  { title: "Stock Valuation", desc: "Total value of stock per item and store.", icon: DollarSign, href: "/reports/valuation" },
  { title: "Movement History", desc: "All stock in, out, and transfer records.", icon: History, href: "/reports/movements" },
  { title: "Low Stock Report", desc: "Items below their configured threshold.", icon: AlertTriangle, href: "/reports/low-stock" },
  { title: "Sales Summary", desc: "Sales by store, item, and date range.", icon: TrendingUp, href: "/reports/sales" },
  { title: "Stock Aging", desc: "Stock grouped by year and category.", icon: Clock, href: "/reports/aging" },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading-sm font-semibold tracking-heading-sm">Reports</h1>
        <p className="text-body text-mid-gray">View and analyze inventory data.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <Link key={r.title} href={r.href}>
            <Card className="cursor-pointer h-full transition-shadow hover:shadow-subtle-2">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-canvas">
                    <r.icon className="h-5 w-5 text-ink" />
                  </div>
                  <CardTitle className="text-base">{r.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-mid-gray">{r.desc}</p>
                <p className="mt-3 flex items-center text-sm font-medium text-ink">
                  View Report <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
