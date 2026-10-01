import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DIETARY_LABELS, EVENT_STATUS_LABELS, OCCASION_LABELS, RSVP_STATUS_LABELS } from "@/lib/labels";
import { formatMXN } from "@/lib/money";
import { formatDateTime, formatLongDate } from "@/lib/dates";
import { capitalize } from "../domain/portal";
import type { PortalDashboard } from "../server/portal-service";
import { MenuList } from "./menu-list";
import { PrintButton } from "./print-button";

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Resumen imprimible del evento (Imprimir / Guardar PDF). */
export function PortalSummaryView({ data }: { data: PortalDashboard }) {
  const { event, payment, stats } = data;
  const colors = event.colors.filter((c) => HEX.test(c));
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 print:max-w-none print:px-0 print:py-0">
      <style>{`@page { size: A4; margin: 14mm; } @media print { html, body { background: #fff !important; } }`}</style>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <Button asChild variant="ghost" className="h-11 w-fit rounded-full px-4">
          <Link href={`/mi-evento/${data.token}`}>
            <ArrowLeft aria-hidden /> Volver a mi evento
          </Link>
        </Button>
        <PrintButton />
      </div>

      <article className="bg-card space-y-8 rounded-3xl border p-6 shadow-xs sm:p-10 print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="border-b pb-6">
          <p className="eyebrow">
            {data.business.brandName} · Resumen de tu evento · {event.code}
          </p>
          <h1 className="font-heading mt-2 text-4xl font-semibold text-balance">{event.title}</h1>
          <p className="mt-2 text-lg">
            {capitalize(event.dateLabel)} · {event.startTime} – {event.endTime} h
          </p>
          <p className="text-muted-foreground text-sm">
            {OCCASION_LABELS[event.occasion]}
            {event.honoreeName ? ` · Homenajeada: ${event.honoreeName}` : ""} · Anfitriona: {data.host.name} · Estado:{" "}
            {EVENT_STATUS_LABELS[event.status]}
          </p>
        </header>

        <section aria-labelledby="r-ubicacion" className="grid gap-6 sm:grid-cols-2 print:grid-cols-2">
          <div>
            <h2 id="r-ubicacion" className="font-heading text-2xl font-semibold">
              Ubicación
            </h2>
            {event.addressLine ? (
              <address className="mt-2 not-italic">
                <p className="font-medium">{event.addressLine}</p>
                <p className="text-muted-foreground text-sm">
                  {[event.neighborhood, event.postalCode ? `C.P. ${event.postalCode}` : null, event.city]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {event.addressNotes ? <p className="mt-2 text-sm">Acceso: {event.addressNotes}</p> : null}
              </address>
            ) : (
              <p className="text-muted-foreground mt-2 text-sm">Dirección pendiente.</p>
            )}
          </div>
          <div>
            <h2 className="font-heading text-2xl font-semibold">Pago</h2>
            {payment ? (
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Total</dt>
                <dd className="tabular text-right font-medium">{formatMXN(payment.totalCents)}</dd>
                <dt className="text-muted-foreground">Pagado</dt>
                <dd className="tabular text-right font-medium">{formatMXN(payment.paidCents)}</dd>
                <dt className="text-muted-foreground">Saldo</dt>
                <dd className="tabular text-right font-semibold">{formatMXN(payment.balanceCents)}</dd>
                {payment.balanceCents > 0 && payment.balanceDueAt ? (
                  <>
                    <dt className="text-muted-foreground">Fecha límite</dt>
                    <dd className="text-right">{formatLongDate(payment.balanceDueAt)}</dd>
                  </>
                ) : null}
              </dl>
            ) : (
              <p className="text-muted-foreground mt-2 text-sm">Sin información de pago.</p>
            )}
          </div>
        </section>

        <section aria-labelledby="r-invitadas" className="print:break-inside-auto">
          <h2 id="r-invitadas" className="font-heading text-2xl font-semibold">
            Invitadas
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {stats.attending} confirmadas · {stats.pending} pendientes · {stats.maybe} tal vez · {stats.notAttending} no
            asisten · Personas esperadas: {stats.headcount} (experiencia para {event.guestCount})
          </p>
          {data.guests.length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Nombre
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Respuesta
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Acompañante
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Restricciones / notas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.guests.map((g) => (
                    <tr key={g.id} className="border-b border-dashed align-top print:break-inside-avoid">
                      <td className="py-2 pr-3">{g.name}</td>
                      <td className="py-2 pr-3">{RSVP_STATUS_LABELS[g.rsvpStatus]}</td>
                      <td className="py-2 pr-3">{g.plusOne ? g.plusOneName || "Sí" : "—"}</td>
                      <td className="py-2">
                        {[g.dietaryRestrictions.map((d) => DIETARY_LABELS[d]).join(", "), g.dietaryNotes]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground mt-2 text-sm">Aún no hay invitadas registradas.</p>
          )}
        </section>

        <section aria-labelledby="r-menu">
          <h2 id="r-menu" className="font-heading mb-3 text-2xl font-semibold">
            Menú
          </h2>
          <MenuList
            menu={data.menu}
            includes={data.experience?.includes}
            experienceName={data.experience?.name}
            addOns={data.addOns}
            compact
          />
        </section>

        <section aria-labelledby="r-programa" className="print:break-inside-avoid">
          <h2 id="r-programa" className="font-heading text-2xl font-semibold">
            Programa
          </h2>
          {data.timeline.length ? (
            <ol className="mt-2 space-y-1 text-sm">
              {data.timeline.map((t) => (
                <li key={t.id} className="grid grid-cols-[3.5rem_1fr] gap-2">
                  <span className="tabular font-semibold">{t.time}</span>
                  <span>
                    {t.title}
                    {t.description ? <span className="text-muted-foreground"> — {t.description}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground mt-2 text-sm">Programa por definir.</p>
          )}
        </section>

        <section aria-labelledby="r-pref" className="print:break-inside-avoid">
          <h2 id="r-pref" className="font-heading text-2xl font-semibold">
            Preferencias
          </h2>
          <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 print:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Colores</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {colors.length
                  ? colors.map((c) => (
                      <span key={c} className="inline-flex items-center gap-1">
                        <span
                          className="inline-block size-4 rounded-full border"
                          style={{ backgroundColor: c, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
                          aria-hidden
                        />
                        <span className="tabular text-xs uppercase">{c}</span>
                      </span>
                    ))
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Código de vestimenta</dt>
              <dd>{event.dressCode ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2 print:col-span-2">
              <dt className="text-muted-foreground">Mensaje para invitadas</dt>
              <dd className="whitespace-pre-line">{event.hostMessage ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2 print:col-span-2">
              <dt className="text-muted-foreground">Notas para el equipo</dt>
              <dd className="whitespace-pre-line">{event.customerNotes ?? "—"}</dd>
            </div>
          </dl>
        </section>

        <footer className="text-muted-foreground border-t pt-4 text-xs">
          Generado el {formatDateTime(data.now)} · {data.business.brandName} · {data.business.contactEmail}
        </footer>
      </article>
    </div>
  );
}
