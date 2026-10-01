import type { TeamRole } from "./user-rules";

/** Descripción breve de cada rol del equipo (UI). */
export const ROLE_HINTS: Record<TeamRole, string> = {
  SUPER_ADMIN: "Acceso total, incluida la administración de super admins.",
  OWNER: "Opera todo el negocio: ventas, eventos, finanzas y configuración.",
  STAFF: "Portal de staff: sólo sus eventos asignados y checklists.",
};
