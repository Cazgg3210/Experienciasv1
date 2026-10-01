import "server-only";
import type { EventStatus, StaffFunction } from "@prisma/client";
import { prisma } from "@/db";
import { localTime } from "@/lib/dates";
import { isBackofficeRole } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/auth/session";
import { computeProgress, staffCanEditItem, type Progress } from "@/features/operations/domain/checklist";
import {
  aggregateDietary,
  computeHeadCount,
  fullAddress,
  groupByCourse,
  mapsLink,
} from "@/features/operations/domain/production";
import {
  checklistItemInclude,
  toChecklistItemView,
  type ChecklistItemView,
} from "@/features/operations/server/ops-queries";

type Viewer = Pick<SessionUser, "id" | "role">;

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export async function getStaffMemberForUser(userId: string) {
  return prisma.staffMember.findUnique({
    where: { userId },
    select: { id: true, name: true, primaryFunction: true, active: true },
  });
}

export type MyEventCard = {
  id: string;
  title: string;
  status: EventStatus;
  eventDate: Date;
  timeLabel: string;
  neighborhood: string | null;
  experienceName: string | null;
  roles: Array<{ function: StaffFunction; schedule: string; confirmed: boolean }>;
  myTasks: Progress;
  openTasks: number;
};

/**
 * Eventos con asignación del integrante ligado al usuario (nunca de otras personas).
 * Próximos: no cancelados, no completados y que no han terminado. Pasados: el resto (sin cancelados).
 */
export async function listMyEvents(user: Viewer, now: Date = new Date()) {
  const member = await getStaffMemberForUser(user.id);
  if (!member) return { member: null, upcoming: [] as MyEventCard[], past: [] as MyEventCard[] };

  const assignments = await prisma.staffAssignment.findMany({
    where: { staffMemberId: member.id, event: { status: { not: "CANCELLED" } } },
    orderBy: { startsAt: "asc" },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          status: true,
          eventDate: true,
          startsAt: true,
          endsAt: true,
          neighborhood: true,
          experience: { select: { name: true } },
          checklistItems: { where: { assigneeId: member.id }, select: { status: true } },
        },
      },
    },
  });

  const byEvent = new Map<string, MyEventCard & { endsAt: Date; startsAt: Date }>();
  for (const a of assignments) {
    const e = a.event;
    let card = byEvent.get(e.id);
    if (!card) {
      const progress = computeProgress(e.checklistItems);
      card = {
        id: e.id,
        title: e.title,
        status: e.status,
        eventDate: e.eventDate,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        timeLabel: `${localTime(e.startsAt)}–${localTime(e.endsAt)}`,
        neighborhood: e.neighborhood,
        experienceName: e.experience?.name ?? null,
        roles: [],
        myTasks: progress,
        openTasks: e.checklistItems.filter((i) => i.status === "PENDING" || i.status === "IN_PROGRESS").length,
      };
      byEvent.set(e.id, card);
    }
    card.roles.push({ function: a.function, schedule: `${localTime(a.startsAt)}–${localTime(a.endsAt)}`, confirmed: a.confirmed });
  }

  const cards = [...byEvent.values()];
  const isUpcoming = (c: { endsAt: Date; status: EventStatus }) => c.status !== "COMPLETED" && c.endsAt.getTime() >= now.getTime();
  const strip = ({ endsAt: _e, startsAt: _s, ...c }: MyEventCard & { endsAt: Date; startsAt: Date }): MyEventCard => c;
  const upcoming = cards.filter(isUpcoming).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()).map(strip);
  const past = cards
    .filter((c) => !isUpcoming(c))
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
    .slice(0, 20)
    .map(strip);
  return { member, upcoming, past };
}

export type StaffChecklistItem = ChecklistItemView & { canEdit: boolean; mine: boolean };

/**
 * Vista de un evento para el portal staff. Devuelve null (→ 404) si el evento no existe o si
 * una persona STAFF no está asignada. SUPER_ADMIN/OWNER pueden ver cualquiera.
 * Nunca incluye montos, tarifas ni pagos.
 */
export async function getStaffEventView(user: Viewer, eventId: string, now: Date = new Date()) {
  if (!ID_RE.test(eventId)) return null;
  const backoffice = isBackofficeRole(user.role);
  const member = await getStaffMemberForUser(user.id);

  if (!backoffice) {
    if (!member) return null;
    const assigned = await prisma.staffAssignment.findFirst({
      where: { eventId, staffMemberId: member.id, event: { status: { not: "CANCELLED" } } },
      select: { id: true },
    });
    if (!assigned) return null;
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      occasion: true,
      honoreeName: true,
      eventDate: true,
      startsAt: true,
      endsAt: true,
      departureAt: true,
      setupStartsAt: true,
      teardownAt: true,
      guestCount: true,
      addressLine: true,
      addressNotes: true,
      neighborhood: true,
      city: true,
      postalCode: true,
      mapsUrl: true,
      colors: true,
      dressCode: true,
      customerNotes: true,
      customer: { select: { name: true, phone: true, whatsapp: true } },
      experience: { select: { name: true } },
      style: { select: { name: true, palette: true } },
      menu: { select: { name: true, items: { orderBy: { sortOrder: "asc" } } } },
      addOns: {
        select: { id: true, quantity: true, notes: true, addOn: { select: { name: true, category: true } } },
        orderBy: { addOn: { sortOrder: "asc" } },
      },
      guests: {
        select: {
          name: true,
          rsvpStatus: true,
          plusOne: true,
          plusOneName: true,
          dietaryRestrictions: true,
          dietaryNotes: true,
        },
        orderBy: { name: "asc" },
      },
      timeline: { select: { id: true, time: true, title: true, description: true }, orderBy: [{ sortOrder: "asc" }, { time: "asc" }] },
      staffAssignments: {
        select: {
          id: true,
          function: true,
          startsAt: true,
          endsAt: true,
          confirmed: true,
          notes: true,
          staffMemberId: true,
          staffMember: { select: { name: true, phone: true } },
        },
        orderBy: { startsAt: "asc" },
      },
      checklistItems: { include: checklistItemInclude, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!event) return null;
  if (!backoffice && event.status === "CANCELLED") return null;

  const myAssignments = member ? event.staffAssignments.filter((a) => a.staffMemberId === member.id) : [];
  const myFunctions = new Set(myAssignments.map((a) => a.function));
  const coordinatorAssignment = event.staffAssignments.find((a) => a.function === "COORDINATOR");
  const canSeeClientPhone = backoffice || myFunctions.has("COORDINATOR") || myFunctions.has("DRIVER");

  const checklist: StaffChecklistItem[] = event.checklistItems.map((row) => {
    const view = toChecklistItemView(row, now);
    const mine = !!member && row.assigneeId === member.id;
    return { ...view, mine, canEdit: backoffice || staffCanEditItem(row, member?.id ?? null) };
  });

  return {
    viewerIsBackoffice: backoffice,
    staffMemberId: member?.id ?? null,
    event: {
      id: event.id,
      code: event.code,
      title: event.title,
      status: event.status,
      occasion: event.occasion,
      honoreeName: event.honoreeName,
      eventDate: event.eventDate,
      timeLabel: `${localTime(event.startsAt)}–${localTime(event.endsAt)}`,
      departureLabel: event.departureAt ? localTime(event.departureAt) : null,
      setupLabel: event.setupStartsAt ? localTime(event.setupStartsAt) : null,
      teardownLabel: event.teardownAt ? localTime(event.teardownAt) : null,
      guestCount: event.guestCount,
      address: fullAddress(event),
      addressNotes: event.addressNotes,
      neighborhood: event.neighborhood,
      mapsUrl: mapsLink(event),
      colors: event.colors,
      dressCode: event.dressCode,
      customerNotes: event.customerNotes,
      experienceName: event.experience?.name ?? null,
      style: event.style,
    },
    client: {
      firstName: event.customer.name.split(" ")[0] ?? event.customer.name,
      phone: canSeeClientPhone ? (event.customer.whatsapp ?? event.customer.phone) : null,
    },
    myAssignments: myAssignments.map((a) => ({
      id: a.id,
      function: a.function,
      schedule: `${localTime(a.startsAt)}–${localTime(a.endsAt)}`,
      confirmed: a.confirmed,
      notes: a.notes,
    })),
    coordinator: coordinatorAssignment
      ? { name: coordinatorAssignment.staffMember.name, phone: coordinatorAssignment.staffMember.phone }
      : null,
    team: event.staffAssignments.map((a) => ({
      id: a.id,
      name: a.staffMember.name,
      function: a.function,
      schedule: `${localTime(a.startsAt)}–${localTime(a.endsAt)}`,
      isMe: !!member && a.staffMemberId === member.id,
    })),
    headCount: computeHeadCount(event.guestCount, event.guests),
    menuName: event.menu?.name ?? null,
    courses: groupByCourse(event.menu?.items ?? []),
    dietary: aggregateDietary(event.guests),
    addOns: event.addOns.map((a) => ({ id: a.id, name: a.addOn.name, quantity: a.quantity, notes: a.notes })),
    timeline: event.timeline,
    checklist,
    myProgress: computeProgress(checklist.filter((i) => i.mine)),
    progress: computeProgress(checklist),
  };
}

export type StaffEventView = NonNullable<Awaited<ReturnType<typeof getStaffEventView>>>;
