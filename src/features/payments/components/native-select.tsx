import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** <select> nativo accesible con el estilo de los inputs (compatible con react-hook-form register). */
export const PaymentsSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  function PaymentsSelect({ className, children, ...props }, ref) {
    return (
      <div className={cn("relative", className)}>
        <select
          ref={ref}
          className={cn(
            "border-input bg-background h-9 w-full appearance-none rounded-lg border py-1.5 pr-8 pl-2.5 text-sm transition-colors outline-none",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3",
            "aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:cursor-not-allowed disabled:opacity-50",
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2"
          aria-hidden
        />
      </div>
    );
  },
);
