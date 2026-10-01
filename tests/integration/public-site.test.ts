import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays } from "date-fns";
import { prisma } from "@/db";
import { localDateKey, toDateKey } from "@/lib/dates";
import { contactFormSchema } from "@/features/marketing/schemas";
import { submitContactRequest } from "@/features/marketing/server/contact-service";
import { recordClientEvent } from "@/features/marketing/server/analytics-service";
import {
  loadCatalog,
  loadCatalogFacets,
  loadExperienceDetail,
  loadGalleryImages,
  loadGeneralFaqs,
  loadRelatedExperiences,
  loadSitemapExperiences,
  loadTestimonials,
} from "@/features/marketing/server/queries";
import { parseCatalogFilters } from "@/features/marketing/domain/catalog-filters";
import { uid } from "./helpers";

/**
 * Sitio público: formulario de contacto → lead CONTACT_FORM, catálogo con filtros,
 * detalle de experiencia, contenido administrable y beacon de analítica.
 * Fixtures propios con valores únicos (no depende del seed ni trunca tablas).
 */

const run = uid("ps");
/** Teléfono único por corrida (lead-intake reutiliza clientas por teléfono). */
const uniquePhone = () => `55${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
const styleSlug = `estilo-${run}`;
const otherStyleSlug = `otro-${run}`;
const ids: { experiences: string[]; styles: string[]; menus: string[]; addOns: string[]; faqs: string[]; testimonials: string[]; media: string[] } = {
  experiences: [],
  styles: [],
  menus: [],
  addOns: [],
  faqs: [],
  testimonials: [],
  media: [],
};

let brunchId = "";
let themedId = "";
let inactiveId = "";

beforeAll(async () => {
  const style = await prisma.style.create({ data: { name: `Estilo ${run}`, slug: styleSlug, palette: ["#ffffff"] } });
  const otherStyle = await prisma.style.create({ data: { name: `Otro ${run}`, slug: otherStyleSlug, palette: ["#000000"] } });
  ids.styles.push(style.id, otherStyle.id);

  const menuActive = await prisma.menu.create({
    data: { name: `Menú activo ${run}`, slug: `menu-a-${run}`, dietaryTags: ["VEGETARIAN", "GLUTEN_FREE"], pricingType: "PER_GUEST", priceCents: 12_000 },
  });
  const menuInactive = await prisma.menu.create({ data: { name: `Menú inactivo ${run}`, slug: `menu-i-${run}`, active: false } });
  ids.menus.push(menuActive.id, menuInactive.id);

  const addOn = await prisma.addOn.create({
    data: { name: `Mimosa bar ${run}`, slug: `addon-${run}`, priceCents: 18_000, pricingType: "PER_GUEST" },
  });
  const addOnInactive = await prisma.addOn.create({ data: { name: `Add-on inactivo ${run}`, slug: `addon-i-${run}`, priceCents: 1000, active: false } });
  ids.addOns.push(addOn.id, addOnInactive.id);

  const image = await prisma.mediaAsset.create({
    data: {
      driver: "EXTERNAL",
      url: "/images/placeholders/mimosas.svg",
      mimeType: "image/svg+xml",
      visibility: "PUBLIC",
      purpose: "EXPERIENCE",
      alt: `Mimosas ${run}`,
    },
  });
  // Imagen PRIVADA ligada a la experiencia (p. ej. foto de un evento): nunca debe salir en el sitio
  const privateImage = await prisma.mediaAsset.create({
    data: {
      driver: "EXTERNAL",
      url: `/images/placeholders/gallery-04.svg?private-${run}`,
      mimeType: "image/svg+xml",
      visibility: "PRIVATE",
      purpose: "EVENT",
      alt: `Privada ${run}`,
    },
  });
  ids.media.push(image.id, privateImage.id);

  const brunch = await prisma.experience.create({
    data: {
      name: `Brunch ${run}`,
      slug: `brunch-${run}`,
      tagline: "Tagline de prueba",
      description: "Párrafo uno.\n\nPárrafo dos.",
      type: "BRUNCH",
      occasions: ["BIRTHDAY", "FRIENDS_BRUNCH"],
      basePriceCents: 1_490_000,
      extraGuestPriceCents: 150_000,
      minGuests: 6,
      maxGuests: 12,
      includes: ["Montaje", "Desmontaje"],
      coverImageUrl: null,
      featured: true,
      sortOrder: 1,
      styles: { connect: [{ id: style.id }] },
      menus: { connect: [{ id: menuActive.id }, { id: menuInactive.id }] },
      addOns: { connect: [{ id: addOn.id }, { id: addOnInactive.id }] },
      images: {
        create: [
          { mediaAssetId: privateImage.id, sortOrder: 0 },
          { mediaAssetId: image.id, sortOrder: 1 },
        ],
      },
      faqs: {
        create: [
          { question: `¿Pregunta activa ${run}?`, answer: "Sí.", sortOrder: 1 },
          { question: `¿Pregunta inactiva ${run}?`, answer: "No.", sortOrder: 2, active: false },
        ],
      },
    },
  });
  const themed = await prisma.experience.create({
    data: {
      name: `Karaoke ${run}`,
      slug: `karaoke-${run}`,
      description: "Temática",
      type: "THEMED",
      occasions: ["BACHELORETTE"],
      basePriceCents: 1_790_000,
      minGuests: 8,
      maxGuests: 10,
      coverImageUrl: "/images/placeholders/karaoke.svg",
      sortOrder: 2,
      styles: { connect: [{ id: style.id }, { id: otherStyle.id }] },
    },
  });
  const inactive = await prisma.experience.create({
    data: {
      name: `Inactiva ${run}`,
      slug: `inactiva-${run}`,
      description: "No debe mostrarse",
      type: "BRUNCH",
      occasions: ["BIRTHDAY"],
      basePriceCents: 1_000_000,
      active: false,
      styles: { connect: [{ id: style.id }] },
    },
  });
  brunchId = brunch.id;
  themedId = themed.id;
  inactiveId = inactive.id;
  ids.experiences.push(brunch.id, themed.id, inactive.id);
});

afterAll(async () => {
  // Limpieza de fixtures propios (sólo ids creados por esta prueba)
  await prisma.analyticsEvent.deleteMany({ where: { experienceId: { in: ids.experiences } } });
  await prisma.experience.deleteMany({ where: { id: { in: ids.experiences } } });
  await prisma.menu.deleteMany({ where: { id: { in: ids.menus } } });
  await prisma.addOn.deleteMany({ where: { id: { in: ids.addOns } } });
  await prisma.style.deleteMany({ where: { id: { in: ids.styles } } });
  await prisma.mediaAsset.deleteMany({ where: { id: { in: ids.media } } });
  await prisma.faq.deleteMany({ where: { id: { in: ids.faqs } } });
  await prisma.testimonial.deleteMany({ where: { id: { in: ids.testimonials } } });
});

describe("formulario de contacto → lead CONTACT_FORM", () => {
  it("crea lead con source CONTACT_FORM, clienta, mensaje en notas y timeline", async () => {
    const email = `contacto.${run}@example.com`;
    const phone = uniquePhone();
    const eventDate = localDateKey(addDays(new Date(), 30));
    const input = contactFormSchema.parse({
      name: "Valeria Contacto",
      phone: `${phone.slice(0, 2)} ${phone.slice(2, 6)} ${phone.slice(6)}`,
      email: email.toUpperCase(),
      occasion: "BRIDAL",
      eventDate,
      message: "Quiero un bridal brunch para 10 amigas en Granada.",
      consent: true,
      website: "",
      sessionId: `sess_${run}`,
    });

    const result = await submitContactRequest(input);
    expect(result.leadId).toBeTruthy();
    expect(result.code).toMatch(/^L-\d{4}-[A-Z0-9]{4}$/);

    const lead = await prisma.lead.findUniqueOrThrow({
      where: { id: result.leadId! },
      include: { customer: true, activities: true },
    });
    expect(lead.source).toBe("CONTACT_FORM");
    expect(lead.status).toBe("NEW");
    expect(lead.code).toBe(result.code);
    expect(lead.email).toBe(email);
    expect(lead.phone).toBe(phone);
    expect(lead.occasion).toBe("BRIDAL");
    expect(lead.notes).toBe("Quiero un bridal brunch para 10 amigas en Granada.");
    expect(lead.eventDate && toDateKey(lead.eventDate)).toBe(eventDate);
    expect(lead.customer?.email).toBe(email);
    expect(lead.customer?.source).toBe("CONTACT_FORM");
    expect(lead.activities.some((a) => a.type === "CREATED")).toBe(true);

    const analytics = await prisma.analyticsEvent.findFirst({ where: { type: "SUBMIT_LEAD", leadId: lead.id } });
    expect(analytics?.sessionId).toBe(`sess_${run}`);
  });

  it("reutiliza a la clienta existente si vuelve a escribir con el mismo correo", async () => {
    const email = `repite.${run}@example.com`;
    const base = {
      name: "Repite",
      phone: uniquePhone(),
      email,
      occasion: "BIRTHDAY" as const,
      message: "Primer mensaje de prueba",
      consent: true,
    };
    const a = await submitContactRequest(contactFormSchema.parse(base));
    const b = await submitContactRequest(contactFormSchema.parse({ ...base, message: "Segundo mensaje de prueba" }));
    const leads = await prisma.lead.findMany({ where: { id: { in: [a.leadId!, b.leadId!] } } });
    expect(leads).toHaveLength(2);
    expect(new Set(leads.map((l) => l.customerId)).size).toBe(1);
  });

  it("honeypot: responde con folio pero NO crea lead", async () => {
    const email = `bot.${run}@example.com`;
    const input = contactFormSchema.parse({
      name: "Bot",
      phone: uniquePhone(),
      email,
      occasion: "OTHER",
      message: "Compra seguidores baratos",
      consent: true,
      website: "http://spam.example",
    });
    const result = await submitContactRequest(input);
    expect(result.leadId).toBeNull();
    expect(result.code).toMatch(/^L-/);
    expect(await prisma.lead.count({ where: { email } })).toBe(0);
    expect(await prisma.customer.count({ where: { email } })).toBe(0);
  });
});

describe("catálogo público con filtros", () => {
  const inStyle = (filters: Record<string, string>) => parseCatalogFilters({ estilo: styleSlug, ...filters });

  it("sólo muestra experiencias activas del estilo, destacadas primero", async () => {
    const list = await loadCatalog(inStyle({}));
    expect(list.map((e) => e.id)).toEqual([brunchId, themedId]);
    expect(list.some((e) => e.id === inactiveId)).toBe(false);
  });

  it("filtra por tipo y ocasión (slugs en español)", async () => {
    expect((await loadCatalog(inStyle({ tipo: "tematica" }))).map((e) => e.id)).toEqual([themedId]);
    expect((await loadCatalog(inStyle({ ocasion: "cumpleanos" }))).map((e) => e.id)).toEqual([brunchId]);
    expect(await loadCatalog(inStyle({ ocasion: "corporativo" }))).toEqual([]);
  });

  it("filtra por personas: minGuests ≤ n ≤ maxGuests; > 12 es consulta especial", async () => {
    expect((await loadCatalog(inStyle({ personas: "6" }))).map((e) => e.id)).toEqual([brunchId]);
    expect((await loadCatalog(inStyle({ personas: "9" }))).map((e) => e.id)).toEqual([brunchId, themedId]);
    expect((await loadCatalog(inStyle({ personas: "11" }))).map((e) => e.id)).toEqual([brunchId]);
    // 20 personas: se muestran todas las que admiten el mínimo (propuesta especial)
    expect((await loadCatalog(inStyle({ personas: "20" }))).map((e) => e.id)).toEqual([brunchId, themedId]);
    expect(await loadCatalog(inStyle({ personas: "3" }))).toEqual([]);
  });

  it("estilo desconocido no devuelve nada; otro estilo filtra correctamente", async () => {
    expect(await loadCatalog(parseCatalogFilters({ estilo: `nada-${run}` }))).toEqual([]);
    expect((await loadCatalog(parseCatalogFilters({ estilo: otherStyleSlug }))).map((e) => e.id)).toEqual([themedId]);
  });

  it("tarjetas: portada de coverImageUrl o primera imagen de la galería", async () => {
    const [brunch, themed] = await loadCatalog(inStyle({}));
    expect(brunch!.cover.src).toBe("/images/placeholders/mimosas.svg");
    expect(themed!.cover.src).toBe("/images/placeholders/karaoke.svg");
    expect(brunch).not.toHaveProperty("extraGuestCostCents");
  });

  it("facetas incluyen los estilos activos con experiencias", async () => {
    const facets = await loadCatalogFacets();
    expect(facets.styles.some((s) => s.slug === styleSlug)).toBe(true);
    expect(facets.types).toEqual(expect.arrayContaining(["BRUNCH", "THEMED"]));
  });
});

describe("detalle de experiencia", () => {
  it("devuelve sólo menús, add-ons y FAQs activos; sin costos internos", async () => {
    const d = await loadExperienceDetail(`brunch-${run}`);
    expect(d).not.toBeNull();
    expect(d!.menus.map((m) => m.name)).toEqual([`Menú activo ${run}`]);
    expect(d!.menus[0]!.dietaryTags).toEqual(["VEGETARIAN", "GLUTEN_FREE"]);
    expect(d!.addOns.map((a) => a.name)).toEqual([`Mimosa bar ${run}`]);
    expect(d!.addOns[0]).not.toHaveProperty("costCents");
    expect(d!.faqs.map((f) => f.question)).toEqual([`¿Pregunta activa ${run}?`]);
    // La imagen PRIVADA (sortOrder 0) se excluye: sólo queda la pública
    expect(d!.images).toHaveLength(1);
    expect(d!.images[0]!.alt).toBe(`Mimosas ${run}`);
    expect(d!.images.some((img) => img.src.includes(`private-${run}`) || img.src.startsWith("/api/media/"))).toBe(false);
    expect(d!.cover.src).toBe("/images/placeholders/mimosas.svg");
    expect(d!.extraGuestPriceCents).toBe(150_000);
    expect(d!.styles.map((s) => s.slug)).toEqual([styleSlug]);
  });

  it("experiencia sin imágenes usa la portada; inactiva o slug inválido → null", async () => {
    const themed = await loadExperienceDetail(`karaoke-${run}`);
    expect(themed!.images).toEqual([expect.objectContaining({ src: "/images/placeholders/karaoke.svg" })]);
    expect(await loadExperienceDetail(`inactiva-${run}`)).toBeNull();
    expect(await loadExperienceDetail("no-existe-" + run)).toBeNull();
    expect(await loadExperienceDetail("../../etc/passwd")).toBeNull();
    expect(await loadExperienceDetail("Mayúsculas")).toBeNull();
  });

  it("relacionadas excluyen la actual y las inactivas", async () => {
    const related = await loadRelatedExperiences({ id: brunchId, type: "BRUNCH", occasions: ["BIRTHDAY"] }, 50);
    expect(related.some((r) => r.id === brunchId)).toBe(false);
    expect(related.some((r) => r.id === inactiveId)).toBe(false);
  });

  it("sitemap incluye activas y excluye inactivas", async () => {
    const sitemap = await loadSitemapExperiences();
    const slugs = sitemap.map((s) => s.slug);
    expect(slugs).toContain(`brunch-${run}`);
    expect(slugs).not.toContain(`inactiva-${run}`);
    expect(() => new Date(sitemap[0]!.updatedAt).toISOString()).not.toThrow();
  });
});

describe("contenido administrable", () => {
  it("FAQ generales: activas y sin experiencia; testimonios activos", async () => {
    const faqActive = await prisma.faq.create({ data: { question: `¿General ${run}?`, answer: "Sí", sortOrder: -1000 } });
    const faqInactive = await prisma.faq.create({ data: { question: `¿Oculta ${run}?`, answer: "No", active: false, sortOrder: -1000 } });
    const tActive = await prisma.testimonial.create({ data: { authorName: `Ana ${run}`, body: "Precioso", sortOrder: -1000 } });
    const tInactive = await prisma.testimonial.create({ data: { authorName: `Oculta ${run}`, body: "x", active: false, sortOrder: -1000 } });
    ids.faqs.push(faqActive.id, faqInactive.id);
    ids.testimonials.push(tActive.id, tInactive.id);

    const faqs = await loadGeneralFaqs(500);
    expect(faqs.some((f) => f.id === faqActive.id)).toBe(true);
    expect(faqs.some((f) => f.id === faqInactive.id)).toBe(false);
    expect(faqs.some((f) => f.question === `¿Pregunta activa ${run}?`)).toBe(false); // FAQ de experiencia
    expect(faqs[0]!.id).toBe(faqActive.id); // orden por sortOrder

    const testimonials = await loadTestimonials(500);
    expect(testimonials.some((t) => t.id === tActive.id)).toBe(true);
    expect(testimonials.some((t) => t.id === tInactive.id)).toBe(false);
  });

  it("galería: sólo GALLERY + PUBLIC + aprobadas, destacadas primero", async () => {
    const featured = await prisma.mediaAsset.create({
      data: { driver: "EXTERNAL", url: `/images/placeholders/gallery-01.svg?${run}`, mimeType: "image/svg+xml", visibility: "PUBLIC", purpose: "GALLERY", featured: true, sortOrder: -1000 },
    });
    const privateOne = await prisma.mediaAsset.create({
      data: { driver: "EXTERNAL", url: `/images/placeholders/gallery-02.svg?${run}`, mimeType: "image/svg+xml", visibility: "PRIVATE", purpose: "GALLERY" },
    });
    const unapproved = await prisma.mediaAsset.create({
      data: { driver: "EXTERNAL", url: `/images/placeholders/gallery-03.svg?${run}`, mimeType: "image/svg+xml", visibility: "PUBLIC", purpose: "GALLERY", approved: false },
    });
    ids.media.push(featured.id, privateOne.id, unapproved.id);

    const gallery = await loadGalleryImages(500);
    const srcs = gallery.map((g) => g.src);
    expect(srcs[0]).toBe(`/images/placeholders/gallery-01.svg?${run}`);
    expect(srcs).not.toContain(`/images/placeholders/gallery-02.svg?${run}`);
    expect(srcs).not.toContain(`/images/placeholders/gallery-03.svg?${run}`);
  });
});

describe("analítica del cliente (beacon)", () => {
  it("registra VIEW_EXPERIENCE con path saneado", async () => {
    const res = await recordClientEvent({
      type: "VIEW_EXPERIENCE",
      experienceId: brunchId,
      path: `/experiencias/brunch-${run}?utm_source=ig`,
      sessionId: `sess_${run}`,
    });
    expect(res).toEqual({ ok: true });
    const ev = await prisma.analyticsEvent.findFirst({
      where: { type: "VIEW_EXPERIENCE", experienceId: brunchId, sessionId: `sess_${run}` },
    });
    expect(ev?.path).toBe(`/experiencias/brunch-${run}`);
    expect(ev?.metadata).toMatchObject({ origin: "client" });
  });

  it("rechaza experiencias inexistentes y redacta tokens", async () => {
    expect(await recordClientEvent({ type: "VIEW_EXPERIENCE", experienceId: `noexiste${run}` })).toEqual({
      ok: false,
      reason: "unknown_experience",
    });
    const sessionId = `tok_${run}`;
    await recordClientEvent({ type: "START_CONFIGURATOR", path: "/cotizacion/super-secret-token-123", sessionId });
    const ev = await prisma.analyticsEvent.findFirst({ where: { sessionId } });
    expect(ev?.path).toBe("/cotizacion/[token]");
    await prisma.analyticsEvent.deleteMany({ where: { sessionId } });
  });
});

describe("POST /api/analytics/track", () => {
  const url = "http://localhost:3000/api/analytics/track";
  const post = async (body: unknown, headers: Record<string, string> = { origin: "http://localhost:3000", host: "localhost:3000" }) => {
    const { POST } = await import("@/app/api/analytics/track/route");
    return POST(
      new Request(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    );
  };

  it("rechaza peticiones de otro origen (CSRF)", async () => {
    const res = await post({ type: "VIEW_EXPERIENCE" }, { origin: "https://evil.example", host: "localhost:3000" });
    expect(res.status).toBe(403);
    expect((await post({ type: "VIEW_EXPERIENCE" }, { host: "localhost:3000" })).status).toBe(403);
  });

  it("valida el cuerpo: JSON inválido, tipo no permitido, cuerpo enorme", async () => {
    expect((await post("{no-json")).status).toBe(400);
    expect((await post({ type: "PAYMENT_SUCCESS" })).status).toBe(400);
    expect((await post({ type: "VIEW_EXPERIENCE", path: "x".repeat(5000) })).status).toBe(413);
  });

  it("422 si la experiencia no existe; 204 y registro si es válida", async () => {
    expect((await post({ type: "VIEW_EXPERIENCE", experienceId: `noexiste${run}` })).status).toBe(422);
    const sessionId = `api_${run}`;
    const res = await post({ type: "VIEW_EXPERIENCE", experienceId: themedId, path: `/experiencias/karaoke-${run}`, sessionId });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(await prisma.analyticsEvent.count({ where: { sessionId, experienceId: themedId, type: "VIEW_EXPERIENCE" } })).toBe(1);
  });
});
