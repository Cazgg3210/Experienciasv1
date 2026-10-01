/**
 * Etiquetas en español para enums del dominio + "tono" visual para badges.
 * Fuente única para toda la UI (admin, portal, sitio público).
 */
import type {
  AddOnCategory,
  AddOnPricingType,
  AvailabilityExceptionType,
  ChecklistArea,
  ChecklistItemStatus,
  ChecklistPhase,
  CostCategory,
  DietaryRestriction,
  EventStatus,
  ExperienceType,
  InventoryCategory,
  InventoryMovementType,
  InventoryReservationStatus,
  LeadActivityType,
  LeadSource,
  LeadStatus,
  MenuCourse,
  MenuPricingType,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  Occasion,
  PaymentKind,
  PaymentMethod,
  PaymentStatus,
  PurchaseStatus,
  QuoteItemType,
  QuoteStatus,
  Role,
  RsvpStatus,
  StaffFunction,
  StaffRateType,
  VendorCategory,
  VendorStatus,
} from "@prisma/client";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "brand" | "muted";

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super admin",
  OWNER: "Fundadora",
  STAFF: "Staff",
  CUSTOMER: "Clienta",
};

export const OCCASION_LABELS: Record<Occasion, string> = {
  BIRTHDAY: "Cumpleaños",
  FRIENDS_BRUNCH: "Brunch entre amigas",
  BACHELORETTE: "Despedida de soltera",
  BRIDAL: "Bridal brunch",
  BABY_BRUNCH: "Baby brunch",
  GATHERING: "Reunión",
  CORPORATE: "Corporativo boutique",
  OTHER: "Otra celebración",
};

export const EXPERIENCE_TYPE_LABELS: Record<ExperienceType, string> = {
  BRUNCH: "Brunch",
  BREAKFAST: "Desayuno",
  CELEBRATION: "Celebración",
  THEMED: "Temática",
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  QUALIFIED: "Calificado",
  QUOTED: "Cotizado",
  WON: "Ganado",
  LOST: "Perdido",
};
export const LEAD_STATUS_TONES: Record<LeadStatus, Tone> = {
  NEW: "info",
  CONTACTED: "brand",
  QUALIFIED: "warning",
  QUOTED: "neutral",
  WON: "success",
  LOST: "muted",
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  CONFIGURATOR: "Configurador web",
  AI_DESIGNER: "Diseñador IA",
  CONTACT_FORM: "Formulario de contacto",
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  REFERRAL: "Recomendación",
  GOOGLE: "Google",
  MANUAL: "Captura manual",
  OTHER: "Otro",
};

export const LEAD_ACTIVITY_LABELS: Record<LeadActivityType, string> = {
  CREATED: "Lead creado",
  STATUS_CHANGE: "Cambio de estado",
  NOTE: "Nota",
  CALL: "Llamada",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  QUOTE_CREATED: "Cotización creada",
  QUOTE_SENT: "Cotización enviada",
  ASSIGNED: "Asignación",
  SYSTEM: "Sistema",
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
  EXPIRED: "Expirada",
};
export const QUOTE_STATUS_TONES: Record<QuoteStatus, Tone> = {
  DRAFT: "muted",
  SENT: "info",
  ACCEPTED: "success",
  REJECTED: "danger",
  EXPIRED: "warning",
};

export const QUOTE_ITEM_TYPE_LABELS: Record<QuoteItemType, string> = {
  BASE_EXPERIENCE: "Experiencia base",
  EXTRA_GUEST: "Invitadas adicionales",
  MENU: "Menú",
  ADDON: "Add-on",
  LOGISTICS: "Logística",
  CUSTOM: "Concepto personalizado",
};

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  INQUIRY: "Consulta",
  PENDING_PAYMENT: "Pendiente de pago",
  CONFIRMED: "Confirmado",
  PLANNING: "En planeación",
  READY: "Listo",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};
export const EVENT_STATUS_TONES: Record<EventStatus, Tone> = {
  INQUIRY: "muted",
  PENDING_PAYMENT: "warning",
  CONFIRMED: "info",
  PLANNING: "brand",
  READY: "success",
  IN_PROGRESS: "brand",
  COMPLETED: "neutral",
  CANCELLED: "danger",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  FAILED: "Fallido",
  REFUNDED: "Reembolsado",
  PARTIAL_REFUND: "Reembolso parcial",
};
export const PAYMENT_STATUS_TONES: Record<PaymentStatus, Tone> = {
  PENDING: "warning",
  PAID: "success",
  FAILED: "danger",
  REFUNDED: "muted",
  PARTIAL_REFUND: "info",
};

export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  DEPOSIT: "Anticipo",
  BALANCE: "Saldo",
  FULL: "Pago completo",
  REFUND: "Reembolso",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  ONLINE: "En línea",
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  CARD_TERMINAL: "Terminal",
  OTHER: "Otro",
};

export const MENU_PRICING_LABELS: Record<MenuPricingType, string> = {
  INCLUDED: "Incluido",
  PER_GUEST: "Upgrade por persona",
  FLAT: "Upgrade por evento",
};

export const ADDON_PRICING_LABELS: Record<AddOnPricingType, string> = {
  FLAT: "Precio fijo",
  PER_GUEST: "Por persona",
};

export const ADDON_CATEGORY_LABELS: Record<AddOnCategory, string> = {
  DECOR: "Decoración",
  FOOD: "Comida",
  DRINKS: "Bebidas",
  ENTERTAINMENT: "Entretenimiento",
  PHOTO: "Foto y video",
  PERSONALIZATION: "Personalización",
  EXPERIENCE: "Experiencia",
  OTHER: "Otro",
};

export const MENU_COURSE_LABELS: Record<MenuCourse, string> = {
  DRINK: "Bebidas",
  STARTER: "Para empezar",
  MAIN: "Plato fuerte",
  SIDE: "Acompañamientos",
  DESSERT: "Postre",
  OTHER: "Otros",
};

export const COST_CATEGORY_LABELS: Record<CostCategory, string> = {
  FOOD: "Alimentos",
  FLOWERS: "Flores",
  STAFF: "Staff",
  TRANSPORT: "Transporte",
  VENDOR: "Proveedores",
  CONSUMABLES: "Consumibles",
  PAYMENT_FEE: "Comisión de pago",
  OTHER: "Otros",
};

export const RSVP_STATUS_LABELS: Record<RsvpStatus, string> = {
  PENDING: "Pendiente",
  ATTENDING: "Asiste",
  NOT_ATTENDING: "No asiste",
  MAYBE: "Tal vez",
};
export const RSVP_STATUS_TONES: Record<RsvpStatus, Tone> = {
  PENDING: "warning",
  ATTENDING: "success",
  NOT_ATTENDING: "muted",
  MAYBE: "info",
};

export const DIETARY_LABELS: Record<DietaryRestriction, string> = {
  VEGETARIAN: "Vegetariana",
  VEGAN: "Vegana",
  GLUTEN_FREE: "Sin gluten",
  LACTOSE_FREE: "Sin lactosa",
  NUT_ALLERGY: "Alergia a nueces",
  SEAFOOD_ALLERGY: "Alergia a mariscos",
  KOSHER: "Kosher",
  HALAL: "Halal",
  OTHER: "Otra",
};

export const CHECKLIST_PHASE_LABELS: Record<ChecklistPhase, string> = {
  T_MINUS_7: "T-7 días",
  T_MINUS_3: "T-3 días",
  T_MINUS_1: "T-1 día",
  SETUP: "Montaje",
  EVENT: "Evento",
  TEARDOWN: "Desmontaje",
  CLOSING: "Cierre",
};
export const CHECKLIST_PHASE_ORDER: ChecklistPhase[] = [
  "T_MINUS_7",
  "T_MINUS_3",
  "T_MINUS_1",
  "SETUP",
  "EVENT",
  "TEARDOWN",
  "CLOSING",
];

export const CHECKLIST_AREA_LABELS: Record<ChecklistArea, string> = {
  FOOD: "Comida",
  TABLE: "Mesa",
  FLOWERS: "Flores",
  ADDONS: "Add-ons",
  TRANSPORT: "Transporte",
  STAFF: "Staff",
  CLIENT: "Clienta",
  ADMIN: "Administración",
  GENERAL: "General",
};

export const CHECKLIST_STATUS_LABELS: Record<ChecklistItemStatus, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En proceso",
  DONE: "Hecho",
  SKIPPED: "Omitido",
};
export const CHECKLIST_STATUS_TONES: Record<ChecklistItemStatus, Tone> = {
  PENDING: "warning",
  IN_PROGRESS: "info",
  DONE: "success",
  SKIPPED: "muted",
};

export const STAFF_FUNCTION_LABELS: Record<StaffFunction, string> = {
  COORDINATOR: "Coordinación",
  CHEF: "Chef",
  KITCHEN_ASSISTANT: "Asistente de cocina",
  SERVER: "Mesera/o",
  SETUP: "Montaje",
  DRIVER: "Chofer",
  HOST: "Anfitriona",
  PHOTOGRAPHER: "Fotografía",
  OTHER: "Otro",
};

export const STAFF_RATE_LABELS: Record<StaffRateType, string> = {
  PER_EVENT: "Por evento",
  PER_HOUR: "Por hora",
};

export const INVENTORY_CATEGORY_LABELS: Record<InventoryCategory, string> = {
  DINNERWARE: "Vajilla",
  GLASSWARE: "Cristalería",
  CUTLERY: "Cubiertos",
  LINENS: "Mantelería",
  DECOR: "Decoración",
  AUDIO: "Audio",
  KARAOKE: "Karaoke",
  FURNITURE: "Mobiliario",
  SERVING: "Servicio",
  OTHER: "Otro",
};

export const INVENTORY_MOVEMENT_LABELS: Record<InventoryMovementType, string> = {
  PURCHASE_IN: "Entrada por compra",
  RESERVE: "Reserva",
  RELEASE: "Liberación",
  CHECK_OUT: "Salida a evento",
  RETURN: "Regreso de evento",
  MAINTENANCE_OUT: "A mantenimiento",
  MAINTENANCE_IN: "De mantenimiento",
  LOSS: "Pérdida / rotura",
  ADJUSTMENT: "Ajuste",
};

export const INVENTORY_RESERVATION_LABELS: Record<InventoryReservationStatus, string> = {
  RESERVED: "Reservado",
  CHECKED_OUT: "En evento",
  RETURNED: "Devuelto",
  CANCELLED: "Cancelado",
};

export const VENDOR_CATEGORY_LABELS: Record<VendorCategory, string> = {
  FLOWERS: "Flores",
  FOOD: "Alimentos",
  PASTRY: "Repostería",
  TRANSPORT: "Transporte",
  FURNITURE: "Mobiliario",
  PHOTO: "Foto",
  BEVERAGES: "Bebidas",
  OTHER: "Otro",
};

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  BLOCKED: "Bloqueado",
};

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  REQUESTED: "Solicitada",
  ORDERED: "Ordenada",
  RECEIVED: "Recibida",
  CANCELLED: "Cancelada",
};
export const PURCHASE_STATUS_TONES: Record<PurchaseStatus, Tone> = {
  REQUESTED: "warning",
  ORDERED: "info",
  RECEIVED: "success",
  CANCELLED: "muted",
};

export const AVAILABILITY_EXCEPTION_LABELS: Record<AvailabilityExceptionType, string> = {
  BLOCKED: "Bloqueado",
  BLACKOUT: "Blackout",
  CAPACITY_OVERRIDE: "Capacidad especial",
};

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  LEAD_RECEIVED: "Lead recibido",
  QUOTE_SENT: "Cotización enviada",
  QUOTE_EXPIRING: "Cotización por vencer",
  QUOTE_ACCEPTED: "Cotización aceptada",
  PAYMENT_DUE: "Pago pendiente",
  PAYMENT_RECEIVED: "Pago recibido",
  BOOKING_CONFIRMED: "Reserva confirmada",
  RSVP_REMINDER: "Recordatorio RSVP",
  EVENT_7D: "Evento en 7 días",
  EVENT_48H: "Evento en 48 h",
  POST_EVENT: "Post-evento",
  REVIEW_REQUEST: "Solicitud de reseña",
  PORTAL_ACCESS: "Acceso al portal",
  STAFF_ASSIGNED: "Asignación de staff",
  GENERIC: "General",
};

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
};

export const NOTIFICATION_STATUS_LABELS: Record<NotificationStatus, string> = {
  QUEUED: "En cola",
  SENT: "Enviado",
  MOCKED: "Simulado",
  FAILED: "Fallido",
  SKIPPED: "Omitido",
};

export const WEEKDAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const WEEKDAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** Convierte un mapa de etiquetas en opciones para <Select>. */
export function toOptions<K extends string>(labels: Record<K, string>): Array<{ value: K; label: string }> {
  return (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }));
}
