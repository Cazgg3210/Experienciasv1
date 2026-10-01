"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { handleActionResult } from "@/components/forms/action-result";
import type { ActionResult } from "@/server/action";
import { cn } from "@/lib/utils";

/** Botones subir/bajar para ordenar manualmente. */
export function OrderButtons({
  label,
  isFirst,
  isLast,
  disabled,
  onMove,
}: {
  label: string;
  isFirst: boolean;
  isLast: boolean;
  disabled?: boolean;
  onMove: (direction: "up" | "down") => Promise<ActionResult<{ moved: boolean }>>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const move = (direction: "up" | "down") =>
    startTransition(async () => {
      const res = await onMove(direction);
      if (handleActionResult(res)) router.refresh();
    });
  return (
    <div className="flex gap-1" role="group" aria-label={`Ordenar ${label}`}>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={disabled || pending || isFirst}
        onClick={() => move("up")}
        aria-label={`Subir ${label}`}
      >
        <ArrowUp aria-hidden />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={disabled || pending || isLast}
        onClick={() => move("down")}
        aria-label={`Bajar ${label}`}
      >
        <ArrowDown aria-hidden />
      </Button>
    </div>
  );
}

/** Interruptor con etiqueta (activo/visible, destacada…). */
export function ToggleSwitch({
  id,
  label,
  checked,
  onToggle,
  successOn,
  successOff,
}: {
  id: string;
  label: string;
  checked: boolean;
  onToggle: (value: boolean) => Promise<ActionResult<unknown>>;
  successOn: string;
  successOff: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <Switch
        id={id}
        checked={checked}
        disabled={pending}
        onCheckedChange={(v) =>
          startTransition(async () => {
            const res = await onToggle(v);
            if (handleActionResult(res, { success: v ? successOn : successOff })) router.refresh();
          })
        }
      />
      <label htmlFor={id} className="cursor-pointer text-sm">
        {label}
      </label>
    </div>
  );
}

export function DeleteButton({
  title,
  description,
  onDelete,
  success,
  label = "Eliminar",
}: {
  title: string;
  description: string;
  onDelete: () => Promise<ActionResult<unknown>>;
  success: string;
  label?: string;
}) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="destructive" size="sm">
          <Trash2 aria-hidden />
          {label}
        </Button>
      }
      title={title}
      description={description}
      confirmLabel="Sí, eliminar"
      destructive
      onConfirm={async () => {
        const res = await onDelete();
        if (handleActionResult(res, { success })) router.refresh();
      }}
    />
  );
}

/** Estrellas de solo lectura */
export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value} de 5 estrellas`} role="img">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn("size-3.5", i < value ? "fill-current text-taupe" : "text-muted-foreground/40")}
          aria-hidden
        />
      ))}
    </span>
  );
}

/** Selector de calificación 1–5 accesible (radios nativos). */
export function StarRatingInput({
  name,
  value,
  onChange,
  describedBy,
  label = "Calificación",
}: {
  name: string;
  value: number;
  onChange: (value: number) => void;
  describedBy?: string;
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} aria-describedby={describedBy} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <label key={n} className="cursor-pointer rounded-md p-1 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
          <input
            type="radio"
            name={name}
            value={n}
            checked={value === n}
            onChange={() => onChange(n)}
            className="sr-only"
          />
          <Star
            className={cn("size-6 transition-colors", n <= value ? "fill-current text-taupe" : "text-muted-foreground/40")}
            aria-hidden
          />
          <span className="sr-only">
            {n} estrella{n === 1 ? "" : "s"}
          </span>
        </label>
      ))}
    </div>
  );
}
