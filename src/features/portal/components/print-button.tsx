"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button type="button" size="xl" onClick={() => window.print()} className="print:hidden">
      <Printer aria-hidden /> Imprimir / Guardar PDF
    </Button>
  );
}
