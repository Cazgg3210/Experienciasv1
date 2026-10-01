import "server-only";
import { prisma } from "@/db";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { audit } from "@/server/audit";
import type { SessionUser } from "@/server/auth/session";
import type { UpdateVendorData, VendorData } from "../schemas";

const FIELDS = ["name", "category", "contactName", "phone", "whatsapp", "email", "slaNotes", "notes", "status", "rating"] as const;

export async function createVendor(actor: SessionUser, data: VendorData) {
  return prisma.$transaction(async (tx) => {
    const vendor = await tx.vendor.create({ data });
    await audit({ action: "vendor.created", entityType: "Vendor", entityId: vendor.id, after: vendor, actor }, tx);
    return vendor;
  });
}

export async function updateVendor(actor: SessionUser, data: UpdateVendorData) {
  const { id, ...fields } = data;
  return prisma.$transaction(async (tx) => {
    const before = await tx.vendor.findUnique({ where: { id } });
    if (!before) throw new NotFoundError("No encontramos el proveedor.");
    const vendor = await tx.vendor.update({ where: { id }, data: fields });
    const b: Record<string, unknown> = {};
    const a: Record<string, unknown> = {};
    for (const key of FIELDS) {
      if (before[key] !== vendor[key]) {
        b[key] = before[key];
        a[key] = vendor[key];
      }
    }
    if (Object.keys(a).length) {
      await audit(
        {
          action: "status" in a ? "vendor.status_changed" : "vendor.updated",
          entityType: "Vendor",
          entityId: id,
          before: b,
          after: a,
          actor,
        },
        tx,
      );
    }
    return vendor;
  });
}

/**
 * Elimina un proveedor sin historial. Si ya tiene compras se conserva para no perder la
 * trazabilidad de costos: se sugiere marcarlo como inactivo o bloqueado.
 */
export async function deleteVendor(actor: SessionUser, id: string) {
  return prisma.$transaction(async (tx) => {
    const vendor = await tx.vendor.findUnique({ where: { id }, include: { _count: { select: { purchases: true } } } });
    if (!vendor) throw new NotFoundError("No encontramos el proveedor.");
    if (vendor._count.purchases > 0) {
      throw new ConflictError(
        `Este proveedor tiene ${vendor._count.purchases} compra(s) registradas. Márcalo como inactivo o bloqueado en lugar de eliminarlo.`,
      );
    }
    await tx.vendor.delete({ where: { id } });
    const { _count: _ignored, ...snapshot } = vendor;
    await audit({ action: "vendor.deleted", entityType: "Vendor", entityId: id, before: snapshot, actor }, tx);
    return { id };
  });
}
