/**
 * Diseñador con IA (/crear-experiencia/ai, proveedor mock) — paquete 2 "Venta pública".
 * Genera una propuesta con el catálogo real y la convierte en lead (source AI_DESIGNER).
 */
import type { Page } from "@playwright/test";
import { expect, test, uniq, uniqEmail, uniqPhone } from "../fixtures";
import { addDaysKey } from "../quote-public/_helpers";
import { callAction, failure, findInternalKeys, formatMXN, okData } from "../configurator/_helpers";
import { localDateKey } from "../../../src/lib/dates";

const ROUTE = "/crear-experiencia/ai";

type DesignView = {
  id: string;
  name: string;
  experience: { id: string; name: string };
  menu?: { id: string } | null;
  addOns: Array<{ id: string }>;
  budget: { withinBudget: boolean } | null;
  estimate: { totalCents: number; depositCents: number };
  guestCount: number;
};
type StoredDesign = { view: DesignView; pricing: { totalCents: number } & Record<string, unknown> };

async function generateViaApi(request: Parameters<typeof callAction>[0], baseURL: string, db: import("@prisma/client").PrismaClient, patch: Record<string, unknown> = {}) {
  const area = await db.serviceArea.findFirstOrThrow({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  return callAction<DesignView>(
    request,
    baseURL,
    "generateDesignAction",
    {
      occasion: "BIRTHDAY",
      occasionOther: "",
      profile: "Mi hermana cumple 30, ama el café y las flores.",
      honoreeAge: 30,
      guestCount: 8,
      budgetRangeId: "sin-definir",
      tastes: "Chilaquiles y mimosas",
      colors: ["#A3B18A"],
      vibes: ["relajado"],
      serviceArea: area.id,
      zoneText: "",
      dietary: [],
      ...patch,
    },
    ROUTE,
  );
}

/** Los chips son inputs nativos visualmente ocultos (sr-only) dentro de su <label>: se pulsa el label, como la clienta. */
async function chip(page: Page, role: "radio" | "checkbox", name: string) {
  const input = page.getByRole(role, { name, exact: true });
  await page.locator("label").filter({ has: input }).click();
  await expect(input).toBeChecked();
}

async function fillDesignerForm(page: Page, profile = `Sofi cumple 30, ama el yoga y las flores (${uniq("ref")}).`) {
  await chip(page, "radio", "Cumpleaños");
  await page.getByLabel("Perfil de la homenajeada o del grupo").fill(profile);
  await page.getByRole("spinbutton", { name: "Personas" }).fill("9");
  await chip(page, "radio", "Aún no lo sé");
  await chip(page, "checkbox", "Botánico");
  await page.getByRole("combobox", { name: "Zona" }).click();
  await page.getByRole("option", { name: "Polanco" }).click();
}

test.describe("Diseñador con IA", { tag: ["@module:ai"] }, () => {
  test(
    "[AI-001] generar una propuesta: concepto + estimado del motor real, guardada como AiDesign y medida",
    { tag: ["@P1", "@mobile"] },
    async ({ page, db, request, baseURL, evidence }) => {
      evidence("anonimo", "Formulario del diseñador → Diseñar mi experiencia (IA mock)");
      await page.goto(ROUTE);
      await expect(page.getByRole("button", { name: "Diseñar mi experiencia" })).toBeEnabled();
      const profile = `Sofi cumple 30, ama el yoga y las flores (${uniq("ai001")}).`;
      await fillDesignerForm(page, profile);
      const responsePromise = page.waitForResponse(
        (r) => r.request().method() === "POST" && !!r.request().headers()["next-action"] && r.url().includes(ROUTE),
      );
      await page.getByRole("button", { name: "Diseñar mi experiencia" }).click();
      // Respuesta que recibió el navegador (si Chromium aún la conserva) + misma acción por HTTP (siempre disponible).
      const browserRaw = await (await responsePromise)
        .body()
        .then((b) => b.toString("latin1"))
        .catch(() => "");
      const apiRaw = (await generateViaApi(request, baseURL!, db)).raw;
      for (const raw of [browserRaw, apiRaw]) {
        for (const key of ["estimatedCostCents", "estimatedMarginCents", "marginBps", "costCents", "costBreakdown", "netRevenueCents"]) {
          expect(raw, `la respuesta pública incluye ${key}`).not.toContain(key);
        }
      }
      expect(apiRaw).toContain("\"totalCents\"");
      const article = page.getByRole("article");
      await expect(article.getByRole("heading", { level: 2 })).toBeVisible({ timeout: 30_000 });
      // La propuesta persistida (AiDesign) es la fuente para comparar con lo que ve la clienta.
      const stored = await db.aiDesign.findFirstOrThrow({ where: { input: { path: ["profile"], equals: profile } } });
      const view = (stored.output as unknown as StoredDesign).view;
      const design = { ...view, id: stored.id };
      expect(findInternalKeys((stored.output as unknown as StoredDesign).pricing), "el estimado guardado para el público no lleva costos").toEqual([]);
      await expect(article.getByRole("heading", { level: 2 })).toHaveText(design.name);
      await expect(article).toContainText(formatMXN(design.estimate.totalCents));
      expect(design.guestCount).toBe(9);
      const row = await db.aiDesign.findUniqueOrThrow({ where: { id: design.id } });
      expect(row.leadId).toBeNull();
      expect((row.output as unknown as StoredDesign).pricing.totalCents).toBe(design.estimate.totalCents);
      expect((row.input as { guestCount: number }).guestCount).toBe(9);
      const active = await db.experience.findUnique({ where: { id: design.experience.id } });
      expect(active?.active, "propone una experiencia real y activa").toBe(true);
      await expect
        .poll(() => db.analyticsEvent.count({ where: { type: "AI_DESIGN_GENERATED", metadata: { path: ["aiDesignId"], equals: design.id } } }))
        .toBe(1);
    },
  );

  test(
    "[AI-002] «Quiero esta experiencia» crea un lead AI_DESIGNER ligado al diseño y la fundadora lo ve",
    { tag: ["@P1", "@mobile"] },
    async ({ page, db, rolePage, evidence }) => {
      evidence("anonimo", "Propuesta → diálogo de contacto → solicitud; owner revisa el lead");
      await page.goto(ROUTE);
      await expect(page.getByRole("button", { name: "Diseñar mi experiencia" })).toBeEnabled();
      await fillDesignerForm(page);
      await page.getByRole("button", { name: "Diseñar mi experiencia" }).click();
      const title = page.getByRole("article").getByRole("heading", { level: 2 }).first();
      await expect(title).toBeVisible();
      const designName = (await title.textContent())!.trim();
      await page.getByRole("button", { name: "Quiero esta experiencia" }).click();
      const dialog = page.getByRole("dialog", { name: "¡Hagámosla realidad!" });
      const name = `Renata ${uniq("Ia")}`;
      const phone = uniqPhone();
      const email = uniqEmail("ia");
      await dialog.getByLabel("Tu nombre").fill(name);
      await dialog.getByRole("textbox", { name: "WhatsApp" }).fill(phone);
      await dialog.getByLabel("Email (opcional)").fill(email);
      await dialog.getByLabel("Fecha tentativa (opcional)").fill(addDaysKey(localDateKey(), 45));
      await dialog.getByRole("checkbox", { name: /Acepto que Ivonne & Rosa me contacte/ }).check();
      await dialog.getByRole("button", { name: "Enviar mi solicitud" }).click();
      await expect(page.getByRole("dialog", { name: `¡Listo, ${name.split(" ")[0]}!` })).toBeVisible();

      const lead = await db.lead.findFirstOrThrow({ where: { email }, include: { snapshot: true, aiDesigns: true } });
      await expect(page.getByRole("dialog")).toContainText(lead.code);
      expect(lead).toMatchObject({ source: "AI_DESIGNER", status: "NEW", name, guestCount: 9, occasion: "BIRTHDAY" });
      expect(lead.inspiration).toContain(designName);
      expect(lead.notes).toContain("Propuesta del Diseñador IA");
      expect(lead.aiDesigns).toHaveLength(1);
      expect((lead.snapshot!.data as { aiDesignId: string }).aiDesignId).toBe(lead.aiDesigns[0]!.id);
      expect(lead.estimatedTotalCents).toBeGreaterThan(0);
      await expect
        .poll(() => db.notificationLog.count({ where: { leadId: lead.id, type: "LEAD_RECEIVED" } }))
        .toBe(2);
      await page.getByRole("button", { name: "Cerrar" }).first().click();
      await expect(page.getByRole("button", { name: "Solicitud enviada" })).toBeVisible();
      await expect(page.getByRole("status").filter({ hasText: "¡Solicitud enviada!" })).toContainText(lead.code);

      const owner = await rolePage("owner");
      await owner.goto(`/admin/leads/${lead.id}`);
      await expect(owner.getByRole("heading", { level: 1, name })).toBeVisible();
      await expect(owner.getByText("Diseñador IA").first()).toBeVisible();
    },
  );

  test(
    "[AI-003] el formulario exige ocasión, perfil, presupuesto, vibra y zona (sin generar nada)",
    { tag: ["@P1", "@negative"] },
    async ({ page, evidence }) => {
      evidence("anonimo", "Diseñar sin llenar el formulario");
      await page.goto(ROUTE);
      await expect(page.getByRole("button", { name: "Diseñar mi experiencia" })).toBeEnabled();
      const actions: string[] = [];
      page.on("request", (r) => {
        if (r.method() === "POST" && r.headers()["next-action"]) actions.push(r.url());
      });
      await page.getByRole("button", { name: "Diseñar mi experiencia" }).click();
      for (const msg of [
        "Elige qué vamos a celebrar.",
        "Cuéntanos un poquito de ella o del grupo.",
        "Elige un rango de presupuesto (o «Aún no lo sé»).",
        "Elige al menos una vibra.",
        "Elige la zona.",
      ]) {
        await expect(page.getByText(msg, { exact: true })).toBeVisible();
      }
      expect(actions, "la validación del navegador no llama al diseñador").toEqual([]);
    },
  );

  test(
    "[AI-004] el backend rechaza entradas inválidas del diseñador (invitadas, presupuesto, zona, colores, vibras)",
    { tag: ["@P1", "@negative"] },
    async ({ db, request, baseURL, evidence }) => {
      evidence("anonimo", "generateDesignAction con payloads manipulados");
      const marker = `Perfil negativo ${uniq("ai004")}`;
      const cases: Array<[string, Record<string, unknown>, string]> = [
        ["5 invitadas", { guestCount: 5 }, "guestCount"],
        ["41 invitadas", { guestCount: 41 }, "guestCount"],
        ["presupuesto inexistente", { budgetRangeId: "noexiste" }, "budgetRangeId"],
        ["zona inexistente", { serviceArea: "noexiste" }, "serviceArea"],
        ["color inválido", { colors: ["red; background:url(x)"] }, "colors.0"],
        ["sin vibras", { vibes: [] }, "vibes"],
        ["vibra inventada", { vibes: ["hackeado"] }, "vibes.0"],
        ["otra ocasión sin detalle", { occasion: "OTHER", occasionOther: "" }, "occasionOther"],
        ["perfil enorme", { profile: "x".repeat(241) }, "profile"],
      ];
      for (const [label, patch, field] of cases) {
        const res = failure(await generateViaApi(request, baseURL!, db, { profile: marker, ...patch }));
        expect(res.code, label).toBe("VALIDATION_ERROR");
        expect(Object.keys(res.fieldErrors ?? {}), `${label}: ${JSON.stringify(res.fieldErrors)}`).toContain(field);
      }
      expect(await db.aiDesign.count({ where: { input: { path: ["profile"], equals: marker } } })).toBe(0);
    },
  );

  test(
    "[AI-005] convertir el mismo diseño dos veces devuelve el mismo folio (un solo lead)",
    { tag: ["@P1", "@regression"] },
    async ({ db, request, baseURL, evidence }) => {
      evidence("anonimo", "convertDesignToLeadAction repetido / simultáneo");
      const design = okData(await generateViaApi(request, baseURL!, db));
      const input = { designId: design.id, name: `Doble ${uniq("Ia")}`, phone: uniqPhone(), email: "", eventDate: "", consent: true, marketingOptIn: false };
      const [a, b] = await Promise.all([
        callAction<{ code: string; alreadySubmitted: boolean }>(request, baseURL!, "convertDesignToLeadAction", input, ROUTE),
        callAction<{ code: string; alreadySubmitted: boolean }>(request, baseURL!, "convertDesignToLeadAction", input, ROUTE),
      ]);
      const c = okData(await callAction<{ code: string; alreadySubmitted: boolean }>(request, baseURL!, "convertDesignToLeadAction", input, ROUTE));
      expect(okData(b).code).toBe(okData(a).code);
      expect(c.code).toBe(okData(a).code);
      expect(c.alreadySubmitted).toBe(true);
      expect(await db.lead.count({ where: { aiDesigns: { some: { id: design.id } } } })).toBe(1);
      expect(await db.lead.count({ where: { source: "AI_DESIGNER", name: input.name } })).toBe(1);
    },
  );

  test(
    "[AI-006] convertir con diseño inexistente, fecha pasada, sin consentimiento o teléfono inválido se rechaza sin crear lead",
    { tag: ["@P1", "@negative"] },
    async ({ db, request, baseURL, evidence }) => {
      evidence("anonimo", "convertDesignToLeadAction con datos inválidos");
      const design = okData(await generateViaApi(request, baseURL!, db));
      const base = { designId: design.id, name: `Neg ${uniq("Ia")}`, phone: uniqPhone(), email: "", eventDate: "", consent: true };
      const notFound = failure(await callAction(request, baseURL!, "convertDesignToLeadAction", { ...base, designId: "cnoexiste0000000000000" }, ROUTE));
      expect(notFound.code).toBe("NOT_FOUND");
      const past = failure(await callAction(request, baseURL!, "convertDesignToLeadAction", { ...base, eventDate: addDaysKey(localDateKey(), -2) }, ROUTE));
      expect(past.fieldErrors?.eventDate).toBeTruthy();
      const noConsent = failure(await callAction(request, baseURL!, "convertDesignToLeadAction", { ...base, consent: false }, ROUTE));
      expect(noConsent.code).toBe("VALIDATION_ERROR");
      const badPhone = failure(await callAction(request, baseURL!, "convertDesignToLeadAction", { ...base, phone: "12-34" }, ROUTE));
      expect(badPhone.fieldErrors?.phone).toBeTruthy();
      const badId = failure(await callAction(request, baseURL!, "convertDesignToLeadAction", { ...base, designId: "../../x" }, ROUTE));
      expect(badId.code).toBe("VALIDATION_ERROR");
      expect(await db.lead.count({ where: { name: base.name } })).toBe(0);
      expect((await db.aiDesign.findUniqueOrThrow({ where: { id: design.id } })).leadId).toBeNull();
    },
  );

  test(
    "[AI-007] un diseño de más de 30 días ya no se puede convertir",
    { tag: ["@P2", "@negative"] },
    async ({ db, request, baseURL, evidence }) => {
      evidence("anonimo", "Diseño viejo (createdAt − 31 días)");
      const design = okData(await generateViaApi(request, baseURL!, db));
      await db.aiDesign.update({ where: { id: design.id }, data: { createdAt: new Date(Date.now() - 31 * 86_400_000) } });
      const res = failure(
        await callAction(request, baseURL!, "convertDesignToLeadAction", { designId: design.id, name: "Vieja Propuesta", phone: uniqPhone(), email: "", eventDate: "", consent: true }, ROUTE),
      );
      expect(res.code).toBe("DESIGN_EXPIRED");
      expect((await db.aiDesign.findUniqueOrThrow({ where: { id: design.id } })).leadId).toBeNull();
    },
  );

  test(
    "[AI-008] la propuesta respeta el presupuesto y el número de invitadas pedido (estimado del motor real)",
    { tag: ["@P2"] },
    async ({ db, request, baseURL, evidence }) => {
      evidence("anonimo", "generateDesignAction con presupuesto bajo y 12 invitadas");
      const budget = await db.budgetRange.findFirstOrThrow({ where: { active: true }, orderBy: { minCents: "asc" } });
      const design = okData(await generateViaApi(request, baseURL!, db, { budgetRangeId: budget.id, guestCount: 12 }));
      expect(design.guestCount).toBe(12);
      const est = okData(
        await callAction<{ totalCents: number }>(
          request,
          baseURL!,
          "estimateAction",
          {
            experienceId: design.experience.id,
            guestCount: 12,
            menuId: design.menu?.id ?? null,
            addOns: design.addOns.map((a) => ({ addOnId: a.id, quantity: 1 })),
            serviceAreaId: (await db.serviceArea.findFirstOrThrow({ where: { active: true }, orderBy: { sortOrder: "asc" } })).id,
          },
          "/crear-experiencia",
        ),
      );
      expect(design.estimate.totalCents, "mismo precio que el configurador para la misma selección").toBe(est.totalCents);
      const overBudget = budget.maxCents != null && design.estimate.totalCents > budget.maxCents;
      expect(design.budget?.withinBudget).toBe(!overBudget);
    },
  );
});
