"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

const reports = [
  { title: "Stock Valuation", desc: "Total value of stock per item and store.", href: "/reports/valuation" },
  { title: "Movement History", desc: "All stock in, out, and transfer records.", href: "/reports/movements" },
  { title: "Profits", desc: "Profit per sale across any date range.", href: "/reports/profits" },
  { title: "Low Stock Report", desc: "Items below their configured threshold.", href: "/reports/low-stock" },
  { title: "Sales Summary", desc: "Sales by store, item, and date range.", href: "/reports/sales" },
  { title: "Stock Aging", desc: "Stock grouped by year and category.", href: "/reports/aging" },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-body text-mid-gray">View and analyze inventory data.</p>
      </div>

      {/* Editorial report index — typographic hierarchy only, no iconography */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <Link key={r.title} href={r.href} className="group block h-full focus-visible:outline-none">
            <Card className="h-full cursor-pointer border-hairline bg-paper transition-all duration-200 group-focus-visible:border-ink/30 group-hover:-translate-y-0.5 group-hover:border-ink/20 group-hover:shadow-subtle-2">
              <CardContent className="flex h-full flex-col p-6">
                <h2 className="font-heading text-lg font-semibold tracking-tight text-ink">
                  {r.title}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-mid-gray">{r.desc}</p>
                <p className="mt-6 self-start border-b border-transparent pb-0.5 text-xs font-medium uppercase tracking-[0.18em] text-ink transition-colors group-focus-visible:border-ink group-hover:border-ink">
                  View Report
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
