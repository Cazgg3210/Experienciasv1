import "server-only";
import bcrypt from "bcryptjs";
import type { StaffMember } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "@/db";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { REVOKE_ALL_SESSIONS } from "@/features/auth/server/session-service";
import { checkLinkedAccountDeactivation } from "@/features/users/server/user-service";
import { audit } from "@/server/audit";
import { can, canAssignRole, type Permission } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/auth/session";
import {
  accessActiveSchema,
  createAccessSchema,
  resetPasswordSchema,
  staffMemberSchema,
  updateStaffMemberSchema,
  type CreateAccessValues,
  type ResetPasswordValues,
  type StaffMemberFormValues,
} from "../schemas";

type Actor = Pick<SessionUser, "id" | "email" | "role">;

const BCRYPT_ROUNDS = 10;

function assertCan(actor: Actor, permission: Permission): void {
  if (!can(actor.role, permission)) throw new ForbiddenError();
}

function snapshot(m: StaffMember) {
  return {
    name: m.name,
    primaryFunction: m.primaryFunction,
    phone: m.phone,
    email: m.email,
    rateCents: m.rateCents,
    rateType: m.rateType,
    availableWeekdays: m.availableWeekdays,
    active: m.active,
  };
}

// =============================================================================
// Integrantes
// =============================================================================

export async function createStaffMember(actor: Actor, raw: StaffMemberFormValues): Promise<StaffMember> {
  assertCan(actor, "staff:write");
  const input = staffMemberSchema.parse(raw);
  const member = await prisma.staffMember.create({ data: input });
  await audit({ action: "staff.created", entityType: "StaffMember", entityId: member.id, after: snapshot(member), actor });
  return member;
}

export async function updateStaffMember(actor: Actor, raw: z.input<typeof updateStaffMemberSchema>): Promise<StaffMember> {
  assertCan(actor, "staff:write");
  const { id, ...input } = updateStaffMemberSchema.parse(raw);
  const before = await prisma.staffMember.findUnique({ where: { id } });
  if (!before) throw new NotFoundError("No encontramos a este integrante.");
  const member = await prisma.staffMember.update({ where: { id }, data: input });
  await audit({
    action: "staff.updated",
    entityType: "StaffMember",
    entityId: id,
    before: snapshot(before),
    after: snapshot(member),
    actor,
  });
  return member;
}

/** Sólo se elimina si no tiene asignaciones (historial de pagos); si no, se desactiva. */
export async function deleteStaffMember(actor: Actor, id: string): Promise<void> {
  assertCan(actor, "staff:write");
  const member = await prisma.staffMember.findUnique({
    where: { id },
    include: { _count: { select: { assignments: true } } },
  });
  if (!member) throw new NotFoundError("No encontramos a este integrante.");
  if (member._count.assignments > 0) {
    throw new ConflictError("Tiene eventos en su historial. Desactívala en lugar de eliminarla.");
  }
  await prisma.$transaction(async (tx) => {
    if (member.userId) {
      // Eliminar la ficha desactiva su cuenta: mismas reglas que Ajustes › Usuarios (no la propia, no una
      // super admin si no lo eres, nunca la última super admin activa).
      const rule = await checkLinkedAccountDeactivation(tx, actor, member.userId);
      if (!rule.ok) {
        const message = `Esta ficha tiene una cuenta de acceso que se desactivaría al eliminarla. ${rule.message}`;
        if (rule.code === "FORBIDDEN") throw new ForbiddenError(message);
        if (rule.code === "CONFLICT") throw new ConflictError(message);
        throw new ValidationError(message);
      }
    }
    await tx.eventChecklistItem.updateMany({ where: { assigneeId: id }, data: { assigneeId: null } });
    await tx.staffMember.delete({ where: { id } });
    if (member.userId) {
      await tx.user.update({ where: { id: member.userId }, data: { active: false, ...REVOKE_ALL_SESSIONS } });
    }
    await audit({ action: "staff.deleted", entityType: "StaffMember", entityId: id, before: snapshot(member), actor }, tx);
  });
}

// =============================================================================
// Accesos (usuarios STAFF)
// =============================================================================

/** Crea el usuario STAFF ligado al integrante (contraseña temporal con bcrypt). */
export async function createStaffAccess(
  actor: Actor,
  raw: CreateAccessValues,
): Promise<{ userId: string; email: string }> {
  assertCan(actor, "users:manage");
  if (!canAssignRole(actor.role, "STAFF")) throw new ForbiddenError();
  const input = createAccessSchema.parse(raw);
  const member = await prisma.staffMember.findUnique({ where: { id: input.staffMemberId } });
  if (!member) throw new NotFoundError("No encontramos a este integrante.");
  if (member.userId) throw new ConflictError("Este integrante ya tiene acceso. Usa «Restablecer contraseña».");

  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) {
    throw new ValidationError("Ya existe una cuenta con ese correo.", { email: ["Este correo ya tiene una cuenta."] });
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        name: member.name,
        phone: member.phone,
        role: "STAFF",
        passwordHash,
        active: true,
      },
    });
    await tx.staffMember.update({
      where: { id: member.id },
      data: { userId: created.id, email: member.email ?? input.email },
    });
    await audit(
      {
        action: "user.created",
        entityType: "User",
        entityId: created.id,
        after: { email: created.email, role: "STAFF", staffMemberId: member.id },
        actor,
      },
      tx,
    );
    return created;
  });
  return { userId: user.id, email: user.email };
}

async function linkedUser(staffMemberId: string, actor: Actor) {
  const member = await prisma.staffMember.findUnique({
    where: { id: staffMemberId },
    include: { user: { select: { id: true, email: true, role: true, active: true } } },
  });
  if (!member) throw new NotFoundError("No encontramos a este integrante.");
  if (!member.user) throw new ConflictError("Este integrante aún no tiene acceso. Usa «Crear acceso».");
  if (!canAssignRole(actor.role, member.user.role)) throw new ForbiddenError();
  return member.user;
}

/**
 * Restablece la contraseña del acceso ligado al integrante y cierra todas sus sesiones abiertas.
 * `self` indica que quien la restablece es la propia usuaria (una fundadora con ficha de staff): su sesión
 * actual también quedó revocada y la acción debe cerrar sesión en el navegador (como en Ajustes › Usuarios).
 */
export async function resetStaffPassword(
  actor: Actor,
  raw: ResetPasswordValues,
): Promise<{ email: string; userId: string; self: boolean }> {
  assertCan(actor, "users:manage");
  const input = resetPasswordSchema.parse(raw);
  const user = await linkedUser(input.staffMemberId, actor);
  const self = user.id === actor.id;
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  await prisma.$transaction(async (tx) => {
    // La contraseña nueva cierra todas sus sesiones abiertas (incluida la propia si se la restablece a sí misma).
    await tx.user.update({ where: { id: user.id }, data: { passwordHash, ...REVOKE_ALL_SESSIONS } });
    await audit(
      {
        action: "user.password_reset",
        entityType: "User",
        entityId: user.id,
        after: { email: user.email, staffMemberId: input.staffMemberId, self },
        actor,
      },
      tx,
    );
  });
  return { email: user.email, userId: user.id, self };
}

export async function setStaffAccessActive(
  actor: Actor,
  raw: z.input<typeof accessActiveSchema>,
): Promise<{ active: boolean }> {
  assertCan(actor, "users:manage");
  const input = accessActiveSchema.parse(raw);
  const user = await linkedUser(input.staffMemberId, actor);
  if (user.id === actor.id) throw new ForbiddenError("No puedes desactivar tu propio acceso.");
  // Desactivar revoca sus sesiones: al reactivarla no revive ningún JWT anterior.
  await prisma.user.update({
    where: { id: user.id },
    data: { active: input.active, ...(input.active ? {} : REVOKE_ALL_SESSIONS) },
  });
  await audit({
    action: input.active ? "user.activated" : "user.deactivated",
    entityType: "User",
    entityId: user.id,
    before: { active: user.active },
    after: { active: input.active },
    actor,
  });
  return { active: input.active };
}
