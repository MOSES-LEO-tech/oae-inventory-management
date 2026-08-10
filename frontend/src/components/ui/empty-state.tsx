"use client";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      <div className="mb-3 text-mid-gray">{icon}</div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-mid-gray">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
