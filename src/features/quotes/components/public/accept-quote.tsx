"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { acceptQuoteSchema, type AcceptQuoteInput } from "../../schemas";
import { acceptQuoteAction } from "../../server/public-actions";

/**
 * CTA principal "Aceptar propuesta" (inline + barra fija en móvil) con un único diálogo:
 * nombre completo + aceptación de términos, política de cancelación y aviso de privacidad.
 */
export function AcceptQuoteCta({
  token,
  version,
  totalLabel,
  depositLabel,
  customerName,
}: {
  token: string;
  /** Versión que la clienta está viendo (se valida en servidor) */
  version: number;
  totalLabel: string;
  depositLabel: string;
  customerName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  // El diálogo es controlado y tiene dos disparadores (botón principal y barra fija en móvil), sin
  // DialogTrigger: Radix no sabe a quién devolver el foco al cerrar. Se recuerda el botón que lo abrió.
  const openerRef = React.useRef<HTMLElement | null>(null);
  function openFrom(e: React.MouseEvent<HTMLButtonElement>) {
    openerRef.current = e.currentTarget;
    setOpen(true);
  }
  const form = useForm<AcceptQuoteInput>({
    resolver: zodResolver(acceptQuoteSchema),
    defaultValues: { token, version, fullName: customerName, acceptTerms: false },
  });
  const errors = form.formState.errors;

  async function onSubmit(values: AcceptQuoteInput) {
    const res = await acceptQuoteAction({ ...values, token, version });
    if (handleActionResult(res, { form, success: "¡Listo! Tu propuesta quedó aceptada" })) {
      setOpen(false);
      router.refresh();
    } else if (res.code === "CONFLICT" || res.code === "NOT_FOUND" || res.code === "DATE_UNAVAILABLE") {
      // La propuesta cambió de estado/versión o la fecha ya no está libre: mostrar el estado vigente.
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <Button size="xl" className="w-full sm:w-auto" onClick={openFrom}>
        <Heart aria-hidden /> Aceptar propuesta
      </Button>

      {/* Barra fija en móvil */}
      <div className="bg-ivory/95 border-border/70 fixed inset-x-0 bottom-0 z-30 border-t px-4 py-3 backdrop-blur sm:hidden print:hidden">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">Total · anticipo {depositLabel}</p>
            <p className="tabular font-heading text-xl font-semibold">{totalLabel}</p>
          </div>
          <Button size="lg" className="h-11 rounded-full px-5" onClick={openFrom}>
            Aceptar
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="sm:max-w-md"
          onCloseAutoFocus={(e) => {
            // WCAG 2.4.3: al cerrar, el foco vuelve al botón que abrió el diálogo (si sigue en la página;
            // tras aceptar, la página cambia y Radix aplica su comportamiento por defecto).
            const opener = openerRef.current;
            if (opener?.isConnected) {
              e.preventDefault();
              opener.focus();
            }
          }}
        >
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
            <DialogHeader>
              <DialogTitle className="font-heading text-2xl">Aceptar propuesta</DialogTitle>
              <DialogDescription>
                Al aceptar apartamos la información de tu celebración. Tu fecha queda confirmada con el anticipo de {depositLabel}.
              </DialogDescription>
            </DialogHeader>
            <input type="hidden" {...form.register("token")} />
            <Field label="Nombre completo" required error={errors.fullName?.message}>
              {(p) => <Input {...p} className="h-11" autoComplete="name" maxLength={120} {...form.register("fullName")} />}
            </Field>
            <Controller
              control={form.control}
              name="acceptTerms"
              render={({ field }) => (
                <div className="space-y-1.5">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="accept-terms"
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                      aria-invalid={errors.acceptTerms ? true : undefined}
                      aria-describedby={errors.acceptTerms ? "accept-terms-err" : undefined}
                      className="mt-0.5"
                    />
                    <label htmlFor="accept-terms" className="text-sm leading-snug">
                      Acepto los{" "}
                      <Link href="/terminos" target="_blank" className="text-olive underline underline-offset-2">
                        términos
                      </Link>
                      , la política de cancelación y el{" "}
                      <Link href="/privacidad" target="_blank" className="text-olive underline underline-offset-2">
                        aviso de privacidad
                      </Link>
                      .
                    </label>
                  </div>
                  {errors.acceptTerms ? (
                    <p id="accept-terms-err" role="alert" className="text-destructive text-xs font-medium">
                      {errors.acceptTerms.message}
                    </p>
                  ) : null}
                </div>
              )}
            />
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Seguir revisando
              </Button>
              <SubmitButton pending={form.formState.isSubmitting} pendingText="Confirmando…" size="lg" className="rounded-full px-5">
                Aceptar y continuar
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
