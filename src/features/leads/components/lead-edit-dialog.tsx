"use client";

import * as React from "react";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LeadForm, type LeadFormOptionsProps, type LeadFormValues } from "./lead-form";

export function LeadEditDialog({ options, values }: { options: LeadFormOptionsProps; values: LeadFormValues }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg">
          <Pencil aria-hidden />
          Editar datos
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl sm:p-6">
        <DialogHeader className="pr-8">
          <DialogTitle className="font-heading text-2xl">Editar lead</DialogTitle>
          <DialogDescription>
            Los cambios quedan registrados en la actividad del lead. Las alertas de cobertura y grupo grande se
            recalculan al guardar.
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
            mode="edit"
            options={options}
            defaultValues={values}
            onDone={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
