"use client";

import { Loader2, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  storeId?: string;
  categoryId?: string;
  quantity: number;
  threshold: number;
  costPrice: number;
  sellingPrice: number;
  supplier?: string;
  lastRestockedAt?: string;
  createdAt: string;
}

interface ItemListProps {
  search: string;
}

// Placeholder component - no data fetching for now
export function ItemList({ search }: ItemListProps) {
  const items: InventoryItem[] = [];
  const isLoading = false;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!items || items.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-semibold">No items found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {search ? "Try adjusting your search" : "Add items to get started"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Items ({items.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {items.map((item: InventoryItem) => (
            <div key={item.id} className="flex items-center justify-between py-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{item.name}</span>
                  {item.quantity <= item.threshold && (
                    <Badge variant="destructive">Low Stock</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  SKU: {item.sku} | Qty: {item.quantity} | {item.sellingPrice}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
