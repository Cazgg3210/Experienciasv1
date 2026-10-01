import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/db";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { can, type AppRole, type Permission } from "@/server/auth/permissions";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: AppRole;
};

/**
 * Usuario actual (o null). Cacheado por request.
 * La sesión es JWT, así que se revalida contra la base en cada request: un usuario desactivado
 * pierde el acceso de inmediato y los cambios de rol aplican sin esperar a que expire el token.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const u = session?.user;
  if (!u?.id || !u.role) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: u.id },
    select: { id: true, email: true, name: true, role: true, active: true },
  });
  if (!dbUser || !dbUser.active || dbUser.role === "CUSTOMER") return null;
  return { id: dbUser.id, email: dbUser.email, name: dbUser.name, role: dbUser.role };
});

/** Para Server Components/páginas: redirige a /login si no hay sesión o a /403 si no tiene permiso. */
export async function requirePagePermission(permission: Permission, callbackUrl?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`);
  if (!can(user.role, permission)) redirect("/sin-acceso");
  return user;
}

/** Para Server Actions / Route Handlers: lanza errores tipados. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) throw new ForbiddenError();
  return user;
}

export async function hasPermission(permission: Permission): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user && can(user.role, permission);
}
