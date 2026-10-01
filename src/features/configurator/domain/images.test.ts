import { describe, expect, it } from "vitest";
import { PLACEHOLDER_IMAGES, canOptimizeImage, safeImageSrc } from "./images";

describe("imágenes del catálogo", () => {
  it("acepta rutas locales y URLs http(s) válidas; si no, usa el placeholder", () => {
    const fb = PLACEHOLDER_IMAGES.experience;
    expect(safeImageSrc(null, fb)).toBe(fb);
    expect(safeImageSrc("", fb)).toBe(fb);
    expect(safeImageSrc("/images/mesa.jpg", fb)).toBe("/images/mesa.jpg");
    expect(safeImageSrc("/api/media/abc123", fb)).toBe("/api/media/abc123");
    expect(safeImageSrc("https://cdn.example.com/a.jpg", fb)).toBe("https://cdn.example.com/a.jpg");
    expect(safeImageSrc("http://localhost:9000/bucket/a.jpg", fb)).toBe("http://localhost:9000/bucket/a.jpg");
    expect(safeImageSrc("//evil.example.com/a.jpg", fb)).toBe(fb);
    expect(safeImageSrc("javascript:alert(1)", fb)).toBe(fb);
    expect(safeImageSrc("http://example.com/a.jpg", fb)).toBe(fb);
    expect(safeImageSrc("/images/con espacio.jpg", fb)).toBe(fb);
  });

  it("sólo optimiza lo que el optimizador de Next puede procesar", () => {
    expect(canOptimizeImage("/images/mesa.jpg")).toBe(true);
    expect(canOptimizeImage("/images/placeholders/brunch-table.svg")).toBe(false);
    expect(canOptimizeImage("/api/media/abc123")).toBe(false);
    expect(canOptimizeImage("/images/mesa.jpg?v=2")).toBe(false);
    expect(canOptimizeImage("http://localhost:9000/bucket/a.jpg")).toBe(true);
    expect(canOptimizeImage("https://bucket.s3.amazonaws.com/a.jpg")).toBe(true);
    expect(canOptimizeImage("https://cdn.example.com/a.jpg")).toBe(false);
    expect(canOptimizeImage("https://bucket.s3.amazonaws.com/a.svg")).toBe(false);
  });
});
