"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Copia texto (link, invitación) al portapapeles con confirmación. */
export function CopyButton({
  value,
  label = "Copiar",
  copiedLabel = "Copiado",
  toastMessage = "Copiado al portapapeles",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick" | "value"> & {
  value: string;
  label?: string;
  copiedLabel?: string;
  toastMessage?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(toastMessage);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar. Selecciona y copia manualmente.");
    }
  }
  return (
    <Button type="button" variant="outline" onClick={onCopy} {...props}>
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      <span>{copied ? copiedLabel : label}</span>
    </Button>
  );
}
