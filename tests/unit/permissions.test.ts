import { describe, expect, it } from "vitest";
import {
  can,
  canAssignRole,
  homePathForRole,
  isBackofficeRole,
  PERMISSIONS,
} from "@/server/auth/permissions";

describe("RBAC", () => {
  it("SUPER_ADMIN tiene todos los permisos", () => {
    for (const p of PERMISSIONS) expect(can("SUPER_ADMIN", p)).toBe(true);
  });
  it("OWNER opera el negocio pero no puede crear super admins", () => {
    expect(can("OWNER", "financials:read")).toBe(true);
    expect(can("OWNER", "quotes:discount")).toBe(true);
    expect(can("OWNER", "users:manage")).toBe(true);
    expect(can("OWNER", "roles:assign_super_admin")).toBe(false);
    expect(canAssignRole("OWNER", "STAFF")).toBe(true);
    expect(canAssignRole("OWNER", "SUPER_ADMIN")).toBe(false);
    expect(canAssignRole("SUPER_ADMIN", "SUPER_ADMIN")).toBe(true);
  });
  it("STAFF sólo ve eventos asignados y checklists", () => {
    expect(can("STAFF", "events:read_assigned")).toBe(true);
    expect(can("STAFF", "checklists:update_assigned")).toBe(true);
    expect(can("STAFF", "events:read_all")).toBe(false);
    expect(can("STAFF", "financials:read")).toBe(false);
    expect(can("STAFF", "leads:read")).toBe(false);
    expect(can("STAFF", "quotes:write")).toBe(false);
    expect(canAssignRole("STAFF", "STAFF")).toBe(false);
  });
  it("CUSTOMER no tiene permisos de backoffice", () => {
    for (const p of PERMISSIONS) expect(can("CUSTOMER", p)).toBe(false);
    expect(isBackofficeRole("CUSTOMER")).toBe(false);
  });
  it("sin rol no hay permisos", () => {
    expect(can(null, "dashboard:view")).toBe(false);
    expect(can(undefined, "dashboard:view")).toBe(false);
  });
  it("redirige a la home correcta por rol", () => {
    expect(homePathForRole("OWNER")).toBe("/admin");
    expect(homePathForRole("SUPER_ADMIN")).toBe("/admin");
    expect(homePathForRole("STAFF")).toBe("/staff");
    expect(homePathForRole("CUSTOMER")).toBe("/");
  });
});
