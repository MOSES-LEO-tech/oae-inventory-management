"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";

const stockInItemSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  unitCost: z.number().min(0, "Unit cost must be non-negative"),
  batchNumber: z.string().optional(),
});

const stockInSchema = z.object({
  date: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
  items: z.array(stockInItemSchema).min(1, "At least one item is required"),
});

type StockInFormData = z.infer<typeof stockInSchema>;

interface StockInFormProps {
  onCancel: () => void;
  onComplete: () => void;
}

export function StockInForm({ onCancel, onComplete }: StockInFormProps) {
  const { user } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<StockInFormData>({
    resolver: zodResolver(stockInSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      items: [{ itemId: "", quantity: 0, unitCost: 0, batchNumber: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const addItem = () => {
    append({ itemId: "", quantity: 0, unitCost: 0, batchNumber: "" });
  };

  const onSubmit = async (data: StockInFormData) => {
    setIsSubmitting(true);
    try {
      // TODO: Implement stock in API call
      const stockInData = {
        date: new Date(data.date),
        notes: data.notes,
        items: data.items,
        createdBy: user?.id,
        createdAt: new Date(),
      };

      console.log("Stock in data:", stockInData);
      toast.success("Stock in recorded successfully!");
      onComplete();
    } catch (error) {
      toast.error("Failed to record stock in");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Stock Entry Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                {...register("date")}
              />
              {errors.date && (
                <p className="text-sm text-destructive">{errors.date.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                placeholder="Add any notes about this stock in..."
                {...register("notes")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Items ({fields.length})</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor={`itemId-${index}`}>Item</Label>
                  <Select
                    onValueChange={(value) =>
                      register(`items.${index}.itemId`).onChange({ target: { value } })
                    }
                  >
                    <SelectTrigger id={`itemId-${index}`}>
                      <SelectValue placeholder="Select an item" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* TODO: Populate with actual items */}
                      <SelectItem value="item-1">Product A</SelectItem>
                      <SelectItem value="item-2">Product B</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.items?.[index]?.itemId && (
                    <p className="text-sm text-destructive">{errors.items[index].itemId.message}</p>
                  )}
                </div>

                <div className="w-24 space-y-2">
                  <Label htmlFor={`quantity-${index}`}>Qty</Label>
                  <Input
                    id={`quantity-${index}`}
                    type="number"
                    min="1"
                    {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                  />
                  {errors.items?.[index]?.quantity && (
                    <p className="text-sm text-destructive">{errors.items[index].quantity.message}</p>
                  )}
                </div>

                <div className="w-32 space-y-2">
                  <Label htmlFor={`unitCost-${index}`}>Unit Cost</Label>
                  <Input
                    id={`unitCost-${index}`}
                    type="number"
                    step="0.01"
                    min="0"
                    {...register(`items.${index}.unitCost`, { valueAsNumber: true })}
                  />
                  {errors.items?.[index]?.unitCost && (
                    <p className="text-sm text-destructive">{errors.items[index].unitCost.message}</p>
                  )}
                </div>

                <div className="w-32 space-y-2">
                  <Label htmlFor={`batch-${index}`}>Batch (Optional)</Label>
                  <Input
                    id={`batch-${index}`}
                    placeholder="BATCH-001"
                    {...register(`items.${index}.batchNumber`)}
                  />
                </div>

                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              "Saving..."
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Stock Entry
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}