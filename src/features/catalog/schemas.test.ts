import { describe, expect, it } from "vitest";
import {
  areaFormSchema,
  budgetFormSchema,
  experienceFormSchema,
  menuFormSchema,
  styleFormSchema,
  type ExperienceFormValues,
} from "./schemas";

const validExperience: ExperienceFormValues = {
  name: "Brunch Floral",
  slug: "brunch-floral",
  tagline: "",
  description: "Una mesa llena de flores para celebrar con tus amigas.",
  type: "BRUNCH",
  occasions: ["BIRTHDAY"],
  durationMinutes: 180,
  active: true,
  featured: false,
  sortOrder: 0,
  baseGuests: 6,
  minGuests: 6,
  maxGuests: 12,
  basePriceCents: 11_600_00,
  extraGuestPriceCents: 1_200_00,
  extraGuestCostCents: 450_00,
  costComponents: [{ category: "FLOWERS", description: "Flores", amountCents: 1_500_00, perGuest: false }],
  includes: ["Montaje"],
  coverImageUrl: "/images/placeholders/brunch-table.svg",
  styleIds: [],
  serviceAreaIds: [],
  menuIds: [],
  addOnIds: [],
  inventoryReqs: [],
  faqs: [],
};

function errorPaths(result: { success: boolean; error?: { issues: Array<{ path: Array<string | number> }> } }) {
  return result.success ? [] : (result.error?.issues ?? []).map((i) => i.path.join("."));
}

describe("experienceFormSchema", () => {
  it("accepts a complete experience", () => {
    expect(experienceFormSchema.safeParse(validExperience).success).toBe(true);
  });
  it("validates slug format with a friendly message", () => {
    const res = experienceFormSchema.safeParse({ ...validExperience, slug: "Brunch Floral!" });
    expect(res.success).toBe(false);
    expect(errorPaths(res)).toContain("slug");
  });
  it("rejects non-integer or negative money", () => {
    expect(errorPaths(experienceFormSchema.safeParse({ ...validExperience, basePriceCents: 10.5 }))).toContain("basePriceCents");
    expect(errorPaths(experienceFormSchema.safeParse({ ...validExperience, basePriceCents: -1 }))).toContain("basePriceCents");
    expect(errorPaths(experienceFormSchema.safeParse({ ...validExperience, basePriceCents: null }))).toContain("basePriceCents");
  });
  it("an active experience needs a base price (never 'desde $0')", () => {
    expect(errorPaths(experienceFormSchema.safeParse({ ...validExperience, basePriceCents: 0 }))).toContain("basePriceCents");
    // Inactive drafts may have no price yet
    expect(experienceFormSchema.safeParse({ ...validExperience, active: false, basePriceCents: 0 }).success).toBe(true);
  });
  it("rejects http:// and protocol-relative cover URLs", () => {
    expect(errorPaths(experienceFormSchema.safeParse({ ...validExperience, coverImageUrl: "http://x.com/a.jpg" }))).toContain(
      "coverImageUrl",
    );
    expect(errorPaths(experienceFormSchema.safeParse({ ...validExperience, coverImageUrl: "//x.com/a.jpg" }))).toContain(
      "coverImageUrl",
    );
  });
  it("requires min ≤ base ≤ max guests", () => {
    expect(errorPaths(experienceFormSchema.safeParse({ ...validExperience, minGuests: 13 }))).toContain("minGuests");
    expect(errorPaths(experienceFormSchema.safeParse({ ...validExperience, baseGuests: 20 }))).toContain("baseGuests");
  });
  it("rejects duplicated inventory items", () => {
    const res = experienceFormSchema.safeParse({
      ...validExperience,
      inventoryReqs: [
        { inventoryItemId: "inv1", quantity: 1, perGuest: true },
        { inventoryItemId: "inv1", quantity: 2, perGuest: false },
      ],
    });
    expect(errorPaths(res)).toContain("inventoryReqs.1.inventoryItemId");
  });
  it("rejects unsafe image urls", () => {
    expect(errorPaths(experienceFormSchema.safeParse({ ...validExperience, coverImageUrl: "javascript:alert(1)" }))).toContain(
      "coverImageUrl",
    );
  });
});

describe("other catalog schemas", () => {
  it("validates menu pricing enums", () => {
    const base = {
      name: "Menú",
      slug: "menu",
      description: "",
      pricingType: "PER_GUEST",
      priceCents: 250_00,
      costPerGuestCents: 290_00,
      tags: ["fusión"],
      dietaryTags: ["VEGAN"],
      active: true,
      sortOrder: 0,
    };
    expect(menuFormSchema.safeParse(base).success).toBe(true);
    expect(menuFormSchema.safeParse({ ...base, pricingType: "FREE" }).success).toBe(false);
  });
  it("validates palette hex colors", () => {
    const base = { name: "Jardín", slug: "jardin", description: "", palette: ["#a3b18a"], imageUrl: "", active: true, sortOrder: 0 };
    expect(styleFormSchema.safeParse(base).success).toBe(true);
    expect(styleFormSchema.safeParse({ ...base, palette: ["verde"] }).success).toBe(false);
  });
  it("validates 5-digit postal codes", () => {
    const base = {
      name: "Roma",
      slug: "roma",
      description: "",
      postalCodes: ["06700"],
      logisticsFeeCents: 0,
      logisticsCostCents: 0,
      active: true,
      sortOrder: 0,
    };
    expect(areaFormSchema.safeParse(base).success).toBe(true);
    expect(areaFormSchema.safeParse({ ...base, postalCodes: ["6700"] }).success).toBe(false);
  });
  it("requires budget max to be greater than min", () => {
    const base = { label: "Hasta $15,000", minCents: 0, maxCents: 15_000_00, sortOrder: 0, active: true };
    expect(budgetFormSchema.safeParse(base).success).toBe(true);
    expect(budgetFormSchema.safeParse({ ...base, maxCents: null }).success).toBe(true);
    expect(errorPaths(budgetFormSchema.safeParse({ ...base, minCents: 20_000_00 }))).toContain("maxCents");
  });
});
