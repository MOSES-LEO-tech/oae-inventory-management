import type { Item, QuantityType } from "@/types";

// ── Carton ⇄ piece conversion ─────────────────────────────────────────────
// An item's non-default quantity type (Carton) carries conversionFactor =
// pieces per carton. These helpers convert between sealed cartons and loose
// pieces so sales can draw from loose first and auto-break sealed cartons.

// The carton-like type of an item: the non-default type whose unit is boxes,
// else the first non-default type. Returns undefined for single-unit items.
export function findCartonType(quantityTypes: QuantityType[] | undefined | null): QuantityType | undefined {
  const list = quantityTypes ?? [];
  return (
    list.find((qt) => !qt.isDefault && qt.unit === "boxes") ??
    list.find((qt) => !qt.isDefault && (qt.conversionFactor ?? 1) > 1)
  );
}

// Pieces per carton for an item (1 when the item has no carton type).
export function pcsPerCarton(
  item: (Pick<Item, "quantityTypes"> & { pcsPerCtn?: number }) | undefined | null
): number {
  const ct = findCartonType(item?.quantityTypes);
  const factor = ct?.conversionFactor ?? item?.pcsPerCtn ?? 1;
  return factor > 0 ? factor : 1;
}

// Total loose-piece equivalent of a quantities map: loose pcs + sealed ctn
// × factor. Keys are quantity-type ids resolved against the item's types.
export function totalPieces(
  quantities: Record<string, number> | undefined | null,
  quantityTypes: QuantityType[] | undefined | null
): number {
  if (!quantities) return 0;
  const ct = findCartonType(quantityTypes);
  let pcsId = "pcs";
  let factor = 1;
  if (quantityTypes) {
    const pcsQt = quantityTypes.find((qt) => qt.isDefault || qt.unit === "pcs");
    if (pcsQt) pcsId = pcsQt.id;
    if (ct) factor = (ct.conversionFactor ?? 1) > 0 ? ct.conversionFactor ?? 1 : 1;
  }
  let total = 0;
  for (const [id, qty] of Object.entries(quantities)) {
    if (id === ct?.id) total += qty * factor;
    else if (id === pcsId || id === "pcs") total += qty;
    // Other non-piece types (dozens, meters) are not convertible — ignored here.
  }
  return total;
}

export interface SaleResolution {
  ok: boolean;
  // Shortfall description when ok is false — "requested X, only Y available".
  error?: string;
  // Net per-pile deltas to apply (negative). Carton auto-break is baked in:
  // breaking 1 ctn yields ctn −1, pcs +factor, then pcs −requested.
  deltas: Record<string, number>;
}

// Resolve a requested sale (keyed by quantity-type id) against the current
// piles into per-pile INCREMENT deltas. Loose pieces are drawn first; a
// shortfall auto-breaks sealed cartons (factor = pcs per carton from the
// item's carton-type conversionFactor). Carton requests draw sealed first,
// then the piece equivalent. Fails when total availability can't cover it.
export function resolveSaleDeltas(
  serverQuantities: Record<string, number>,
  quantityTypes: QuantityType[] | undefined | null,
  requested: Record<string, number>
): SaleResolution {
  const ct = findCartonType(quantityTypes);
  const factor = ct ? pcsPerCarton({ quantityTypes: quantityTypes ?? [] }) : 0;
  const pcsQt = quantityTypes?.find((qt) => qt.isDefault || qt.unit === "pcs");
  const deltas: Record<string, number> = {};

  const availPcs = (serverQuantities[pcsQt?.id ?? "pcs"] ?? 0) + (serverQuantities["pcs"] ?? 0);
  const availCtn = ct ? serverQuantities[ct.id] ?? 0 : 0;

  let needPcs = 0;
  let needCtn = 0;
  for (const [id, qty] of Object.entries(requested)) {
    if (qty <= 0) continue;
    if (ct && id === ct.id) needCtn += qty;
    else needPcs += qty; // pcs or any unknown id defaults to piece-equivalent
  }

  // Carton demand: sealed cartons first, remainder converted to pcs.
  const sealedUse = Math.min(needCtn, availCtn);
  needPcs += (needCtn - sealedUse) * (factor || 1);
  if (sealedUse > 0 && ct) deltas[ct.id] = (deltas[ct.id] ?? 0) - sealedUse;

  // Piece demand: loose first, auto-break sealed cartons for the shortfall.
  const looseUse = Math.min(needPcs, availPcs);
  const shortfall = needPcs - looseUse;
  const totalAvail = availPcs + availCtn * (factor || 1);
  if (shortfall > 0 && availCtn * (factor || 1) < shortfall) {
    return {
      ok: false,
      error: `requested ${needPcs + needCtn * (factor || 1)} pcs equivalent, only ${totalAvail} available`,
      deltas: {},
    };
  }
  if (looseUse > 0) {
    const pcsId = pcsQt?.id ?? "pcs";
    deltas[pcsId] = (deltas[pcsId] ?? 0) - looseUse;
  }
  const breakCtn = shortfall > 0 ? Math.ceil(shortfall / (factor || 1)) : 0;
  if (breakCtn > 0 && ct) {
    deltas[ct.id] = (deltas[ct.id] ?? 0) - breakCtn;
    // Breaking adds the un-sold remainder of the broken carton back to loose.
    const returnedPcs = breakCtn * (factor || 1) - shortfall;
    if (returnedPcs > 0) {
      const pcsId = pcsQt?.id ?? "pcs";
      deltas[pcsId] = (deltas[pcsId] ?? 0) + returnedPcs;
    }
  }
  return { ok: true, deltas };
}
