/**
 * Constantes del AI Experience Designer (seguras para cliente y servidor: sin I/O).
 */

/** Versión del prompt/plantillas. Se persiste en AiDesign.promptVersion. */
export const PROMPT_VERSION = "ai-designer.v1";

/** Valor especial de ubicación cuando la zona no está en el catálogo de zonas. */
export const OTHER_AREA = "otra";

/** Valor especial de presupuesto cuando la clienta aún no lo tiene definido. */
export const BUDGET_UNKNOWN = "sin-definir";

export const MIN_GUESTS = 6;
export const MAX_GUESTS = 40;
export const MAX_COLORS = 5;
export const MAX_VIBES = 4;

export const OCCASION_VALUES = [
  "BIRTHDAY",
  "FRIENDS_BRUNCH",
  "BACHELORETTE",
  "BRIDAL",
  "BABY_BRUNCH",
  "GATHERING",
  "CORPORATE",
  "OTHER",
] as const;
export type DesignerOccasion = (typeof OCCASION_VALUES)[number];

export const DIETARY_VALUES = [
  "VEGETARIAN",
  "VEGAN",
  "GLUTEN_FREE",
  "LACTOSE_FREE",
  "NUT_ALLERGY",
  "SEAFOOD_ALLERGY",
  "KOSHER",
  "HALAL",
  "OTHER",
] as const;
export type DesignerDietary = (typeof DIETARY_VALUES)[number];

export const VIBE_VALUES = [
  "relajado",
  "glam",
  "divertido",
  "intimo",
  "botanico",
  "romantico",
  "minimal",
  "fiestero",
  "cultural",
] as const;
export type Vibe = (typeof VIBE_VALUES)[number];

export const VIBE_LABELS: Record<Vibe, string> = {
  relajado: "Relajado",
  glam: "Glam",
  divertido: "Divertido",
  intimo: "Íntimo",
  botanico: "Botánico",
  romantico: "Romántico",
  minimal: "Minimal",
  fiestero: "Fiestero",
  cultural: "Cultural",
};

/** Colores sugeridos (chips) en el formulario. */
export const COLOR_PRESETS: ReadonlyArray<{ name: string; hex: string }> = [
  { name: "Blush", hex: "#E9C9BE" },
  { name: "Salvia", hex: "#A3B18A" },
  { name: "Arena", hex: "#E8DCC8" },
  { name: "Marfil", hex: "#F7F3EC" },
  { name: "Dorado", hex: "#C6A15B" },
  { name: "Terracota", hex: "#C8664B" },
  { name: "Durazno", hex: "#F4B6A6" },
  { name: "Mantequilla", hex: "#F6D27A" },
  { name: "Menta", hex: "#A8D5C2" },
  { name: "Azul cielo", hex: "#8FB3E0" },
  { name: "Lavanda", hex: "#B9A7D6" },
  { name: "Fucsia", hex: "#D6336C" },
  { name: "Vino", hex: "#7B2D3A" },
  { name: "Oliva", hex: "#5C6B4E" },
  { name: "Blanco", hex: "#FFFFFF" },
  { name: "Carbón", hex: "#2F2C2A" },
];
