import type { DesignerOccasion } from "./constants";

/**
 * Tipos de la vista pública de una propuesta (lo que recibe el cliente).
 * Sin costos ni márgenes: el estimado viene de publicEstimate().
 */
export type DesignPaletteColor = { name: string; hex: string };

export type DesignView = {
  id: string;
  name: string;
  concept: string;
  description: string[];
  palette: DesignPaletteColor[];
  activities: string[];
  tableDesign: string;
  playlistVibe: string;
  occasion: DesignerOccasion;
  occasionLabel: string;
  guestCount: number;
  experience: { id: string; slug: string; name: string; tagline: string | null; href: string };
  style: { id: string; name: string } | null;
  menu: { id: string; name: string; description: string | null } | null;
  dietaryNote: string | null;
  addOns: Array<{ id: string; name: string; description: string | null; categoryLabel: string }>;
  estimate: {
    totalCents: number;
    depositCents: number;
    depositPercent: number;
    /** true: los precios ya incluyen IVA; false: el IVA se suma al subtotal (el total siempre lo incluye) */
    taxIncluded: boolean;
    subtotalCents: number;
    discountCents: number;
    taxCents: number;
    lines: Array<{ description: string; totalPriceCents: number }>;
    notes: string[];
    pricingVersion: string;
  };
  budget: { label: string; withinBudget: boolean; suggestion: string | null } | null;
  configuratorHref: string;
};

export type ConvertDesignResult = {
  code: string;
  whatsappUrl: string;
  alreadySubmitted: boolean;
};

export type DesignerPageOptions = {
  budgets: Array<{ id: string; label: string }>;
  areas: Array<{ id: string; name: string }>;
};
