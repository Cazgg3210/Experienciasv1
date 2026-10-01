import { randomBytes } from "node:crypto";
import { prisma } from "@/db";
import type { SessionUser } from "@/server/auth/session";

/** Sufijo único para que pruebas en paralelo no choquen entre sí. */
export function uid(prefix = "t"): string {
  return `${prefix}${randomBytes(5).toString("hex")}`;
}

/** Crea (o reutiliza) una fundadora de prueba y devuelve el actor para servicios. */
export async function testOwner(): Promise<SessionUser> {
  const email = "owner.integration@ivonne-rosa.test";
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Owner Test", role: "OWNER" },
  });
  return { id: user.id, email: user.email, name: user.name, role: "OWNER" };
}

export async function testStaff(): Promise<SessionUser & { staffMemberId: string }> {
  const email = `staff.${uid()}@ivonne-rosa.test`;
  const user = await prisma.user.create({ data: { email, name: "Staff Test", role: "STAFF" } });
  const member = await prisma.staffMember.create({ data: { name: "Staff Test", userId: user.id, primaryFunction: "SERVER" } });
  return { id: user.id, email, name: user.name, role: "STAFF", staffMemberId: member.id };
}
