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
  otros países (11 a 15 dígitos). El número nacional empieza del 2 al 9; una lada `52` sólo vale con su longitud
  mexicana y con `+` al inicio siempre viene la lada (`+` + 10 dígitos no es un número nacional). Toda escritura de
  clientas y leads usa esta forma; los esquemas Zod validan con la misma función, y los enlaces wa.me y los avisos por
  WhatsApp usan la misma regla (`whatsappDigits` = forma canónica sin `+`). Un teléfono guardado antes con un
  formato que esta regla rechaza (p. ej. `044…`, `+52` con dígitos de más o de menos) hay que corregirlo al editar el
  perfil o el lead: es un dato que tampoco funcionaría para WhatsApp.
- **Busca o crea clienta** (`findCustomerByContact`): primero por correo y luego por teléfono o WhatsApp (forma
  canónica exacta y, como respaldo, sólo dígitos contra las formas del mismo número para datos guardados antes de la
  forma canónica). Si se escribió un correo, el teléfono sólo reconoce a una clienta **sin** correo: el mismo teléfono
  con otro correo es otra persona (dos clientas pueden compartir teléfono) y se crea la nueva. Se serializa por correo
  y número (`lockCustomerContact`), así dos capturas simultáneas no crean dos clientas. La usan la captura de leads
  (`createInboundLead`), el alta manual de evento y la cotización con «Clienta nueva».
- **Datos de contacto de una clienta que ya existía** (`contactUpdateForExisting`): lo que captura el equipo completa
  los campos vacíos (nunca sobrescribe). Lo que llega por el sitio público **nunca** se agrega a su perfil —cualquiera
  puede escribir el teléfono o el correo de otra persona y recibiría sus enlaces de cotización, portal y pagos—: queda
  en el lead y el timeline del lead pide confirmarlo con ella antes de actualizar el perfil.
- **Búsqueda por teléfono** en Clientas, Eventos, Cotizaciones y los selectores de clienta: tolera formatos ("+52 1 55…",
  "(55) 1234-5678") y encuentra también filas guardadas antes de la forma canónica (`customerPhoneSearchFilter`).
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

**Checkout en línea** (`startCheckout`): se serializa por reserva con el candado de la reserva, pero nunca lo retiene
durante la llamada a la pasarela: (1) con el candado se reserva el pago (`PENDING` sin `checkoutUrl`), (2) sin
transacción la pasarela abre la sesión, (3) con el candado se publica la URL sólo si el pago sigue reservado y la reserva
no está cancelada. Una solicitud simultánea del mismo cobro espera y reutiliza esa URL; una cancelación a la mitad anula
el lugar reservado y la sesión que abrió la pasarela se expira sin entregarse. Al cancelar un evento, sus checkouts
abiertos pasan a `FAILED` «Evento cancelado.» y se pide a la pasarela expirar sus sesiones (best-effort); un cobro que
la pasarela confirme de todos modos queda `PAID` con «Reembolso requerido» y aviso al equipo.

## Invitadas: posibles duplicados

El link general nunca re-identifica a una invitada (BUG-003). Un auto-registro (`SELF_RSVP`) que coincide por nombre o
email con otra invitada de la lista —registrada antes o después— se marca «Posible duplicado» con el nombre de la
coincidencia; si dos auto-registros coinciden se marcan los dos (el orden de llegada no prueba cuál es la original).
Las invitadas que agregaron la anfitriona o el equipo no se marcan. Si la coincidencia es una invitada pendiente que la
anfitriona agregó, el portal le indica que quite ese registro; los recordatorios no se omiten automáticamente (quien
conozca el nombre de una invitada podría silenciarlos).

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
