/**
 * Cuentas y tokens de prueba. Se toman del seed DEMO (fuente única) para no duplicar credenciales:
 * el global-setup vuelve a sembrar la base E2E en cada corrida, así que siempre existen.
 * Sólo válidas en el entorno local de E2E (base *_e2e).
 */
import path from "node:path";
import { DEMO_PASSWORD, DEMO_USERS } from "../../../prisma/seed-data/demo-catalog";
import { DEMO_TOKENS } from "../../../prisma/seed-data/demo-sales";

export type E2ERole = "superadmin" | "owner" | "owner2" | "staff" | "staff2";

export const ACCOUNTS: Record<E2ERole, { email: string; name: string; appRole: string; home: string }> = {
  superadmin: { email: DEMO_USERS.superadmin.email, name: DEMO_USERS.superadmin.name, appRole: "SUPER_ADMIN", home: "/admin" },
  owner: { email: DEMO_USERS.ivonne.email, name: DEMO_USERS.ivonne.name, appRole: "OWNER", home: "/admin" },
  owner2: { email: DEMO_USERS.rosa.email, name: DEMO_USERS.rosa.name, appRole: "OWNER", home: "/admin" },
  // Lupita (coordinación) está asignada a "Cumpleaños de Sofía" y "Karaoke & Mimosas de Daniela"
  staff: { email: DEMO_USERS.lupita.email, name: DEMO_USERS.lupita.name, appRole: "STAFF", home: "/staff" },
  staff2: { email: DEMO_USERS.carlos.email, name: DEMO_USERS.carlos.name, appRole: "STAFF", home: "/staff" },
};

export const PASSWORD = process.env.E2E_PASSWORD ?? DEMO_PASSWORD;

export const ROLES: E2ERole[] = ["superadmin", "owner", "owner2", "staff", "staff2"];

/** Sesión guardada por rol (la genera tests/e2e/setup/auth.setup.ts). Cada carril (E2E_LANE) tiene las suyas. */
export function storageStatePath(role: E2ERole): string {
  const lane = Number(process.env.E2E_LANE ?? 0);
  return path.join(__dirname, "..", ".auth", ...(lane > 0 ? [`l${lane}`] : []), `${role}.json`);
}

/**
 * Enlaces por token del seed DEMO (clienta/invitada no usan login).
 * Úsalos para pruebas de SÓLO LECTURA. Para mutar (aceptar, pagar, RSVP…) crea datos propios
 * con las factories: los tokens del seed son compartidos por todas las pruebas de la corrida.
 */
export const TOKENS = {
  quoteLucia: DEMO_TOKENS.luciaQuote,
  memoryValeria: DEMO_TOKENS.memoryValeria,
  guestCamila: DEMO_TOKENS.camilaGuest,
  portalSofia: "demo-portal-cumple-sofia-2026",
  inviteSofia: "demo-invite-cumple-sofia-2026",
  micrositeSofia: "cumple-sofia",
  portalFernandaPendingPayment: "demo-portal-baby-fernanda-2026",
  portalValeriaCompleted: "demo-portal-peru-valeria-2026",
} as const;
