import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ExternalLink, MapPin, MessageCircle, Phone, Utensils } from "lucide-react";
import { StatusBadge } from "@/components/data/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatDateTime, formatLongDate, localTime } from "@/lib/dates";
import {
  ADDON_CATEGORY_LABELS,
  DIETARY_LABELS,
  INVENTORY_CATEGORY_LABELS,
  INVENTORY_RESERVATION_LABELS,
  MENU_COURSE_LABELS,
  OCCASION_LABELS,
  RSVP_STATUS_LABELS,
} from "@/lib/labels";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { whatsappLink } from "@/server/providers/whatsapp/links";
import { fullAddress, mapsLink, ucfirst } from "@/features/operations/domain/production";
import { toLocalInputValue } from "@/features/operations/domain/assignment";
import { getProductionOrder } from "@/features/operations/server/ops-queries";
import { ChecklistBoard } from "@/features/operations/components/checklist-board";
import { StaffAssignments } from "@/features/operations/components/staff-assignments";
import { LogisticsForm } from "@/features/operations/components/logistics-form";
import { AddOnNotesForm } from "@/features/operations/components/addon-notes-form";
import { PrintButton } from "@/features/operations/components/print-button";
import { ProgressBar } from "@/features/operations/components/progress-bar";
import { ColorSwatches, InfoList, OpsSection, SubCard } from "@/features/operations/components/production-parts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Orden de producción" };

const PRINT_CSS = `@media print {
  aside, header.sticky, nav { display: none !important; }
  #contenido { max-width: none !important; padding: 0 !important; }
  body { font-size: 11pt; }
  a[href^="http"]::after { content: ""; }
}`;

const NAV = [
  { id: "resumen", label: "Resumen" },
  { id: "comida", label: "Comida" },
  { id: "mesa", label: "Mesa" },
  { id: "addons", label: "Add-ons" },
  { id: "staff", label: "Staff" },
  { id: "transporte", label: "Transporte" },
  { id: "checklist", label: "Checklist" },
];

export default async function EventOperationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission("operations:read", `/admin/events/${id}/operations`);
  const order = await getProductionOrder(id);
  if (!order) notFound();

  const { event, customer, headCount, portions, dietary } = order;
  const canChecklist = can(user.role, "checklists:write");
  const canStaff = can(user.role, "staff:write");
  const canEvent = can(user.role, "events:write");
  const cancelled = event.status === "CANCELLED";
  const address = fullAddress(event);
  const maps = mapsLink(event);
  const clientPhone = customer.whatsapp ?? customer.phone;
  const floral = order.addOns.filter((a) => a.floral);
  const assignedIds = new Set(order.assignments.map((a) => a.staffMemberId));
  const time = (d: Date | null) => (d ? localTime(d) : "—");

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Impresión: sólo la orden (sin barra lateral, encabezado del panel ni pestañas). */}
      <style>{PRINT_CSS}</style>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Operaciones · {event.code}</p>
          <h2 className="font-heading text-2xl font-semibold sm:text-3xl">Orden de producción</h2>
          <p className="text-muted-foreground text-sm">
            {ucfirst(formatLongDate(event.eventDate))} · {time(event.startsAt)}–{time(event.endsAt)} · Generada {formatDateTime(new Date())}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <ProgressBar progress={order.progress} label="Avance del checklist" className="w-48" />
          <PrintButton label="Imprimir orden" />
        </div>
      </div>

      {cancelled ? (
        <div role="alert" className="border-destructive/30 bg-destructive/5 text-destructive flex items-center gap-2 rounded-xl border px-4 py-3 text-sm">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          Este evento está cancelado. La orden queda como referencia; no se pueden asignar personas ni generar tareas.
        </div>
      ) : null}

      <nav aria-label="Secciones de la orden" className="bg-background/95 sticky top-14 z-20 -mx-1 overflow-x-auto px-1 py-2 backdrop-blur print:hidden">
        <ul className="flex gap-1.5">
          {NAV.map((n) => (
            <li key={n.id}>
              <a
                href={`#${n.id}`}
                className="hover:bg-sage-soft hover:text-olive focus-visible:ring-ring/50 inline-flex h-8 items-center rounded-full border px-3 text-sm whitespace-nowrap outline-none focus-visible:ring-3"
              >
                {n.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* ------------------------------------------------------------------ RESUMEN */}
      <OpsSection id="resumen" title="Resumen" description="Qué, cuándo, dónde y quién.">
        <div className="grid gap-4 md:grid-cols-2">
          <SubCard title="Qué">
            <InfoList
              rows={[
                ["Experiencia", order.experience?.name ?? "Sin experiencia"],
                ["Ocasión", OCCASION_LABELS[event.occasion]],
                ["Menú", order.menu?.name ?? "Sin menú asignado"],
                ["Estilo", order.style?.name ?? "—"],
                [
                  "Add-ons",
                  order.addOns.length ? order.addOns.map((a) => `${a.name}${a.quantity > 1 ? ` ×${a.quantity}` : ""}`).join(", ") : "Ninguno",
                ],
              ]}
            />
          </SubCard>
          <SubCard title="Cuándo">
            <InfoList
              rows={[
                ["Fecha", ucfirst(formatLongDate(event.eventDate))],
                ["Horario", `${time(event.startsAt)}–${time(event.endsAt)}`],
                ["Salida de bodega", event.departureAt ? formatDateTime(event.departureAt) : "Por definir"],
                ["Montaje", event.setupStartsAt ? formatDateTime(event.setupStartsAt) : "Por definir"],
                ["Desmontaje", event.teardownAt ? formatDateTime(event.teardownAt) : "Por definir"],
              ]}
            />
          </SubCard>
          <SubCard title="Dónde">
            <InfoList
              rows={[
                ["Dirección", address ?? "Sin dirección registrada"],
                ["Zona", order.serviceArea?.name ?? "—"],
                ["Acceso", event.addressNotes ?? "Sin notas de acceso"],
              ]}
            />
            {maps ? (
              <a
                href={maps}
                target="_blank"
                rel="noreferrer"
                className="text-olive mt-3 inline-flex items-center gap-1.5 text-sm font-medium hover:underline print:hidden"
              >
                <MapPin className="size-4" aria-hidden />
                Abrir en Maps
                <ExternalLink className="size-3" aria-hidden />
              </a>
            ) : null}
          </SubCard>
          <SubCard title="Quién">
            <InfoList
              rows={[
                [
                  "Clienta",
                  <span key="c" className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {customer.name}
                    {clientPhone ? (
                      <>
                        <a href={`tel:${clientPhone}`} className="text-olive inline-flex items-center gap-1 hover:underline">
                          <Phone className="size-3.5" aria-hidden />
                          {clientPhone}
                        </a>
                        <a
                          href={whatsappLink(clientPhone)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-olive inline-flex items-center gap-1 hover:underline print:hidden"
                        >
                          <MessageCircle className="size-3.5" aria-hidden />
                          WhatsApp
                        </a>
                      </>
                    ) : null}
                  </span>,
                ],
                ["Homenajeada", event.honoreeName ?? "—"],
                [
                  "Invitadas",
                  <span key="i">
                    {headCount.planned} planeadas · {headCount.confirmedTotal} confirmadas
                    {headCount.plusOnes ? ` (incluye ${headCount.plusOnes} acompañantes)` : ""} · {headCount.pending} sin responder
                  </span>,
                ],
                ["Dress code", event.dressCode ?? "—"],
              ]}
            />
          </SubCard>
        </div>
        {event.customerNotes || event.internalNotes || event.inspiration ? (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {event.customerNotes ? (
              <SubCard title="Notas de la clienta">
                <p className="text-sm whitespace-pre-line">{event.customerNotes}</p>
              </SubCard>
            ) : null}
            {event.inspiration ? (
              <SubCard title="Inspiración">
                <p className="text-sm whitespace-pre-line">{event.inspiration}</p>
              </SubCard>
            ) : null}
            {event.internalNotes ? (
              <SubCard title="Notas internas">
                <p className="text-sm whitespace-pre-line">{event.internalNotes}</p>
              </SubCard>
            ) : null}
          </div>
        ) : null}
      </OpsSection>

      {/* ------------------------------------------------------------------ COMIDA */}
      <OpsSection id="comida" title="Comida" description={order.menu ? `Menú ${order.menu.name}` : "Sin menú asignado"}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,16rem)_1fr]">
          <div className="bg-sage-soft/60 rounded-xl p-4">
            <p className="eyebrow">Porciones a preparar</p>
            <p className="font-heading text-olive mt-1 text-5xl font-semibold tabular-nums">{portions.total}</p>
            <ul className="text-muted-foreground mt-3 space-y-1 text-xs">
              <li>
                Mayor entre {headCount.planned} planeadas y {headCount.confirmedTotal} confirmadas (con acompañantes).
              </li>
              <li>Margen de cortesía sugerido: +{portions.buffer} porción{portions.buffer === 1 ? "" : "es"}.</li>
              {portions.baseGuests ? (
                <li>
                  Escala sobre receta base de {portions.baseGuests} personas: <strong className="text-foreground">×{portions.factor}</strong>
                </li>
              ) : null}
            </ul>
          </div>
          {order.courses.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Platillos del menú por tiempo con cantidades</caption>
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs">
                    <th scope="col" className="py-2 pr-3 font-medium">Tiempo</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Platillo</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Cantidad</th>
                    <th scope="col" className="py-2 font-medium">Notas de escala</th>
                  </tr>
                </thead>
                <tbody>
                  {order.courses.flatMap((c) =>
                    c.items.map((item, idx) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="text-muted-foreground py-2 pr-3 align-top text-xs">{idx === 0 ? MENU_COURSE_LABELS[c.course] : ""}</td>
                        <td className="py-2 pr-3 align-top">
                          <p className="font-medium">{item.name}</p>
                          {item.description ? <p className="text-muted-foreground text-xs">{item.description}</p> : null}
                          {item.dietaryTags.length ? (
                            <p className="text-olive text-xs">{item.dietaryTags.map((t) => DIETARY_LABELS[t]).join(" · ")}</p>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3 text-right align-top font-medium tabular-nums">{portions.total}</td>
                        <td className="text-muted-foreground py-2 align-top text-xs">
                          1 por persona
                          {portions.baseGuests ? ` · receta ×${portions.factor}` : ""}
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={Utensils} title="Sin platillos" description="Asigna un menú al evento para ver la producción de cocina." />
          )}
        </div>

        <div className="mt-6">
          <h3 className="font-heading text-lg font-semibold">Restricciones alimentarias</h3>
          <p className="text-muted-foreground mb-3 text-xs">
            De invitadas que asisten o aún no responden ({dietary.totalGuestsWithNeeds} con indicaciones).
          </p>
          {dietary.byRestriction.length === 0 && dietary.notesOnly.length === 0 ? (
            <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">Nadie ha reportado restricciones todavía.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {dietary.byRestriction.map((r) => (
                <div key={r.restriction} className="rounded-xl border p-3 print:break-inside-avoid">
                  <p className="flex items-center justify-between gap-2 font-medium">
                    {DIETARY_LABELS[r.restriction]}
                    <span className="bg-warning/10 text-warning rounded-full px-2 text-xs tabular-nums">{r.guests.length}</span>
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {r.guests.map((g, i) => (
                      <li key={`${g.name}-${i}`}>
                        {g.name}
                        {g.rsvpStatus !== "ATTENDING" ? (
                          <span className="text-muted-foreground text-xs"> ({RSVP_STATUS_LABELS[g.rsvpStatus].toLowerCase()})</span>
                        ) : null}
                        {g.notes ? <span className="text-muted-foreground block text-xs">“{g.notes}”</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {dietary.notesOnly.length ? (
                <div className="rounded-xl border p-3 print:break-inside-avoid">
                  <p className="font-medium">Otras indicaciones</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {dietary.notesOnly.map((g, i) => (
                      <li key={`${g.name}-${i}`}>
                        {g.name}: <span className="text-muted-foreground">“{g.notes}”</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </OpsSection>

      {/* ------------------------------------------------------------------ MESA */}
      <OpsSection id="mesa" title="Mesa" description="Vajilla, cristalería, mantelería y cubiertos reservados para este evento.">
        <ReservationTable rows={order.tableReservations} empty="No hay vajilla ni mantelería reservada todavía." />
        {order.otherReservations.length ? (
          <div className="mt-5">
            <h3 className="font-heading mb-2 text-lg font-semibold">Decoración, servicio y equipo</h3>
            <ReservationTable rows={order.otherReservations} empty="" />
          </div>
        ) : null}
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <SubCard title="Colores del evento">
            <ColorSwatches colors={event.colors} label="Colores del evento" />
          </SubCard>
          <SubCard title={order.style ? `Paleta · ${order.style.name}` : "Paleta de estilo"}>
            <ColorSwatches colors={order.style?.palette ?? []} label="Paleta del estilo" />
          </SubCard>
          <SubCard title="Flores">
            {floral.length ? (
              <ul className="space-y-1 text-sm">
                {floral.map((f) => (
                  <li key={f.id}>
                    {f.name}
                    {f.quantity > 1 ? ` ×${f.quantity}` : ""}
                    {f.notes ? <span className="text-muted-foreground block text-xs">{f.notes}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">Flores incluidas en la experiencia; sin add-ons florales.</p>
            )}
          </SubCard>
        </div>
      </OpsSection>

      {/* ------------------------------------------------------------------ ADD-ONS */}
      <OpsSection id="addons" title="Add-ons" description="Extras contratados con sus notas operativas.">
        {order.addOns.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">Este evento no tiene add-ons.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {order.addOns.map((a) => (
              <li key={a.id} className="rounded-xl border p-4 print:break-inside-avoid">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {a.name}
                    <span className="text-muted-foreground font-normal"> ×{a.quantity}</span>
                  </p>
                  <StatusBadge tone="brand" dot={false}>
                    {ADDON_CATEGORY_LABELS[a.category]}
                  </StatusBadge>
                </div>
                {a.description ? <p className="text-muted-foreground mb-2 text-xs">{a.description}</p> : null}
                <AddOnNotesForm id={a.id} name={a.name} notes={a.notes} canWrite={canEvent} />
              </li>
            ))}
          </ul>
        )}
      </OpsSection>

      {/* ------------------------------------------------------------------ STAFF */}
      <OpsSection id="staff" title="Staff" description="Quién trabaja, en qué horario y cuánto se le paga.">
        <StaffAssignments
          eventId={event.id}
          eventStartsAt={event.startsAt.toISOString()}
          eventEndsAt={event.endsAt.toISOString()}
          assignments={order.assignments}
          staffOptions={order.staffOptions}
          canWrite={canStaff}
          eventCancelled={cancelled}
        />
      </OpsSection>

      {/* ------------------------------------------------------------------ TRANSPORTE */}
      <OpsSection
        id="transporte"
        title="Transporte y montaje"
        description={`El evento es de ${time(event.startsAt)} a ${time(event.endsAt)}. Los cambios quedan en la bitácora de auditoría.`}
      >
        <LogisticsForm
          eventId={event.id}
          departureAt={toLocalInputValue(event.departureAt)}
          setupStartsAt={toLocalInputValue(event.setupStartsAt)}
          teardownAt={toLocalInputValue(event.teardownAt)}
          canWrite={canEvent && !cancelled}
        />
      </OpsSection>

      {/* ------------------------------------------------------------------ CHECKLIST */}
      <OpsSection id="checklist" title="Checklist" description="Por fase y área. Las tareas con cámara requieren foto para cerrarse.">
        <ChecklistBoard
          eventId={event.id}
          items={order.checklist}
          staffOptions={order.staffOptions.map((s) => ({ id: s.id, name: s.name, assigned: assignedIds.has(s.id) }))}
          canWrite={canChecklist}
          eventCancelled={cancelled}
        />
      </OpsSection>

      <p className="text-muted-foreground text-center text-xs print:hidden">
        <Link href="/admin/operations" className="hover:underline">
          Volver al tablero de operaciones
        </Link>
      </p>
    </div>
  );
}

function ReservationTable({
  rows,
  empty,
}: {
  rows: Array<{
    id: string;
    quantity: number;
    status: keyof typeof INVENTORY_RESERVATION_LABELS;
    notes: string | null;
    inventoryItem: { name: string; sku: string; category: keyof typeof INVENTORY_CATEGORY_LABELS; unit: string };
  }>;
  empty: string;
}) {
  if (!rows.length) return empty ? <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">{empty}</p> : null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Artículos reservados de inventario</caption>
        <thead>
          <tr className="text-muted-foreground border-b text-left text-xs">
            <th scope="col" className="py-2 pr-3 font-medium">Artículo</th>
            <th scope="col" className="py-2 pr-3 font-medium">Categoría</th>
            <th scope="col" className="py-2 pr-3 font-medium">SKU</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">Cantidad</th>
            <th scope="col" className="py-2 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b last:border-0">
              <td className="py-2 pr-3">
                {r.inventoryItem.name}
                {r.notes ? <span className="text-muted-foreground block text-xs">{r.notes}</span> : null}
              </td>
              <td className="text-muted-foreground py-2 pr-3">{INVENTORY_CATEGORY_LABELS[r.inventoryItem.category]}</td>
              <td className="py-2 pr-3 font-mono text-xs">{r.inventoryItem.sku}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {r.quantity} {r.inventoryItem.unit}
              </td>
              <td className="py-2">
                <StatusBadge tone={r.status === "RESERVED" ? "info" : r.status === "CHECKED_OUT" ? "brand" : r.status === "RETURNED" ? "success" : "muted"}>
                  {INVENTORY_RESERVATION_LABELS[r.status]}
                </StatusBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
