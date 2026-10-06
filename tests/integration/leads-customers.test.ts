/**
 * Integración: CRM de leads + clientas.
 * Usa la base de pruebas (TEST_DATABASE_URL). Cada prueba crea sus propios datos con valores únicos
 * (no trunca tablas ni asume datos semilla).
 */
import { describe, expect, it } from "vitest";
import type { LeadStatus } from "@prisma/client";
import { prisma } from "@/db";
import { dateOnly, localDateKey, zonedDateTime } from "@/lib/dates";
import { ConflictError, ForbiddenError, ValidationError } from "@/lib/errors";
import { generateToken } from "@/lib/tokens";
import {
  assignLead,
  changeLeadStatus,
  countLeadsByStatus,
  createManualLead,
  listLeads,
  listLeadsForExport,
  listLeadsForKanban,
  logLeadActivity,
  updateLead,
} from "@/features/leads/server/lead-service";
import { getLeadDetail, resolveLeadSnapshot } from "@/features/leads/server/lead-queries";
import { EMPTY_LEAD_FILTERS, type LeadFilters } from "@/features/leads/domain/lead-filters";
import {
  deleteCustomer,
  getCustomerDetail,
  listCustomers,
  updateCustomer,
} from "@/features/customers/server/customer-service";
import { submitContactRequest } from "@/features/marketing/server/contact-service";
import { contactFormSchema } from "@/features/marketing/schemas";
import { testOwner, testStaff, uid } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;

/** Teléfono MX de 10 dígitos único. */
function newPhone(): string {
  return `55${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
}

async function makeCustomer(name = "Clienta Prueba") {
  return prisma.customer.create({
    data: {
      name,
      email: `${uid("cli")}@example.test`,
      phone: `55${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
      referralCode: uid("IR-").toUpperCase(),
    },
  });
}

async function makeLead(
  data: Partial<{
    name: string;
    status: LeadStatus;
    source: "MANUAL" | "WHATSAPP" | "INSTAGRAM" | "CONFIGURATOR" | "REFERRAL";
    outOfArea: boolean;
    specialRequest: boolean;
    eventDate: Date | null;
    assignedToId: string | null;
    customerId: string | null;
    email: string | null;
    phone: string | null;
    guestCount: number | null;
    createdAt: Date;
  }> = {},
) {
  return prisma.lead.create({
    data: {
      code: uid("L-").toUpperCase(),
      name: data.name ?? `Lead ${uid()}`,
      email: data.email === undefined ? `${uid("lead")}@example.test` : data.email,
      phone: data.phone ?? null,
      occasion: "BIRTHDAY",
      status: data.status ?? "NEW",
      source: data.source ?? "MANUAL",
      outOfArea: data.outOfArea ?? false,
      specialRequest: data.specialRequest ?? false,
      eventDate: data.eventDate ?? null,
      guestCount: data.guestCount ?? 8,
      assignedToId: data.assignedToId ?? null,
      customerId: data.customerId ?? null,
      ...(data.createdAt ? { createdAt: data.createdAt } : {}),
    },
  });
}

function filters(partial: Partial<LeadFilters>): LeadFilters {
  return { ...EMPTY_LEAD_FILTERS, ...partial };
}

async function activitiesOf(leadId: string) {
  return prisma.leadActivity.findMany({ where: { leadId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
}

// -----------------------------------------------------------------------------
// ESTADOS
// -----------------------------------------------------------------------------

describe("changeLeadStatus", () => {
  it("transición válida: actualiza estado, deja actividad STATUS_CHANGE (from/to) y auditoría", async () => {
    const owner = await testOwner();
    const lead = await makeLead();
    const res = await changeLeadStatus(owner, { leadId: lead.id, toStatus: "CONTACTED", note: "Le escribí por WhatsApp" });
    expect(res).toEqual({ leadId: lead.id, fromStatus: "NEW", toStatus: "CONTACTED" });

    const updated = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(updated.status).toBe("CONTACTED");
    const acts = await activitiesOf(lead.id);
    expect(acts).toHaveLength(1);
    expect(acts[0]).toMatchObject({
      type: "STATUS_CHANGE",
      fromStatus: "NEW",
      toStatus: "CONTACTED",
      actorId: owner.id,
      message: "Le escribí por WhatsApp",
    });
    const audits = await prisma.auditLog.findMany({ where: { entityType: "Lead", entityId: lead.id } });
    expect(audits.map((a) => a.action)).toEqual(["lead.status_changed"]);

    // Cadena completa del embudo
    await changeLeadStatus(owner, { leadId: lead.id, toStatus: "QUALIFIED" });
    await changeLeadStatus(owner, { leadId: lead.id, toStatus: "QUOTED" });
    await changeLeadStatus(owner, { leadId: lead.id, toStatus: "WON" });
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe("WON");
    expect(await prisma.leadActivity.count({ where: { leadId: lead.id, type: "STATUS_CHANGE" } })).toBe(4);
  });

  it("transición inválida: lanza ConflictError y no deja rastro", async () => {
    const owner = await testOwner();
    const lead = await makeLead();
    await expect(changeLeadStatus(owner, { leadId: lead.id, toStatus: "WON" })).rejects.toBeInstanceOf(ConflictError);
    await expect(changeLeadStatus(owner, { leadId: lead.id, toStatus: "NEW" })).rejects.toBeInstanceOf(ConflictError);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe("NEW");
    expect(await activitiesOf(lead.id)).toHaveLength(0);

    const won = await makeLead({ status: "WON" });
    await expect(changeLeadStatus(owner, { leadId: won.id, toStatus: "LOST", lostReason: "x" })).rejects.toThrow(
      /No es posible mover/,
    );
  });

  it("LOST exige motivo; reactivar limpia el motivo", async () => {
    const owner = await testOwner();
    const lead = await makeLead({ status: "CONTACTED" });
    const err = await changeLeadStatus(owner, { leadId: lead.id, toStatus: "LOST", lostReason: "   " }).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).fieldErrors).toHaveProperty("lostReason");
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe("CONTACTED");

    await changeLeadStatus(owner, { leadId: lead.id, toStatus: "LOST", lostReason: "Fuera de presupuesto" });
    const lost = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(lost).toMatchObject({ status: "LOST", lostReason: "Fuera de presupuesto" });
    const act = await prisma.leadActivity.findFirstOrThrow({ where: { leadId: lead.id, toStatus: "LOST" } });
    expect(act.message).toContain("Fuera de presupuesto");

    await changeLeadStatus(owner, { leadId: lead.id, toStatus: "NEW" });
    expect(await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).toMatchObject({ status: "NEW", lostReason: null });
  });

  it("sin permiso (staff) no puede cambiar estados", async () => {
    const staff = await testStaff();
    const lead = await makeLead();
    await expect(changeLeadStatus(staff, { leadId: lead.id, toStatus: "CONTACTED" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listLeads(staff, EMPTY_LEAD_FILTERS)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// -----------------------------------------------------------------------------
// ASIGNACIÓN Y CONTACTO
// -----------------------------------------------------------------------------

describe("assignLead", () => {
  it("asigna a una fundadora, registra ASSIGNED y permite desasignar", async () => {
    const owner = await testOwner();
    const lead = await makeLead();
    const res = await assignLead(owner, { leadId: lead.id, assigneeId: owner.id });
    expect(res).toEqual({ changed: true, assigneeId: owner.id });
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).assignedToId).toBe(owner.id);
    const act = await prisma.leadActivity.findFirstOrThrow({ where: { leadId: lead.id, type: "ASSIGNED" } });
    expect(act.message).toContain(owner.name);

    // Mismo responsable: sin cambios ni actividad extra
    expect(await assignLead(owner, { leadId: lead.id, assigneeId: owner.id })).toEqual({ changed: false, assigneeId: owner.id });
    expect(await prisma.leadActivity.count({ where: { leadId: lead.id, type: "ASSIGNED" } })).toBe(1);

    await assignLead(owner, { leadId: lead.id, assigneeId: null });
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).assignedToId).toBeNull();
    expect(await prisma.leadActivity.count({ where: { leadId: lead.id, type: "ASSIGNED" } })).toBe(2);
  });

  it("rechaza asignar a staff o a usuarios inexistentes", async () => {
    const owner = await testOwner();
    const staff = await testStaff();
    const lead = await makeLead();
    await expect(assignLead(owner, { leadId: lead.id, assigneeId: staff.id })).rejects.toBeInstanceOf(ValidationError);
    await expect(assignLead(owner, { leadId: lead.id, assigneeId: "no-existe" })).rejects.toBeInstanceOf(ValidationError);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).assignedToId).toBeNull();
  });
});

describe("logLeadActivity", () => {
  it("registrar un contacto sobre un lead NUEVO lo mueve a CONTACTADO y actualiza lastContactedAt", async () => {
    const owner = await testOwner();
    const lead = await makeLead();
    const res = await logLeadActivity(owner, { leadId: lead.id, type: "CALL", message: "Platicamos 10 min, quiere brunch" });
    expect(res.autoContacted).toBe(true);

    const updated = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(updated.status).toBe("CONTACTED");
    expect(updated.lastContactedAt).toBeInstanceOf(Date);

    const acts = await activitiesOf(lead.id);
    expect(acts.map((a) => a.type)).toEqual(["CALL", "STATUS_CHANGE"]);
    expect(acts[1]).toMatchObject({ fromStatus: "NEW", toStatus: "CONTACTED" });

    // Timeline (más reciente primero) conserva el orden lógico
    const detail = await getLeadDetail(owner, lead.id);
    expect(detail!.activities.map((a) => a.type)).toEqual(["STATUS_CHANGE", "CALL"]);
    expect(detail!.activities[0]!.actor?.name).toBe(owner.name);

    // Un segundo contacto ya no cambia el estado
    const again = await logLeadActivity(owner, { leadId: lead.id, type: "WHATSAPP", message: "Le mandé opciones" });
    expect(again.autoContacted).toBe(false);
    expect(await prisma.leadActivity.count({ where: { leadId: lead.id, type: "STATUS_CHANGE" } })).toBe(1);
  });

  it("una nota interna no cuenta como contacto", async () => {
    const owner = await testOwner();
    const lead = await makeLead();
    const res = await logLeadActivity(owner, { leadId: lead.id, type: "NOTE", message: "Prefiere sábados" });
    expect(res.autoContacted).toBe(false);
    const updated = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(updated).toMatchObject({ status: "NEW", lastContactedAt: null });
  });

  it("contacto sobre un lead CALIFICADO actualiza lastContactedAt sin cambiar estado", async () => {
    const owner = await testOwner();
    const lead = await makeLead({ status: "QUALIFIED" });
    await logLeadActivity(owner, { leadId: lead.id, type: "EMAIL", message: "Envié propuesta" });
    const updated = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(updated.status).toBe("QUALIFIED");
    expect(updated.lastContactedAt).not.toBeNull();
  });
});

// -----------------------------------------------------------------------------
// LISTADO / FILTROS
// -----------------------------------------------------------------------------

describe("listLeads (filtros)", () => {
  it("filtra por búsqueda, estado, origen, banderas, asignación y fechas; pagina y cuenta por estado", async () => {
    const owner = await testOwner();
    const token = uid("zq");
    const now = Date.now();
    const a = await makeLead({ name: `Ana ${token}`, status: "NEW", source: "WHATSAPP", eventDate: dateOnly("2031-05-10"), createdAt: new Date(now - 3 * DAY) });
    const b = await makeLead({ name: `Bea ${token}`, status: "CONTACTED", source: "INSTAGRAM", outOfArea: true, assignedToId: owner.id, eventDate: dateOnly("2031-06-20"), createdAt: new Date(now - 2 * DAY) });
    const c = await makeLead({ name: `Cris ${token}`, status: "LOST", source: "WHATSAPP", specialRequest: true, phone: "+52 55 4321 9876", createdAt: new Date(now - 1 * DAY) });

    const ids = (r: { items: Array<{ id: string }> }) => r.items.map((i) => i.id);

    // Texto (por defecto: más recientes primero)
    const all = await listLeads(owner, filters({ q: token }));
    expect(all.total).toBe(3);
    expect(ids(all)).toEqual([c.id, b.id, a.id]);

    // Estado (multi)
    expect(ids(await listLeads(owner, filters({ q: token, statuses: ["NEW", "LOST"] })))).toEqual([c.id, a.id]);
    // Origen
    expect(ids(await listLeads(owner, filters({ q: token, source: "WHATSAPP" })))).toEqual([c.id, a.id]);
    // Banderas
    expect(ids(await listLeads(owner, filters({ q: token, flags: ["outOfArea"] })))).toEqual([b.id]);
    expect(ids(await listLeads(owner, filters({ q: token, flags: ["special"] })))).toEqual([c.id]);
    // Asignación
    expect(ids(await listLeads(owner, filters({ q: token, assignedTo: owner.id })))).toEqual([b.id]);
    expect(ids(await listLeads(owner, filters({ q: token, assignedTo: "none" })))).toEqual([c.id, a.id]);
    // Rango por fecha del evento
    expect(ids(await listLeads(owner, filters({ q: token, from: "2031-06-01", to: "2031-06-30" })))).toEqual([b.id]);
    // Rango por fecha de registro (día local)
    const createdKey = localDateKey(new Date(now - 1 * DAY));
    expect(ids(await listLeads(owner, filters({ q: token, dateField: "created", from: createdKey, to: createdKey })))).toContain(c.id);
    // Búsqueda por código y por teléfono (dígitos)
    expect(ids(await listLeads(owner, filters({ q: a.code.toLowerCase() })))).toEqual([a.id]);
    expect(ids(await listLeads(owner, filters({ q: "4321 9876" })))).toContain(c.id);
    // Orden por fecha de evento (nulos al final)
    expect(ids(await listLeads(owner, filters({ q: token, sort: "event_asc" })))).toEqual([a.id, b.id, c.id]);

    // Paginación
    const p1 = await listLeads(owner, filters({ q: token }), { page: 1, pageSize: 2 });
    const p2 = await listLeads(owner, filters({ q: token }), { page: 2, pageSize: 2 });
    expect(p1.items).toHaveLength(2);
    expect(ids(p2)).toEqual([a.id]);
    // Página fuera de rango se ajusta a la última
    expect((await listLeads(owner, filters({ q: token }), { page: 99, pageSize: 2 })).page).toBe(2);

    // Conteo por estado ignora el filtro de estado
    const counts = await countLeadsByStatus(owner, filters({ q: token, statuses: ["NEW"] }));
    expect(counts).toMatchObject({ NEW: 1, CONTACTED: 1, LOST: 1, WON: 0, QUALIFIED: 0, QUOTED: 0 });

    // Kanban y exportación usan los mismos filtros
    const kanban = await listLeadsForKanban(owner, filters({ q: token }));
    expect(kanban.find((col) => col.status === "LOST")!.items.map((i) => i.id)).toEqual([c.id]);
    const exported = await listLeadsForExport(owner, filters({ q: token, source: "INSTAGRAM" }));
    expect(exported.map((r) => r.code)).toEqual([b.code]);
    expect(exported[0]).toMatchObject({ outOfArea: true, assignedToName: owner.name });
  });
});

// -----------------------------------------------------------------------------
// CAPTURA MANUAL Y EDICIÓN
// -----------------------------------------------------------------------------

describe("createManualLead / updateLead", () => {
  it("crea el lead con la clienta, timeline y asignación a quien lo captura", async () => {
    const owner = await testOwner();
    const email = `${uid("manual")}@example.test`;
    const res = await createManualLead(owner, {
      name: "Mariana Prueba",
      email,
      phone: `55 ${Math.floor(1000 + Math.random() * 8999)} ${Math.floor(1000 + Math.random() * 8999)}`,
      occasion: "BACHELORETTE",
      guestCount: 10,
      source: "INSTAGRAM",
      notes: "Llegó por un reel",
    });
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: res.leadId }, include: { customer: true, activities: true } });
    expect(lead).toMatchObject({ source: "INSTAGRAM", status: "NEW", assignedToId: owner.id, email, guestCount: 10 });
    expect(lead.customer?.email).toBe(email);
    expect(lead.activities.map((a) => a.type)).toEqual(["CREATED"]);

    // Segunda captura con el mismo correo reutiliza a la clienta
    const again = await createManualLead(owner, { name: "Mariana P.", email: email.toUpperCase(), occasion: "BIRTHDAY", source: "MANUAL" });
    expect(again.customerId).toBe(res.customerId);
  });

  it("BUG-014: la captura del equipo no envía avisos de lead entrante aunque el origen sea Instagram; la pública sí", async () => {
    const owner = await testOwner();
    const team = await createManualLead(owner, {
      name: "Captura Equipo",
      email: `${uid("equipo")}@example.test`,
      phone: newPhone(),
      occasion: "BIRTHDAY",
      source: "INSTAGRAM",
    });
    expect(await prisma.notificationLog.count({ where: { leadId: team.leadId } })).toBe(0);

    const pub = await submitContactRequest(
      contactFormSchema.parse({
        name: "Captura Pública",
        phone: newPhone(),
        email: `${uid("publica")}@example.test`,
        occasion: "BIRTHDAY",
        message: "Hola, queremos un brunch de cumpleaños.",
        consent: true,
      }),
    );
    const sent = await prisma.notificationLog.findMany({ where: { leadId: pub.leadId! }, select: { type: true } });
    expect(sent.map((n) => n.type)).toEqual(expect.arrayContaining(["LEAD_RECEIVED", "GENERIC"]));
  });

  it("BUG-008: reconoce a la clienta por teléfono aunque se haya guardado con otro formato; guarda la forma canónica", async () => {
    const owner = await testOwner();
    const national = newPhone();
    const spaced = `+52 ${national.slice(0, 2)} ${national.slice(2, 6)} ${national.slice(6)}`;
    // Dato previo a la forma canónica (perfil editado a mano / seed antiguo): no se modifica
    const legacy = await prisma.customer.create({
      data: { name: "Clienta Formato", phone: spaced, referralCode: uid("IR-").toUpperCase() },
    });

    const viaPanel = await createManualLead(owner, { name: "Otro Nombre", phone: `521${national}`, occasion: "BIRTHDAY", source: "WHATSAPP" });
    expect(viaPanel.customerId).toBe(legacy.id);
    const viaSite = await submitContactRequest(
      contactFormSchema.parse({
        name: "Clienta Formato",
        phone: national,
        email: `${uid("formato")}@example.test`,
        occasion: "BIRTHDAY",
        message: "Escribo otra vez por el sitio.",
        consent: true,
      }),
    );
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: viaSite.leadId! } });
    expect(lead.customerId).toBe(legacy.id);
    expect(lead.phone).toBe(`+52${national}`);
    expect(await prisma.customer.count({ where: { id: legacy.id, phone: spaced } })).toBe(1);

    // Un número distinto (mismos últimos dígitos, otra lada) no se confunde
    const other = await createManualLead(owner, { name: "Otra Clienta", phone: `+1 ${national.slice(0, 3)} ${national.slice(3)}`, occasion: "BIRTHDAY", source: "MANUAL" });
    expect(other.customerId).not.toBe(legacy.id);
  });

  it("edita datos, recalcula banderas y deja actividad + auditoría", async () => {
    const owner = await testOwner();
    const lead = await makeLead({ name: "Original", guestCount: 6 });
    const res = await updateLead(owner, {
      leadId: lead.id,
      name: "Nombre Nuevo",
      email: lead.email ?? undefined,
      occasion: "BIRTHDAY",
      guestCount: 40,
      zoneText: "Valle de Bravo",
      colors: "salvia, marfil ,",
      eventDate: "2031-03-14",
    });
    expect(res.changed).toEqual(expect.arrayContaining(["name", "guestCount", "zoneText", "colors", "eventDate"]));
    const updated = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(updated).toMatchObject({
      name: "Nombre Nuevo",
      guestCount: 40,
      specialRequest: true, // > máximo estándar (12 por defecto)
      outOfArea: true, // zona escrita sin zona de servicio
      colors: ["salvia", "marfil"],
    });
    expect(updated.eventDate?.toISOString().slice(0, 10)).toBe("2031-03-14");
    expect(await prisma.leadActivity.count({ where: { leadId: lead.id, type: "SYSTEM" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { entityId: lead.id, action: "lead.updated" } })).toBe(1);

    // Sin cambios: no escribe nada
    const noop = await updateLead(owner, {
      leadId: lead.id,
      name: "Nombre Nuevo",
      email: lead.email ?? undefined,
      occasion: "BIRTHDAY",
      guestCount: 40,
      zoneText: "Valle de Bravo",
      colors: "salvia, marfil",
      eventDate: "2031-03-14",
    });
    expect(noop.changed).toEqual([]);
    expect(await prisma.leadActivity.count({ where: { leadId: lead.id, type: "SYSTEM" } })).toBe(1);
  });

  it("rechaza referencias de catálogo inexistentes", async () => {
    const owner = await testOwner();
    const lead = await makeLead();
    const err = await updateLead(owner, {
      leadId: lead.id,
      name: lead.name,
      email: lead.email ?? undefined,
      occasion: "BIRTHDAY",
      experienceId: "no-existe",
    }).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).fieldErrors).toHaveProperty("experienceId");
  });
});

// -----------------------------------------------------------------------------
// CLIENTAS
// -----------------------------------------------------------------------------

async function makeEventFor(customerId: string) {
  const dateKey = localDateKey(new Date(Date.now() + 40 * DAY));
  return prisma.event.create({
    data: {
      code: uid("EV-").toUpperCase(),
      title: "Brunch de prueba",
      status: "CONFIRMED",
      customerId,
      eventDate: dateOnly(dateKey),
      startsAt: zonedDateTime(dateKey, "11:00"),
      endsAt: zonedDateTime(dateKey, "14:00"),
      guestCount: 8,
      micrositeSlug: uid("ms-"),
      inviteToken: generateToken(),
      portalToken: generateToken(),
    },
  });
}

describe("updateCustomer", () => {
  it("normaliza datos y audita", async () => {
    const owner = await testOwner();
    const customer = await makeCustomer();
    const email = `${uid("NUEVO")}@Example.TEST`;
    const res = await updateCustomer(owner, {
      customerId: customer.id,
      name: "  Sofía Actualizada ",
      email,
      phone: "55 1111 2222",
      whatsapp: "",
      instagram: "@sofi.brunch",
      notes: "Alérgica a nueces",
      marketingOptIn: true,
    });
    expect(res.changed).toEqual(expect.arrayContaining(["name", "email", "phone", "instagram", "notes", "marketingOptIn"]));
    const updated = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(updated).toMatchObject({
      name: "Sofía Actualizada",
      email: email.toLowerCase(),
      phone: "+525511112222", // forma canónica única del teléfono (BUG-008)
      whatsapp: null,
      instagram: "sofi.brunch",
      marketingOptIn: true,
    });
    expect(await prisma.auditLog.count({ where: { entityId: customer.id, action: "customer.updated" } })).toBe(1);

    // El mismo número escrito con otro formato no es un cambio (ni escribe ni audita)
    const same = await updateCustomer(owner, {
      customerId: customer.id,
      name: "Sofía Actualizada",
      email,
      phone: "+52 1 55 1111-2222",
      whatsapp: "",
      instagram: "@sofi.brunch",
      notes: "Alérgica a nueces",
      marketingOptIn: true,
    });
    expect(same.changed).toEqual([]);
    expect(await prisma.auditLog.count({ where: { entityId: customer.id, action: "customer.updated" } })).toBe(1);
  });

  it("correo duplicado: error amable en el campo email", async () => {
    const owner = await testOwner();
    const a = await makeCustomer("Clienta A");
    const b = await makeCustomer("Clienta B");
    const err = await updateCustomer(owner, {
      customerId: b.id,
      name: "Clienta B",
      email: a.email!.toUpperCase(),
      marketingOptIn: false,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).message).toMatch(/ya pertenece a otra clienta/);
    expect((err as ValidationError).fieldErrors?.email?.[0]).toMatch(/ya pertenece/);
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: b.id } })).email).toBe(b.email);
  });
});

describe("deleteCustomer", () => {
  it("bloquea la eliminación si tiene eventos", async () => {
    const owner = await testOwner();
    const customer = await makeCustomer();
    await makeEventFor(customer.id);
    const err = await deleteCustomer(owner, { customerId: customer.id }).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect((err as ConflictError).message).toMatch(/1 evento/);
    expect(await prisma.customer.count({ where: { id: customer.id } })).toBe(1);

    const detail = await getCustomerDetail(owner, customer.id);
    expect(detail!.blockers).toEqual(["Tiene 1 evento."]);
  });

  it("elimina si sólo tiene leads (quedan sin clienta) y audita customer.deleted", async () => {
    const owner = await testOwner();
    const customer = await makeCustomer();
    const lead = await makeLead({ customerId: customer.id });
    await deleteCustomer(owner, { customerId: customer.id });
    expect(await prisma.customer.count({ where: { id: customer.id } })).toBe(0);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).customerId).toBeNull();
    const log = await prisma.auditLog.findFirstOrThrow({ where: { entityId: customer.id, action: "customer.deleted" } });
    expect(log.actorId).toBe(owner.id);
  });

  it("staff no puede eliminar ni editar", async () => {
    const staff = await testStaff();
    const customer = await makeCustomer();
    await expect(deleteCustomer(staff, { customerId: customer.id })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      updateCustomer(staff, { customerId: customer.id, name: "X", marketingOptIn: false }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("listCustomers / getCustomerDetail", () => {
  it("calcula leads, eventos y total pagado neto de reembolsos", async () => {
    const owner = await testOwner();
    const name = `Paga ${uid()}`;
    const customer = await makeCustomer(name);
    await makeLead({ customerId: customer.id });
    await makeLead({ customerId: customer.id });
    const event = await makeEventFor(customer.id);
    const quote = await prisma.quote.create({
      data: {
        code: uid("Q-").toUpperCase(),
        publicToken: generateToken(),
        status: "ACCEPTED",
        customerId: customer.id,
        title: "Brunch",
        guestCount: 8,
        totalCents: 2_000_000,
      },
    });
    const booking = await prisma.booking.create({
      data: {
        code: uid("B-").toUpperCase(),
        quoteId: quote.id,
        customerId: customer.id,
        eventId: event.id,
        totalCents: 2_000_000,
        depositRequiredCents: 1_000_000,
        termsVersion: "test",
        termsAcceptedAt: new Date(),
        acceptedByName: name,
      },
    });
    const pay = (data: { kind: "DEPOSIT" | "BALANCE" | "REFUND"; status: "PAID" | "PENDING" | "PARTIAL_REFUND"; amountCents: number; refundedCents?: number }) =>
      prisma.payment.create({
        data: {
          bookingId: booking.id,
          provider: "manual",
          method: "TRANSFER",
          idempotencyKey: uid("idem"),
          paidAt: data.status === "PENDING" ? null : new Date(),
          refundedCents: data.refundedCents ?? 0,
          kind: data.kind,
          status: data.status,
          amountCents: data.amountCents,
        },
      });
    await pay({ kind: "DEPOSIT", status: "PAID", amountCents: 1_000_000 });
    await pay({ kind: "BALANCE", status: "PARTIAL_REFUND", amountCents: 1_000_000, refundedCents: 200_000 });
    await pay({ kind: "REFUND", status: "PAID", amountCents: 200_000 });
    await pay({ kind: "BALANCE", status: "PENDING", amountCents: 500_000 });

    const list = await listCustomers(owner, { q: name });
    expect(list.total).toBe(1);
    expect(list.items[0]).toMatchObject({ id: customer.id, leadsCount: 2, eventsCount: 1, totalPaidCents: 1_800_000 });
    expect(list.items[0]!.lastActivityAt).toBeInstanceOf(Date);

    const detail = await getCustomerDetail(owner, customer.id);
    expect(detail!.totalPaidCents).toBe(1_800_000);
    expect(detail!.payments).toHaveLength(4);
    expect(detail!.blockers).toHaveLength(3);
    expect(await getCustomerDetail(owner, "no-existe")).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// REVISIÓN QA: casos adicionales
// -----------------------------------------------------------------------------

describe("revisión: concurrencia, zonas, rango de registro y snapshot", () => {
  it("cambios de estado concurrentes nunca dejan un historial incoherente", async () => {
    const owner = await testOwner();
    const lead = await makeLead();
    const results = await Promise.allSettled([
      changeLeadStatus(owner, { leadId: lead.id, toStatus: "CONTACTED" }),
      changeLeadStatus(owner, { leadId: lead.id, toStatus: "QUALIFIED" }),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    expect(ok.length).toBeGreaterThanOrEqual(1);
    for (const r of results) if (r.status === "rejected") expect(r.reason).toBeInstanceOf(ConflictError);

    const acts = await prisma.leadActivity.findMany({
      where: { leadId: lead.id, type: "STATUS_CHANGE" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    // Una actividad por cambio aplicado y cadena from→to continua desde NEW
    expect(acts).toHaveLength(ok.length);
    expect(acts[0]!.fromStatus).toBe("NEW");
    for (let i = 1; i < acts.length; i++) expect(acts[i]!.fromStatus).toBe(acts[i - 1]!.toStatus);
    const final = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(final.status).toBe(acts.at(-1)!.toStatus);
  });

  it("al elegir una zona de servicio se descarta la zona escrita y se quita 'fuera de cobertura'", async () => {
    const owner = await testOwner();
    const area = await prisma.serviceArea.create({ data: { name: `Zona ${uid()}`, slug: uid("zona-"), active: true } });
    const lead = await makeLead({ name: "Zona Prueba" });
    const base = { leadId: lead.id, name: "Zona Prueba", email: lead.email ?? undefined, occasion: "BIRTHDAY" as const };

    await updateLead(owner, { ...base, zoneText: "Valle de Bravo" });
    expect(await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).toMatchObject({
      outOfArea: true,
      zoneText: "Valle de Bravo",
      serviceAreaId: null,
    });

    // El formulario conserva el texto oculto al cambiar a una zona del catálogo
    await updateLead(owner, { ...base, serviceAreaId: area.id, zoneText: "Valle de Bravo" });
    expect(await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).toMatchObject({
      outOfArea: false,
      zoneText: null,
      serviceAreaId: area.id,
    });

    await prisma.lead.update({ where: { id: lead.id }, data: { serviceAreaId: null } });
    await prisma.serviceArea.delete({ where: { id: area.id } });
  });

  it("el rango por fecha de registro usa el día de CDMX (bordes 00:00 y 23:59)", async () => {
    const owner = await testOwner();
    const token = uid("tz");
    // 2030-01-15 en CDMX (UTC-6) va de 06:00Z del 15 a 05:59:59Z del 16
    const inStart = await makeLead({ name: `In1 ${token}`, createdAt: new Date("2030-01-15T06:00:00.000Z") });
    const inEnd = await makeLead({ name: `In2 ${token}`, createdAt: new Date("2030-01-16T05:59:59.000Z") });
    const before = await makeLead({ name: `Out1 ${token}`, createdAt: new Date("2030-01-15T05:59:59.000Z") });
    const after = await makeLead({ name: `Out2 ${token}`, createdAt: new Date("2030-01-16T06:00:00.000Z") });
    const res = await listLeads(owner, filters({ q: token, dateField: "created", from: "2030-01-15", to: "2030-01-15" }));
    const got = res.items.map((i) => i.id).sort();
    expect(got).toEqual([inStart.id, inEnd.id].sort());
    expect(got).not.toContain(before.id);
    expect(got).not.toContain(after.id);
  });

  it("snapshot: costos, márgenes y avisos internos sólo para quien tiene financials:read", async () => {
    const owner = await testOwner();
    const staff = await testStaff();
    const lead = await makeLead();
    await prisma.configurationSnapshot.create({
      data: {
        leadId: lead.id,
        pricingVersion: "test",
        data: { guestCount: 8, startTime: "11:00", meta: { version: 2 } },
        estimate: {
          lines: [{ description: "Experiencia", quantity: 1, unitPriceCents: 1_000_000, totalPriceCents: 1_000_000 }],
          totalCents: 1_000_000,
          estimatedCostCents: 950_000,
          estimatedMarginCents: 50_000,
          marginBps: 500,
          belowMinMargin: true,
          warnings: [
            { code: "SPECIAL_REQUEST_GUESTS", message: "Grupo grande" },
            { code: "MARGIN_BELOW_MINIMUM", message: "Margen por debajo del mínimo" },
          ],
        },
      },
    });
    const detail = (await getLeadDetail(owner, lead.id))!;

    const forOwner = (await resolveLeadSnapshot(owner, detail))!;
    expect(forOwner.estimate!.warnings).toEqual(["Grupo grande"]);
    expect(forOwner.internal).toMatchObject({
      source: "snapshot",
      estimatedCostCents: 950_000,
      marginBps: 500,
      belowMinMargin: true,
      warnings: ["Margen por debajo del mínimo"],
    });
    expect(forOwner.data.fields.map((f) => f.key)).toEqual(["guestCount", "startTime"]);

    const forStaff = (await resolveLeadSnapshot(staff, detail))!;
    expect(forStaff.internal).toBeNull();
    expect(forStaff.estimate!.internal).toBeNull();
    expect(forStaff.estimate!.internalWarnings).toEqual([]);
    expect(forStaff.estimate!.warnings).toEqual(["Grupo grande"]);
  });
});
