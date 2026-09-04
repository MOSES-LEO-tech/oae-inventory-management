// Client-side instant-PDF engine for report exports.
//
// Pattern derived from Legacy Medicore's clinic-report generator: portrait A4,
// solid header band carrying the bare transparent logo (no container), facility
// name + report title + period line, stat cards, striped tables, paginated
// footer, then an immediate doc.save() download — no server round-trip.
//
// Palette follows this app's editorial monochrome identity (ink/paper/hairline).
// jsPDF + jspdf-autotable are loaded lazily on first export so the report
// routes stay light until a user actually downloads.

import type { jsPDF } from "jspdf";
import type autoTableFn from "jspdf-autotable";
import type { Currency } from "@/types";
import { LOGO_DATA_URL } from "@/lib/logo-data";
import { getFacility } from "@/lib/services/facility";

// ─── Facility context (name + currency) with offline fallback ─────────────

export interface ReportFacilityInfo {
  name: string;
  currency: Currency;
}

const FACILITY_CACHE_PREFIX = "jl_report_facility_";

/**
 * Resolves the facility display name and currency for report headers.
 * Reads the live Firestore document when reachable and caches the result to
 * localStorage; falls back to that cache when offline so previously-generated
 * reports keep the correct branding.
 */
export async function resolveReportFacilityInfo(
  facilityId: string
): Promise<ReportFacilityInfo> {
  const cacheKey = `${FACILITY_CACHE_PREFIX}${facilityId}`;
  let cached: ReportFacilityInfo | null = null;
  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (raw) cached = JSON.parse(raw) as ReportFacilityInfo;
  } catch {
    // Corrupt cache entry — ignore and continue.
  }

  try {
    const facility = await getFacility(facilityId);
    if (facility?.name) {
      const info: ReportFacilityInfo = {
        name: facility.name,
        currency: facility.currency ?? cached?.currency ?? "UGX",
      };
      try {
        window.localStorage.setItem(cacheKey, JSON.stringify(info));
      } catch {
        // Storage full/unavailable — non-fatal.
      }
      return info;
    }
  } catch {
    // Offline or permission-restricted — fall through to cache.
  }

  return cached ?? { name: "", currency: "UGX" };
}

// ─── Shared types ──────────────────────────────────────────────────────────

export interface ReportContext {
  facilityName: string;
  currency: Currency;
  generatedBy: string;
}

export interface PdfStat {
  label: string;
  value: string;
}

export interface PdfSection {
  title: string;
  columns: string[];
  rows: string[][];
  /** Column indexes rendered right-aligned (amounts/quantities). */
  numericColumns?: number[];
  /** Bold emphasised final row (subtotals / grand totals). */
  totalRow?: string[];
}

interface RenderInput {
  fileName: string;
  title: string;
  /** e.g. "01 Aug 2026 – 24 Aug 2026 · All Stores" */
  periodLine?: string;
  stats?: PdfStat[];
  sections: PdfSection[];
}

// ─── Formatting helpers ────────────────────────────────────────────────────

export function formatReportMoney(ctx: ReportContext, amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: ctx.currency,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatReportNumber(value: number): string {
  return new Intl.NumberFormat("en-UG").format(value || 0);
}

export function formatReportDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// ─── Layout constants (app palette) ────────────────────────────────────────

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const BAND_H = 34;

const INK: [number, number, number] = [23, 23, 23];
const PAPER: [number, number, number] = [255, 255, 255];
const HAIRLINE: [number, number, number] = [226, 226, 222];
const STRIPE: [number, number, number] = [246, 245, 242];
const MUTED: [number, number, number] = [110, 110, 108];

function lastAutoTableY(doc: jsPDF, fallback: number): number {
  const table = (
    doc as unknown as { lastAutoTable?: { finalY?: number } }
  ).lastAutoTable;
  return typeof table?.finalY === "number" ? table.finalY : fallback;
}

async function loadPdfDeps(): Promise<{
  createDoc: () => jsPDF;
  autoTable: typeof autoTableFn;
}> {
  const [{ jsPDF }, autotable] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return { createDoc: () => new jsPDF({ unit: "mm", format: "a4" }), autoTable: autotable.default };
}

// ─── Header band ───────────────────────────────────────────────────────────

function drawHeader(doc: jsPDF, ctx: ReportContext, input: RenderInput): void {
  doc.setFillColor(...INK);
  doc.rect(0, 0, PAGE_W, BAND_H, "F");

  // Bare transparent logo — never enclosed in a container.
  try {
    doc.addImage(LOGO_DATA_URL, "PNG", MARGIN, 8, 18, 18);
  } catch {
    // Logo is decorative; the report remains valid without it.
  }

  const textX = MARGIN + 25;

  doc.setTextColor(...PAPER);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(ctx.facilityName || "Business", textX, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(input.title.toUpperCase(), textX, 19.5, { charSpace: 0.6 });

  if (input.periodLine) {
    doc.setFontSize(8);
    doc.setTextColor(200, 200, 200);
    doc.text(input.periodLine, textX, 25.5);
  }

  doc.setFontSize(7.5);
  doc.setTextColor(190, 190, 190);
  doc.text(`Generated ${formatTimestamp(new Date())}`, PAGE_W - MARGIN, 12, {
    align: "right",
  });
  if (ctx.generatedBy) {
    doc.text(`By ${ctx.generatedBy}`, PAGE_W - MARGIN, 17, { align: "right" });
  }
}

// ─── Stat cards ────────────────────────────────────────────────────────────

function drawStats(doc: jsPDF, stats: PdfStat[]): number {
  if (!stats.length) return BAND_H + 12;

  const gap = 5;
  const width = (PAGE_W - MARGIN * 2 - gap * (stats.length - 1)) / stats.length;
  const height = 21;
  const y = BAND_H + 10;

  stats.forEach((stat, i) => {
    const x = MARGIN + i * (width + gap);
    doc.setFillColor(...PAPER);
    doc.setDrawColor(...HAIRLINE);
    doc.roundedRect(x, y, width, height, 1.6, 1.6, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(...MUTED);
    doc.text(stat.label.toUpperCase(), x + 3.5, y + 7, { charSpace: 0.35 });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...INK);
    doc.text(stat.value, x + 3.5, y + 15);
  });

  return y + height;
}

// ─── Sections (striped tables) ─────────────────────────────────────────────

function drawSection(
  doc: jsPDF,
  autoTable: typeof autoTableFn,
  section: PdfSection,
  startY: number
): number {
  let cursor = startY + 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  doc.text(section.title, MARGIN, cursor);
  cursor += 2;
  doc.setDrawColor(...HAIRLINE);
  doc.line(MARGIN, cursor, PAGE_W - MARGIN, cursor);
  cursor += 3.5;

  const body = section.totalRow
    ? [...section.rows, section.totalRow]
    : section.rows;
  const lastRowIndex = section.rows.length; // index of totalRow within body

  autoTable(doc, {
    head: [section.columns],
    body,
    startY: cursor,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2,
      lineColor: HAIRLINE,
      lineWidth: 0.15,
      textColor: INK,
    },
    headStyles: {
      fillColor: INK,
      textColor: PAPER,
      fontSize: 7.8,
      fontStyle: "bold",
      halign: "left",
    },
    alternateRowStyles: { fillColor: STRIPE },
    willDrawCell: (data) => {
      if (section.totalRow && data.row.index === lastRowIndex && data.section === "body") {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.4);
      }
    },
    margin: { left: MARGIN, right: MARGIN, bottom: 22 },
  });

  return lastAutoTableY(doc, cursor);
}

// ─── Footer pagination ─────────────────────────────────────────────────────

function drawFooters(doc: jsPDF, ctx: ReportContext, title: string): void {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...HAIRLINE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, PAGE_H - 15, PAGE_W - MARGIN, PAGE_H - 15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`${ctx.facilityName || "Business"} · ${title}`, MARGIN, PAGE_H - 10);
    doc.text(`Page ${i} of ${total}`, PAGE_W - MARGIN, PAGE_H - 10, {
      align: "right",
    });
  }
}

// ─── Engine ────────────────────────────────────────────────────────────────

async function renderReportPdf(ctx: ReportContext, input: RenderInput): Promise<void> {
  const { createDoc, autoTable } = await loadPdfDeps();
  const doc = createDoc();

  drawHeader(doc, ctx, input);

  let cursor = drawStats(doc, input.stats ?? []);

  for (const section of input.sections) {
    // Start a fresh page rather than splitting a section heading from its table.
    if (cursor > PAGE_H - 45) {
      doc.addPage();
      cursor = BAND_H + 4;
    }
    cursor = drawSection(doc, autoTable, section, cursor);
  }

  drawFooters(doc, ctx, input.title);
  doc.save(input.fileName);
}

// ─── Per-report generators (called from report pages) ─────────────────────

export async function generateSalesSummaryPdf(
  ctx: ReportContext,
  input: {
    fileName: string;
    periodLine: string;
    summary: { revenue: number; itemsSold: number; salesCount: number; avgSale: number };
    records: Array<{ date: Date; store: string; lines: number; qty: number; total: number }>;
    breakdown: Array<{ item: string; qty: number; revenue: number }>;
  }
): Promise<void> {
  await renderReportPdf(ctx, {
    fileName: input.fileName,
    title: "Sales Summary",
    periodLine: input.periodLine,
    stats: [
      { label: "Total Revenue", value: formatReportMoney(ctx, input.summary.revenue) },
      { label: "Items Sold", value: formatReportNumber(input.summary.itemsSold) },
      { label: "Sales Count", value: formatReportNumber(input.summary.salesCount) },
      { label: "Average Sale", value: formatReportMoney(ctx, input.summary.avgSale) },
    ],
    sections: [
      {
        title: "Sales Records",
        columns: ["Date", "Store", "Lines", "Qty Sold", "Total"],
        numericColumns: [2, 3, 4],
        rows: input.records.map((r) => [
          formatReportDate(r.date),
          r.store,
          formatReportNumber(r.lines),
          formatReportNumber(r.qty),
          formatReportMoney(ctx, r.total),
        ]),
      },
      {
        title: "Breakdown by Item",
        columns: ["Item", "Qty Sold", "Revenue"],
        numericColumns: [1, 2],
        rows: input.breakdown.map((b) => [
          b.item,
          formatReportNumber(b.qty),
          formatReportMoney(ctx, b.revenue),
        ]),
        totalRow: ["TOTAL", "", formatReportMoney(ctx, input.summary.revenue)],
      },
    ],
  });
}

export async function generateValuationPdf(
  ctx: ReportContext,
  input: {
    fileName: string;
    periodLine: string;
    rows: Array<{
      name: string;
      type: string;
      store: string;
      year: string;
      quantities: Array<{ label: string; qty: number; cost: number }>;
      value: number;
    }>;
    totalValue: number;
  }
): Promise<void> {
  await renderReportPdf(ctx, {
    fileName: input.fileName,
    title: "Stock Valuation",
    periodLine: input.periodLine,
    stats: [
      { label: "Total Stock Value", value: formatReportMoney(ctx, input.totalValue) },
      { label: "Valued Lines", value: formatReportNumber(input.rows.length) },
    ],
    sections: input.rows.length > 0 ? [{
      title: "Valuation Detail",
      columns: (() => {
        const firstRow = input.rows[0];
        const qtyLabels = firstRow.quantities?.map(q => q.label) ?? ["PC", "CTN"];
        return ["Item", "Type", "Store", "Year", ...qtyLabels.flatMap(l => [`Qty ${l}`, `Cost ${l}`]), "Value"];
      })(),
      numericColumns: (() => {
        const firstRow = input.rows[0];
        const qtyCount = firstRow.quantities?.length ?? 2;
        return Array.from({ length: qtyCount * 2 }, (_, i) => 4 + i).concat([4 + qtyCount * 2]);
      })(),
      rows: input.rows.map((r) => [
        r.name,
        r.type,
        r.store,
        r.year,
        ...r.quantities.flatMap(q => [formatReportNumber(q.qty), formatReportMoney(ctx, q.cost)]),
        formatReportMoney(ctx, r.value),
      ]),
      totalRow: [
        "GRAND TOTAL",
        "",
        "",
        "",
        ...Array.from({ length: (input.rows[0]?.quantities?.length ?? 2) * 2 }, () => ""),
        formatReportMoney(ctx, input.totalValue),
      ],
    }] : []
  });
}

export async function generateLowStockPdf(
  ctx: ReportContext,
  input: {
    fileName: string;
    periodLine: string;
    criticalCount: number;
    lowCount: number;
    rows: Array<{
      name: string;
      type: string;
      store: string;
      quantities: Array<{ label: string; qty: number; threshold: number }>;
      status: string;
    }>;
  }
): Promise<void> {
  await renderReportPdf(ctx, {
    fileName: input.fileName,
    title: "Low Stock Report",
    periodLine: input.periodLine,
    stats: [
      { label: "Items Needing Restock", value: formatReportNumber(input.criticalCount + input.lowCount) },
      { label: "Critical (Out)", value: formatReportNumber(input.criticalCount) },
      { label: "Low", value: formatReportNumber(input.lowCount) },
    ],
    sections: input.rows.length > 0 ? [{
      title: "Restock List",
      columns: (() => {
        const firstRow = input.rows[0];
        const qtyLabels = firstRow.quantities?.map(q => q.label) ?? ["PC", "CTN"];
        return ["Item", "Type", "Store", ...qtyLabels.flatMap(l => [`Current ${l}`, `Threshold ${l}`]), "Status"];
      })(),
      numericColumns: (() => {
        const firstRow = input.rows[0];
        const qtyCount = firstRow.quantities?.length ?? 2;
        return Array.from({ length: qtyCount * 2 }, (_, i) => 3 + i);
      })(),
      rows: input.rows.map((r) => [
        r.name,
        r.type,
        r.store,
        ...r.quantities.flatMap(q => [formatReportNumber(q.qty), formatReportNumber(q.threshold)]),
        r.status.toUpperCase(),
      ]),
    }] : []
  });
}

export async function generateMovementsPdf(
  ctx: ReportContext,
  input: {
    fileName: string;
    periodLine: string;
    summary: { totalIn: number; totalOut: number; net: number };
    rows: Array<{
      date: Date;
      itemName: string;
      type: string;
      store: string;
      quantities: Array<{ label: string; qty: number }>;
      performedBy: string;
      notes: string;
    }>;
  }
): Promise<void> {
  await renderReportPdf(ctx, {
    fileName: input.fileName,
    title: "Movement History",
    periodLine: input.periodLine,
    stats: [
      { label: "Total In", value: formatReportNumber(input.summary.totalIn) },
      { label: "Total Out", value: formatReportNumber(input.summary.totalOut) },
      { label: "Net Movement", value: formatReportNumber(input.summary.net) },
    ],
    sections: input.rows.length > 0 ? [{
      title: "Movements",
      columns: (() => {
        const firstRow = input.rows[0];
        const qtyLabels = firstRow.quantities?.map(q => q.label) ?? ["Qty"];
        return ["Date", "Item", "Type", "Store", ...qtyLabels.map(l => `Qty ${l}`), "Performed By", "Notes"];
      })(),
      numericColumns: (() => {
        const firstRow = input.rows[0];
        const qtyCount = firstRow.quantities?.length ?? 1;
        return Array.from({ length: qtyCount }, (_, i) => 4 + i);
      })(),
      rows: input.rows.map((r) => [
        formatReportDate(r.date),
        r.itemName,
        r.type,
        r.store,
        ...r.quantities.map(q => formatReportNumber(q.qty)),
        r.performedBy || "—",
        r.notes || "—",
      ]),
    }] : []
  });
}

export async function generateProfitsPdf(
  ctx: ReportContext,
  input: {
    fileName: string;
    periodLine: string;
    summary: { totalRevenue: number; totalProfit: number; margin: number };
    rows: Array<{
      date: Date;
      items: string;
      store: string;
      revenue: number;
      profit: number | null;
    }>;
  }
): Promise<void> {
  await renderReportPdf(ctx, {
    fileName: input.fileName,
    title: "Profits Report",
    periodLine: input.periodLine,
    stats: [
      { label: "Total Revenue", value: formatReportMoney(ctx, input.summary.totalRevenue) },
      { label: "Total Profit", value: formatReportMoney(ctx, input.summary.totalProfit) },
      { label: "Profit Margin", value: `${input.summary.margin.toFixed(1)}%` },
    ],
    sections: input.rows.length > 0 ? [{
      title: "Sales Detail",
      columns: ["Date", "Items", "Store", "Revenue", "Profit"],
      numericColumns: [3, 4],
      rows: input.rows.map((r) => [
        formatReportDate(r.date),
        r.items,
        r.store,
        formatReportMoney(ctx, r.revenue),
        r.profit === null ? "—" : formatReportMoney(ctx, r.profit),
      ]),
      totalRow: [
        "TOTAL",
        "",
        "",
        formatReportMoney(ctx, input.summary.totalRevenue),
        formatReportMoney(ctx, input.summary.totalProfit),
      ],
    }] : []
  });
}

export async function generateAgingPdf(
  ctx: ReportContext,
  input: {
    fileName: string;
    periodLine: string;
    groups: Array<{
      year: string;
      itemCount: number;
      subtotal: number;
      rows: Array<{ 
        name: string; 
        type: string; 
        store: string; 
        quantities: Array<{ label: string; qty: number; cost: number }>;
        value: number 
      }>;
    }>;
    totalValue: number;
  }
): Promise<void> {
  await renderReportPdf(ctx, {
    fileName: input.fileName,
    title: "Stock Aging Analysis",
    periodLine: input.periodLine,
    stats: [
      { label: "Age Bands", value: formatReportNumber(input.groups.length) },
      { label: "Grand Total Value", value: formatReportMoney(ctx, input.totalValue) },
    ],
    sections: input.groups.map((g) => {
      // Get quantity type labels from first row for column headers
      const qtyLabels = g.rows[0]?.quantities?.map(q => q.label) ?? ["PC", "CTN"];
      return {
        title: `Stock Year ${g.year} (${g.itemCount} items)`,
        columns: ["Item", "Type", "Store", ...qtyLabels.map(l => `Qty ${l}`), "Value"],
        numericColumns: Array.from({ length: qtyLabels.length }, (_, i) => 3 + i).concat([3 + qtyLabels.length]),
        rows: g.rows.map((r) => [
          r.name,
          r.type,
          r.store,
          ...r.quantities.map(q => formatReportNumber(q.qty)),
          formatReportMoney(ctx, r.value),
        ]),
        totalRow: [
          "SUBTOTAL",
          "",
          "",
          ...qtyLabels.map(() => ""),
          formatReportMoney(ctx, g.subtotal),
        ],
      };
    }),
  });
}
