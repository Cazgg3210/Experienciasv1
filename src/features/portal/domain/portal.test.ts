import { describe, expect, it } from "vitest";
import {
  buildGuestInvitationText,
  buildInvitationText,
  canEditAddress,
  changedPreferenceKeys,
  countdownParts,
  isPortalEditable,
  isRsvpOpen,
  joinSpanish,
  mapsLink,
  paymentCta,
  preferenceChangeMessage,
  safeExternalUrl,
  type HostPreferences,
} from "./portal";
import { buildMenuView } from "./menu";
import { preferencesFormSchema, reviewFormSchema, addressFormSchema } from "../schemas";

const HOUR = 60 * 60 * 1000;

describe("permisos por estado y fecha", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  it("dirección editable sólo con más de 48 h de anticipación", () => {
    expect(canEditAddress("CONFIRMED", new Date(now.getTime() + 49 * HOUR), now)).toBe(true);
    expect(canEditAddress("CONFIRMED", new Date(now.getTime() + 47 * HOUR), now)).toBe(false);
    expect(canEditAddress("CANCELLED", new Date(now.getTime() + 100 * HOUR), now)).toBe(false);
    expect(canEditAddress("COMPLETED", new Date(now.getTime() + 100 * HOUR), now)).toBe(false);
  });
  it("portal editable salvo cancelado/completado", () => {
    expect(isPortalEditable("PENDING_PAYMENT")).toBe(true);
    expect(isPortalEditable("READY")).toBe(true);
    expect(isPortalEditable("CANCELLED")).toBe(false);
    expect(isPortalEditable("COMPLETED")).toBe(false);
  });
  it("RSVP abierto hasta que termina el evento", () => {
    expect(isRsvpOpen("CONFIRMED", new Date(now.getTime() + HOUR), now)).toBe(true);
    expect(isRsvpOpen("CONFIRMED", new Date(now.getTime() - HOUR), now)).toBe(false);
    expect(isRsvpOpen("CANCELLED", new Date(now.getTime() + HOUR), now)).toBe(false);
  });
});

describe("paymentCta", () => {
  it("anticipo pendiente", () => {
    expect(paymentCta({ status: "PENDING_PAYMENT", totalCents: 1000_00, paidCents: 0, depositRequiredCents: 500_00 })).toEqual({
      kind: "DEPOSIT",
      label: "Pagar anticipo",
      amountCents: 500_00,
    });
  });
  it("saldo pendiente en evento confirmado", () => {
    expect(paymentCta({ status: "CONFIRMED", totalCents: 1000_00, paidCents: 500_00, depositRequiredCents: 500_00 })).toEqual({
      kind: "BALANCE",
      label: "Pagar saldo",
      amountCents: 500_00,
    });
  });
  it("sin CTA si está pagado, cancelado o completado", () => {
    expect(paymentCta({ status: "CONFIRMED", totalCents: 1000_00, paidCents: 1000_00, depositRequiredCents: 500_00 })).toBeNull();
    expect(paymentCta({ status: "CANCELLED", totalCents: 1000_00, paidCents: 0, depositRequiredCents: 500_00 })).toBeNull();
    expect(paymentCta({ status: "COMPLETED", totalCents: 1000_00, paidCents: 0, depositRequiredCents: 500_00 })).toBeNull();
  });
});

describe("countdownParts", () => {
  const start = new Date("2026-10-10T17:00:00Z");
  const end = new Date("2026-10-10T21:00:00Z");
  it("calcula días/horas/minutos", () => {
    const now = new Date(start.getTime() - (2 * 24 * 60 + 3 * 60 + 5) * 60_000);
    expect(countdownParts(start, end, now)).toEqual({ days: 2, hours: 3, minutes: 5, state: "upcoming" });
  });
  it("hoy y pasado", () => {
    expect(countdownParts(start, end, new Date(start.getTime() + HOUR)).state).toBe("today");
    expect(countdownParts(start, end, new Date(end.getTime() + HOUR)).state).toBe("past");
  });
});

describe("textos de invitación", () => {
  const base = {
    hostName: "Sofía Navarro",
    title: "Cumpleaños de Sofía",
    dateLabel: "sábado 10 de octubre de 2026",
    timeLabel: "11:00",
    neighborhood: "Polanco V Sección",
    city: "Ciudad de México",
    url: "https://example.com/e/cumple-sofia/abc",
  };
  it("invitación general incluye fecha, hora, colonia y link", () => {
    const text = buildInvitationText(base);
    expect(text).toContain("Sofía te invita");
    expect(text).toContain("sábado 10 de octubre de 2026 a las 11:00 h en Polanco V Sección, Ciudad de México");
    expect(text).toContain(base.url);
  });
  it("invitación personal saluda a la invitada", () => {
    const text = buildGuestInvitationText({ ...base, guestName: "Camila Torres" });
    expect(text.startsWith("¡Hola, Camila!")).toBe(true);
    expect(text).toContain("enlace personal");
  });
});

describe("cambios de preferencias", () => {
  const before: HostPreferences = {
    colors: ["#E9C9BE"],
    honoreeName: "Sofía",
    customerNotes: null,
    dressCode: null,
    hostMessage: "Hola",
    playlistUrl: null,
  };
  it("detecta campos modificados", () => {
    const after = { ...before, colors: ["#e9c9be"], dressCode: "Blanco", playlistUrl: "https://x.y" };
    expect(changedPreferenceKeys(before, after)).toEqual(["dressCode", "playlistUrl"]);
  });
  it("arma un mensaje legible", () => {
    expect(preferenceChangeMessage(["colors", "hostMessage"])).toBe(
      "La anfitriona actualizó los colores y el mensaje de anfitriona.",
    );
    expect(preferenceChangeMessage([])).toBeNull();
    expect(joinSpanish(["a", "b", "c"])).toBe("a, b y c");
  });
});

describe("mapsLink", () => {
  it("usa el enlace guardado o arma una búsqueda", () => {
    expect(mapsLink({ mapsUrl: "https://maps.app/x" })).toBe("https://maps.app/x");
    expect(mapsLink({ addressLine: "Lope de Vega 214", neighborhood: "Polanco", city: "CDMX" })).toContain(
      "google.com/maps/search",
    );
    expect(mapsLink({ addressLine: null })).toBeNull();
  });
  it("ignora enlaces guardados que no son http(s)", () => {
    expect(mapsLink({ mapsUrl: "javascript:alert(1)", addressLine: "Lope de Vega 214" })).toContain("google.com/maps/search");
    expect(mapsLink({ mapsUrl: "javascript:alert(1)" })).toBeNull();
  });
});

describe("safeExternalUrl", () => {
  it("sólo acepta URLs http(s) absolutas", () => {
    expect(safeExternalUrl(" https://open.spotify.com/playlist/x ")).toBe("https://open.spotify.com/playlist/x");
    expect(safeExternalUrl("http://example.com")).toBe("http://example.com");
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,hola")).toBeNull();
    expect(safeExternalUrl("/relativa")).toBeNull();
    expect(safeExternalUrl("")).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
  });
});

describe("buildMenuView", () => {
  it("agrupa por tiempo en orden", () => {
    const view = buildMenuView({
      name: "Brunch",
      description: null,
      dietaryTags: [],
      items: [
        { id: "1", name: "Pastel", description: null, course: "DESSERT", dietaryTags: [], sortOrder: 0 },
        { id: "2", name: "Café", description: null, course: "DRINK", dietaryTags: [], sortOrder: 0 },
        { id: "3", name: "Chilaquiles", description: null, course: "MAIN", dietaryTags: ["VEGETARIAN"], sortOrder: 0 },
      ],
    });
    expect(view?.courses.map((c) => c.course)).toEqual(["DRINK", "MAIN", "DESSERT"]);
    expect(buildMenuView(null)).toBeNull();
  });
});

describe("schemas del portal", () => {
  it("preferencias: colores hex y playlist URL", () => {
    const ok = {
      colors: ["#E9C9BE"],
      honoreeName: "",
      dressCode: "",
      hostMessage: "",
      customerNotes: "",
      playlistUrl: "https://open.spotify.com/playlist/x",
    };
    expect(preferencesFormSchema.safeParse(ok).success).toBe(true);
    expect(preferencesFormSchema.safeParse({ ...ok, colors: ["rojo"] }).success).toBe(false);
    expect(preferencesFormSchema.safeParse({ ...ok, playlistUrl: "javascript:alert(1)" }).success).toBe(false);
  });
  it("dirección: CP de 5 dígitos", () => {
    const ok = { addressLine: "Lope de Vega 214", neighborhood: "Polanco", postalCode: "11560", addressNotes: "", mapsUrl: "" };
    expect(addressFormSchema.safeParse(ok).success).toBe(true);
    expect(addressFormSchema.safeParse({ ...ok, postalCode: "1156" }).success).toBe(false);
  });
  it("opinión: estrellas 1–5 y NPS 0–10", () => {
    expect(reviewFormSchema.safeParse({ rating: 5, npsScore: 10, comment: "", publishable: true }).success).toBe(true);
    expect(reviewFormSchema.safeParse({ rating: 0, npsScore: null, comment: "", publishable: false }).success).toBe(false);
    expect(reviewFormSchema.safeParse({ rating: 4, npsScore: 11, comment: "", publishable: false }).success).toBe(false);
  });
});
