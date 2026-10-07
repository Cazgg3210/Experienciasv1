"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, KeyRound, RefreshCw, ShieldCheck, ShieldOff, UserPlus } from "lucide-react";
import type { z } from "zod";
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
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { CopyButton } from "@/components/data/copy-button";
import { StatusBadge } from "@/components/data/status-badge";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { generateTempPassword } from "../domain/staff";
import { createAccessSchema, resetPasswordSchema } from "../schemas";
import { createStaffAccessAction, resetStaffPasswordAction, setStaffAccessActiveAction } from "../server/actions";

type Access = { email: string; active: boolean; lastLoginLabel: string | null } | null;

export function StaffAccessCard({
  staffMemberId,
  staffName,
  defaultEmail,
  access,
  canManage,
  loginUrl,
  isSelf = false,
}: {
  staffMemberId: string;
  staffName: string;
  defaultEmail: string | null;
  access: Access;
  canManage: boolean;
  loginUrl: string;
  /** El acceso ligado a esta ficha es el de quien está viendo la página (fundadora con ficha de staff). */
  isSelf?: boolean;
}) {
  const router = useRouter();
  const [credentials, setCredentials] = React.useState<{ email: string; password: string } | null>(null);

  return (
    <div className="space-y-4">
      {access ? (
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium break-all">{access.email}</span>
            <StatusBadge tone={access.active ? "success" : "muted"}>{access.active ? "Acceso activo" : "Acceso desactivado"}</StatusBadge>
          </div>
          <p className="text-muted-foreground text-xs">
            {access.lastLoginLabel ? `Último ingreso: ${access.lastLoginLabel}` : "Aún no ha iniciado sesión."}
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          {staffName.split(" ")[0]} todavía no tiene acceso al portal de staff. Con acceso puede ver sus eventos, horarios y tareas
          desde el celular.
        </p>
      )}

      {canManage ? (
        <div className="flex flex-wrap gap-2">
          {access ? (
            <>
              <ResetPasswordDialog staffMemberId={staffMemberId} email={access.email} isSelf={isSelf} onDone={setCredentials} />
              {/* Nadie desactiva su propio acceso (el servidor también lo rechaza). */}
              {isSelf ? null : (
                <ConfirmDialog
                  trigger={
                    <Button type="button" variant="ghost" className={access.active ? "text-destructive" : undefined}>
                      {access.active ? <ShieldOff className="size-4" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}
                      {access.active ? "Desactivar acceso" : "Reactivar acceso"}
                    </Button>
                  }
                  title={access.active ? "¿Desactivar el acceso?" : "¿Reactivar el acceso?"}
                  description={
                    access.active
                      ? `${staffName} ya no podrá iniciar sesión en el portal de staff.`
                      : `${staffName} podrá volver a iniciar sesión con su contraseña actual.`
                  }
                  confirmLabel={access.active ? "Desactivar" : "Reactivar"}
                  destructive={access.active}
                  onConfirm={async () => {
                    const res = await setStaffAccessActiveAction({ staffMemberId, active: !access.active });
                    if (handleActionResult(res, { success: access.active ? "Acceso desactivado" : "Acceso reactivado" })) router.refresh();
                  }}
                />
              )}
            </>
          ) : (
            <CreateAccessDialog staffMemberId={staffMemberId} defaultEmail={defaultEmail} onDone={setCredentials} />
          )}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">Sólo quien administra usuarios puede crear o restablecer accesos.</p>
      )}

      {credentials ? (
        <div role="status" className="border-olive/30 bg-sage-soft/60 space-y-3 rounded-xl border p-4">
          <p className="text-sm font-medium">Comparte estas credenciales con {staffName.split(" ")[0]} por un canal privado.</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Portal</dt>
            <dd className="break-all">{loginUrl}</dd>
            <dt className="text-muted-foreground">Correo</dt>
            <dd className="break-all">{credentials.email}</dd>
            <dt className="text-muted-foreground">Contraseña</dt>
            <dd className="font-mono">{credentials.password}</dd>
          </dl>
          <div className="flex flex-wrap gap-2">
            <CopyButton
              size="sm"
              value={`Portal: ${loginUrl}\nCorreo: ${credentials.email}\nContraseña temporal: ${credentials.password}`}
              label="Copiar credenciales"
            />
            <Button type="button" size="sm" variant="ghost" onClick={() => setCredentials(null)}>
              Ocultar
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">Por seguridad no volveremos a mostrar esta contraseña.</p>
        </div>
      ) : null}
    </div>
  );
}

function PasswordField({
  id,
  error,
  register,
  onGenerate,
}: {
  id?: string;
  error?: string;
  register: UseFormRegisterReturn;
  onGenerate: () => void;
}) {
  const [show, setShow] = React.useState(true);
  return (
    <Field label="Contraseña temporal" error={error} description="Mínimo 10 caracteres con letras y números." required id={id}>
      {(p) => (
        <div className="flex gap-2">
          <Input {...p} {...register} type={show ? "text" : "password"} autoComplete="new-password" className="font-mono" />
          <Button type="button" variant="outline" size="icon" onClick={() => setShow((s) => !s)} aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={onGenerate} aria-label="Generar otra contraseña">
            <RefreshCw className="size-4" />
          </Button>
        </div>
      )}
    </Field>
  );
}

function CreateAccessDialog({
  staffMemberId,
  defaultEmail,
  onDone,
}: {
  staffMemberId: string;
  defaultEmail: string | null;
  onDone: (c: { email: string; password: string }) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const form = useForm<z.input<typeof createAccessSchema>, unknown, z.output<typeof createAccessSchema>>({
    resolver: zodResolver(createAccessSchema),
    defaultValues: { staffMemberId, email: defaultEmail ?? "", password: "" },
  });
  React.useEffect(() => {
    if (open && !form.getValues("password")) form.setValue("password", generateTempPassword());
  }, [open, form]);

  async function onSubmit(values: z.output<typeof createAccessSchema>) {
    const res = await createStaffAccessAction(values);
    if (handleActionResult(res, { form, success: "Acceso creado" })) {
      onDone({ email: res.data.email, password: values.password });
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">
          <UserPlus className="size-4" aria-hidden />
          Crear acceso
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear acceso al portal de staff</DialogTitle>
          <DialogDescription>Se crea un usuario con rol Staff ligado a este integrante.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Correo para iniciar sesión" error={form.formState.errors.email?.message} required>
            {(p) => <Input {...p} type="email" autoComplete="off" {...form.register("email")} />}
          </Field>
          <PasswordField
            error={form.formState.errors.password?.message}
            register={form.register("password")}
            onGenerate={() => form.setValue("password", generateTempPassword(), { shouldValidate: true })}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={form.formState.isSubmitting}>Crear acceso</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  staffMemberId,
  email,
  isSelf,
  onDone,
}: {
  staffMemberId: string;
  email: string;
  isSelf: boolean;
  onDone: (c: { email: string; password: string }) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const form = useForm<z.input<typeof resetPasswordSchema>, unknown, z.output<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { staffMemberId, password: "" },
  });
  React.useEffect(() => {
    if (open) form.setValue("password", generateTempPassword());
  }, [open, form]);

  async function onSubmit(values: z.output<typeof resetPasswordSchema>) {
    const res = await resetStaffPasswordAction(values);
    const success = isSelf ? "Contraseña actualizada. Inicia sesión con la nueva." : "Contraseña restablecida";
    if (handleActionResult(res, { form, success })) {
      if (res.ok && res.data.signedOut) {
        // Sus sesiones se cerraron (incluida ésta): navegación completa para no conservar datos del panel en memoria.
        window.location.assign("/login");
        return;
      }
      onDone({ email, password: values.password });
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <KeyRound className="size-4" aria-hidden />
          Restablecer contraseña
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Restablecer contraseña</DialogTitle>
          <DialogDescription>
            {isSelf
              ? "Define tu nueva contraseña. Se cerrarán todas tus sesiones, incluida ésta, y entrarás de nuevo con ella."
              : "La contraseña anterior dejará de funcionar de inmediato y sus sesiones abiertas se cierran."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <PasswordField
            error={form.formState.errors.password?.message}
            register={form.register("password")}
            onGenerate={() => form.setValue("password", generateTempPassword(), { shouldValidate: true })}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={form.formState.isSubmitting}>Restablecer</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
