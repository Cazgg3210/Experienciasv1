import type {
  AddOnCategory,
  AddOnPricingType,
  DietaryRestriction,
  ExperienceType,
  MenuPricingType,
  Occasion,
} from "@prisma/client";
import type { EngineSettings } from "@/features/quotes/domain/quote-engine";

/**
 * Catálogo REAL (cargado de la DB) que usa el diseñador. Los precios sólo se usan en
 * servidor para ajustar la propuesta al presupuesto; nunca se envían al LLM.
 */
export type CatalogExperience = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string;
  type: ExperienceType;
  occasions: Occasion[];
  basePriceCents: number;
  baseGuests: number;
  minGuests: number;
  maxGuests: number;
  extraGuestPriceCents: number;
  includes: string[];
  featured: boolean;
  sortOrder: number;
  styleIds: string[];
  menuIds: string[];
  addOnIds: string[];
  serviceAreaIds: string[];
};

export type CatalogMenu = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  pricingType: MenuPricingType;
  priceCents: number;
  tags: string[];
  dietaryTags: DietaryRestriction[];
  itemNames: string[];
  sortOrder: number;
};

export type CatalogAddOn = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: AddOnCategory;
  pricingType: AddOnPricingType;
  priceCents: number;
  maxQuantity: number;
  sortOrder: number;
};

export type CatalogStyle = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  palette: string[];
  sortOrder: number;
};

export type CatalogArea = {
  id: string;
  slug: string;
  name: string;
  logisticsFeeCents: number;
};

export type CatalogBudget = {
  id: string;
  label: string;
  minCents: number;
  maxCents: number | null;
};

export type DesignerCatalog = {
  experiences: CatalogExperience[];
  menus: CatalogMenu[];
  addOns: CatalogAddOn[];
  styles: CatalogStyle[];
  areas: CatalogArea[];
  budgets: CatalogBudget[];
  pricing: EngineSettings;
};

export type PaletteColor = { name: string; hex: string };

/** Propuesta final (ids reales del catálogo + textos). */
export type DesignProposal = {
  name: string;
  concept: string;
  /** 2–3 párrafos */
  description: string[];
  palette: PaletteColor[];
  experienceId: string;
  styleId: string | null;
  menuId: string | null;
  addOnIds: string[];
  activities: string[];
  tableDesign: string;
  playlistVibe: string;
};

/** Selección que se cotiza (ids reales). */
export type DesignSelection = {
  experienceId: string;
  menuId: string | null;
  addOnIds: string[];
};

export type BudgetFit = {
  budget: CatalogBudget | null;
  /** Total aproximado calculado con el QuoteEngine puro (el precio mostrado viene de estimateSelection). */
  estimatedTotalCents: number;
  overBudget: boolean;
  suggestion: string | null;
};

export type RulesDesignResult = {
  design: DesignProposal;
  fit: BudgetFit;
  /** Nota de restricciones alimentarias (cubiertas o adaptadas). */
  dietaryNote: string | null;
};
