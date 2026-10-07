import "server-only";
import bcrypt from "bcryptjs";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/db";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { REVOKE_ALL_SESSIONS } from "@/features/auth/server/session-service";
import { audit } from "@/server/audit";
import type { SessionUser } from "@/server/auth/session";
import {
  BCRYPT_COST,
  TEAM_ROLES,
  checkActiveChange,
  checkCreateUser,
  checkPasswordReset,
  checkPasswordStrength,
  checkRoleChange,
  type RuleResult,
  type TeamRole,
} from "../domain/user-rules";
import {
  changeRoleSchema,
  createUserSchema,
  resetPasswordSchema,
  setActiveSchema,
  type CreateUserValues,
} from "../schemas";

type Tx = Prisma.TransactionClient;

/** Llave de lock transaccional para serializar cambios que afectan a super admins. */
const SUPER_ADMIN_LOCK = 72_011_001;

function enforce(result: RuleResult): void {
  if (result.ok) return;
  if (result.code === "FORBIDDEN") throw new ForbiddenError(result.message);
  if (result.code === "CONFLICT") throw new ConflictError(result.message);
  throw new ValidationError(result.message);
}

async function lockSuperAdmins(tx: Tx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SUPER_ADMIN_LOCK})`;
}

async function countActiveSuperAdmins(tx: Tx): Promise<number> {
  return tx.user.count({ where: { role: "SUPER_ADMIN", active: true } });
}

/**
 * Regla de Usuarios para desactivar una cuenta desde OTRO módulo (p. ej. eliminar la ficha de staff ligada,
 * que desactiva su acceso): las mismas restricciones que `setUserActive` — nadie desactiva su propia cuenta,
 * sólo un super admin toca a otro super admin y nunca queda el sistema sin super admin activo.
 * Toma el lock de super admins: debe llamarse dentro de la transacción que desactiva. Una cuenta ya inactiva pasa.
 */
export async function checkLinkedAccountDeactivation(
  tx: Tx,
  actor: Pick<SessionUser, "id" | "role">,
  userId: string,
): Promise<RuleResult> {
  await lockSuperAdmins(tx);
  const target = await tx.user.findUnique({ where: { id: userId }, select: { id: true, role: true, active: true } });
  if (!target || !target.active) return { ok: true };
  return checkActiveChange(actor, target, false, await countActiveSuperAdmins(tx));
}

export type TeamUserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  active: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  staffMember: { id: string; name: string } | null;
};

/** Usuarias del equipo (las clientas no se administran aquí). */
export async function listTeamUsers(): Promise<TeamUserRow[]> {
  const users = await prisma.user.findMany({
    where: { role: { in: [...TEAM_ROLES] } },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      active: true,
      lastLoginAt: true,
      createdAt: true,
      staffMember: { select: { id: true, name: true } },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  const order: Record<string, number> = { SUPER_ADMIN: 0, OWNER: 1, STAFF: 2 };
  return users.sort((a, b) => Number(b.active) - Number(a.active) || (order[a.role] ?? 9) - (order[b.role] ?? 9));
}

/** Fichas de staff sin cuenta de acceso (para vincular al crear una usuaria STAFF). */
export async function listLinkableStaff(): Promise<Array<{ id: string; name: string; email: string | null }>> {
  return prisma.staffMember.findMany({
    where: { userId: null, active: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}

export async function createUser(input: CreateUserValues, actor: SessionUser): Promise<{ id: string }> {
  const data = createUserSchema.parse(input);
  enforce(checkCreateUser(actor, data.role));
  enforce(checkPasswordStrength(data.password, { email: data.email, name: data.name }));

  const existing = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
  if (existing) throw new ConflictError("Ya existe un usuario con ese correo.");

  const staffMemberId = data.staffMemberId || null;
  if (staffMemberId && data.role !== "STAFF") {
    throw new ValidationError("Sólo puedes vincular una ficha de staff a usuarias con rol Staff.");
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_COST);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { name: data.name, email: data.email, role: data.role, passwordHash, active: true },
      select: { id: true, email: true, name: true, role: true },
    });
    if (staffMemberId) {
      const linked = await tx.staffMember.updateMany({
        where: { id: staffMemberId, userId: null },
        data: { userId: created.id },
      });
      if (linked.count === 0) throw new ConflictError("La ficha de staff ya está vinculada a otra cuenta.");
    }
    await audit(
      {
        action: "user.created",
        entityType: "User",
        entityId: created.id,
        after: { email: created.email, name: created.name, role: created.role, staffMemberId },
        actor,
      },
      tx,
    );
    return created;
  });
  return { id: user.id };
}

export async function changeUserRole(
  input: { userId: string; role: TeamRole },
  actor: SessionUser,
): Promise<{ id: string; role: Role }> {
  const data = changeRoleSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    await lockSuperAdmins(tx);
    const target = await tx.user.findUnique({
      where: { id: data.userId },
      select: { id: true, role: true, active: true, email: true },
    });
    if (!target) throw new NotFoundError("No encontramos a esa usuaria.");
    const activeSuperAdmins = await countActiveSuperAdmins(tx);
    enforce(checkRoleChange(actor, target, data.role, activeSuperAdmins));
    const updated = await tx.user.update({
      where: { id: target.id },
      // Cambiar el rol cierra sus sesiones abiertas: vuelve a entrar con un JWT del rol nuevo.
      data: { role: data.role, ...REVOKE_ALL_SESSIONS },
      select: { id: true, role: true },
    });
    await audit(
      {
        action: "user.role_changed",
        entityType: "User",
        entityId: target.id,
        before: { role: target.role, email: target.email },
        after: { role: updated.role, email: target.email },
        actor,
      },
      tx,
    );
    return updated;
  });
}

export async function setUserActive(
  input: { userId: string; active: boolean },
  actor: SessionUser,
): Promise<{ id: string; active: boolean }> {
  const data = setActiveSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    await lockSuperAdmins(tx);
    const target = await tx.user.findUnique({
      where: { id: data.userId },
      select: { id: true, role: true, active: true, email: true },
    });
    if (!target) throw new NotFoundError("No encontramos a esa usuaria.");
    const activeSuperAdmins = await countActiveSuperAdmins(tx);
    enforce(checkActiveChange(actor, target, data.active, activeSuperAdmins));
    const updated = await tx.user.update({
      where: { id: target.id },
      // Desactivar revoca sus sesiones: al reactivarla no revive ningún JWT anterior.
      data: { active: data.active, ...(data.active ? {} : REVOKE_ALL_SESSIONS) },
      select: { id: true, active: true },
    });
    await audit(
      {
        action: data.active ? "user.activated" : "user.deactivated",
        entityType: "User",
        entityId: target.id,
        before: { active: target.active, email: target.email },
        after: { active: updated.active, email: target.email },
        actor,
      },
      tx,
    );
    return updated;
  });
}

export async function resetUserPassword(
  input: { userId: string; password: string },
  actor: SessionUser,
): Promise<{ id: string }> {
  const data = resetPasswordSchema.parse(input);
  const target = await prisma.user.findUnique({
    where: { id: data.userId },
    select: { id: true, role: true, active: true, email: true, name: true },
  });
  if (!target) throw new NotFoundError("No encontramos a esa usuaria.");
  enforce(checkPasswordReset(actor, target));
  enforce(checkPasswordStrength(data.password, { email: target.email, name: target.name }));
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_COST);
  await prisma.$transaction(async (tx) => {
    // La contraseña nueva cierra todas las sesiones abiertas (incluida la propia si se restablece a sí misma).
    await tx.user.update({ where: { id: target.id }, data: { passwordHash, ...REVOKE_ALL_SESSIONS } });
    // Nunca se audita la contraseña ni el hash
    await audit(
      {
        action: "user.password_reset",
        entityType: "User",
        entityId: target.id,
        after: { email: target.email, self: target.id === actor.id },
        actor,
      },
      tx,
    );
  });
  return { id: target.id };
}
