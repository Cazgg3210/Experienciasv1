# Modelo de dominio

> Fuente de verdad: `prisma/schema.prisma`. Este documento explica el significado de negocio.

## Lenguaje del negocio

| Término | Significado |
|---|---|
| **Experiencia** (`Experience`) | Producto vendible pre-diseñado (Signature Brunch, Birthday Table, Karaoke & Mimosas, Bridal Brunch, Perú x México). Precio base que incluye N personas (`baseGuests`), invitada adicional, rango de personas, componentes de costo, zonas, estilos, menús y add-ons compatibles. |
| **Menú** (`Menu`, `MenuItem`) | Incluido o upgrade (por persona o por evento). `costPerGuestCents` = costo completo de los platillos por persona. |
| **Add-on** (`AddOn`) | Extra (karaoke, pastel, fotógrafo, mimosa bar…) fijo o por persona, con costo, categoría de costo e inventario requerido. |
| **Estilo** (`Style`) | Natural, elegante, romántico, divertido, minimal, colorido — con paleta. |
| **Zona** (`ServiceArea`) | Célula geográfica con tarifa y costo de logística. Fuera de zona → lead `OUT_OF_AREA`. |
| **Lead** | Solicitud de una posible clienta (configurador, IA, contacto, WhatsApp, manual) con snapshot de lo configurado. |
| **Cotización** (`Quote`) | Propuesta versionada con líneas, descuento, IVA, costo y margen estimado; enlace seguro para aceptar. |
| **Reserva** (`Booking`) | Acuerdo comercial al aceptar: términos aceptados, total, anticipo requerido, fecha límite de saldo. |
| **Evento** (`Event`) | La celebración: fecha/horario, dirección, invitadas, micrositio, portal, operación y costos. Su `status` es el estado de la reserva. |
| **Invitada** (`EventGuest`) | Persona invitada con RSVP, acompañante, restricciones alimentarias y link personal. |
| **Orden de producción** | Vista operativa del evento: qué, cuándo, dónde, quién, comida, mesa, add-ons, staff, transporte, checklist. |
| **Memory Capsule** | Galería + mensajes post-evento compartibles con consentimiento. |

## Reglas de precio (QuoteEngine)

`src/features/quotes/domain/quote-engine.ts` — puro y probado.

1. **Base**: precio base de la experiencia (incluye `baseGuests`). Si vienen menos personas se cobra la base (aviso).
2. **Invitadas adicionales**: `(invitadas − baseGuests) × extraGuestPrice`; costo `× extraGuestCost`.
3. **Menú**: `INCLUDED` (precio 0), `PER_GUEST` (× invitadas facturables) o `FLAT`; su costo por persona siempre se suma.
4. **Add-ons**: `FLAT × cantidad` o `PER_GUEST × invitadas × cantidad`, limitados a `maxQuantity`.
5. **Logística**: tarifa de la zona (precio) y su costo (TRANSPORT).
6. **Conceptos personalizados** (admin).
7. **Descuento**: porcentaje (bps) o monto; nunca mayor al subtotal. Requiere permiso y queda auditado.
8. **IVA** (16% configurable): incluido en precios por defecto (se desglosa) o sumado al final.
9. **Costo estimado** por categoría (FOOD, FLOWERS, STAFF, TRANSPORT, VENDOR, CONSUMABLES, PAYMENT_FEE, OTHER)
   incluyendo comisión estimada de la pasarela (`paymentFeeBps` + fijo) sobre el total.
10. **Margen** = ingreso neto de IVA − costo estimado; `marginBps` sobre ingreso neto. Alertas: bajo el mínimo
    configurado (`minMarginBps`) y negativo — nunca se ocultan.
11. **Anticipo**: `depositBps` del total (default 50%); saldo = total − anticipo, con fecha límite
    (`balanceDueDaysBefore` antes del evento).

Grupos mayores a `maxStandardGuests` (12) se aceptan como **consulta especial**.

## Clientas, teléfonos y captura de leads

- **Teléfono canónico** (`@/lib/phone` → `normalizePhone`): se guarda en E.164 — `+52` + 10 dígitos para México
  (se aceptan 10 dígitos, `+52`, `52`, el prefijo legado `521` y espacios/guiones/puntos/paréntesis) y `+lada…` para
  otros países. Toda escritura de clientas y leads usa esta forma; los esquemas Zod validan con la misma función.
- **Busca o crea clienta** (`findCustomerByContact`): primero por correo y luego por teléfono, comparando sólo dígitos
  contra las formas del mismo número (reconoce datos guardados antes de la forma canónica). La usan la captura de
  leads (`createInboundLead`), el alta manual de evento y la cotización con «Clienta nueva».
- **Avisos de lead entrante** («Recibimos tu solicitud» a la clienta y «Nuevo lead» al equipo): sólo cuando el lead
  entra por un canal público (configurador, diseñador IA, contacto). Una captura del equipo en el panel no avisa,
  sea cual sea su origen comercial (Instagram, WhatsApp, recomendación…).

## Disponibilidad (V1)

`src/features/bookings/domain/availability.ts`: reglas por día de la semana (abierto, máximo de eventos, horario),
excepciones por fecha (`BLOCKED`, `BLACKOUT`, `CAPACITY_OVERRIDE`, opcionalmente por zona), anticipación mínima y
máxima, buffer entre eventos (traslapes) y capacidad diaria contando eventos en
`PENDING_PAYMENT | CONFIRMED | PLANNING | READY | IN_PROGRESS` (evita double-booking básico). Se re-valida al aceptar
la cotización y al reprogramar (excluyendo el propio evento).

## Ciclo de vida

```
Lead NEW ─contacto→ CONTACTED ─→ QUALIFIED ─cotización→ QUOTED ─aceptación→ WON
                                                            └────────────→ LOST (con motivo)
Quote DRAFT ─enviar→ SENT ─aceptar→ ACCEPTED ─→ Booking + Event(PENDING_PAYMENT)
                       ├─rechazar→ REJECTED   └─vence→ EXPIRED (cron o al abrirla)
Event PENDING_PAYMENT ─anticipo cubierto (webhook/manual)→ CONFIRMED ─→ PLANNING ─→ READY ─→ IN_PROGRESS ─→ COMPLETED ─cierre→ closedAt
                       └──────────────────────────── CANCELLED (con motivo; libera inventario)
```

Al confirmar (`onEventConfirmed`): se instancian checklists desde plantillas (T-7, T-3, T-1, montaje, evento,
desmontaje, cierre; `dueAt = inicio + offset`) y se reservan los requerimientos de inventario (experiencia + add-ons,
por persona o fijos) reportando faltantes por fecha.

## Pagos

`Payment.kind`: DEPOSIT, BALANCE, FULL, REFUND. Pagado neto = Σ(PAID/PARTIAL_REFUND/REFUNDED − reembolsado) de pagos
no-REFUND. Saldo = total − pagado neto (nunca negativo). El anticipo está cubierto cuando pagado neto ≥ anticipo requerido.
Pagos manuales (efectivo, transferencia, terminal) y reembolsos quedan auditados.

## Costeo real y cierre

Costo real por evento = compras **recibidas** (monto real por categoría) + asignaciones de staff (STAFF) + comisiones de
pagos (PAYMENT_FEE) + costos manuales (`EventCost`). Margen real = ingreso neto − costo real. Al cerrar un evento
`COMPLETED` se guarda `closingSnapshot` con venta, costos estimado/real y márgenes (auditado), y se dispara el
seguimiento post-evento (memory capsule y solicitud de reseña).

## Configuración

Secciones en `Setting` validadas con Zod (`src/features/settings/domain/settings-schema.ts`), todas con defaults:
`business`, `pricing`, `availability`, `notifications`, `flags`. Feature flags: valor de la DB > variable de entorno.

## Analytics internos

`AnalyticsEvent.type`: VIEW_EXPERIENCE, START_CONFIGURATOR, COMPLETE_CONFIGURATOR, SUBMIT_LEAD, VIEW_QUOTE, ACCEPT_QUOTE,
START_PAYMENT, PAYMENT_SUCCESS, RSVP_SUBMIT, AI_DESIGN_GENERATED → embudo en `/admin/analytics`.
