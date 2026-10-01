import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * <select> nativo con el estilo de los inputs. Funciona sin JS (formularios GET de filtros),
 * con react-hook-form (register) y es totalmente accesible con teclado y lectores de pantalla.
 */
export function NativeSelect({ className, wrapperClassName, ...props }: React.ComponentProps<"select"> & { wrapperClassName?: string }) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <select
        className={cn(
          "border-input bg-background h-8 w-full min-w-0 appearance-none rounded-lg border py-1 pr-8 pl-2.5 text-base outline-none md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:ring-3",
          "disabled:bg-input/50 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
      <ChevronDown
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2"
        aria-hidden
      />
    </div>
  );
}
