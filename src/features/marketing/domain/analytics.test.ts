import { describe, expect, it } from "vitest";
import { isClientTrackable, sanitizeTrackPath } from "./analytics";

describe("isClientTrackable", () => {
  it("sólo permite los tipos de la lista blanca", () => {
    expect(isClientTrackable("VIEW_EXPERIENCE")).toBe(true);
    expect(isClientTrackable("START_CONFIGURATOR")).toBe(true);
    expect(isClientTrackable("COMPLETE_CONFIGURATOR")).toBe(true);
    expect(isClientTrackable("PAYMENT_SUCCESS")).toBe(false);
    expect(isClientTrackable("SUBMIT_LEAD")).toBe(false);
    expect(isClientTrackable("")).toBe(false);
  });
});

describe("sanitizeTrackPath", () => {
  it("conserva rutas públicas sin query ni hash", () => {
    expect(sanitizeTrackPath("/experiencias/signature-brunch")).toBe("/experiencias/signature-brunch");
    expect(sanitizeTrackPath("/experiencias?tipo=brunch#top")).toBe("/experiencias");
    expect(sanitizeTrackPath("/")).toBe("/");
  });

  it("redacta tokens en rutas privadas", () => {
    expect(sanitizeTrackPath("/cotizacion/abcDEF123_secret-token")).toBe("/cotizacion/[token]");
    expect(sanitizeTrackPath("/e/cumple-sofia/demo-guest-token")).toBe("/e/[token]/[token]");
    expect(sanitizeTrackPath("/mi-evento/xyz?x=1")).toBe("/mi-evento/[token]");
    expect(sanitizeTrackPath("/memory")).toBe("/memory");
  });

  it("rechaza valores que no son paths internos", () => {
    expect(sanitizeTrackPath("https://evil.example/x")).toBeNull();
    expect(sanitizeTrackPath("//evil.example")).toBeNull();
    expect(sanitizeTrackPath("javascript:alert(1)")).toBeNull();
    expect(sanitizeTrackPath("/a<b>")).toBeNull();
    expect(sanitizeTrackPath("")).toBeNull();
    expect(sanitizeTrackPath(null)).toBeNull();
  });

  it("limita la longitud", () => {
    const long = `/${"a".repeat(500)}`;
    expect(sanitizeTrackPath(long)!.length).toBe(300);
  });
});
