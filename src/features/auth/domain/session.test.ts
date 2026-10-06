import { describe, expect, it } from "vitest";
import { isSessionRenewalDue, isSessionVersionCurrent, tokenSessionVersion, withoutSessionCookieRenewal } from "./session";

describe("versión de sesión (revocación)", () => {
  it("un token sin versión (emitido antes del despliegue) cuenta como 0", () => {
    expect(tokenSessionVersion(undefined)).toBe(0);
    expect(tokenSessionVersion(null)).toBe(0);
    expect(isSessionVersionCurrent(undefined, 0)).toBe(true);
    expect(isSessionVersionCurrent(undefined, 1)).toBe(false);
  });

  it("sólo la versión vigente autoriza", () => {
    expect(isSessionVersionCurrent(3, 3)).toBe(true);
    expect(isSessionVersionCurrent(2, 3)).toBe(false);
    expect(isSessionVersionCurrent(4, 3)).toBe(false);
  });

  it("valores inesperados nunca coinciden (falla cerrado)", () => {
    for (const v of ["0", -1, 1.5, Number.NaN, {}, true]) {
      expect(tokenSessionVersion(v)).toBeNull();
      expect(isSessionVersionCurrent(v, 0)).toBe(false);
    }
  });
});

describe("renovación de la cookie de sesión", () => {
  const now = Date.UTC(2026, 9, 6, 12, 0, 0);
  const nowSec = now / 1000;
  const hour = 3600;

  it("un JWT reciente no se renueva", () => {
    expect(isSessionRenewalDue(nowSec, now, hour)).toBe(false);
    expect(isSessionRenewalDue(nowSec - hour + 1, now, hour)).toBe(false);
  });

  it("al cumplir la antigüedad mínima se renueva", () => {
    expect(isSessionRenewalDue(nowSec - hour, now, hour)).toBe(true);
    expect(isSessionRenewalDue(nowSec - 5 * hour, now, hour)).toBe(true);
  });

  it("sin iat válido se renueva", () => {
    expect(isSessionRenewalDue(undefined, now, hour)).toBe(true);
    expect(isSessionRenewalDue("123", now, hour)).toBe(true);
    expect(isSessionRenewalDue(Number.NaN, now, hour)).toBe(true);
  });
});

describe("withoutSessionCookieRenewal", () => {
  it("quita la re-emisión de la cookie de sesión (normal, __Secure- y fragmentada)", () => {
    const input = [
      "authjs.session-token=eyJhbGciOiJkaXIi.abc; Path=/; Expires=Tue, 06 Oct 2026 20:00:00 GMT; HttpOnly; SameSite=Lax",
      "__Secure-authjs.session-token=eyJ.def; Path=/; HttpOnly; Secure; SameSite=Lax",
      "authjs.session-token.0=eyJ.part0; Path=/; HttpOnly",
      "authjs.session-token.1=part1; Path=/; HttpOnly",
    ];
    expect(withoutSessionCookieRenewal(input)).toEqual([]);
  });

  it("conserva el borrado de la cookie de sesión y las demás cookies", () => {
    const deletion = "authjs.session-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0";
    const other = "authjs.csrf-token=abc%7Cdef; Path=/; HttpOnly";
    const callback = "authjs.callback-url=http%3A%2F%2Flocalhost; Path=/";
    expect(withoutSessionCookieRenewal([deletion, "authjs.session-token=eyJ.x; Path=/", other, callback])).toEqual([
      deletion,
      other,
      callback,
    ]);
  });
});
