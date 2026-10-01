/**
 * Datos "base" (los que producción necesita para operar): reglas de disponibilidad,
 * rangos de presupuesto, estilos, zonas de servicio y plantillas de checklist.
 * Los IDs deterministas permiten upserts idempotentes en modelos sin columna única.
 */
import type { ChecklistArea, ChecklistPhase, StaffFunction } from "@prisma/client";
import { mx } from "./helpers";

export const PLACEHOLDER = (name: string) => `/images/placeholders/${name}.svg`;

// -----------------------------------------------------------------------------
// Disponibilidad (0 = domingo ... 6 = sábado)
// -----------------------------------------------------------------------------
export const AVAILABILITY_RULES: { weekday: number; isOpen: boolean; maxEvents: number }[] = [
  { weekday: 0, isOpen: true, maxEvents: 2 }, // domingo
  { weekday: 1, isOpen: false, maxEvents: 0 }, // lunes: descanso del equipo
  { weekday: 2, isOpen: true, maxEvents: 1 },
  { weekday: 3, isOpen: true, maxEvents: 1 },
  { weekday: 4, isOpen: true, maxEvents: 1 },
  { weekday: 5, isOpen: true, maxEvents: 1 },
  { weekday: 6, isOpen: true, maxEvents: 2 }, // sábado
];

// -----------------------------------------------------------------------------
// Rangos de presupuesto
// -----------------------------------------------------------------------------
export const BUDGET_RANGES: { id: string; label: string; minCents: number; maxCents: number | null }[] = [
  { id: "seed-budget-01", label: "Hasta $15,000", minCents: 0, maxCents: mx(15_000) },
  { id: "seed-budget-02", label: "$15,000 – $20,000", minCents: mx(15_000), maxCents: mx(20_000) },
  { id: "seed-budget-03", label: "$20,000 – $30,000", minCents: mx(20_000), maxCents: mx(30_000) },
  { id: "seed-budget-04", label: "$30,000 – $45,000", minCents: mx(30_000), maxCents: mx(45_000) },
  { id: "seed-budget-05", label: "Más de $45,000", minCents: mx(45_000), maxCents: null },
];

// -----------------------------------------------------------------------------
// Estilos
// -----------------------------------------------------------------------------
export const STYLES: { slug: string; name: string; description: string; palette: string[]; imageUrl: string }[] = [
  {
    slug: "natural",
    name: "Natural",
    description:
      "Lino crudo, madera, follaje fresco y flores de campo. Una mesa que se siente como una tarde larga en el jardín.",
    palette: ["#F7F3EC", "#E8DCC8", "#A3B18A", "#5C6B4E"],
    imageUrl: PLACEHOLDER("gallery-01"),
  },
  {
    slug: "elegante",
    name: "Elegante",
    description:
      "Cristalería fina, candelabros de latón y flores blancas. Sobria, luminosa y atemporal, para celebrar en grande sin perder la calidez.",
    palette: ["#FFFFFF", "#E8DCC8", "#C6A15B", "#2F2C2A"],
    imageUrl: PLACEHOLDER("gallery-04"),
  },
  {
    slug: "romantico",
    name: "Romántico",
    description:
      "Rosas de jardín, tonos blush y velas encendidas. Suave y femenino, ideal para bridal showers y cumpleaños íntimos.",
    palette: ["#F3E1DA", "#E9C9BE", "#F7F3EC", "#A48F7E"],
    imageUrl: PLACEHOLDER("bridal-flowers"),
  },
  {
    slug: "divertido",
    name: "Divertido",
    description:
      "Globos orgánicos, colores alegres y detalles que invitan a la fiesta. Perfecto para karaoke, despedidas y cumpleaños con mucha energía.",
    palette: ["#F4B6A6", "#F6D27A", "#A8D5C2", "#8FB3E0"],
    imageUrl: PLACEHOLDER("gallery-05"),
  },
  {
    slug: "minimal",
    name: "Minimal",
    description:
      "Menos es más: blancos rotos, líneas limpias, un solo tipo de flor y mucho espacio para la conversación.",
    palette: ["#FFFFFF", "#F7F3EC", "#D9D4CC", "#2F2C2A"],
    imageUrl: PLACEHOLDER("gallery-03"),
  },
  {
    slug: "colorido",
    name: "Colorido",
    description:
      "Papel picado, textiles artesanales y flores vibrantes. Una mesa con raíces mexicanas que celebra el color sin miedo.",
    palette: ["#D6336C", "#F4A261", "#2A9D8F", "#E9C46A"],
    imageUrl: PLACEHOLDER("peru-mexico"),
  },
];

// -----------------------------------------------------------------------------
// Zonas de servicio
// -----------------------------------------------------------------------------
export const SERVICE_AREAS: {
  slug: string;
  name: string;
  description: string;
  postalCodes: string[];
  logisticsFeeCents: number;
  logisticsCostCents: number;
  active: boolean;
}[] = [
  {
    slug: "polanco",
    name: "Polanco",
    description: "Polanco I a V Sección, Los Morales y Chapultepec Morales.",
    postalCodes: ["11550", "11560", "11510", "11540"],
    logisticsFeeCents: mx(350),
    logisticsCostCents: mx(250),
    active: true,
  },
  {
    slug: "granada",
    name: "Granada",
    description: "Granada y Ampliación Granada (Nuevo Polanco).",
    postalCodes: ["11520", "11529"],
    logisticsFeeCents: mx(350),
    logisticsCostCents: mx(250),
    active: true,
  },
  {
    slug: "irrigacion",
    name: "Irrigación",
    description: "Colonia Irrigación y alrededores inmediatos.",
    postalCodes: ["11500"],
    logisticsFeeCents: mx(450),
    logisticsCostCents: mx(300),
    active: true,
  },
  {
    slug: "lomas-de-chapultepec",
    name: "Lomas de Chapultepec",
    description: "Próximamente (fase 2).",
    postalCodes: ["11000", "11950"],
    logisticsFeeCents: mx(600),
    logisticsCostCents: mx(400),
    active: false,
  },
  {
    slug: "anzures",
    name: "Anzures",
    description: "Próximamente (fase 2).",
    postalCodes: ["11590"],
    logisticsFeeCents: mx(600),
    logisticsCostCents: mx(400),
    active: false,
  },
];

// -----------------------------------------------------------------------------
// Plantillas de checklist (una por fase). offsetMinutes relativo a startsAt.
// -----------------------------------------------------------------------------
export interface ChecklistTemplateSeed {
  id: string;
  phase: ChecklistPhase;
  name: string;
  description: string;
  items: {
    title: string;
    description?: string;
    area: ChecklistArea;
    offsetMinutes: number;
    defaultFunction: StaffFunction | null;
    requiresEvidence?: boolean;
  }[];
}

const D = 24 * 60;

export const CHECKLIST_TEMPLATES: ChecklistTemplateSeed[] = [
  {
    id: "seed-chk-t-minus-7",
    phase: "T_MINUS_7",
    name: "T-7 · Confirmaciones y compras",
    description: "Una semana antes: cerrar detalles con la clienta y detonar compras.",
    items: [
      { title: "Confirmar número final de invitadas con la clienta", area: "CLIENT", offsetMinutes: -7 * D, defaultFunction: "COORDINATOR" },
      { title: "Confirmar menú y restricciones alimentarias", area: "FOOD", offsetMinutes: -7 * D, defaultFunction: "CHEF" },
      { title: "Ordenar flores al proveedor", area: "FLOWERS", offsetMinutes: -7 * D + 60, defaultFunction: "COORDINATOR" },
      { title: "Reservar inventario y revisar conflictos", area: "TABLE", offsetMinutes: -7 * D + 120, defaultFunction: "COORDINATOR" },
      { title: "Confirmar staff asignado y horarios", area: "STAFF", offsetMinutes: -7 * D + 180, defaultFunction: "COORDINATOR" },
    ],
  },
  {
    id: "seed-chk-t-minus-3",
    phase: "T_MINUS_3",
    name: "T-3 · Saldo, proveedores y RSVP",
    description: "Tres días antes: dinero, proveedores y lista de invitadas.",
    items: [
      { title: "Confirmar pago del saldo pendiente", description: "Si no hay pago, enviar recordatorio amable por WhatsApp.", area: "ADMIN", offsetMinutes: -3 * D, defaultFunction: null },
      { title: "Lista final de compras de cocina", area: "FOOD", offsetMinutes: -3 * D, defaultFunction: "CHEF" },
      { title: "Confirmar add-ons con proveedores (pastel, fotógrafo, globos)", area: "ADDONS", offsetMinutes: -3 * D + 60, defaultFunction: "COORDINATOR" },
      { title: "Enviar recordatorio de RSVP a invitadas pendientes", area: "CLIENT", offsetMinutes: -3 * D + 120, defaultFunction: "COORDINATOR" },
    ],
  },
  {
    id: "seed-chk-t-minus-1",
    phase: "T_MINUS_1",
    name: "T-1 · Preparación",
    description: "Un día antes: cocina, flores e inventario listos.",
    items: [
      { title: "Mise en place y preparaciones de cocina", area: "FOOD", offsetMinutes: -1 * D, defaultFunction: "CHEF" },
      { title: "Recoger flores y armar arreglos", area: "FLOWERS", offsetMinutes: -1 * D + 120, defaultFunction: "SETUP", requiresEvidence: true },
      { title: "Empacar inventario y revisar contra lista", area: "TABLE", offsetMinutes: -1 * D + 240, defaultFunction: "SETUP", requiresEvidence: true },
      { title: "Confirmar ruta, acceso y estacionamiento con la clienta", area: "TRANSPORT", offsetMinutes: -1 * D + 300, defaultFunction: "DRIVER" },
    ],
  },
  {
    id: "seed-chk-setup",
    phase: "SETUP",
    name: "Montaje",
    description: "Llegada y montaje en sitio.",
    items: [
      { title: "Salida de bodega con todo el equipo", area: "TRANSPORT", offsetMinutes: -180, defaultFunction: "DRIVER" },
      { title: "Montaje de mesa, mantelería y vajilla", area: "TABLE", offsetMinutes: -120, defaultFunction: "SETUP" },
      { title: "Montaje floral y centros de mesa", area: "FLOWERS", offsetMinutes: -90, defaultFunction: "SETUP" },
      { title: "Prueba de sonido / karaoke (si aplica)", area: "ADDONS", offsetMinutes: -45, defaultFunction: "SETUP" },
      { title: "Foto de la mesa terminada antes de recibir invitadas", area: "GENERAL", offsetMinutes: -15, defaultFunction: "COORDINATOR", requiresEvidence: true },
    ],
  },
  {
    id: "seed-chk-event",
    phase: "EVENT",
    name: "Durante el evento",
    description: "Servicio y momentos clave.",
    items: [
      { title: "Recibir a la homenajeada y a las invitadas", area: "CLIENT", offsetMinutes: 0, defaultFunction: "COORDINATOR" },
      { title: "Servicio de bebidas de bienvenida", area: "FOOD", offsetMinutes: 10, defaultFunction: "SERVER" },
      { title: "Servicio del plato fuerte", area: "FOOD", offsetMinutes: 60, defaultFunction: "CHEF" },
      { title: "Momento especial: pastel / brindis", area: "GENERAL", offsetMinutes: 150, defaultFunction: "COORDINATOR" },
    ],
  },
  {
    id: "seed-chk-teardown",
    phase: "TEARDOWN",
    name: "Desmontaje",
    description: "Dejar el espacio impecable y regresar todo a bodega.",
    items: [
      { title: "Desmontaje y limpieza del espacio", area: "TABLE", offsetMinutes: 240, defaultFunction: "SETUP" },
      { title: "Conteo de inventario de regreso (merma y daños)", area: "TABLE", offsetMinutes: 270, defaultFunction: "SETUP", requiresEvidence: true },
      { title: "Carga y regreso a bodega", area: "TRANSPORT", offsetMinutes: 300, defaultFunction: "DRIVER" },
    ],
  },
  {
    id: "seed-chk-closing",
    phase: "CLOSING",
    name: "Cierre",
    description: "Costos reales, memoria del evento y reseña.",
    items: [
      { title: "Registrar costos reales y comprobantes", area: "ADMIN", offsetMinutes: 1 * D, defaultFunction: null, requiresEvidence: true },
      { title: "Subir fotos a la Memory Capsule", area: "CLIENT", offsetMinutes: 1 * D, defaultFunction: "COORDINATOR" },
      { title: "Enviar solicitud de reseña", area: "CLIENT", offsetMinutes: 2 * D, defaultFunction: "COORDINATOR" },
      { title: "Cerrar evento y revisar margen", area: "ADMIN", offsetMinutes: 3 * D, defaultFunction: null },
    ],
  },
];

export function checklistItemId(templateId: string, index: number): string {
  return `${templateId}-${String(index + 1).padStart(2, "0")}`;
}
