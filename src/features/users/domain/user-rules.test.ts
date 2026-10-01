import { describe, expect, it } from "vitest";
import {
  assignableRoles,
  checkActiveChange,
  checkCreateUser,
  checkPasswordReset,
  checkPasswordStrength,
  checkRoleChange,
} from "./user-rules";

const superAdmin = { id: "sa1", role: "SUPER_ADMIN" as const };
const owner = { id: "o1", role: "OWNER" as const };
const staffActor = { id: "s1", role: "STAFF" as const };

const targetSA = { id: "sa2", role: "SUPER_ADMIN" as const, active: true };
const targetOwner = { id: "o2", role: "OWNER" as const, active: true };
const targetStaff = { id: "s2", role: "STAFF" as const, active: true };

describe("roles asignables", () => {
  it("OWNER no puede asignar SUPER_ADMIN", () => {
    expect(assignableRoles("OWNER")).toEqual(["OWNER", "STAFF"]);
    expect(assignableRoles("SUPER_ADMIN")).toEqual(["SUPER_ADMIN", "OWNER", "STAFF"]);
    expect(assignableRoles("STAFF")).toEqual([]);
  });
});

describe("crear usuarias", () => {
  it("OWNER no puede crear SUPER_ADMIN; STAFF no puede crear nada", () => {
    expect(checkCreateUser(owner, "SUPER_ADMIN")).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(checkCreateUser(owner, "STAFF")).toEqual({ ok: true });
    expect(checkCreateUser(superAdmin, "SUPER_ADMIN")).toEqual({ ok: true });
    expect(checkCreateUser(staffActor, "STAFF")).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(checkCreateUser(owner, "CUSTOMER")).toMatchObject({ ok: false, code: "VALIDATION" });
  });
});

describe("cambio de rol", () => {
  it("nadie puede cambiar su propio rol", () => {
    expect(checkRoleChange(owner, { ...targetOwner, id: owner.id }, "STAFF", 1)).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(checkRoleChange(superAdmin, { ...targetSA, id: superAdmin.id }, "OWNER", 2)).toMatchObject({ ok: false, code: "CONFLICT" });
  });

  it("OWNER no puede promover a SUPER_ADMIN ni degradar a un SUPER_ADMIN", () => {
    expect(checkRoleChange(owner, targetStaff, "SUPER_ADMIN", 1)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(checkRoleChange(owner, targetSA, "OWNER", 2)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(checkRoleChange(owner, targetStaff, "OWNER", 1)).toEqual({ ok: true });
  });

  it("no se puede quitar al último SUPER_ADMIN activo", () => {
    expect(checkRoleChange(superAdmin, targetSA, "OWNER", 1)).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(checkRoleChange(superAdmin, targetSA, "OWNER", 2)).toEqual({ ok: true });
    // un super admin inactivo sí puede cambiar de rol
    expect(checkRoleChange(superAdmin, { ...targetSA, active: false }, "OWNER", 1)).toEqual({ ok: true });
  });

  it("rechaza el mismo rol", () => {
    expect(checkRoleChange(superAdmin, targetStaff, "STAFF", 1)).toMatchObject({ ok: false, code: "VALIDATION" });
  });
});

describe("activar / desactivar", () => {
  it("no puedes desactivarte a ti misma", () => {
    expect(checkActiveChange(owner, { ...targetOwner, id: owner.id }, false, 1)).toMatchObject({ ok: false, code: "CONFLICT" });
  });

  it("no se puede desactivar al último SUPER_ADMIN activo", () => {
    expect(checkActiveChange(superAdmin, targetSA, false, 1)).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(checkActiveChange(superAdmin, targetSA, false, 2)).toEqual({ ok: true });
  });

  it("OWNER no puede desactivar a un SUPER_ADMIN pero sí a staff", () => {
    expect(checkActiveChange(owner, targetSA, false, 3)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(checkActiveChange(owner, targetStaff, false, 1)).toEqual({ ok: true });
    expect(checkActiveChange(owner, { ...targetStaff, active: false }, true, 1)).toEqual({ ok: true });
  });

  it("rechaza cambios sin efecto", () => {
    expect(checkActiveChange(owner, targetStaff, true, 1)).toMatchObject({ ok: false, code: "VALIDATION" });
  });
});

describe("restablecer contraseña", () => {
  it("OWNER puede restablecer staff y a sí misma, no a un SUPER_ADMIN", () => {
    expect(checkPasswordReset(owner, targetStaff)).toEqual({ ok: true });
    expect(checkPasswordReset(owner, { ...targetOwner, id: owner.id })).toEqual({ ok: true });
    expect(checkPasswordReset(owner, targetSA)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(checkPasswordReset(superAdmin, targetSA)).toEqual({ ok: true });
  });
});

describe("cuentas de clientas", () => {
  it("no se administran desde Usuarios (rol, estado ni contraseña)", () => {
    const customer = { id: "c1", role: "CUSTOMER" as const, active: true };
    expect(checkRoleChange(superAdmin, customer, "OWNER", 2)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(checkRoleChange(owner, customer, "STAFF", 1)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(checkActiveChange(owner, customer, false, 1)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(checkPasswordReset(owner, customer)).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
});

describe("contraseñas", () => {
  it("exige ≥ 10 caracteres y rechaza patrones triviales", () => {
    expect(checkPasswordStrength("corta")).toMatchObject({ ok: false });
    expect(checkPasswordStrength("aaaaaaaaaaaa")).toMatchObject({ ok: false });
    expect(checkPasswordStrength("ivonne-2026-x", { email: "ivonne@ivonne-rosa.test" })).toMatchObject({ ok: false });
    expect(checkPasswordStrength("Brunch-Lindo-2026")).toEqual({ ok: true });
  });
});
