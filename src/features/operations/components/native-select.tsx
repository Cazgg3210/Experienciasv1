import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * <select> nativo con el estilo de los inputs del sistema: accesible, ligero (listas largas de
 * tareas) y con el selector nativo en móvil.
 */
export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  Omit<React.ComponentProps<"select">, "size"> & { size?: "sm" | "default" | "lg" }
>(function NativeSelect({ className, size = "default", children, ...props }, ref) {
  return (
    <div className={cn("relative inline-flex w-full min-w-0", className)}>
      <select
        ref={ref}
        {...props}
        className={cn(
          "border-input bg-background w-full min-w-0 appearance-none rounded-lg border pr-8 pl-2.5 text-sm transition-colors outline-none",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:ring-3",
          size === "sm" && "h-7 text-xs",
          size === "default" && "h-8",
          size === "lg" && "h-11 text-base",
        )}
      >
        {children}
      </select>
      <ChevronDown
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2"
        aria-hidden
      />
    </div>
  );
});
