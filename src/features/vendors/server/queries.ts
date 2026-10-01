import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { summarizePurchases } from "@/features/purchases/domain/purchase-rules";
import type { VendorFilters } from "../schemas";

export async function listVendors(filters: VendorFilters, { page = 1, pageSize = 25 } = {}) {
  const where: Prisma.VendorWhereInput = {
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" } },
            { contactName: { contains: filters.q, mode: "insensitive" } },
            { email: { contains: filters.q, mode: "insensitive" } },
            { phone: { contains: filters.q } },
            { whatsapp: { contains: filters.q } },
          ],
        }
      : {}),
  };
  const [vendors, total, statusCounts] = await Promise.all([
    prisma.vendor.findMany({
      where,
      orderBy: [{ status: "asc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        purchases: { select: { status: true, expectedAmountCents: true, actualAmountCents: true } },
      },
    }),
    prisma.vendor.count({ where }),
    prisma.vendor.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const rows = vendors.map(({ purchases, ...v }) => ({ ...v, totals: summarizePurchases(purchases) }));
  const counts = { ACTIVE: 0, INACTIVE: 0, BLOCKED: 0 };
  for (const s of statusCounts) counts[s.status] = s._count._all;
  return { rows, total, counts };
}

export async function getVendorDetail(id: string) {
  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      purchases: {
        orderBy: { createdAt: "desc" },
        include: { event: { select: { id: true, code: true, title: true, eventDate: true } } },
      },
    },
  });
  if (!vendor) return null;
  const { purchases, ...rest } = vendor;
  return { vendor: rest, purchases, totals: summarizePurchases(purchases) };
}

export async function getVendorForEdit(id: string) {
  return prisma.vendor.findUnique({ where: { id } });
}
