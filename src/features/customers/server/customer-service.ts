import "server-only";
import { Prisma, type LeadSource } from "@prisma/client";
import { prisma } from "@/db";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { samePhone } from "@/lib/phone";
import { audit } from "@/server/audit";
import { can, type Permission } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/auth/session";
import {
  customerDeletionBlockers,
  latestActivity,
  normalizeEmail,
  normalizeInstagram,
  normalizeOptional,
  totalPaidByCustomer,
} from "../domain/customer-rules";
import type { UpdateCustomerInput } from "../schemas";
import { customerPhoneSearchFilter, phoneForStorage } from "./customer-contact";

type Ctx = { ip?: string | null };

/** Holgura para transacciones interactivas (el default de Prisma, 5 s, se agota con la BD bajo carga). */
const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

function assertCan(actor: SessionUser, permission: Permission) {
  if (!can(actor.role, permission)) throw new ForbiddenError();
}

const ID_RE = /^[a-z0-9_-]{1,64}$/i;

/** Pagos que cuentan como cobrados (los REFUND son registros de salida y no suman). */
const COLLECTED_PAYMENT_WHERE = {
  kind: { not: "REFUND" },
  status: { in: ["PAID", "PARTIAL_REFUND", "REFUNDED"] },
} satisfies Prisma.PaymentWhereInput;

// -----------------------------------------------------------------------------
// LISTADO
// -----------------------------------------------------------------------------

export const CUSTOMERS_PAGE_SIZE = 25;
export const CUSTOMER_SORTS = ["recent", "name"] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export type CustomerListItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  leadsCount: number;
  eventsCount: number;
  totalPaidCents: number;
  lastActivityAt: Date | null;
  createdAt: Date;
};

async function customerSearchWhere(q: string | null | undefined): Promise<Prisma.CustomerWhereInput> {
  const query = q?.trim().slice(0, 100);
  if (!query) return {};
  const or: Prisma.CustomerWhereInput[] = [
    { name: { contains: query, mode: "insensitive" } },
    { email: { contains: query, mode: "insensitive" } },
    { phone: { contains: query } },
    { whatsapp: { contains: query } },
    { instagram: { contains: query.replace(/^@/, ""), mode: "insensitive" } },
    { referralCode: { contains: query, mode: "insensitive" } },
  ];
  // Teléfono en cualquier formato: un número completo (+52, 521, con espacios…) se busca por su número
  // nacional y encuentra la forma canónica "+52…", los 10 dígitos y las filas antiguas con separadores.
  const phoneFilter = await customerPhoneSearchFilter(prisma, query);
  if (phoneFilter) or.push(phoneFilter);
  return { OR: or };
}

export async function listCustomers(
  actor: SessionUser,
  opts: { q?: string | null; page?: number; pageSize?: number; sort?: CustomerSort } = {},
): Promise<{ items: CustomerListItem[]; total: number; page: number; pageSize: number }> {
  assertCan(actor, "customers:read");
  const pageSize = Math.min(Math.max(opts.pageSize ?? CUSTOMERS_PAGE_SIZE, 1), 200);
  const where = await customerSearchWhere(opts.q);
  const total = await prisma.customer.count({ where });
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(opts.page ?? 1, 1), lastPage);

  const rows = await prisma.customer.findMany({
    where,
    orderBy: opts.sort === "name" ? [{ name: "asc" }, { id: "asc" }] : [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      source: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { leads: true, events: true } },
      leads: { select: { updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 1 },
      quotes: { select: { updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 1 },
      events: { select: { updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 1 },
    },
  });

  const ids = rows.map((r) => r.id);
  const payments = ids.length
    ? await prisma.payment.findMany({
        where: { ...COLLECTED_PAYMENT_WHERE, booking: { customerId: { in: ids } } },
        select: { kind: true, status: true, amountCents: true, refundedCents: true, paidAt: true, booking: { select: { customerId: true } } },
      })
    : [];
  const paid = totalPaidByCustomer(payments.map((p) => ({ ...p, customerId: p.booking.customerId })));
  const lastPaymentAt = new Map<string, Date>();
  for (const p of payments) {
    const prev = lastPaymentAt.get(p.booking.customerId);
    if (p.paidAt && (!prev || p.paidAt > prev)) lastPaymentAt.set(p.booking.customerId, p.paidAt);
  }

  const items: CustomerListItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    source: r.source,
    leadsCount: r._count.leads,
    eventsCount: r._count.events,
    totalPaidCents: paid.get(r.id) ?? 0,
    lastActivityAt: latestActivity([
      r.updatedAt,
      r.leads[0]?.updatedAt,
      r.quotes[0]?.updatedAt,
      r.events[0]?.updatedAt,
      lastPaymentAt.get(r.id),
    ]),
    createdAt: r.createdAt,
  }));
  return { items, total, page, pageSize };
}

// -----------------------------------------------------------------------------
// DETALLE
// -----------------------------------------------------------------------------

export async function getCustomerDetail(actor: SessionUser, customerId: string) {
  assertCan(actor, "customers:read");
  if (!ID_RE.test(customerId)) return null;
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      user: { select: { id: true, email: true, role: true } },
      leads: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          code: true,
          status: true,
          occasion: true,
          occasionOther: true,
          eventDate: true,
          guestCount: true,
          source: true,
          createdAt: true,
          experience: { select: { name: true } },
        },
      },
      quotes: {
        orderBy: { createdAt: "desc" },
        select: { id: true, code: true, title: true, status: true, totalCents: true, eventDate: true, version: true, createdAt: true },
      },
      events: {
        orderBy: { eventDate: "desc" },
        select: { id: true, code: true, title: true, status: true, eventDate: true, guestCount: true, experience: { select: { name: true } } },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        select: { id: true, rating: true, npsScore: true, comment: true, publishable: true, createdAt: true, event: { select: { id: true, title: true, eventDate: true } } },
      },
      _count: { select: { quotes: true, bookings: true, events: true, leads: true } },
    },
  });
  if (!customer) return null;

  const [payments, referrals] = await Promise.all([
    prisma.payment.findMany({
      where: { booking: { customerId } },
      orderBy: [{ paidAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      select: {
        id: true,
        kind: true,
        status: true,
        method: true,
        amountCents: true,
        refundedCents: true,
        paidAt: true,
        createdAt: true,
        booking: { select: { id: true, code: true, event: { select: { id: true, title: true } } } },
      },
    }),
    prisma.lead.count({ where: { referredByCode: customer.referralCode } }),
  ]);

  const collected = payments.filter((p) => p.kind !== "REFUND" && ["PAID", "PARTIAL_REFUND", "REFUNDED"].includes(p.status));
  const totalPaidCents = totalPaidByCustomer(collected.map((p) => ({ ...p, customerId }))).get(customerId) ?? 0;
  const blockers = customerDeletionBlockers({
    quotes: customer._count.quotes,
    bookings: customer._count.bookings,
    events: customer._count.events,
  });
  const lastActivityAt = latestActivity([
    customer.updatedAt,
    ...customer.leads.map((l) => l.createdAt),
    ...customer.quotes.map((q) => q.createdAt),
    ...payments.map((p) => p.paidAt),
  ]);

  return { customer, payments, referrals, totalPaidCents, blockers, lastActivityAt };
}
export type CustomerDetail = NonNullable<Awaited<ReturnType<typeof getCustomerDetail>>>;

// -----------------------------------------------------------------------------
// ESCRITURA
// -----------------------------------------------------------------------------

const EMAIL_TAKEN = "Ese correo ya pertenece a otra clienta. Revisa si es un registro duplicado.";

export async function updateCustomer(actor: SessionUser, input: UpdateCustomerInput, ctx: Ctx = {}) {
  assertCan(actor, "customers:write");
  const current = await prisma.customer.findUnique({ where: { id: input.customerId } });
  if (!current) throw new NotFoundError("No encontramos a esa clienta.");

  const next = {
    name: input.name.trim(),
    email: normalizeEmail(input.email),
    phone: phoneForStorage(input.phone, "phone"),
    whatsapp: phoneForStorage(input.whatsapp, "whatsapp"),
    instagram: normalizeInstagram(input.instagram),
    notes: normalizeOptional(input.notes),
    marketingOptIn: input.marketingOptIn,
  };

  if (next.email && next.email !== current.email) {
    const taken = await prisma.customer.findFirst({
      where: { email: { equals: next.email, mode: "insensitive" }, id: { not: current.id } },
      select: { id: true },
    });
    if (taken) throw new ValidationError(EMAIL_TAKEN, { email: [EMAIL_TAKEN] });
  }

  // Un teléfono que sólo pasa a la forma canónica (mismo número) no cuenta como cambio.
  const changed = (Object.keys(next) as Array<keyof typeof next>).filter((k) =>
    k === "phone" || k === "whatsapp" ? !samePhone(next[k], current[k]) : next[k] !== current[k],
  );
  if (!changed.length) return { changed: [] as string[] };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.customer.update({ where: { id: current.id }, data: next });
      await audit(
        {
          action: "customer.updated",
          entityType: "Customer",
          entityId: current.id,
          before: Object.fromEntries(changed.map((k) => [k, current[k]])),
          after: Object.fromEntries(changed.map((k) => [k, next[k]])),
          actor,
          ip: ctx.ip,
        },
        tx,
      );
    }, TX_OPTIONS);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ValidationError(EMAIL_TAKEN, { email: [EMAIL_TAKEN] });
    }
    throw error;
  }
  return { changed: changed as string[] };
}

/** Elimina a la clienta sólo si no tiene cotizaciones, reservas ni eventos. Sus leads quedan sin clienta. */
export async function deleteCustomer(actor: SessionUser, input: { customerId: string }, ctx: Ctx = {}) {
  assertCan(actor, "customers:write");
  const customer = await prisma.customer.findUnique({
    where: { id: input.customerId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      referralCode: true,
      _count: { select: { quotes: true, bookings: true, events: true, leads: true } },
    },
  });
  if (!customer) throw new NotFoundError("No encontramos a esa clienta.");

  const blockers = customerDeletionBlockers({
    quotes: customer._count.quotes,
    bookings: customer._count.bookings,
    events: customer._count.events,
  });
  if (blockers.length) {
    throw new ConflictError(`No se puede eliminar a ${customer.name}: ${blockers.join(" ")}`);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.customer.delete({ where: { id: customer.id } });
      await audit(
        {
          action: "customer.deleted",
          entityType: "Customer",
          entityId: customer.id,
          before: {
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            referralCode: customer.referralCode,
            leads: customer._count.leads,
          },
          actor,
          ip: ctx.ip,
        },
        tx,
      );
    }, TX_OPTIONS);
  } catch (error) {
    // Carrera: se creó una cotización/evento entre la verificación y el borrado (FK Restrict)
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2003" || error.code === "P2014")) {
      throw new ConflictError("No se puede eliminar: la clienta ya tiene cotizaciones, reservas o eventos.");
    }
    throw error;
  }
  return { deleted: true };
}
