/**
 * Tipos públicos del configurador (seguros para el cliente: sin costos ni márgenes).
 */
import type { AddOnCategory, DietaryRestriction, ExperienceType, MenuCourse, Occasion } from "@prisma/client";
import type { AvailabilityStatus } from "@/features/bookings/domain/availability";

export type CatalogExperience = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  type: ExperienceType;
  occasions: Occasion[];
  basePriceCents: number;
  baseGuests: number;
  minGuests: number;
  maxGuests: number;
  durationMinutes: number;
  coverImageUrl: string | null;
  featured: boolean;
  sortOrder: number;
  styleIds: string[];
  menuIds: string[];
  addOnIds: string[];
  areaIds: string[];
};

export type CatalogStyle = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  palette: string[];
  imageUrl: string | null;
};

export type CatalogArea = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logisticsFeeCents: number;
  active: boolean;
};

export type CatalogMenu = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  pricingType: "INCLUDED" | "PER_GUEST" | "FLAT";
  priceCents: number;
  tags: string[];
  dietaryTags: DietaryRestriction[];
  items: Array<{ name: string; course: MenuCourse }>;
  itemCount: number;
};

export type CatalogAddOn = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: AddOnCategory;
  pricingType: "FLAT" | "PER_GUEST";
  priceCents: number;
  maxQuantity: number;
  leadTimeDays: number;
  imageUrl: string | null;
};

export type CatalogBudgetRange = {
  id: string;
  label: string;
  minCents: number;
  maxCents: number | null;
};

export type ConfiguratorSettings = {
  minStandardGuests: number;
  maxStandardGuests: number;
  pricesIncludeTax: boolean;
  taxRateBps: number;
  depositBps: number;
  defaultStartTime: string;
  minLeadDays: number;
  maxAdvanceDays: number;
};

export type ConfiguratorCatalog = {
  experiences: CatalogExperience[];
  styles: CatalogStyle[];
  areas: CatalogArea[];
  menus: CatalogMenu[];
  addOns: CatalogAddOn[];
  budgetRanges: CatalogBudgetRange[];
  settings: ConfiguratorSettings;
};

/** Día del calendario público (sin datos de otros eventos más allá de la capacidad). */
export type CalendarDay = {
  date: string;
  status: AvailabilityStatus;
  acceptsRequests: boolean;
  remaining: number;
};

/** Estimado público (espejo de publicEstimate en servidor). */
export type ConfiguratorEstimate = {
  pricingVersion: string;
  guestCount: number;
  extraGuests: number;
  lines: Array<{
    type: string;
    description: string;
    quantity: number;
    unitPriceCents: number;
    totalPriceCents: number;
  }>;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  depositCents: number;
  warnings: string[];
};

export type SubmitConfiguratorPublicResult = {
  code: string;
  firstName: string;
  whatsappUrl: string;
  outOfArea: boolean;
  specialRequest: boolean;
  availabilityStatus: AvailabilityStatus;
  totalCents: number;
};
