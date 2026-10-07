import { cn } from "@/lib/utils";

/**
 * Aviso para quien navega sin JavaScript en un formulario cuyo botón espera a hidratar
 * (`<SubmitButton waitForHydration />`): sin JS el botón nunca se habilita y aquí se explica por qué.
 */
export function NoScriptNotice({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <noscript>
      <p className={cn("text-muted-foreground text-sm", className)}>
        {children ?? "Para enviar este formulario activa JavaScript en tu navegador."}
      </p>
    </noscript>
  );
}
