# Application Test Map — Paquete 2 «Venta pública» (carril 2)

Fuente: `docs/qa/.discovery/inventory.json` (2026-10-06, commit f26b1a1) + lectura de código en `src/features/{marketing,configurator,ai-designer,quotes,payments,bookings,leads}` y `src/app/(public)`, `src/app/(experience)/{cotizacion,pago}`.
Prioridades: P0 crítico · P1 principal · P2 secundario · P3 menor. La columna «Resultado esperado» indica entre paréntesis la(s) prueba(s) que lo cubren.

## Sitio público (`@module:public`)

| ID | Módulo | Página/Flujo | Rol | Acción | Resultado esperado | Prioridad |
|---|---|---|---|---|---|---|
| S2-001 | Público | `/` | Anónimo | Abrir inicio | 200, un h1, landmarks, sin errores de consola (PUB-001) | P1 |
| S2-002 | Público | `/experiencias` | Anónimo | Abrir catálogo | 200 y exactamente las experiencias activas de la base, cada una enlazada a su detalle (PUB-002, PUB-014) | P1 |
| S2-003 | Público | `/experiencias/[slug]` | Anónimo | Abrir detalle | h1 = nombre, «Desde» con precio base en MXN, JSON-LD Service, CTA «Diseña esta experiencia» → configurador con la experiencia preseleccionada (PUB-003, PUB-015) | P1 |
| S2-004 | Público | `/experiencias/[slug]` inexistente / inactiva / con HTML | Anónimo | Abrir slug inválido | Página «Esta mesa ya no está puesta», noindex, sin datos; no listada en el catálogo (PUB-016) | P1 |
| S2-005 | Público | `/experiencias?ocasion&personas&tipo&estilo` | Anónimo | Filtrar catálogo | Resultados = consulta equivalente en base; grupo grande → nota «consulta especial»; sin resultados → estado vacío; parámetros basura ignorados (PUB-017) | P2 |
| S2-006 | Público | `/como-funciona`, `/nuestra-historia` | Anónimo | Abrir páginas informativas | 200, h1, landmarks, sin errores (PUB-004, PUB-005) | P2 |
| S2-007 | Público | `/privacidad`, `/terminos` | Anónimo | Abrir legales | 200, h1, enlazadas desde el pie (PUB-007, PUB-008, PUB-011) | P2 |
| S2-008 | Público | Encabezado / pie / menú móvil | Anónimo | Navegar | Menú principal y CTA del header llevan a su página; menú móvil abre/cierra (PUB-011, PUB-012) | P2 |
| S2-009 | Público | Hero del inicio | Anónimo | CTAs principales | «Diseña tu experiencia» → paso 1 del configurador; «Ver experiencias» → catálogo (PUB-013) | P1 |
| S2-010 | Público | SEO | Rastreador sin JS | Leer `<head>` | title con marca, description ≥ 40, canonical, og:title/og:image absoluta/og:locale es_MX, sin noindex; og:image responde imagen (PUB-018) | P2 |
| S2-011 | Público | Páginas con token / pago | Rastreador | Indexación | `/cotizacion/*` con meta noindex + `X-Robots-Tag`; robots.txt bloquea zonas privadas; sitemap con experiencias activas y sin inactivas ni tokens (PUB-019) | P1 |
| S2-012 | Público | Accesibilidad | Anónimo | axe WCAG 2.1 AA | Sin violaciones critical/serious en inicio, catálogo, detalle, cómo funciona, contacto, historia (PUB-020) | P2 |
| S2-013 | Público | Responsive | Anónimo | 1440/1366/768/390 | Sin scroll horizontal y CTA principal visible (PUB-021) | P2 |
| S2-014 | Público | `/crear-experiencia`, `/crear-experiencia/ai` | Anónimo | Abrir | 200, h1, sin errores (PUB-009, PUB-010) | P1 |

## Contacto (`submitContactForm`)

| ID | Módulo | Página/Flujo | Rol | Acción | Resultado esperado | Prioridad |
|---|---|---|---|---|---|---|
| S2-020 | Público | `/contacto` | Anónimo | Enviar formulario completo | Confirmación con folio = `Lead.code`; Lead NEW `CONTACT_FORM` + Customer + `LeadActivity CREATED` + `LEAD_RECEIVED` (email+WhatsApp) + aviso al equipo + `SUBMIT_LEAD`; visible en `/admin/leads` (PUB-040) | P0 |
| S2-021 | Público | `/contacto` | Anónimo | Enviar vacío | Error por campo, `aria-invalid`, nada en base (PUB-041) | P1 |
| S2-022 | Público | `/contacto` | Anónimo | Formatos inválidos | Teléfono, correo, mensaje corto, fecha pasada rechazados en el navegador (PUB-042) | P1 |
| S2-023 | Público | `submitContactForm` | Anónimo (request directo) | Payload manipulado | `VALIDATION_ERROR` con campo; base sin cambios (PUB-043) | P1 |
| S2-024 | Público | `/contacto` | Anónimo | Doble clic | Un solo lead y una clienta (PUB-044) | P1 |
| S2-025 | Público | `submitContactForm` | Bot | Honeypot lleno | Éxito aparente con folio falso; nada en base (PUB-045) | P2 |
| S2-026 | Público | `/contacto` ×2 mismo correo | Anónimo | Reenviar | Dos leads, una sola clienta (PUB-046) | P2 |
| S2-027 | Público | `/contacto` + `/admin/leads/[id]` | Anónimo / Owner | Texto con HTML/script | Se muestra escapado, no se ejecuta (PUB-047) | P2 |

## Configurador (`@module:configurator`)

| ID | Módulo | Página/Flujo | Rol | Acción | Resultado esperado | Prioridad |
|---|---|---|---|---|---|---|
| S2-030 | Configurador | `/crear-experiencia` (10 pasos) | Anónimo | Recorrido completo + envío | Resumen con estimado = `estimateAction`; Lead NEW `CONFIGURATOR` con selección, `estimatedTotalCents` del servidor, Customer (teléfono `+52…`), timeline, `ConfigurationSnapshot` (data + estimate + submissionId), avisos, analítica de embudo; visible en `/admin/leads` (CONF-001) | P0 |
| S2-031 | Configurador | `estimateAction` | Anónimo | Estimar | Cálculo en servidor con reglas del motor (base, extras, menú/extra por persona, logística, IVA 16 % incluido, anticipo 50 %), centavos enteros, sin costos/márgenes (CONF-013) | P0 |
| S2-032 | Configurador | HTML/RSC de páginas públicas | Anónimo | Inspeccionar | El catálogo enviado al navegador no contiene costos internos (CONF-014) | P0 |
| S2-033 | Configurador | `submitConfiguratorAction` | Anónimo (request directo) | Precio inventado | El servidor ignora `estimatedTotalCents` y guarda el recalculado (CONF-015) | P0 |
| S2-034 | Configurador | Resumen → Editar | Anónimo | Cambiar invitadas / extras | Estimado se recalcula en servidor; respuestas sin llaves internas (CONF-002) | P1 |
| S2-035 | Configurador | Paso 4 | Anónimo | Invitadas fuera de rango | Clamp 2–40, botones deshabilitados en límites, aviso «Consulta especial» > 12 (CONF-003) | P1 |
| S2-036 | Configurador | Paso 2 (calendario) | Anónimo | Fechas no disponibles | Pasados, lunes, bloqueados y llenos no seleccionables; el paso exige fecha (CONF-004) | P1 |
| S2-037 | Configurador | `getAvailabilityAction` | Anónimo | Consultar rango | BLOCKED/FULL/PAST/CLOSED correctos; sólo `date,status,acceptsRequests,remaining` (sin datos de otros eventos); entradas inválidas → 400 lógico (CONF-016) | P1 |
| S2-038 | Configurador | Resumen (contacto) | Anónimo | Datos inválidos | Errores por campo; sin lead (CONF-005) | P1 |
| S2-039 | Configurador | `submitConfiguratorAction` | Anónimo (request directo) | Fecha pasada / bloqueada / imposible | Rechazo con mensaje de negocio; sin lead (CONF-017) | P1 |
| S2-040 | Configurador | `submitConfiguratorAction` | Anónimo (request directo) | Payloads inválidos (teléfono, consentimiento, invitadas, horario, ids incompatibles, experiencia inactiva, zona, presupuesto) | `VALIDATION_ERROR` con el campo; sin lead (CONF-018) | P1 |
| S2-041 | Configurador | Resumen | Anónimo | Doble clic en enviar | Un solo lead/clienta/aviso (CONF-006) | P1 |
| S2-042 | Configurador | `submitConfiguratorAction` | Anónimo | Reintento mismo `submissionId` | Mismo folio, sin duplicados (CONF-019) | P1 |
| S2-043 | Configurador | Recarga a mitad | Anónimo | Continuar borrador | Banner «Tienes una experiencia a medio armar», restaura paso y valores; tras enviar se limpia (CONF-007) | P2 |
| S2-044 | Configurador | Paso 3 «Otra zona» | Anónimo | Fuera de cobertura | Lead `outOfArea` con colonia; logística «Por confirmar»; nota en confirmación (CONF-008) | P1 |
| S2-045 | Configurador | Grupo > 12 | Anónimo | Consulta especial | `specialRequest` + nota interna + mensaje (CONF-009) | P1 |
| S2-046 | Configurador | `?experiencia=&ocasion=` | Anónimo | Preselección | Ocasión y experiencia preseleccionadas; parámetros inválidos ignorados (CONF-010) | P1 |
| S2-047 | Configurador | Pasos 1–10 | Anónimo | Validación por paso | Mensajes por paso obligatorio (CONF-011) | P2 |
| S2-048 | Configurador | Accesibilidad / teclado | Anónimo | axe + flechas en radiogroup | Sin violaciones serias; navegación con flechas/espacio (CONF-012) | P2 |
| S2-049 | Configurador | Día lleno (request) | Anónimo | Enviar a fecha FULL | Se acepta como consulta con nota «Fecha llena» (CONF-020) | P2 |
| S2-050 | Configurador | Clienta recurrente | Anónimo | Mismo teléfono | Misma Customer; se completa el correo (CONF-021) | P2 |
| S2-051 | Configurador / Contacto | Entre canales | Anónimo | Mismo teléfono en configurador y contacto | Misma Customer (CONF-022) | P2 |
| S2-052 | Configurador | `trackConfiguratorAction` | Anónimo | Analítica embudo | START/COMPLETE por sesión; tipos no permitidos rechazados (CONF-023) | P3 |

## Diseñador IA (`@module:ai`, flag `AI_DESIGNER_ENABLED`)

| ID | Módulo | Página/Flujo | Rol | Acción | Resultado esperado | Prioridad |
|---|---|---|---|---|---|---|
| S2-060 | IA | `/crear-experiencia/ai` | Anónimo | Generar propuesta | Propuesta con experiencia activa real, estimado del motor, `AiDesign` persistido, `AI_DESIGN_GENERATED`, sin costos en la respuesta (AI-001) | P1 |
| S2-061 | IA | «Quiero esta experiencia» | Anónimo / Owner | Convertir a lead | Lead `AI_DESIGNER` ligado al diseño, snapshot, avisos; visible en admin (AI-002) | P1 |
| S2-062 | IA | Formulario | Anónimo | Enviar vacío | Errores por campo; sin `AiDesign` (AI-003) | P1 |
| S2-063 | IA | `generateDesignAction` | Anónimo (request) | Entradas inválidas | `VALIDATION_ERROR` por campo (AI-004) | P1 |
| S2-064 | IA | `convertDesignToLeadAction` | Anónimo | Repetido / simultáneo | Mismo folio, un lead (AI-005) | P1 |
| S2-065 | IA | `convertDesignToLeadAction` | Anónimo | Diseño inexistente, fecha pasada, sin consentimiento, teléfono/id inválido | Rechazo; sin lead (AI-006) | P1 |
| S2-066 | IA | Diseño > 30 días | Anónimo | Convertir | `DESIGN_EXPIRED` (AI-007) | P2 |
| S2-067 | IA | Coherencia de precio | Anónimo | Presupuesto bajo, 12 invitadas | Mismo total que el configurador; `withinBudget` coherente (AI-008) | P2 |
| S2-068 | IA | Flag apagado (global) | Anónimo | Abrir / generar / convertir | Página en pausa, configurador sin enlace, backend `FEATURE_DISABLED`, nada en base; restaurado (AI-009) | P1 |

## Cotización por token (`/cotizacion/[token]`, `@module:quotes`)

| ID | Módulo | Página/Flujo | Rol | Acción | Resultado esperado | Prioridad |
|---|---|---|---|---|---|---|
| S2-070 | Cotizaciones | `/cotizacion/[token]` SENT | Clienta | Ver propuesta | Conceptos y totales en MXN = base; vigencia; sin costos/márgenes/notas internas en HTML ni RSC; `viewedAt` + `VIEW_QUOTE` una vez (QPUB-001) | P0 |
| S2-071 | Cotizaciones | Aceptar | Clienta | Aceptar con nombre + términos | Quote ACCEPTED, Booking (total, anticipo, firmante, términos, saldo vence −3 d), Event PENDING_PAYMENT con portal token, Lead WON, auditoría, avisos, `ACCEPT_QUOTE` (QPUB-002) | P0 |
| S2-072 | Cotizaciones | Rechazar | Clienta | Rechazar con motivo | REJECTED + motivo, sin booking/evento, actividad del lead, auditoría, aviso al equipo (QPUB-003) | P0 |
| S2-073 | Cotizaciones | Aceptar | Clienta | Datos inválidos | Front y back exigen nombre+apellido y términos (QPUB-004) | P1 |
| S2-074 | Cotizaciones | Vencida | Clienta | Abrir / aceptar / rechazar | Pantalla «expiró», EXPIRED en base, CONFLICT (QPUB-005) | P1 |
| S2-075 | Cotizaciones | Ya aceptada | Clienta | Re-aceptar / rechazar | CONFLICT, una sola reserva (QPUB-006) | P1 |
| S2-076 | Cotizaciones | Rechazada | Clienta | Aceptar / re-rechazar | CONFLICT / idempotente sin sobrescribir (QPUB-007) | P1 |
| S2-077 | Cotizaciones | Versión reemplazada | Clienta | Aceptar en pestaña vieja | CONFLICT «se actualizó…», refresca a la vigente; v2 sí se acepta con el monto nuevo (QPUB-008) | P1 |
| S2-078 | Cotizaciones | Doble clic | Clienta | Aceptar 2× | Una reserva/un evento (QPUB-009) | P1 |
| S2-079 | Cotizaciones | Token inválido / inexistente / DRAFT | Anónimo | Abrir / aceptar | 404 real genérico sin datos; NOT_FOUND (QPUB-010) | P1 |
| S2-080 | Cotizaciones | Fecha ocupada | Clienta | Aceptar | Mensaje «La fecha ya no está disponible», sigue SENT, actividad + aviso «Fecha no disponible» (QPUB-011) | P1 |
| S2-081 | Cotizaciones | Vista de la fundadora | Owner | Abrir propuesta | No marca `viewedAt` (QPUB-012) | P3 |
| S2-082 | Cotizaciones | Respuesta de aceptar | Clienta | Inspeccionar | Sólo `portalToken` (QPUB-013) | P2 |
| S2-083 | Cotizaciones | Accesibilidad | Clienta | axe + teclado | Sin violaciones serias; foco al abrir/cerrar el diálogo (QPUB-014, QPUB-015) | P2/P3 |

## Pagos (proveedor mock, `@module:payments`)

| ID | Módulo | Página/Flujo | Rol | Acción | Resultado esperado | Prioridad |
|---|---|---|---|---|---|---|
| S2-090 | Pagos | Anticipo | Clienta | Pagar anticipo → checkout simulado → resultado | Payment PAID (monto = anticipo, comisión 3.6 % + $3), `WebhookEvent` firmado procesado, Event CONFIRMED + auditoría, `onEventConfirmed` (checklists, inventario), avisos BOOKING_CONFIRMED/PAYMENT_RECEIVED/equipo, analítica; propuesta «Anticipo recibido», portal accesible (PAY-001) | P0 |
| S2-091 | Pagos | Rechazo | Clienta | Simular pago rechazado → reintentar | FAILED con motivo, evento pendiente, nuevo checkout (PAY-002) | P0 |
| S2-092 | Pagos | Cancelar | Clienta | Cancelar en la pasarela | Regresa a la propuesta; sigue PENDING (PAY-003) | P1 |
| S2-093 | Pagos | Checkout inexistente | Anónimo | Abrir / accionar | 404 «No encontramos este pago», NOT_FOUND/VALIDATION (PAY-004) | P1 |
| S2-094 | Pagos | Pagar dos veces | Clienta | Reabrir / reintentar | «Este pago ya fue procesado», sin segundo cobro ni avisos; DEPOSIT_COVERED (PAY-005) | P1 |
| S2-095 | Pagos | Reintento de checkout | Clienta | Iniciar de nuevo | Reutiliza el pendiente (PAY-006); en paralelo no debe duplicar (PAY-019) | P1/P2 |
| S2-096 | Pagos | `startCheckoutAction` | Anónimo | Token sin reserva / inexistente / kind inválido | NOT_FOUND genérico / VALIDATION; sin pagos (PAY-007) | P1 |
| S2-097 | Pagos | `getPaymentStatusAction`, `/pago/resultado` | Anónimo | Firma alterada / cruzada | NOT_FOUND / 404 sin datos de otro pago (PAY-008) | P1 |
| S2-098 | Pagos | Webhook `payment.succeeded` | Proveedor | Entrega + reenvío | Confirma una vez; duplicado idempotente; otro id → `already_paid` (PAY-009) | P1 |
| S2-099 | Pagos | Webhook `payment.failed` | Proveedor | failed → succeeded → failed tardío | FAILED, luego PAID, el tardío se ignora (PAY-010) | P1 |
| S2-100 | Pagos | Webhook monto menor | Proveedor | Cobro parcial | No PAID, nota «Revisión manual», `amount_mismatch`, aviso (PAY-011) | P1 |
| S2-101 | Pagos | Webhook pago desconocido / firma inválida / proveedor desconocido / GET | Proveedor / atacante | Entregar | 200 `payment_not_found` / 400 / 404 / 405 sin efectos (PAY-012) | P2 |
| S2-102 | Pagos | Webhook `refund.succeeded` | Proveedor | Reembolso parcial | PARTIAL_REFUND + fila REFUND + auditoría, idempotente (PAY-013) | P2 |
| S2-103 | Pagos | `/pago/resultado` | Clienta | Esperar webhook | Se actualiza sola a «¡Pago recibido!» (PAY-014) | P1 |
| S2-104 | Pagos | Enlace > 1 h | Clienta | Pagar | «expiró», CHECKOUT_EXPIRED, nuevo checkout distinto (PAY-015) | P1 |
| S2-105 | Pagos | Saldo cambiado | Clienta | Pagar enlace viejo | «ya no está vigente», CHECKOUT_STALE (PAY-016) | P2 |
| S2-106 | Pagos | Reserva cancelada | Clienta | Iniciar pago | EVENT_CANCELLED (PAY-017) | P1 |
| S2-107 | Pagos | Checkout abierto + cancelación posterior | Clienta / Owner | Pagar después de cancelar | No se cobra (PAY-021) | P1 |
| S2-108 | Pagos | Saldo desde portal | Clienta | BALANCE | Monto = total − anticipo; luego NO_BALANCE (PAY-018) | P2 |
| S2-109 | Pagos | Flag `PAYMENTS_ENABLED` apagado (global) | Clienta | Pagar anticipo | Aviso de pausa, PAYMENTS_DISABLED, sin pagos; restaurado (PAY-020) | P1 |
| S2-110 | Pagos | Accesibilidad | Clienta | axe checkout + resultado | Sin violaciones serias (PAY-022) | P2 |

## Fuera de este paquete (referencia)
- Seguridad de webhooks/CSRF/rate limit de acciones públicas y `/api/analytics/track`: paquete 1.
- Portal `/mi-evento/*` más allá de comprobar acceso tras pagar: paquete 4.
- Creación/edición de cotizaciones en el admin (sólo se usan `createQuoteAction`/`sendQuoteAction` como preparación): paquete 3.
- Stripe/MercadoPago reales: NOT APPLICABLE (servicio externo de pago).
