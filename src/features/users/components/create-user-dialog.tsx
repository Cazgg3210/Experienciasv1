"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { ROLE_LABELS } from "@/lib/labels";
import { NativeSelect } from "@/features/settings/components/native-select";
import type { TeamRole } from "../domain/user-rules";
import { ROLE_HINTS } from "../domain/role-meta";
import { createUserSchema, type CreateUserValues } from "../schemas";
import { createUserAction } from "../server/actions";
import { PasswordField } from "./password-field";

export function CreateUserDialog({
  roles,
  linkableStaff,
}: {
  roles: TeamRole[];
  linkableStaff: Array<{ id: string; name: string; email: string | null }>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const defaultRole: TeamRole = roles.includes("STAFF") ? "STAFF" : roles[0] ?? "STAFF";
  const form = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: "", email: "", role: defaultRole, password: "", staffMemberId: "" },
  });
  const errors = form.formState.errors;
  const role = form.watch("role");
  const password = form.watch("password");

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await createUserAction({
        ...values,
        staffMemberId: values.role === "STAFF" ? values.staffMemberId || undefined : undefined,
      });
      if (handleActionResult(res, { form, success: `Cuenta creada para ${values.name}` })) {
        form.reset();
        setOpen(false);
      }
    }),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) form.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg">
          <UserPlus aria-hidden />
          Nueva usuaria
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Nueva usuaria del equipo</DialogTitle>
          <DialogDescription>
            Comparte la contraseña temporal por un canal seguro; podrá cambiarla después.
          </DialogDescription>
        </DialogHeader>
        <form id="create-user-form" onSubmit={onSubmit} noValidate className="space-y-4">
          <Field label="Nombre" error={errors.name?.message} required>
            {(p) => <Input {...p} autoComplete="off" {...form.register("name")} />}
          </Field>
          <Field label="Correo" error={errors.email?.message} required>
            {(p) => <Input {...p} type="email" autoComplete="off" {...form.register("email")} />}
          </Field>
          <Field
            label="Rol"
            description={ROLE_HINTS[role as TeamRole]}
            error={errors.role?.message}
            required
          >
            {(p) => (
              <NativeSelect {...p} {...form.register("role")}>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          {role === "STAFF" && linkableStaff.length > 0 ? (
            <Field
              label="Vincular con ficha de staff"
              description="Así verá en su portal los eventos donde está asignada."
              error={errors.staffMemberId?.message}
            >
              {(p) => (
                <NativeSelect {...p} {...form.register("staffMemberId")}>
                  <option value="">Sin vincular</option>
                  {linkableStaff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.email ? ` · ${s.email}` : ""}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
          ) : null}
          <Field
            label="Contraseña temporal"
            description="Mínimo 10 caracteres."
            error={errors.password?.message}
            required
          >
            {(p) => (
              <PasswordField
                value={password}
                inputProps={{ ...p, ...form.register("password") }}
                onGenerate={(pw) => form.setValue("password", pw, { shouldValidate: true, shouldDirty: true })}
              />
            )}
          </Field>
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" size="lg" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <SubmitButton form="create-user-form" size="lg" pending={pending} pendingText="Creando…">
            Crear cuenta
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
