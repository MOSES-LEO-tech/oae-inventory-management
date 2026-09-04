# OAE Inventory — Stock-Math Verification Report

**Date:** 2026-09-04 · **Project:** `inventory-master-ddc8c` · **Scope:** HANDOVER.md §6 checklist
**Test facility:** "Hermes QA Lab" (`2ecea594-29a4-457b-a722-59481f716815`) — scratch data only, no business data touched.
**Method:** every assertion made against **server-truth** via Firestore REST (`.hermes/qa/deep.mjs`), never the UI cache. Wire-level evidence via CDP network capture (`.hermes/qa/netcap.mjs` → `commits*.jsonl`).

---

## Verdict

**The handover's central claim was FALSE as shipped — now FIXED and verified.**

The increment-only architecture (§4/§5) was correctly designed but incorrectly implemented in
`src/stores/inventory-store.ts`: every quantity mutation passed a **nested map literal**
(`quantities: { typeId: increment(δ) }`) to `update()`. Firestore derives the update mask
from the payload, so the mask included the **parent `quantities` field** → the server first
**replaced the whole map with `{}`**, then applied the increment transform: `0 + δ = δ`.

Consequences (all reproduced before the fix):
- Any sale/adjust/transfer against a **nonzero base** landed at exactly the delta
  (base 10, sale 3 → **−3**, reproduced 3× deterministically).
- **Sibling quantity-type keys were wiped** by the parent mask.
- Ledger stayed self-consistent (movement docs correct) while the doc was wrong —
  exactly the "entered = total" symptom §6.3 misattributed to legacy data damage.
- Stock-in legs "passed" only because every base was 0 (`0 + δ = δ` looks correct).
- Offline replay had the same defect (same call shape).

**Fix applied** (`inventory-store.ts`, 8 sites: adjustStock, addStockIn ×2,
recordSale online+offline, dispatchTransfer, completeTransfer, cancelTransfer):
dot-path field keys —

```ts
// before (broken): mask includes parent map → map wiped, then transformed
{ quantities: { [id]: increment(δ) } }
// after (correct): mask contains only the subfields
{ [`quantities.${id}`]: increment(δ) }
```

`src/lib/stock/operations.ts` already used the correct dot-path shape (unwired module) —
which shows the author knew the right form; the wired store diverged from it.

---

## Results matrix (all server-truth verified)

| # | Case | Before fix | After fix |
|---|---|---|---|
| 1 | Stock-in +10 (base 0) | 10 ✓ (by coincidence) | — |
| 2 | Stock-in {+8 Pc, +2 Box} multi-type | — | **8 / 2** ✅ |
| 3 | **Sale −3 from base 10** | **−3 ✗ (repro ×3, wire-captured)** | **7** ✅ |
| 4 | Adjust +5 from 7 | — | **12** ✅, ADJUSTMENT movement ledgered |
| 5 | Sibling preservation: +2 Pc on {8 Pc, 2 Box} | would wipe Box | **10 Pc / Box intact 2** ✅ |
| 6 | Transfer request → dispatch 4 | would land −4 | Main 12→**8** ✅, IN_TRANSIT |
| 7 | Receive transfer (new dest row) | would create 4-from-0 by luck | Branch row = **4** ✅ (dot-path merge creates subfields on new docs), COMPLETED, receivedQuantities recorded |
| 8 | Cancel IN_TRANSIT (−2) | — | Main restored 6→**8** ✅, CANCELLED, TRANSFER_IN movement |
| 9 | `next build` gate (§6.1) | interrupted at handover | **PASS** — compiled clean, TS clean, 31/31 routes (pre- and post-fix) |
| 10 | Offline queue & replay | — | ⚠️ see caveat |

### Caveat on the offline leg (case 10)
CDP `Network.emulateNetworkConditions(offline)` does **not** sever Firestore's established
long-poll/WebSocket channel — `navigator.onLine` stayed true in-page and the write applied
server-side. A strict offline→online replay could not be produced in this harness. The
offline code path (inventory-store.ts :1176–1190) was patched with the identical dot-path
shape and is covered by cases 5/7 (same `merge:true` + dot-path mechanics that replay uses).
A true offline test needs a genuinely airgapped client (DevTools offline toggle by hand, or
a device with radios off) — recommended as follow-up, not a blocker: the write shape, which
is the only thing that differed, is verified.

### Two-device commute test — not run
Requires two independent browser profiles signed into the facility simultaneously. Not
attempted: the commute property follows from the verified wire format (pure per-subfield
transforms commute under any order); recommend a manual two-browser spot-check if desired.

---

## Evidence artifacts (`.hermes/qa/`)

| File | Contents |
|---|---|
| `commits.jsonl`, `commits2.jsonl` | Raw Firestore Commit bodies captured pre-fix — the smoking gun (`update {quantities:{}}` + `updateTransforms` + parent-field mask) |
| `deep.mjs` | Server-truth dump: inventory / movements / transfers decoded |
| `netcap.mjs` | CDP network capture harness |
| `restore-pen.mjs` | Scratch-doc rebuild utility (full field set at qty 10) |
| `fs-rest.mjs` | Auth + Firestore REST oracle |
| `cdp.mjs` | Chrome DevTools Protocol driver (nav/fill/click/offline/shot) |
| `probe-txn.mjs` | REST transform probe (proved server math correct: standalone increment → 7) |

## Test accounts & data
- Admin: `hermes.qa.oae@test.dev` / `HermesQA-2026!`
- Facility: Hermes QA Lab — Main Store + Branch Store
- Items: QA Pen Blue (Pieces), QA Notebook A4 (Pieces+Box)
- Final server state: Pen Main 7 (10−3 sale) + Branch 4, Notebook 10 Pc / 2 Box — all consistent with the ledger.

## Recommendations
1. **Deploy the fixed `inventory-store.ts`** — it is the only changed file.
2. **Data repair sweep:** any real-facility row that ever recorded a sale/adjust/transfer
   against a nonzero base before this fix is likely corrupted to "delta-only" values.
   The movement ledger (`stockMovements`) is complete and trustworthy — expected totals can
   be recomputed from it (sum of IN/OUT/ADJUSTMENT per itemId+qtyTypeId) and diffs applied
   as one manual adjustment per damaged row (handover §6.3's drill, now with the right
   diagnosis).
3. Consider a regression test that performs a sale against a seeded nonzero base and
   asserts the server doc — the one check that would have caught this.
4. The handover's §4 "why-math-errors-impossible" table should be amended: increments make
   math commutative, but **only with dot-path masks** — nested map literals silently
   downgrade to absolute-from-zero writes.