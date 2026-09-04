import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus } from "lucide-react";

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-heading-sm font-semibold tracking-heading-sm">Invoices</h1>
          <p className="text-muted-foreground">Generate and track invoices.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Generate Invoice
        </Button>
      </div>

      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          <FileText className="mx-auto mb-3 h-12 w-12" />
          <p>No invoices generated yet.</p>
          <p className="text-sm">Click "Generate Invoice" to create one.</p>
        </CardContent>
      </Card>
    </div>
  );
}