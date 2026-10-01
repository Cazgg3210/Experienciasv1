"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LeadForm, type LeadFormOptionsProps } from "./lead-form";

/** "Nuevo lead": captura manual (WhatsApp, Instagram, recomendación…) desde el panel. */
export function NewLeadDialog({ options }: { options: LeadFormOptionsProps }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <Plus aria-hidden />
          Nuevo lead
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl sm:p-6">
        <DialogHeader className="pr-8">
          <DialogTitle className="font-heading text-2xl">Nuevo lead</DialogTitle>
          <DialogDescription>
            Registra a quien te escribió por WhatsApp, Instagram o por recomendación. Si ya es clienta, la
            vinculamos automáticamente por correo o teléfono.
          </DialogDescription>
        </DialogHeader>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-3 right-3"
          onClick={() => setOpen(false)}
          aria-label="Cerrar"
        >
          <X aria-hidden />
        </Button>
        {open ? (
          <LeadForm
            mode="create"
            options={options}
            defaultValues={{ name: "", occasion: "BIRTHDAY", source: "MANUAL" }}
            onDone={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
