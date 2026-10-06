import { describe, expect, it } from "vitest";
import { safeCallbackPath, safeRedirectUrl } from "./callback-url";

describe("safeCallbackPath — rutas internas válidas", () => {
  it.each([
    ["/admin", "/admin"],
    ["/admin/quotes?status=SENT", "/admin/quotes?status=SENT"],
    ["/admin/leads?status=NEW&q=%3Cscript%3E", "/admin/leads?status=NEW&q=%3Cscript%3E"],
    ["/staff?vista=hoy", "/staff?vista=hoy"],
    ["/admin/events#calendario", "/admin/events#calendario"],
    ["/", "/"],
  ])("%j → %j", (input, expected) => {
    expect(safeCallbackPath(input)).toBe(expected);
  });

  it("normaliza segmentos `..` sin salir del sitio", () => {
    expect(safeCallbackPath("/admin/../staff")).toBe("/staff");
  });

  it("una ruta con `//` codificado sigue siendo interna (no se decodifica)", () => {
    expect(safeCallbackPath("/%2F%2Fevil.example")).toBe("/%2F%2Fevil.example");
    expect(safeCallbackPath("/%09/evil.example")).toBe("/%09/evil.example");
  });
});

describe("safeCallbackPath — open redirect y entradas inválidas", () => {
  it.each([
    ["absoluta https", "https://evil.example/robo"],
    ["absoluta http", "http://localhost@evil.example/"],
    ["relativa al protocolo", "//evil.example/robo"],
    ["diagonal invertida tras /", "/\\evil.example/robo"],
    ["doble diagonal invertida", "\\\\evil.example"],
    ["javascript:", "javascript:alert(document.domain)"],
    ["data:", "data:text/html,<script>alert(1)</script>"],
    ["TAB entre diagonales (ACC-BUG-03)", "/\t/evil.example"],
    ["LF entre diagonales", "/\n/evil.example"],
    ["CR entre diagonales", "/\r/evil.example"],
    ["NUL", "/admin\u0000"],
    ["DEL", "/admin\u007F"],
    ["control C1", "/admin\u0085x"],
    ["espacio", "/ /evil.example"],
    ["NBSP", "/ /evil.example"],
    ["separador de línea Unicode", "/ /evil.example"],
    ["`..` que termina en //", "/..//evil.example"],
    ["`.` que termina en //", "/.//evil.example"],
    ["sin diagonal inicial", "admin"],
    ["vacía", ""],
  ])("%s", (_name, input) => {
    expect(safeCallbackPath(input)).toBeNull();
  });

  it("rechaza tipos que no son cadena y longitudes absurdas", () => {
    expect(safeCallbackPath(undefined)).toBeNull();
    expect(safeCallbackPath(null)).toBeNull();
    expect(safeCallbackPath(["/admin"])).toBeNull();
    expect(safeCallbackPath(`/${"a".repeat(2048)}`)).toBeNull();
  });
});

describe("safeRedirectUrl (callback redirect de Auth.js)", () => {
  const base = "http://localhost:3201";

  it("rutas internas se resuelven contra el origen", () => {
    expect(safeRedirectUrl("/login", base)).toBe(`${base}/login`);
    expect(safeRedirectUrl("/admin/quotes?status=SENT", base)).toBe(`${base}/admin/quotes?status=SENT`);
  });

  it("URL absoluta del mismo origen se conserva (normalizada)", () => {
    expect(safeRedirectUrl(`${base}/admin/leads?status=NEW`, base)).toBe(`${base}/admin/leads?status=NEW`);
  });

  it.each(["https://evil.example/", "//evil.example", "/\t/evil.example", "/\\evil.example", "\\\\evil.example", "javascript:alert(1)", `${base}//evil.example`])(
    "%j vuelve al inicio del sitio",
    (url) => {
      expect(safeRedirectUrl(url, base)).toBe(base);
    },
  );
});
