"use client";

import * as React from "react";

interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "checked"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/**
 * Dependency-free accessible switch (same role/aria contract as the Radix
 * Switch used by shadcn/ui, without adding the dependency).
 */
const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className = "", checked, onCheckedChange, ...props }, ref) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-state={checked ? "checked" : "unchecked"}
      ref={ref}
      onClick={() => onCheckedChange(!checked)}
      className={`inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-primary" : "bg-hairline"
      } ${className}`}
      {...props}
    >
      <span
        className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-subtle ring-0 transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  )
);
Switch.displayName = "Switch";

export { Switch };
