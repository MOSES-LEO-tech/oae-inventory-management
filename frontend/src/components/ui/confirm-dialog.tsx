"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

// Ported from Legacy Medicore (NEW UPDATE/components/ui/confirm-dialog.tsx).
// Principle: destructive/irreversible actions are confirmed with this modal —
// never native confirm() and never inline two-click patterns.
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: "default" | "destructive" | "purple";
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}

const VARIANT_STYLES: Record<string, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  purple: "bg-purple-600 text-white hover:bg-purple-700",
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = "Confirm",
  confirmVariant = "default",
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    },
    [onOpenChange]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={() => !loading && onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="relative bg-card border rounded-lg shadow-lg w-full max-w-sm mx-4 p-6 z-10 animate-in fade-in zoom-in-95">
        <button
          onClick={() => onOpenChange(false)}
          disabled={loading}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-6">{message}</p>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-md border bg-card text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "px-4 py-2 text-sm rounded-md font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-2",
              VARIANT_STYLES[confirmVariant]
            )}
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
