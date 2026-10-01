import { describe, expect, it } from "vitest";
import { decideCronAuth } from "./cron-auth";

describe("decideCronAuth", () => {
  const secret = "s3cret-value-for-cron-0123456789";

  it("acepta el Bearer correcto (sin importar mayúsculas del esquema)", () => {
    expect(decideCronAuth(`Bearer ${secret}`, secret)).toBe("ok");
    expect(decideCronAuth(`bearer ${secret}`, secret)).toBe("ok");
    expect(decideCronAuth(`  Bearer   ${secret}  `, secret)).toBe("ok");
  });

  it("rechaza encabezados ausentes, vacíos o incorrectos", () => {
    expect(decideCronAuth(null, secret)).toBe("unauthorized");
    expect(decideCronAuth("", secret)).toBe("unauthorized");
    expect(decideCronAuth("Bearer ", secret)).toBe("unauthorized");
    expect(decideCronAuth(secret, secret)).toBe("unauthorized"); // sin esquema Bearer
    expect(decideCronAuth(`Bearer ${secret}x`, secret)).toBe("unauthorized");
    expect(decideCronAuth(`Basic ${secret}`, secret)).toBe("unauthorized");
  });

  it("falla cerrado si no hay secreto configurado", () => {
    expect(decideCronAuth(`Bearer ${secret}`, undefined)).toBe("unconfigured");
    expect(decideCronAuth(`Bearer `, "")).toBe("unconfigured");
  });
});
