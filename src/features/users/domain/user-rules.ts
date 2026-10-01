import { can, canAssignRole, type AppRole } from "@/server/auth/permissions";

/**
 * Reglas puras de administración de usuarias del equipo (sin I/O).
 * El servicio las evalúa dentro de una transacción con el conteo real de super admins.
 */

export const TEAM_ROLES = ["SUPER_ADMIN", "OWNER", "STAFF"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 200;
/** Costo de bcrypt para contraseñas (igual que el login). */
export const BCRYPT_COST = 10;

export type RuleViolation = { ok: false; code: "FORBIDDEN" | "CONFLICT" | "VALIDATION"; message: string };
export type RuleResult = { ok: true } | RuleViolation;

const OK: RuleResult = { ok: true };
const forbidden = (message: string): RuleViolation => ({ ok: false, code: "FORBIDDEN", message });
const conflict = (message: string): RuleViolation => ({ ok: false, code: "CONFLICT", message });
const invalid = (message: string): RuleViolation => ({ ok: false, code: "VALIDATION", message });

export type RuleActor = { id: string; role: AppRole };
export type RuleTarget = { id: string; role: AppRole; active: boolean };

export function isTeamRole(role: string): role is TeamRole {
  return (TEAM_ROLES as readonly string[]).includes(role);
}

/** Roles que la persona puede asignar (OWNER no puede crear SUPER_ADMIN). */
export function assignableRoles(actorRole: AppRole): TeamRole[] {
  return TEAM_ROLES.filter((r) => canAssignRole(actorRole, r));
}

/** Desde Usuarios sólo se administran cuentas del equipo (nunca cuentas de clientas). */
const NOT_TEAM = "Sólo puedes administrar cuentas del equipo.";

/** Sólo un super admin puede modificar (rol, estado, contraseña) a otro super admin. */
function canTouchTarget(actor: RuleActor, target: RuleTarget): boolean {
  if (target.role !== "SUPER_ADMIN") return true;
  return can(actor.role, "roles:assign_super_admin");
}

export function checkCreateUser(actor: RuleActor, role: AppRole): RuleResult {
  if (!can(actor.role, "users:manage")) return forbidden("No tienes permiso para administrar usuarios.");
  if (!isTeamRole(role)) return invalid("Elige un rol del equipo.");
  if (!canAssignRole(actor.role, role)) return forbidden("No puedes crear usuarios con ese rol.");
  return OK;
}

export function checkRoleChange(
  actor: RuleActor,
  target: RuleTarget,
  newRole: AppRole,
  activeSuperAdmins: number,
): RuleResult {
  if (!can(actor.role, "users:manage")) return forbidden("No tienes permiso para administrar usuarios.");
  if (actor.id === target.id) return conflict("No puedes cambiar tu propio rol.");
  if (!isTeamRole(target.role)) return forbidden(NOT_TEAM);
  if (!isTeamRole(newRole)) return invalid("Elige un rol del equipo.");
  if (target.role === newRole) return invalid("La persona ya tiene ese rol.");
  if (!canTouchTarget(actor, target)) return forbidden("Sólo un super admin puede modificar a otro super admin.");
  if (!canAssignRole(actor.role, newRole)) return forbidden("No puedes asignar ese rol.");
  if (target.role === "SUPER_ADMIN" && target.active && activeSuperAdmins <= 1) {
    return conflict("Debe quedar al menos un super admin activo.");
  }
  return OK;
}

export function checkActiveChange(
  actor: RuleActor,
  target: RuleTarget,
  active: boolean,
  activeSuperAdmins: number,
): RuleResult {
  if (!can(actor.role, "users:manage")) return forbidden("No tienes permiso para administrar usuarios.");
  if (!isTeamRole(target.role)) return forbidden(NOT_TEAM);
  if (target.active === active) return invalid(active ? "La cuenta ya está activa." : "La cuenta ya está desactivada.");
  if (actor.id === target.id && !active) return conflict("No puedes desactivar tu propia cuenta.");
  if (!canTouchTarget(actor, target)) return forbidden("Sólo un super admin puede modificar a otro super admin.");
  if (!active && target.role === "SUPER_ADMIN" && target.active && activeSuperAdmins <= 1) {
    return conflict("No puedes desactivar al último super admin activo.");
  }
  return OK;
}

export function checkPasswordReset(actor: RuleActor, target: RuleTarget): RuleResult {
  if (!can(actor.role, "users:manage")) return forbidden("No tienes permiso para administrar usuarios.");
  if (!isTeamRole(target.role)) return forbidden(NOT_TEAM);
  if (actor.id !== target.id && !canTouchTarget(actor, target)) {
    return forbidden("Sólo un super admin puede restablecer la contraseña de otro super admin.");
  }
  return OK;
}

/** Validación de contraseña temporal (además del esquema Zod). */
export function checkPasswordStrength(password: string, context: { email?: string; name?: string } = {}): RuleResult {
  if (password.length < MIN_PASSWORD_LENGTH) return invalid(`Mínimo ${MIN_PASSWORD_LENGTH} caracteres.`);
  if (password.length > MAX_PASSWORD_LENGTH) return invalid(`Máximo ${MAX_PASSWORD_LENGTH} caracteres.`);
  if (/^(.)\1+$/.test(password)) return invalid("La contraseña no puede repetir un solo carácter.");
  const lower = password.toLowerCase();
  const local = context.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) return invalid("La contraseña no debe contener el correo.");
  return OK;
}
