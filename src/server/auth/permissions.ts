/**
 * RBAC centralizado. Fuente única de verdad de permisos por rol.
 * Puro (sin dependencias de servidor) para poder probarse y usarse en UI.
 */
export const ROLES = ["SUPER_ADMIN", "OWNER", "STAFF", "CUSTOMER"] as const;
export type AppRole = (typeof ROLES)[number];

export const PERMISSIONS = [
  "dashboard:view",
  "leads:read",
  "leads:write",
  "customers:read",
  "customers:write",
  "catalog:read",
  "catalog:write",
  "pricing:write", // cambiar precios/costos del catálogo
  "quotes:read",
  "quotes:write",
  "quotes:discount",
  "quotes:send",
  "bookings:read",
  "payments:read",
  "payments:manual", // registrar pagos manuales / reembolsos
  "events:read_all",
  "events:read_assigned",
  "events:write",
  "events:cancel",
  "events:close",
  "guests:read",
  "guests:write",
  "availability:write",
  "operations:read",
  "checklists:write", // administrar templates y checklist de cualquier evento
  "checklists:update_assigned", // marcar tareas propias
  "inventory:read",
  "inventory:write",
  "vendors:read",
  "vendors:write",
  "purchases:read",
  "purchases:write",
  "staff:read",
  "staff:write",
  "financials:read",
  "costs:write",
  "media:upload",
  "media:moderate",
  "memory:write",
  "content:write",
  "analytics:read",
  "notifications:read",
  "settings:read",
  "settings:write",
  "users:manage",
  "roles:assign_super_admin",
  "audit:read",
  "ai:use",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL = [...PERMISSIONS] as Permission[];

const OWNER_PERMISSIONS: Permission[] = ALL.filter((p) => p !== "roles:assign_super_admin");

const STAFF_PERMISSIONS: Permission[] = [
  "events:read_assigned",
  "checklists:update_assigned",
  "media:upload",
  "inventory:read",
];

const CUSTOMER_PERMISSIONS: Permission[] = [];

export const ROLE_PERMISSIONS: Record<AppRole, ReadonlySet<Permission>> = {
  SUPER_ADMIN: new Set(ALL),
  OWNER: new Set(OWNER_PERMISSIONS),
  STAFF: new Set(STAFF_PERMISSIONS),
  CUSTOMER: new Set(CUSTOMER_PERMISSIONS),
};

export function can(role: AppRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function canAny(role: AppRole | null | undefined, permissions: Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}

/** Roles con acceso al panel /admin */
export function isBackofficeRole(role: AppRole | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "OWNER";
}

/** Ruta de inicio según rol después de iniciar sesión */
export function homePathForRole(role: AppRole | null | undefined): string {
  if (role === "STAFF") return "/staff";
  if (isBackofficeRole(role)) return "/admin";
  return "/";
}

/** Un usuario puede asignar un rol si tiene users:manage y (para SUPER_ADMIN) el permiso especial. */
export function canAssignRole(actorRole: AppRole, targetRole: AppRole): boolean {
  if (!can(actorRole, "users:manage")) return false;
  if (targetRole === "SUPER_ADMIN") return can(actorRole, "roles:assign_super_admin");
  return true;
}
