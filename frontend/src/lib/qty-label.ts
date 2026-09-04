import type { QuantityType } from "@/types";

// Older records key quantities by short legacy ids ("pcs", "ctn", ...) rather
// than the item's current quantity-type ids. Map the known ones to readable
// labels so raw identifiers never leak into the UI.
const LEGACY_LABELS: Record<string, string> = {
  pcs: "Pieces",
  pc: "Piece",
  piece: "Piece",
  pieces: "Pieces",
  box: "Boxes",
  boxes: "Boxes",
  ctn: "Cartons",
  carton: "Cartons",
  dozen: "Dozens",
  dozens: "Dozens",
};

// Inventory rows carry a denormalized copy of the item's quantity types that
// can drift from the catalog document (multi-device edits, rows predating the
// copy, etc.). Merge every available source into one de-duplicated list —
// first occurrence wins — so label lookups resolve regardless of which copy
// a record was written against.
export function mergeQuantityTypes(
  ...lists: (QuantityType[] | undefined | null)[]
): QuantityType[] {
  const merged: QuantityType[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const qt of list ?? []) {
      if (!qt?.id || seen.has(qt.id)) continue;
      seen.add(qt.id);
      merged.push(qt);
    }
  }
  return merged;
}

// Resolve a quantity-type id to its display label: the item's own quantity
// type label when available, a legacy label otherwise, else the id unchanged.
export function getQuantityTypeLabel(
  quantityTypes: QuantityType[] | undefined | null,
  qtyTypeId: string
): string {
  const qt = quantityTypes?.find((q) => q.id === qtyTypeId);
  if (qt?.label) return qt.label;
  return LEGACY_LABELS[qtyTypeId.toLowerCase()] ?? qtyTypeId;
}

// Format a quantities map (keyed by quantity-type id) as "4 Pieces / 16 Boxes".
export function formatQuantities(
  quantities: Record<string, number> | undefined | null,
  quantityTypes: QuantityType[] | undefined | null
): string {
  if (!quantities) return "";
  const entries = Object.entries(quantities);
  if (entries.length === 0) return "";
  return entries
    .map(([id, qty]) => `${qty} ${getQuantityTypeLabel(quantityTypes, id)}`)
    .join(" / ");
}
