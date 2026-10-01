import { describe, expect, it } from "vitest";
import {
  buildCustomerShareText,
  buildPublicShareText,
  canAcceptGuestUpload,
  capitalizeFirst,
  CAPSULE_TITLE_MAX,
  defaultCapsuleMessage,
  defaultCapsuleTitle,
  firstName,
  moderationSummary,
  nextIndex,
  normalizeGuestText,
  photoAlt,
  pickCover,
  prevIndex,
  publicMediaFilter,
  wrapIndex,
} from "./capsule";
import { guestbookFormSchema, guestUploadFieldsSchema, guestUploadFormSchema, updateCapsuleSchema } from "../schemas";

const d = (iso: string) => new Date(iso);

describe("títulos y textos", () => {
  it("genera 'Memorias de <evento>' y lo recorta al máximo", () => {
    expect(defaultCapsuleTitle("Cumple de Sofía")).toBe("Memorias de Cumple de Sofía");
    expect(defaultCapsuleTitle("   ")).toBe("Memorias de tu celebración");
    const long = defaultCapsuleTitle("x".repeat(300));
    expect(long.length).toBe(CAPSULE_TITLE_MAX);
    expect(long.endsWith("…")).toBe(true);
  });

  it("mensaje por defecto menciona a la homenajeada si existe", () => {
    expect(defaultCapsuleMessage("Valeria")).toContain("Valeria");
    expect(defaultCapsuleMessage(null)).toContain("Ivonne & Rosa");
  });

  it("capitaliza sólo la primera letra de la fecha", () => {
    expect(capitalizeFirst("jueves 10 de septiembre de 2026")).toBe("Jueves 10 de septiembre de 2026");
    expect(capitalizeFirst("")).toBe("");
  });

  it("primer nombre", () => {
    expect(firstName("Ana Paula Ríos")).toBe("Ana");
    expect(firstName("  ")).toBe("");
    expect(firstName(null)).toBe("");
  });

  it("texto de WhatsApp distingue publicada / en preparación e incluye el enlace", () => {
    const url = "https://example.com/memory/abc";
    const ready = buildCustomerShareText({ customerName: "Valeria Núñez", capsuleTitle: "Memorias", url, published: true });
    expect(ready).toContain("¡Hola, Valeria!");
    expect(ready).toContain("Ya está lista");
    expect(ready).toContain(url);
    const draft = buildCustomerShareText({ customerName: null, capsuleTitle: "Memorias", url, published: false });
    expect(draft.startsWith("¡Hola!")).toBe(true);
    expect(draft).toContain("Estamos preparando");
    expect(buildPublicShareText("Memorias")).toContain("Memorias");
  });
});

describe("normalizeGuestText", () => {
  it("colapsa espacios y quita caracteres de control", () => {
    expect(normalizeGuestText("  Ana \t  María\u0007 ")).toBe("Ana María");
  });
  it("en multilínea conserva saltos (máx. uno en blanco)", () => {
    expect(normalizeGuestText("Hola\r\n\r\n\r\n\r\n  mundo  \n bonito", { multiline: true })).toBe("Hola\n\nmundo\nbonito");
  });
});

describe("canAcceptGuestUpload", () => {
  it("exige cápsula publicada, subidas abiertas y consentimiento", () => {
    expect(canAcceptGuestUpload({ published: false, allowGuestUploads: true }, true)).toEqual({ ok: false, reason: "NOT_PUBLISHED" });
    expect(canAcceptGuestUpload({ published: true, allowGuestUploads: false }, true)).toEqual({ ok: false, reason: "UPLOADS_DISABLED" });
    expect(canAcceptGuestUpload({ published: true, allowGuestUploads: true }, false)).toEqual({ ok: false, reason: "NO_CONSENT" });
    expect(canAcceptGuestUpload({ published: true, allowGuestUploads: true }, true)).toEqual({ ok: true });
  });
});

describe("galería pública", () => {
  const media = [
    { id: "a", kind: "IMAGE" as const, approved: true, sortOrder: 2, createdAt: d("2026-01-02"), featured: false },
    { id: "b", kind: "IMAGE" as const, approved: false, sortOrder: 0, createdAt: d("2026-01-01"), featured: true },
    { id: "c", kind: "DOCUMENT" as const, approved: true, sortOrder: 0, createdAt: d("2026-01-01"), featured: false },
    { id: "d", kind: "IMAGE" as const, approved: true, sortOrder: 1, createdAt: d("2026-01-05"), featured: false },
    { id: "e", kind: "IMAGE" as const, approved: true, sortOrder: 1, createdAt: d("2026-01-03"), featured: true },
  ];

  it("sólo imágenes aprobadas, ordenadas por sortOrder y fecha", () => {
    expect(publicMediaFilter(media).map((m) => m.id)).toEqual(["e", "d", "a"]);
  });

  it("portada: la elegida si es visible; si no, la featured; si no, la primera", () => {
    const visible = publicMediaFilter(media);
    expect(pickCover(visible, "a")?.id).toBe("a");
    expect(pickCover(visible, "b")?.id).toBe("e"); // b está oculta → no se filtra al público
    expect(pickCover(visible, null)?.id).toBe("e");
    expect(pickCover(visible.filter((m) => !m.featured), null)?.id).toBe("d");
    expect(pickCover([], "a")).toBeNull();
  });

  it("navegación circular del lightbox", () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
    expect(prevIndex(0, 3)).toBe(2);
    expect(prevIndex(1, 3)).toBe(0);
    expect(wrapIndex(-7, 3)).toBe(2);
    expect(wrapIndex(5, 0)).toBe(0);
  });

  it("alt accesible con respaldo", () => {
    expect(photoAlt({ alt: "Mesa con flores", index: 0, title: "X" })).toBe("Mesa con flores");
    expect(photoAlt({ alt: " ", uploaderName: "Gaby", index: 1, title: "Memorias" })).toBe(
      "Foto 2 de Memorias, compartida por Gaby",
    );
    expect(photoAlt({ index: 0, title: "Memorias" })).toBe("Foto 1 de Memorias");
  });

  it("resumen de moderación", () => {
    expect(moderationSummary([{ approved: true }, { approved: false }, { approved: true }])).toEqual({
      total: 3,
      approved: 2,
      pending: 1,
    });
  });
});

describe("esquemas", () => {
  it("libro de visitas: nombre y mensaje obligatorios, mensaje ≤ 500", () => {
    expect(guestbookFormSchema.safeParse({ name: "Ana", body: "¡Qué bonito día!" }).success).toBe(true);
    expect(guestbookFormSchema.safeParse({ name: "", body: "Hola" }).success).toBe(false);
    expect(guestbookFormSchema.safeParse({ name: "Ana", body: "x".repeat(501) }).success).toBe(false);
    expect(guestbookFormSchema.safeParse({ name: "Ana", body: "x".repeat(500) }).success).toBe(true);
  });

  it("subida pública: consentimiento debe ser exactamente 'true'", () => {
    expect(guestUploadFieldsSchema.safeParse({ name: "Ana", consent: "true" }).success).toBe(true);
    expect(guestUploadFieldsSchema.safeParse({ name: "Ana", consent: "false" }).success).toBe(false);
    expect(guestUploadFieldsSchema.safeParse({ name: "Ana", consent: "" }).success).toBe(false);
    expect(guestUploadFieldsSchema.safeParse({ name: " ", consent: "true" }).success).toBe(false);
    expect(guestUploadFormSchema.safeParse({ name: "Ana", consent: false }).success).toBe(false);
    expect(guestUploadFormSchema.safeParse({ name: "Ana", consent: true }).success).toBe(true);
  });

  it("ajustes: título mínimo 3 caracteres", () => {
    const base = { capsuleId: "c1", message: "", published: true, allowGuestUploads: false };
    expect(updateCapsuleSchema.safeParse({ ...base, title: "Hi" }).success).toBe(false);
    expect(updateCapsuleSchema.safeParse({ ...base, title: "Memorias de Vale" }).success).toBe(true);
  });
});
