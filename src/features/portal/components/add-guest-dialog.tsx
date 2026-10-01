"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { hostGuestFormSchema, type HostGuestFormValues } from "@/features/guests/schemas";
import { addHostGuestAction } from "@/features/guests/server/actions";
import { usePortalUi } from "./portal-ui";

/** Alta rápida de invitadas (se queda abierto para agregar varias seguidas). */
export function AddGuestDialog({ token }: { token: string }) {
  const { addGuestOpen, setAddGuestOpen } = usePortalUi();
  const router = useRouter();
  const [added, setAdded] = React.useState<string[]>([]);
  const form = useForm<HostGuestFormValues>({
    resolver: zodResolver(hostGuestFormSchema),
    defaultValues: { name: "", contact: "" },
  });
  const pending = form.formState.isSubmitting;

  async function onSubmit(values: HostGuestFormValues) {
    const res = await addHostGuestAction({ token, ...values });
    if (handleActionResult(res, { form, success: `Agregamos a ${values.name.trim()} a tu lista` })) {
      setAdded((prev) => [res.data.name, ...prev].slice(0, 5));
      form.reset({ name: "", contact: "" });
      // Tras re-render (el botón de envío deja de estar ocupado), volver al nombre para agregar la siguiente.
      window.setTimeout(() => form.setFocus("name"), 0);
      router.refresh();
    }
  }

  return (
    <Dialog
      open={addGuestOpen}
      onOpenChange={(open) => {
        setAddGuestOpen(open);
        if (!open) {
          setAdded([]);
          form.reset({ name: "", contact: "" });
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="gap-5 p-5 sm:max-w-md sm:p-6"
        onOpenAutoFocus={(e) => {
          // Enfocar el campo de nombre (no el botón Cerrar, que es el primero en el DOM).
          e.preventDefault();
          form.setFocus("name");
        }}
      >
        <DialogHeader className="pr-8">
          <DialogTitle className="font-heading text-2xl font-semibold">Agregar invitada</DialogTitle>
          <DialogDescription>
            Después podrás copiar su link personal o enviárselo por WhatsApp para que confirme.
          </DialogDescription>
        </DialogHeader>
        <DialogClose asChild>
          <Button variant="ghost" size="icon-lg" className="absolute top-3 right-3 rounded-full" aria-label="Cerrar">
            <X aria-hidden />
          </Button>
        </DialogClose>

        {added.length > 0 ? (
          <div role="status" className="bg-sage-soft text-olive rounded-2xl px-4 py-3 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="size-4" aria-hidden /> Ya están en tu lista:
            </p>
            <p className="mt-1">{added.join(", ")}</p>
          </div>
        ) : null}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Nombre" required error={form.formState.errors.name?.message}>
            {(p) => (
              <Input
                {...p}
                {...form.register("name")}
                autoComplete="off"
                autoCapitalize="words"
                placeholder="Ej. Camila Torres"
                className="h-12 text-base"
              />
            )}
          </Field>
          <Field
            label="Teléfono o email (opcional)"
            description="Con su celular podrás mandarle la invitación directo por WhatsApp."
            error={form.formState.errors.contact?.message}
          >
            {(p) => (
              <Input
                {...p}
                {...form.register("contact")}
                autoComplete="off"
                inputMode="email"
                placeholder="55 1234 5678 o camila@correo.com"
                className="h-12 text-base"
              />
            )}
          </Field>
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="h-12 rounded-full px-6 text-base">
                {added.length ? "Listo" : "Cancelar"}
              </Button>
            </DialogClose>
            <SubmitButton pending={pending} pendingText="Agregando…" size="xl">
              <UserPlus aria-hidden /> Agregar
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
