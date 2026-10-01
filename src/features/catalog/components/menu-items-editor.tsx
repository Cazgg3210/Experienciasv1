"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { ArrowDownUp, Pencil, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { DIETARY_LABELS, MENU_COURSE_LABELS, toOptions } from "@/lib/labels";
import { moveItem } from "../domain/catalog-rules";
import { MENU_COURSES, menuItemFormSchema, type MenuItemFormValues } from "../schemas";
import type { MenuItemRow } from "../server/queries";
import {
  createMenuItemAction,
  deleteMenuItemAction,
  reorderMenuItemsAction,
  updateMenuItemAction,
} from "../server/actions";
import { FieldGroup, OrderButtons, SectionCard, ToggleChips } from "./form-bits";

const DIETARY_OPTIONS = toOptions(DIETARY_LABELS);
const COURSE_OPTIONS = toOptions(MENU_COURSE_LABELS);
const EMPTY_ITEM: MenuItemFormValues = { name: "", description: "", course: "MAIN", dietaryTags: [] };

/** Platillos del menú: alta/edición en diálogo, reordenar y eliminar (guardan al instante). */
export function MenuItemsEditor({ menuId, items: initial, canWrite }: { menuId: string; items: MenuItemRow[]; canWrite: boolean }) {
  const router = useRouter();
  const [items, setItems] = React.useState(initial);
  const [editing, setEditing] = React.useState<MenuItemRow | "new" | null>(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setItems(initial), [initial]);

  async function persistOrder(next: MenuItemRow[]): Promise<boolean> {
    const previous = items;
    setItems(next);
    setBusy(true);
    const res = await reorderMenuItemsAction({ menuId, orderedIds: next.map((i) => i.id) });
    setBusy(false);
    if (!res.ok) {
      setItems(previous);
      toast.error(res.error);
      return false;
    }
    router.refresh();
    return true;
  }

  function sortByCourse() {
    const order = new Map(MENU_COURSES.map((c, i) => [c, i]));
    const next = [...items].sort((a, b) => (order.get(a.course) ?? 9) - (order.get(b.course) ?? 9));
    if (next.every((it, i) => it.id === items[i]?.id)) {
      toast.info("Los platillos ya están ordenados por tiempo.");
      return;
    }
    void persistOrder(next).then((ok) => ok && toast.success("Platillos ordenados por tiempo"));
  }

  return (
    <SectionCard
      title={`Platillos (${items.length})`}
      description="Así se presenta el menú a la clienta, en este orden."
      actions={
        canWrite ? (
          <>
            {items.length > 1 ? (
              <Button type="button" variant="outline" size="lg" disabled={busy} onClick={sortByCourse}>
                <ArrowDownUp aria-hidden />
                Ordenar por tiempo
              </Button>
            ) : null}
            <Button type="button" size="lg" onClick={() => setEditing("new")}>
              <Plus aria-hidden />
              Agregar platillo
            </Button>
          </>
        ) : null
      }
    >
      {items.length ? (
        <ol className="divide-y rounded-xl border">
          {items.map((item, i) => (
            <li key={item.id} className="flex flex-wrap items-start gap-3 p-3 sm:flex-nowrap">
              <span className="text-muted-foreground tabular mt-0.5 w-6 shrink-0 text-right text-xs">{i + 1}.</span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-sage-soft text-olive rounded-full px-2 py-0.5 text-xs font-medium">
                    {MENU_COURSE_LABELS[item.course]}
                  </span>
                  <p className="font-medium">{item.name}</p>
                </div>
                {item.description ? <p className="text-muted-foreground text-sm">{item.description}</p> : null}
                {item.dietaryTags.length ? (
                  <p className="text-muted-foreground text-xs">{item.dietaryTags.map((d) => DIETARY_LABELS[d]).join(" · ")}</p>
                ) : null}
              </div>
              {canWrite ? (
                <div className="ml-auto flex shrink-0 items-center gap-0.5">
                  <OrderButtons
                    index={i}
                    count={items.length}
                    label={item.name}
                    disabled={busy}
                    onMove={(d) => persistOrder(moveItem(items, i, d))}
                  />
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditing(item)} aria-label={`Editar ${item.name}`}>
                    <Pencil aria-hidden />
                  </Button>
                  <ConfirmDialog
                    destructive
                    title={`¿Eliminar "${item.name}"?`}
                    description="El platillo dejará de aparecer en el menú."
                    confirmLabel="Eliminar"
                    onConfirm={async () => {
                      const res = await deleteMenuItemAction({ id: item.id });
                      if (!res.ok) {
                        toast.error(res.error);
                        return;
                      }
                      setItems((prev) => prev.filter((x) => x.id !== item.id));
                      toast.success("Platillo eliminado");
                      router.refresh();
                    }}
                    trigger={
                      <Button type="button" variant="ghost" size="icon-sm" disabled={busy} aria-label={`Eliminar ${item.name}`}>
                        <Trash2 aria-hidden />
                      </Button>
                    }
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          icon={UtensilsCrossed}
          title="Este menú aún no tiene platillos"
          description="Agrega bebidas, entradas, platos fuertes y postres para que la clienta sepa qué va a disfrutar."
          action={
            canWrite ? (
              <Button type="button" onClick={() => setEditing("new")}>
                <Plus aria-hidden />
                Agregar el primer platillo
              </Button>
            ) : undefined
          }
        />
      )}

      <MenuItemDialog
        menuId={menuId}
        item={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />
    </SectionCard>
  );
}

function MenuItemDialog({
  menuId,
  item,
  onClose,
  onSaved,
}: {
  menuId: string;
  item: MenuItemRow | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const open = item !== null;
  const isNew = item === "new";
  const form = useForm<MenuItemFormValues>({ resolver: zodResolver(menuItemFormSchema), defaultValues: EMPTY_ITEM });
  const errors = form.formState.errors;

  React.useEffect(() => {
    if (!item) return;
    form.reset(
      item === "new"
        ? EMPTY_ITEM
        : { name: item.name, description: item.description, course: item.course, dietaryTags: item.dietaryTags },
    );
  }, [item, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!item) return;
    const res = item === "new" ? await createMenuItemAction({ ...values, menuId }) : await updateMenuItemAction({ ...values, id: item.id });
    if (handleActionResult(res, { form, success: item === "new" ? "Platillo agregado" : "Platillo actualizado" })) onSaved();
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg">{isNew ? "Nuevo platillo" : "Editar platillo"}</DialogTitle>
            <DialogDescription>Nombre claro y antojable; la descripción es opcional.</DialogDescription>
          </DialogHeader>
          <Field label="Nombre" required error={errors.name?.message}>
            {(p) => <Input {...p} autoFocus {...form.register("name")} />}
          </Field>
          <Field label="Tiempo" required error={errors.course?.message}>
            {(p) => (
              <Controller
                control={form.control}
                name="course"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...p} className="h-9 w-full">
                      <SelectValue>{MENU_COURSE_LABELS[field.value]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {COURSE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </Field>
          <Field label="Descripción" error={errors.description?.message}>
            {(p) => <Textarea {...p} rows={3} {...form.register("description")} />}
          </Field>
          <Controller
            control={form.control}
            name="dietaryTags"
            render={({ field }) => (
              <FieldGroup legend="Apto para">
                <ToggleChips options={DIETARY_OPTIONS} value={field.value} onChange={field.onChange} />
              </FieldGroup>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" onClick={onClose}>
              Cancelar
            </Button>
            <SubmitButton size="lg" pending={form.formState.isSubmitting}>
              {isNew ? "Agregar platillo" : "Guardar platillo"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
