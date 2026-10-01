import { describe, expect, it } from "vitest";
import { buildStorageKey, sniffMime, validateUpload } from "./validation";

const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>");
const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");

describe("media validation", () => {
  it("detecta el tipo real por magic bytes", () => {
    expect(sniffMime(jpg)).toBe("image/jpeg");
    expect(sniffMime(png)).toBe("image/png");
    expect(sniffMime(webp)).toBe("image/webp");
    expect(sniffMime(pdf)).toBe("application/pdf");
  });

  it("rechaza SVG/HTML aunque se renombren como imagen", () => {
    expect(validateUpload(svg, { maxBytes: 1e6 }).ok).toBe(false);
    expect(validateUpload(html, { maxBytes: 1e6 }).ok).toBe(false);
  });

  it("rechaza archivos vacíos o demasiado grandes", () => {
    expect(validateUpload(new Uint8Array(), { maxBytes: 10 }).ok).toBe(false);
    expect(validateUpload(jpg, { maxBytes: 4 }).ok).toBe(false);
  });

  it("restringe por lista permitida", () => {
    const r = validateUpload(pdf, { maxBytes: 1e6, allow: ["image/jpeg", "image/png", "image/webp"] });
    expect(r.ok).toBe(false);
  });

  it("devuelve extensión y tipo", () => {
    const r = validateUpload(png, { maxBytes: 1e6 });
    expect(r).toEqual({ ok: true, mime: "image/png", extension: "png", kind: "IMAGE" });
  });

  it("construye claves seguras sin path traversal", () => {
    const key = buildStorageKey({
      purpose: "MEMORY",
      scopeId: "../../etc",
      randomId: "abc/../x",
      extension: "jpg",
      now: new Date(Date.UTC(2026, 9, 1)),
    });
    expect(key).toBe("memory/etc/2026/10/abcx.jpg");
    expect(key).not.toContain("..");
  });
});
