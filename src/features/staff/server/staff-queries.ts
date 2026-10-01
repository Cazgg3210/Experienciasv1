import "server-only";
import type { Prisma, StaffFunction } from "@prisma/client";
import { prisma } from "@/db";
import { summarizeAmounts } from "../domain/staff";

export type StaffListFilters = { q?: string; status?: "active" | "inactive" | "all"; fn?: StaffFunction };

export async function listStaff(filters: StaffListFilters = {}, now: Date = new Date()) {
  const where: Prisma.StaffMemberWhereInput = {};
  if (filters.status !== "all") where.active = filters.status !== "inactive";
  if (filters.fn) where.primaryFunction = filters.fn;
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { email: { contains: filters.q, mode: "insensitive" } },
      { phone: { contains: filters.q } },
    ];
  }
  const members = await prisma.staffMember.findMany({
    where,
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      user: { select: { email: true, active: true, lastLoginAt: true } },
      assignments: {
        where: { endsAt: { gte: now }, event: { status: { not: "CANCELLED" } } },
        select: { id: true },
      },
    },
  });
  return members.map(({ assignments, ...m }) => ({ ...m, upcomingCount: assignments.length }));
}

export async function getStaffDetail(id: string, now: Date = new Date()) {
  const member = await prisma.staffMember.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, active: true, lastLoginAt: true, role: true } },
      assignments: {
        orderBy: { startsAt: "desc" },
        include: {
          event: {
            select: {
              id: true,
              code: true,
              title: true,
              status: true,
              eventDate: true,
              startsAt: true,
              endsAt: true,
              neighborhood: true,
            },
          },
        },
      },
    },
  });
  if (!member) return null;
  const upcoming = member.assignments
    .filter((a) => a.endsAt.getTime() >= now.getTime() && a.event.status !== "CANCELLED" && a.event.status !== "COMPLETED")
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const upcomingIds = new Set(upcoming.map((a) => a.id));
  const history = member.assignments.filter((a) => !upcomingIds.has(a.id));
  const totals = summarizeAmounts(member.assignments.map((a) => ({ amountCents: a.amountCents, paid: a.paid, eventStatus: a.event.status })));
  const openTasks = await prisma.eventChecklistItem.count({
    where: { assigneeId: id, status: { in: ["PENDING", "IN_PROGRESS"] }, event: { status: { notIn: ["CANCELLED"] } } },
  });
  return { member, upcoming, history, totals, openTasks };
}

export type StaffDetail = NonNullable<Awaited<ReturnType<typeof getStaffDetail>>>;
