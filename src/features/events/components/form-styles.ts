/** Clases compartidas por formularios del módulo (inputs nativos con el mismo look que shadcn). */
export const nativeSelectClass =
  "h-10 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 sm:h-9 md:text-sm dark:bg-input/30";

export const inputSizeClass = "h-10 sm:h-9";

/**
 * Tarjeta de grupo de campos. La leyenda flota para quedar dentro de la tarjeta
 * (y no "cortando" el borde como hace el <legend> nativo); el siguiente bloque la limpia.
 */
export const fieldsetClass =
  "min-w-0 space-y-4 rounded-xl border bg-card p-4 shadow-xs sm:p-5 [&>legend+*]:clear-both";

export const legendClass = "font-heading float-left w-full text-xl font-semibold";
