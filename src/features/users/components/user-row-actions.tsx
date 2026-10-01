"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Power, ShieldCheck } from "lucide-react";
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
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { ROLE_LABELS } from "@/lib/labels";
import { NativeSelect } from "@/features/settings/components/native-select";
import type { TeamRole } from "../domain/user-rules";
import { ROLE_HINTS } from "../domain/role-meta";
import { changeRoleSchema, resetPasswordSchema, type ChangeRoleValues, type ResetPasswordValues } from "../schemas";
import { changeUserRoleAction, resetUserPasswordAction, setUserActiveAction } from "../server/actions";
import { PasswordField } from "./password-field";

export type RowUser = { id: string; name: string; email: string; role: TeamRole; active: boolean };

function ChangeRoleDialog({ user, roles }: { user: RowUser; roles: TeamRole[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<ChangeRoleValues>({
    resolver: zodResolver(changeRoleSchema),
    defaultValues: { userId: user.id, role: user.role },
  });
  const role = form.watch("role");
  const formId = `role-form-${user.id}`;
  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await changeUserRoleAction(values);
      if (handleActionResult(res, { form, success: `${user.name} ahora es ${ROLE_LABELS[values.role]}` })) setOpen(false);
    }),
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) form.reset({ userId: user.id, role: user.role });
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <ShieldCheck aria-hidden />
          Rol
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Cambiar rol</DialogTitle>
          <DialogDescription>
            {user.name} · {user.email}
          </DialogDescription>
        </DialogHeader>
        <form id={formId} onSubmit={onSubmit} noValidate>
          <Field label="Nuevo rol" description={ROLE_HINTS[role]} error={form.formState.errors.role?.message} required>
            {(p) => (
              <NativeSelect {...p} {...form.register("role")}>
                {!roles.includes(user.role) ? (
                  <option value={user.role} disabled>
                    {ROLE_LABELS[user.role]} (actual)
                  </option>
                ) : null}
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                    {r === user.role ? " (actual)" : ""}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" size="lg" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <SubmitButton form={formId} size="lg" pending={pending} disabled={role === user.role}>
            Guardar rol
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ user }: { user: RowUser }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { userId: user.id, password: "" },
  });
  const password = form.watch("password");
  const formId = `password-form-${user.id}`;
  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await resetUserPasswordAction(values);
      if (handleActionResult(res, { form, success: "Contraseña restablecida. Compártela por un canal seguro." })) {
        setOpen(false);
        form.reset({ userId: user.id, password: "" });
      }
    }),
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) form.reset({ userId: user.id, password: "" });
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <KeyRound aria-hidden />
          Contraseña
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Restablecer contraseña</DialogTitle>
          <DialogDescription>
            Define una contraseña temporal para {user.name}. La anterior deja de funcionar de inmediato.
          </DialogDescription>
        </DialogHeader>
        <form id={formId} onSubmit={onSubmit} noValidate>
          <Field label="Contraseña temporal" description="Mínimo 10 caracteres." error={form.formState.errors.password?.message} required>
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
          <SubmitButton form={formId} size="lg" pending={pending}>
            Restablecer
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UserRowActions({
  user,
  isSelf,
  canManageTarget,
  roles,
}: {
  user: RowUser;
  isSelf: boolean;
  /** false si la persona es super admin y quien administra no lo es */
  canManageTarget: boolean;
  roles: TeamRole[];
}) {
  if (!canManageTarget) {
    return <p className="text-muted-foreground text-xs">Sólo un super admin puede modificar esta cuenta.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {!isSelf ? <ChangeRoleDialog user={user} roles={roles} /> : null}
      <ResetPasswordDialog user={user} />
      {!isSelf ? (
        <ConfirmDialog
          trigger={
            <Button type="button" variant={user.active ? "destructive" : "outline"} size="sm">
              <Power aria-hidden />
              {user.active ? "Desactivar" : "Reactivar"}
            </Button>
          }
          title={user.active ? `¿Desactivar a ${user.name}?` : `¿Reactivar a ${user.name}?`}
          description={
            user.active
              ? "No podrá volver a iniciar sesión. Su historial se conserva y puedes reactivarla cuando quieras."
              : "Podrá iniciar sesión otra vez con su contraseña actual."
          }
          confirmLabel={user.active ? "Desactivar" : "Reactivar"}
          destructive={user.active}
          onConfirm={async () => {
            const res = await setUserActiveAction({ userId: user.id, active: !user.active });
            handleActionResult(res, { success: user.active ? "Cuenta desactivada" : "Cuenta reactivada" });
          }}
        />
      ) : null}
    </div>
  );
}
