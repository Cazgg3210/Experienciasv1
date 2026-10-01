"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import type { CatalogEntity } from "../schemas";
import {
  deleteAddOnAction,
  deleteBudgetRangeAction,
  deleteExperienceAction,
  deleteMenuAction,
  deleteServiceAreaAction,
  deleteStyleAction,
  toggleCatalogActiveAction,
} from "../server/actions";

const DELETE_ACTIONS = {
  experience: deleteExperienceAction,
  menu: deleteMenuAction,
  addOn: deleteAddOnAction,
  style: deleteStyleAction,
  serviceArea: deleteServiceAreaAction,
  budgetRange: deleteBudgetRangeAction,
} satisfies Record<CatalogEntity, unknown>;

/** Texto del diálogo de borrado: concordancia de género y qué historial lo protege. */
const DELETE_COPY: Record<CatalogEntity, { noun: string; pronoun: "la" | "lo"; usedIn: string }> = {
  experience: { noun: "esta experiencia", pronoun: "la", usedIn: "eventos, cotizaciones o leads" },
  menu: { noun: "este menú", pronoun: "lo", usedIn: "experiencias, eventos, cotizaciones o leads" },
  addOn: { noun: "este add-on", pronoun: "lo", usedIn: "experiencias, eventos o cotizaciones" },
  style: { noun: "este estilo", pronoun: "lo", usedIn: "experiencias, eventos, cotizaciones o leads" },
  serviceArea: { noun: "esta zona", pronoun: "la", usedIn: "experiencias, eventos, cotizaciones o leads" },
  budgetRange: { noun: "este rango", pronoun: "lo", usedIn: "leads" },
};

/**
 * Eliminar con confirmación. Si el elemento tiene historial (eventos, cotizaciones, leads...)
 * el servidor lo desactiva en lugar de borrarlo y explica por qué.
 */
export function DeleteCatalogButton({
  entity,
  id,
  name,
  redirectTo,
  disabled,
  compact,
}: {
  entity: CatalogEntity;
  id: string;
  name: string;
  redirectTo?: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  return (
    <ConfirmDialog
      destructive
      title={`¿Eliminar "${name}"?`}
      description={`Si ${DELETE_COPY[entity].noun} ya está ${DELETE_COPY[entity].pronoun === "la" ? "ligada" : "ligado"} a ${DELETE_COPY[entity].usedIn}, no se borrará: ${DELETE_COPY[entity].pronoun} desactivaremos para conservar el historial. Si no tiene uso, se eliminará definitivamente.`}
      confirmLabel="Eliminar"
      onConfirm={async () => {
        const res = await DELETE_ACTIONS[entity]({ id });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        if (res.data.outcome === "deactivated") {
          toast.info(res.data.message, { duration: 9000 });
          router.refresh();
          return;
        }
        toast.success(res.data.message);
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      }}
      trigger={
        compact ? (
          <Button type="button" variant="ghost" size="icon-sm" disabled={disabled} aria-label={`Eliminar ${name}`}>
            <Trash2 aria-hidden />
          </Button>
        ) : (
          <Button type="button" variant="destructive" size="lg" disabled={disabled}>
            <Trash2 aria-hidden />
            Eliminar
          </Button>
        )
      }
    />
  );
}

const TOGGLE_LABELS: Record<CatalogEntity, { on: string; off: string }> = {
  experience: { on: "Activa", off: "Inactiva" },
  menu: { on: "Activo", off: "Inactivo" },
  addOn: { on: "Disponible", off: "No disponible" },
  style: { on: "Activo", off: "Inactivo" },
  serviceArea: { on: "Activa", off: "Inactiva" },
  budgetRange: { on: "Activo", off: "Inactivo" },
};

/** Activa/desactiva rápido desde las listas (optimista, con rollback). */
export function ActiveToggle({
  entity,
  id,
  name,
  active,
  disabled,
}: {
  entity: CatalogEntity;
  id: string;
  name: string;
  active: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const labels = TOGGLE_LABELS[entity];
  const [value, setValue] = React.useState(active);
  const [pending, startTransition] = React.useTransition();
  React.useEffect(() => setValue(active), [active]);
  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={value}
        disabled={disabled || pending}
        aria-label={`${value ? "Desactivar" : "Activar"} ${name}`}
        onCheckedChange={(next) => {
          setValue(next);
          startTransition(async () => {
            const res = await toggleCatalogActiveAction({ entity, id, active: next });
            if (!res.ok) {
              setValue(!next);
              toast.error(res.error);
              return;
            }
            toast.success(next ? `"${name}": ${labels.on.toLowerCase()}` : `"${name}": ${labels.off.toLowerCase()}`);
            router.refresh();
          });
        }}
      />
      <span className="text-muted-foreground text-xs" aria-hidden>
        {value ? labels.on : labels.off}
      </span>
    </div>
  );
}
