/**
 * Seed BASE: upserts idempotentes (crea lo que falte, no pisa cambios hechos desde el admin).
 * Se usa tal cual en producción (`pnpm db:seed:base`) y como primera fase del seed DEMO.
 */
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { settingsSchemas, type SettingsKey } from "../../src/features/settings/domain/settings-schema";
import {
  AVAILABILITY_RULES,
  BUDGET_RANGES,
  CHECKLIST_TEMPLATES,
  SERVICE_AREAS,
  STYLES,
  checklistItemId,
} from "./base-data";
import { json } from "./helpers";

export const BCRYPT_COST = 10;

export async function seedSettings(prisma: PrismaClient): Promise<void> {
  const keys = Object.keys(settingsSchemas) as SettingsKey[];
  for (const key of keys) {
    const value = key === "flags" ? {} : settingsSchemas[key].parse({});
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: json(value) },
      update: {},
    });
  }
}

export async function seedAvailabilityRules(prisma: PrismaClient): Promise<void> {
  for (const rule of AVAILABILITY_RULES) {
    await prisma.availabilityRule.upsert({
      where: { weekday: rule.weekday },
      create: { ...rule, earliestStart: "08:00", latestEnd: "21:00" },
      update: {},
    });
  }
}

export async function seedBudgetRanges(prisma: PrismaClient): Promise<void> {
  for (const [index, range] of BUDGET_RANGES.entries()) {
    await prisma.budgetRange.upsert({
      where: { id: range.id },
      create: { ...range, sortOrder: index + 1, active: true },
      update: {},
    });
  }
}

export async function seedStyles(prisma: PrismaClient): Promise<void> {
  for (const [index, style] of STYLES.entries()) {
    await prisma.style.upsert({
      where: { slug: style.slug },
      create: { ...style, sortOrder: index + 1, active: true },
      update: {},
    });
  }
}

export async function seedServiceAreas(prisma: PrismaClient): Promise<void> {
  for (const [index, area] of SERVICE_AREAS.entries()) {
    await prisma.serviceArea.upsert({
      where: { slug: area.slug },
      create: { ...area, sortOrder: index + 1 },
      update: {},
    });
  }
}

export async function seedChecklistTemplates(prisma: PrismaClient): Promise<void> {
  for (const [tIndex, template] of CHECKLIST_TEMPLATES.entries()) {
    await prisma.checklistTemplate.upsert({
      where: { id: template.id },
      create: {
        id: template.id,
        name: template.name,
        phase: template.phase,
        description: template.description,
        sortOrder: tIndex + 1,
        active: true,
      },
      update: {},
    });
    for (const [index, item] of template.items.entries()) {
      const id = checklistItemId(template.id, index);
      await prisma.checklistTemplateItem.upsert({
        where: { id },
        create: {
          id,
          templateId: template.id,
          title: item.title,
          description: item.description ?? null,
          area: item.area,
          offsetMinutes: item.offsetMinutes,
          defaultFunction: item.defaultFunction,
          requiresEvidence: item.requiresEvidence ?? false,
          sortOrder: index + 1,
        },
        update: {},
      });
    }
  }
}

export type AdminSeedResult = { status: "created" | "exists" | "skipped"; email?: string };

/** SUPER_ADMIN desde SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD. Nunca sobreescribe la contraseña existente. */
export async function seedSuperAdminFromEnv(prisma: PrismaClient): Promise<AdminSeedResult> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn(
      "[seed] AVISO: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD no están definidos: se omite la creación del SUPER_ADMIN.",
    );
    return { status: "skipped" };
  }
  if (password.length < 10) {
    console.warn("[seed] AVISO: SEED_ADMIN_PASSWORD es muy corta (mínimo recomendado: 10 caracteres).");
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "SUPER_ADMIN" || !existing.active) {
      await prisma.user.update({ where: { email }, data: { role: "SUPER_ADMIN", active: true } });
    }
    return { status: "exists", email };
  }
  await prisma.user.create({
    data: {
      email,
      name: process.env.SEED_ADMIN_NAME?.trim() || "Administración",
      role: "SUPER_ADMIN",
      passwordHash: await bcrypt.hash(password, BCRYPT_COST),
      active: true,
    },
  });
  return { status: "created", email };
}

/** Catálogo base (sin usuarios). */
export async function seedBaseCatalog(prisma: PrismaClient): Promise<void> {
  await seedSettings(prisma);
  await seedAvailabilityRules(prisma);
  await seedBudgetRanges(prisma);
  await seedStyles(prisma);
  await seedServiceAreas(prisma);
  await seedChecklistTemplates(prisma);
}
