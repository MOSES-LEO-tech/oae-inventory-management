import { z } from "zod";

const positiveQuantity = z.coerce.number().int().min(0);

export const stockOutSchema = z.object({
  itemId: z.string().min(1, "Select an item."),
  qtyPc: positiveQuantity,
  qtyCtn: positiveQuantity,
  unitPrice: z.coerce.number().positive("Enter a unit price."),
  storeId: z.string().min(1, "Select a store."),
}).refine((data) => data.qtyPc > 0 || data.qtyCtn > 0, {
  message: "Enter a quantity in PC or CTN.",
  path: ["qtyPc"],
});

export const stockInSchema = z.object({
  itemId: z.string().min(1, "Select an item."),
  qtyPc: positiveQuantity,
  qtyCtn: positiveQuantity,
  storeId: z.string().min(1, "Select a store."),
}).refine((data) => data.qtyPc > 0 || data.qtyCtn > 0, {
  message: "Enter a quantity in PC or CTN.",
  path: ["qtyPc"],
});

export const transferSchema = z.object({
  fromStore: z.string().min(1, "Select the source store."),
  toStore: z.string().min(1, "Select the destination store."),
  rows: z.array(z.object({
    itemId: z.string().min(1, "Select an item."),
    qtyPc: positiveQuantity,
    qtyCtn: positiveQuantity,
  })).min(1, "Add at least one item."),
}).superRefine((data, ctx) => {
  if (data.fromStore === data.toStore) {
    ctx.addIssue({ code: "custom", message: "Choose different source and destination stores.", path: ["toStore"] });
  }
  const itemIds = data.rows.map((row) => row.itemId).filter(Boolean);
  if (new Set(itemIds).size !== itemIds.length) {
    ctx.addIssue({ code: "custom", message: "Each item can only be added once.", path: ["rows"] });
  }
  data.rows.forEach((row, index) => {
    if (row.qtyPc === 0 && row.qtyCtn === 0) {
      ctx.addIssue({ code: "custom", message: "Enter a PC or CTN quantity.", path: ["rows", index] });
    }
  });
});

export const addItemSchema = z.object({
  name: z.string().trim().min(2, "Enter an item name."),
  type: z.string().trim().min(1, "Enter an item type or variant."),
  category: z.string().min(1, "Select a stock year."),
  unitPricePc: z.coerce.number().positive("Enter a PC price."),
  unitPriceCtn: z.coerce.number().positive("Enter a CTN price."),
  lowStockThresholdPc: positiveQuantity,
  lowStockThresholdCtn: positiveQuantity,
});

export const adjustmentSchema = z.object({
  adjPc: z.coerce.number().int(),
  adjCtn: z.coerce.number().int(),
  reason: z.string().trim().min(3, "Enter a reason for the adjustment."),
  currentPc: z.number().int().min(0),
  currentCtn: z.number().int().min(0),
}).superRefine((data, ctx) => {
  if (data.adjPc === 0 && data.adjCtn === 0) {
    ctx.addIssue({ code: "custom", message: "Enter a PC or CTN adjustment.", path: ["adjPc"] });
  }
  if (data.currentPc + data.adjPc < 0) {
    ctx.addIssue({ code: "custom", message: "The PC balance cannot be negative.", path: ["adjPc"] });
  }
  if (data.currentCtn + data.adjCtn < 0) {
    ctx.addIssue({ code: "custom", message: "The CTN balance cannot be negative.", path: ["adjCtn"] });
  }
});

export type ValidationErrors = Record<string, string>;

export function flattenValidationErrors(error: z.ZodError): ValidationErrors {
  return error.issues.reduce<ValidationErrors>((errors, issue) => {
    const key = issue.path.join(".");
    if (!errors[key]) errors[key] = issue.message;
    return errors;
  }, {});
}
