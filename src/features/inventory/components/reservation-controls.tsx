"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PackageCheck, PackageMinus, PackagePlus, Pencil, RefreshCcw, Truck, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import {
  addReservationSchema,
  reservationQuantitySchema,
  returnReservationSchema,
  type AddReservationInput,
  type ReservationQuantityInput,
  type ReturnReservationInput,
} from "../schemas";
import {
  addReservationAction,
  cancelReservationAction,
  checkOutAllAction,
  checkOutReservationAction,
  recalculateEventReservationsAction,
  releaseAllForEventAction,
  returnReservationAction,
  updateReservationQuantityAction,
} from "../server/actions";
import type { InventoryShortage } from "../server/reservation-service";

function shortageToast(shortage: InventoryShortage | null) {
  if (shortage) {
    toast.warning(`Atención: faltan ${shortage.shortBy} de “${shortage.name}” ese día (hay ${shortage.available} disponibles).`);
  }
}

export function RecalculateButton({ eventId, disabled }: { eventId: string; disabled?: boolean }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button disabled={disabled}>
          <RefreshCcw className="size-4" aria-hidden /> Recalcular desde requerimientos
        </Button>
      }
      title="¿Recalcular reservas?"
      description="Se calculan las piezas desde la experiencia y los add-ons (por invitada o por evento). Las cantidades ajustadas a mano se reemplazan; lo que ya salió a evento o regresó no se toca."
      confirmLabel="Recalcular"
      onConfirm={async () => {
        const res = await recalculateEventReservationsAction({ eventId });
        if (handleActionResult(res, { success: false })) {
          const { reserved, shortages } = res.data;
          if (shortages.length) {
            toast.warning(
              `${reserved} ${reserved === 1 ? "artículo reservado" : "artículos reservados"}. ${shortages.length} con faltante: ${shortages
                .slice(0, 3)
                .map((s) => `${s.name} (faltan ${s.shortBy})`)
                .join(", ")}${shortages.length > 3 ? "…" : ""}`,
            );
          } else {
            toast.success(`Listo: ${reserved} ${reserved === 1 ? "artículo reservado" : "artículos reservados"} sin faltantes.`);
          }
          router.refresh();
        }
      }}
    />
  );
}

export function CheckOutAllButton({ eventId, pending }: { eventId: string; pending: number }) {
  const router = useRouter();
  if (pending === 0) return null;
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline">
          <Truck className="size-4" aria-hidden /> Entregar todo ({pending})
        </Button>
      }
      title="¿Registrar la salida de todas las piezas?"
      description={`${pending === 1 ? "La reserva pendiente pasará" : `Las ${pending} reservas pendientes pasarán`} a “En evento” y quedará registrado el movimiento de salida.`}
      confirmLabel="Registrar salida"
      onConfirm={async () => {
        const res = await checkOutAllAction({ eventId });
        if (handleActionResult(res, { success: false })) {
          toast.success(`Salida registrada para ${res.data.checkedOut} artículos.`);
          router.refresh();
        }
      }}
    />
  );
}

/** Libera de golpe las reservas pendientes (p. ej. evento cancelado que aún aparta piezas). */
export function ReleaseAllButton({ eventId, pending }: { eventId: string; pending: number }) {
  const router = useRouter();
  if (pending === 0) return null;
  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive">
          <PackageMinus className="size-4" aria-hidden /> Liberar todo ({pending})
        </Button>
      }
      title="¿Liberar todas las reservas pendientes?"
      description={`${pending === 1 ? "La reserva que aún no sale queda disponible" : `Las ${pending} reservas que aún no salen quedan disponibles`} para otros eventos de ese día. Lo que ya salió a evento no cambia.`}
      confirmLabel="Liberar todo"
      destructive
      onConfirm={async () => {
        const res = await releaseAllForEventAction({ eventId });
        if (handleActionResult(res, { success: false })) {
          toast.success(`Se liberaron ${res.data.released} reservas.`);
          router.refresh();
        }
      }}
    />
  );
}

export function AddReservationDialog({
  eventId,
  items,
}: {
  eventId: string;
  items: Array<{ id: string; sku: string; name: string; unit: string }>;
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const form = useForm<AddReservationInput>({
    resolver: zodResolver(addReservationSchema),
    defaultValues: { eventId, inventoryItemId: "", quantity: 1 },
  });
  const errors = form.formState.errors;
  React.useEffect(() => {
    if (open) form.reset({ eventId, inventoryItemId: "", quantity: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <PackagePlus className="size-4" aria-hidden /> Agregar artículo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Agregar artículo</DialogTitle>
          <DialogDescription>Reserva una pieza extra que no viene en los requerimientos de la experiencia.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            const res = await addReservationAction(values);
            if (handleActionResult(res, { form, success: "Artículo reservado" })) {
              shortageToast(res.data.shortage);
              setOpen(false);
              router.refresh();
            }
          })}
        >
          <Field label="Artículo" required error={errors.inventoryItemId?.message}>
            {(p) => (
              <Controller
                control={form.control}
                name="inventoryItemId"
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger {...p} className="w-full">
                      <SelectValue placeholder="Elige un artículo" />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name} · {i.sku}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </Field>
          <Field label="Cantidad" required error={errors.quantity?.message}>
            {(p) => <Input {...p} type="number" inputMode="numeric" min={1} {...form.register("quantity", { valueAsNumber: true })} />}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={form.formState.isSubmitting}>Reservar</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditQuantityDialog({
  reservationId,
  quantity,
  itemName,
  unit,
}: {
  reservationId: string;
  quantity: number;
  itemName: string;
  unit: string;
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const form = useForm<ReservationQuantityInput>({
    resolver: zodResolver(reservationQuantitySchema),
    defaultValues: { reservationId, quantity },
  });
  React.useEffect(() => {
    if (open) form.reset({ reservationId, quantity });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, quantity]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Editar cantidad de ${itemName}`}>
          <Pencil className="size-3.5" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Editar cantidad</DialogTitle>
          <DialogDescription>{itemName}</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            const res = await updateReservationQuantityAction(values);
            if (handleActionResult(res, { form, success: "Cantidad actualizada" })) {
              shortageToast(res.data.shortage);
              setOpen(false);
              router.refresh();
            }
          })}
        >
          <Field label={`Cantidad (${unit})`} required error={form.formState.errors.quantity?.message}>
            {(p) => <Input {...p} type="number" inputMode="numeric" min={1} autoFocus {...form.register("quantity", { valueAsNumber: true })} />}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={form.formState.isSubmitting}>Guardar</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CheckOutButton({ reservationId, itemName }: { reservationId: string; itemName: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      aria-label={`Registrar salida de ${itemName}`}
      onClick={() =>
        startTransition(async () => {
          const res = await checkOutReservationAction({ reservationId });
          if (handleActionResult(res, { success: "Salida registrada" })) router.refresh();
        })
      }
    >
      <Truck className="size-3.5" aria-hidden /> Entregar
    </Button>
  );
}

export function ReturnDialog({
  reservationId,
  quantity,
  itemName,
  unit,
}: {
  reservationId: string;
  quantity: number;
  itemName: string;
  unit: string;
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const form = useForm<ReturnReservationInput>({
    resolver: zodResolver(returnReservationSchema),
    defaultValues: { reservationId, returnedQuantity: quantity, damagedQuantity: 0, notes: "" },
  });
  const errors = form.formState.errors;
  const damaged = form.watch("damagedQuantity");
  const returned = form.watch("returnedQuantity");
  React.useEffect(() => {
    if (open) form.reset({ reservationId, returnedQuantity: quantity, damagedQuantity: 0, notes: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const sum = (Number.isFinite(returned) ? returned : 0) + (Number.isFinite(damaged) ? damaged : 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Registrar regreso de ${itemName}`}>
          <PackageCheck className="size-3.5" aria-hidden /> Regreso
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Registrar regreso</DialogTitle>
          <DialogDescription>
            {itemName} · salieron {quantity} {unit}. Las piezas dañadas o perdidas se dan de baja del inventario.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            const res = await returnReservationAction(values);
            if (handleActionResult(res, { form, success: "Regreso registrado" })) {
              setOpen(false);
              router.refresh();
            }
          })}
        >
          <div className="grid grid-cols-2 gap-4">
            <Field label="En buen estado" required error={errors.returnedQuantity?.message}>
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={quantity}
                  {...form.register("returnedQuantity", {
                    valueAsNumber: true,
                    onChange: (e) => {
                      const v = Number(e.target.value);
                      if (Number.isInteger(v) && v >= 0 && v <= quantity) form.setValue("damagedQuantity", quantity - v);
                    },
                  })}
                />
              )}
            </Field>
            <Field label="Dañadas o perdidas" required error={errors.damagedQuantity?.message}>
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={quantity}
                  {...form.register("damagedQuantity", {
                    valueAsNumber: true,
                    onChange: (e) => {
                      const v = Number(e.target.value);
                      if (Number.isInteger(v) && v >= 0 && v <= quantity) form.setValue("returnedQuantity", quantity - v);
                    },
                  })}
                />
              )}
            </Field>
          </div>
          <p className={sum === quantity ? "text-muted-foreground text-xs" : "text-destructive text-xs"} aria-live="polite">
            Suma {sum} de {quantity} piezas.
          </p>
          <Field label="Notas" error={errors.notes?.message} description={damaged > 0 ? "Describe qué pasó (queda en el historial)." : undefined}>
            {(p) => <Textarea {...p} rows={2} placeholder="Ej. 1 copa rota durante el brindis." {...form.register("notes")} />}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={form.formState.isSubmitting}>
              <Undo2 className="size-4" aria-hidden /> Registrar regreso
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReleaseButton({ reservationId, itemName, quantity }: { reservationId: string; itemName: string; quantity: number }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Liberar reserva de ${itemName}`}>
          <PackageMinus className="size-3.5" aria-hidden />
        </Button>
      }
      title="¿Liberar esta reserva?"
      description={`Se liberan ${quantity} piezas de “${itemName}” para otros eventos de ese día.`}
      confirmLabel="Liberar"
      destructive
      onConfirm={async () => {
        const res = await cancelReservationAction({ reservationId });
        if (handleActionResult(res, { success: "Reserva liberada" })) router.refresh();
      }}
    />
  );
}
