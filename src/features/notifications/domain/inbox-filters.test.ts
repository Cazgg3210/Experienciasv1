import { describe, expect, it } from "vitest";
import { hasInboxFilters, inboxHref, parseInboxFilters, previewText } from "./inbox-filters";
import { renderNotification } from "./templates";

describe("parseInboxFilters", () => {
  it("acepta sólo valores válidos", () => {
    const f = parseInboxFilters({
      channel: "WHATSAPP",
      type: "RSVP_REMINDER",
      status: "MOCKED",
      q: "  sofia ",
      unread: "1",
      id: "cmup3h2ju00afqmp8m9f3aduw",
    });
    expect(f).toEqual({
      channel: "WHATSAPP",
      type: "RSVP_REMINDER",
      status: "MOCKED",
      q: "sofia",
      unread: true,
      id: "cmup3h2ju00afqmp8m9f3aduw",
    });
  });

  it("descarta valores inválidos o maliciosos", () => {
    const f = parseInboxFilters({ channel: "SMS", type: "DROP TABLE", status: ["x"], unread: "yes", id: "../../etc" });
    expect(f).toEqual({ channel: undefined, type: undefined, status: undefined, q: undefined, unread: false, id: undefined });
    expect(hasInboxFilters(f)).toBe(false);
  });

  it("limita la búsqueda a 100 caracteres", () => {
    expect(parseInboxFilters({ q: "a".repeat(300) }).q).toHaveLength(100);
  });
});

describe("inboxHref", () => {
  it("conserva filtros y permite seleccionar/deseleccionar un mensaje", () => {
    const f = parseInboxFilters({ channel: "EMAIL", unread: "1", id: "cmup3h2ju00afqmp8m9f3aduw" });
    expect(inboxHref("/admin/notifications", f, { id: "abcdefghijklmnop" })).toBe(
      "/admin/notifications?channel=EMAIL&unread=1&id=abcdefghijklmnop",
    );
    expect(inboxHref("/admin/notifications", f, { id: null, page: 2 })).toBe(
      "/admin/notifications?channel=EMAIL&unread=1&page=2",
    );
    expect(inboxHref("/admin/notifications", parseInboxFilters({}))).toBe("/admin/notifications");
  });
});

describe("previewText", () => {
  it("compacta espacios y recorta", () => {
    expect(previewText("Hola\n\nmundo")).toBe("Hola mundo");
    expect(previewText("x".repeat(200), 10)).toBe(`${"x".repeat(10)}…`);
  });
});

describe("plantillas (extensiones compatibles)", () => {
  it("EVENT_7D usa los días restantes si se indican", () => {
    expect(renderNotification("EVENT_7D", { eventTitle: "Cumple", daysLeft: 5 }).subject).toBe("¡Faltan 5 días!");
    expect(renderNotification("EVENT_7D", { eventTitle: "Cumple" }).subject).toBe("¡Falta una semana!");
    expect(renderNotification("EVENT_7D", { eventTitle: "Cumple" }).text).toContain("en 7 días");
  });

  it("POST_EVENT permite mensaje y CTA alternativos", () => {
    const r = renderNotification("POST_EVENT", {
      message: "Pronto compartiremos las fotos.",
      ctaLabel: "Ver mi evento",
      url: "https://x.test/mi-evento/abc",
    });
    expect(r.text).toContain("Pronto compartiremos las fotos.");
    expect(r.text).toContain("Ver mi evento: https://x.test/mi-evento/abc");
    expect(r.html).toContain("Ver mi evento");
    const def = renderNotification("POST_EVENT", { url: "https://x.test/memory/abc" });
    expect(def.text).toContain("Memory Capsule");
    expect(def.text).toContain("Ver Memory Capsule: https://x.test/memory/abc");
  });

  it("escapa HTML en el correo", () => {
    const r = renderNotification("GENERIC", { message: "<script>alert(1)</script>" });
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("&lt;script&gt;");
  });
});
