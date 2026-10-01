import { describe, expect, it } from "vitest";
import { deepEqual, diffJson, formatDiffValue } from "./diff";
import { auditActionLabel, auditActionTone, hasActiveFilters, parseAuditFilters } from "./filters";

describe("diffJson", () => {
  it("detecta cambios, altas y bajas anidadas", () => {
    const before = { taxRateBps: 1600, nested: { a: 1, b: 2 }, gone: true, list: [1, 2] };
    const after = { taxRateBps: 800, nested: { a: 1, c: 3 }, list: [1, 2], added: "x" };
    expect(diffJson(before, after)).toEqual([
      { path: "added", kind: "added", after: "x" },
      { path: "gone", kind: "removed", before: true },
      { path: "nested.b", kind: "removed", before: 2 },
      { path: "nested.c", kind: "added", after: 3 },
      { path: "taxRateBps", kind: "changed", before: 1600, after: 800 },
    ]);
  });

  it("creación y eliminación completas", () => {
    expect(diffJson(null, { role: "STAFF" })).toEqual([{ path: "role", kind: "added", after: "STAFF" }]);
    expect(diffJson({ role: "STAFF" }, null)).toEqual([{ path: "role", kind: "removed", before: "STAFF" }]);
    expect(diffJson(null, null)).toEqual([]);
  });

  it("arreglos y primitivos se comparan completos", () => {
    expect(diffJson({ l: [1, 2] }, { l: [1, 3] })).toEqual([{ path: "l", kind: "changed", before: [1, 2], after: [1, 3] }]);
    expect(diffJson(1, 2)).toEqual([{ path: "(valor)", kind: "changed", before: 1, after: 2 }]);
  });

  it("deepEqual", () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
  });

  it("formatDiffValue", () => {
    expect(formatDiffValue("hola")).toBe('"hola"');
    expect(formatDiffValue(null)).toBe("null");
    expect(formatDiffValue(undefined)).toBe("—");
    expect(formatDiffValue({ a: 1 })).toBe('{"a":1}');
    expect(formatDiffValue("x".repeat(500), 10)).toBe(`"${"x".repeat(10)}…"`);
  });
});

describe("filtros de auditoría", () => {
  it("valida y normaliza", () => {
    const f = parseAuditFilters({
      action: "settings.pricing_changed",
      entityType: "Setting",
      actor: "system",
      from: "2026-10-05",
      to: "2026-10-01",
      entityId: "pricing",
    });
    expect(f).toEqual({
      action: "settings.pricing_changed",
      entityType: "Setting",
      actor: "system",
      entityId: "pricing",
      from: "2026-10-01",
      to: "2026-10-05",
    });
    expect(hasActiveFilters(f)).toBe(true);
  });

  it("descarta entradas inválidas", () => {
    const f = parseAuditFilters({ action: "a b; drop", actor: "<x>", from: "2026-13-40", to: "ayer" });
    expect(f).toEqual({ action: undefined, entityType: undefined, actor: undefined, entityId: undefined, from: undefined, to: undefined });
    expect(hasActiveFilters(f)).toBe(false);
  });

  it("etiquetas y tonos", () => {
    expect(auditActionLabel("user.role_changed")).toBe("Cambio de rol");
    expect(auditActionLabel("custom.thing")).toBe("custom.thing");
    expect(auditActionTone("media.deleted")).toBe("danger");
    expect(auditActionTone("settings.pricing_changed")).toBe("warning");
    expect(auditActionTone("user.created")).toBe("brand");
  });
});
