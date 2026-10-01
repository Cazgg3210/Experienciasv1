"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Plus, Trash2, Wand2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { MediaUploader } from "@/components/media/media-uploader";
import { moveItem, normalizeHexColor, publicMediaPath } from "../domain/catalog-rules";
import { styleFormSchema, type StyleFormValues } from "../schemas";
import { createStyleAction, updateStyleAction } from "../server/actions";
import { CatalogImage } from "./catalog-image";
import { FieldGroup, OrderButtons, SwitchField } from "./form-bits";
import { SlugHint, useSlugAutofill } from "./use-slug-autofill";

/** Alta/edición de estilos (paleta de colores con selector + swatches). */
export function StyleDialog({
  mode,
  styleId,
  defaultValues,
  trigger,
  canUpload,
}: {
  mode: "create" | "edit";
  styleId?: string;
  defaultValues: StyleFormValues;
  trigger: React.ReactNode;
  canUpload: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent showCloseButton={false} className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        {open ? (
          <StyleForm
            mode={mode}
            styleId={styleId}
            defaultValues={defaultValues}
            canUpload={canUpload}
            onDone={() => setOpen(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function StyleForm({
  mode,
  styleId,
  defaultValues,
  canUpload,
  onDone,
}: {
  mode: "create" | "edit";
  styleId?: string;
  defaultValues: StyleFormValues;
  canUpload: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const form = useForm<StyleFormValues>({ resolver: zodResolver(styleFormSchema), defaultValues });
  const { register, control, formState } = form;
  const errors = formState.errors;
  const [name, slug, imageUrl] = useWatch({ control, name: ["name", "slug", "imageUrl"] });
  const slugField = useSlugAutofill({
    entity: "style",
    excludeId: styleId,
    name,
    slug,
    initialSlug: mode === "edit" ? defaultValues.slug : undefined,
    setSlug: (v) => form.setValue("slug", v, { shouldDirty: true }),
    onTaken: (message) => form.setError("slug", { type: "server", message }),
    onAvailable: () => {
      if (form.getFieldState("slug").error?.type === "server") form.clearErrors("slug");
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const res = mode === "create" ? await createStyleAction(values) : await updateStyleAction({ ...values, id: styleId! });
    if (handleActionResult(res, { form, success: mode === "create" ? "Estilo creado" : "Estilo guardado" })) {
      onDone();
      router.refresh();
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <DialogHeader>
        <DialogTitle className="text-lg">{mode === "create" ? "Nuevo estilo" : "Editar estilo"}</DialogTitle>
        <DialogDescription>Los estilos inspiran la decoración y la paleta de cada evento.</DialogDescription>
      </DialogHeader>
      <Field label="Nombre" required error={errors.name?.message}>
        {(p) => <Input {...p} autoFocus placeholder="Ej. Jardín romántico" {...register("name")} />}
      </Field>
      <Field label="Slug" required error={errors.slug?.message} description={<SlugHint status={slugField.status} path={slug || "…"} />}>
        {(p) => (
          <div className="flex gap-2">
            <Input {...p} spellCheck={false} className="font-mono" {...register("slug", { onChange: () => slugField.markEdited() })} />
            <Button type="button" variant="outline" size="lg" onClick={() => slugField.regenerate()} title="Generar desde el nombre">
              <Wand2 aria-hidden />
              <span className="sr-only">Generar desde el nombre</span>
            </Button>
          </div>
        )}
      </Field>
      <Field label="Descripción" error={errors.description?.message}>
        {(p) => <Textarea {...p} rows={2} {...register("description")} />}
      </Field>
      <Controller
        control={control}
        name="palette"
        render={({ field }) => (
          <FieldGroup
            legend="Paleta"
            description="Hasta 12 colores. Usa el selector o escribe el código hex."
            error={errors.palette?.message ?? (Array.isArray(errors.palette) ? errors.palette.find(Boolean)?.message : undefined)}
          >
            <PaletteEditor value={field.value} onChange={field.onChange} />
          </FieldGroup>
        )}
      />
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem] sm:items-start">
        <div className="space-y-3">
          <Field label="URL de imagen" error={errors.imageUrl?.message}>
            {(p) => <Input {...p} spellCheck={false} placeholder="/images/placeholders/gallery-01.svg" {...register("imageUrl")} />}
          </Field>
          {canUpload ? (
            <MediaUploader
              fields={{ purpose: "STYLE", visibility: "PUBLIC", alt: name?.slice(0, 200) || undefined }}
              label="Subir foto de referencia"
              onUploaded={(m) => form.setValue("imageUrl", publicMediaPath(m.id), { shouldDirty: true, shouldValidate: true })}
            />
          ) : null}
        </div>
        <div className="relative aspect-square overflow-hidden rounded-xl border">
          <CatalogImage src={imageUrl || null} alt={name ? `Referencia de ${name}` : "Referencia del estilo"} sizes="128px" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <SwitchField label="Activo" description="Disponible para elegir." checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
        <Field label="Orden" error={errors.sortOrder?.message}>
          {(p) => <Input {...p} type="number" min={0} inputMode="numeric" {...register("sortOrder", { valueAsNumber: true })} />}
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={onDone}>
          Cancelar
        </Button>
        <SubmitButton size="lg" pending={formState.isSubmitting}>
          {mode === "create" ? "Crear estilo" : "Guardar estilo"}
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}

function PaletteEditor({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const add = (raw: string) => {
    const hex = normalizeHexColor(raw);
    if (!hex) {
      setError("Escribe un color hex válido, por ejemplo #a3b18a.");
      return;
    }
    if (value.includes(hex)) {
      setError("Ese color ya está en la paleta.");
      return;
    }
    if (value.length >= 12) {
      setError("Máximo 12 colores.");
      return;
    }
    setError(null);
    onChange([...value, hex]);
    setDraft("");
  };
  return (
    <div className="space-y-3">
      {value.length ? (
        <ul className="space-y-2">
          {value.map((color, i) => (
            <li key={`${color}-${i}`} className="flex items-center gap-2">
              <input
                type="color"
                value={normalizeHexColor(color) ?? "#000000"}
                onChange={(e) => onChange(value.map((c, j) => (j === i ? e.target.value.toLowerCase() : c)))}
                className="size-9 shrink-0 cursor-pointer rounded-lg border bg-transparent p-0.5"
                aria-label={`Elegir color ${i + 1}`}
              />
              <Input
                value={color}
                aria-label={`Código del color ${i + 1}`}
                className="h-9 font-mono"
                onChange={(e) => onChange(value.map((c, j) => (j === i ? e.target.value.trim().toLowerCase() : c)))}
              />
              <OrderButtons index={i} count={value.length} label={`color ${i + 1}`} onMove={(d) => onChange(moveItem(value, i, d))} />
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Quitar color ${color}`}>
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">Sin colores todavía.</p>
      )}
      {value.length ? <Swatches colors={value} /> : null}
      <div className="flex gap-2">
        <input
          type="color"
          className="size-9 shrink-0 cursor-pointer rounded-lg border bg-transparent p-0.5"
          aria-label="Elegir un color nuevo"
          value={normalizeHexColor(draft) ?? "#a3b18a"}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Input
          value={draft}
          placeholder="#a3b18a"
          aria-label="Nuevo color (hex)"
          aria-invalid={error ? true : undefined}
          className="h-9 font-mono"
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
        />
        <Button type="button" variant="outline" size="lg" onClick={() => add(draft || "#a3b18a")}>
          <Plus aria-hidden />
          Agregar
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-xs font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Tira de swatches (texto alternativo con los códigos). */
export function Swatches({ colors, className }: { colors: string[]; className?: string }) {
  if (!colors.length) return null;
  return (
    <div className={className}>
      <div className="flex h-8 overflow-hidden rounded-lg border" role="img" aria-label={`Paleta: ${colors.join(", ")}`}>
        {colors.map((c, i) => (
          <span key={`${c}-${i}`} className="h-full flex-1" style={{ backgroundColor: normalizeHexColor(c) ?? "transparent" }} />
        ))}
      </div>
    </div>
  );
}
