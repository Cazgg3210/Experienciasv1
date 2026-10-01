import { cn } from "@/lib/utils";

/**
 * Tabla de datos de una gráfica. Por defecto se muestra plegada en un <details> ("Ver datos")
 * para lectura precisa; con `hidden` queda sólo para lectores de pantalla.
 */
export function ChartDataTable({
  caption,
  columns,
  rows,
  hidden = false,
  className,
}: {
  caption: string;
  columns: string[];
  rows: Array<Array<React.ReactNode>>;
  hidden?: boolean;
  className?: string;
}) {
  const table = (
    <table className="w-full text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b">
          {columns.map((c, i) => (
            <th
              key={c}
              scope="col"
              className={cn("text-muted-foreground py-1.5 font-medium", i === 0 ? "text-left" : "text-right")}
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} className="border-b last:border-0">
            {r.map((cell, ci) =>
              ci === 0 ? (
                <th key={ci} scope="row" className="py-1.5 text-left font-normal">
                  {cell}
                </th>
              ) : (
                <td key={ci} className="tabular py-1.5 text-right">
                  {cell}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
  // sr-only sobre <table> no recorta (las tablas ignoran width/overflow): se envuelve en un div.
  if (hidden) return <div className="sr-only">{table}</div>;
  return (
    <details className={cn("group mt-3", className)}>
      <summary className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex cursor-pointer items-center gap-1 rounded text-xs underline-offset-4 outline-none select-none hover:underline focus-visible:ring-2">
        <span className="group-open:hidden">Ver datos</span>
        <span className="hidden group-open:inline">Ocultar datos</span>
      </summary>
      <div className="mt-2 overflow-x-auto">{table}</div>
    </details>
  );
}
