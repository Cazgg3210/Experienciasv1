# Application Test Map — Paquete 6/6 "Transversal" (carril 6)

Fuente: inventario `docs/qa/.discovery/inventory.json` (2026-10-06, 83 páginas / 13 APIs / 169 acciones, drift: ninguno) · commit `f26b1a1` · entorno TEST (build de producción local `.next-e2e`, :3206, base `ivonne_rosa_e2e_l6`).
Prioridades: **P0** recorrido crítico de negocio/seguridad · **P1** principal · **P2** secundario · **P3** menor.
Prefijos: `SMK` smoke · `CRIT` recorridos críticos · `RESP` responsive · `A11Y` accesibilidad.

## Smoke (`tests/e2e/smoke/smoke.spec.ts`)

| ID | Módulo | Página/Flujo | Rol | Acción | Resultado esperado | Prioridad |
|---|---|---|---|---|---|---|
| SMK-001 | API | `/api/health`, `/api/health/db` | Anónimo | GET | 200 `{status:"ok"}` y `database:"up"` | P0 |
| SMK-002 | Auth | `/login` → `/admin` | SUPER_ADMIN | Login por formulario | Llega a `/admin` con "Hola, Admin" | P0 |
| SMK-003 | Auth | `/login` → `/admin` | OWNER (Ivonne) | Login por formulario | Llega a `/admin` con "Hola, Ivonne" | P0 |
| SMK-004 | Auth | `/login` → `/admin` | OWNER (Rosa) | Login por formulario | Llega a `/admin` con "Hola, Rosa" | P0 |
| SMK-005 | Auth | `/login` → `/staff` | STAFF (Lupita) | Login por formulario | Llega a `/staff` "Mis próximos eventos" | P0 |
| SMK-006 | Auth | `/login` → `/staff` | STAFF (Carlos) | Login por formulario | Llega a `/staff` | P0 |
| SMK-010…014 | Público | `/`, `/experiencias`, `/experiencias/signature-brunch`, `/crear-experiencia`, `/contacto` | Anónimo | GET | 200, H1, main y footer, sin errores de consola/red | P0 |
| SMK-015…018 | Público | `/como-funciona`, `/nuestra-historia`, `/privacidad`, `/terminos` | Anónimo | GET | 200, H1, sin errores | P1 |
| SMK-019 | Auth | `/login` | Anónimo | GET | H1 "Bienvenida de vuelta" | P0 |
| SMK-020 | Público | `/experiencias` | Anónimo | Comparar con base | Todas las experiencias activas visibles | P1 |
| SMK-021 | Analytics | `/admin` | OWNER | Leer dashboard | Saludo + panel "Próximos 7 días" | P1 |
| SMK-022 | Leads | `/admin/leads?q=` | OWNER | Buscar lead real | Aparece el lead NEW de la base | P1 |
| SMK-023 | Cotizaciones | `/admin/quotes` | OWNER | Leer lista | Aparece el folio de la cotización de Lucía | P1 |
| SMK-024 | Eventos | `/admin/events` → detalle | OWNER | Leer | Lista + detalle de "Cumpleaños de Sofía" con panel Pagos | P1 |
| SMK-025 | Calendario | `/admin/calendar` | OWNER | Leer | H1 "Calendario" | P1 |
| SMK-026 | Inventario | `/admin/inventory?q=` | OWNER | Buscar artículo real | Artículo activo visible | P1 |
| SMK-027 | Compras | `/admin/purchases`, `/admin/vendors` | OWNER | Leer | H1 + proveedor real visible | P1 |
| SMK-028 | Finanzas | `/admin/finance` | OWNER | Leer | Fila del evento de Sofía | P1 |
| SMK-029 | Ajustes | `/admin/settings` | OWNER | Leer | "Nombre de la marca" = valor guardado | P1 |
| SMK-030 | Staff | `/staff` | STAFF (Lupita) | Leer | Sólo Sofía y Daniela (asignados); no Mariana | P1 |
| SMK-031 | Cotizaciones | `/cotizacion/[token Lucía]` | Clienta | Leer | Título + CTA "Aceptar propuesta" | P0 |
| SMK-032 | Portal | `/mi-evento/[token Sofía]` | Clienta | Leer | H1 del evento + secciones Pago e Invitadas | P0 |
| SMK-033 | Invitadas | `/e/cumple-sofia/[invite]` y `/[guest Camila]` | Invitada | Leer | Micrositio + RSVP personal prellenado | P0 |
| SMK-034 | Memory | `/memory/[token Valeria]` | Invitada | Leer | Título + libro de visitas | P0 |
| SMK-035 | Portal | tokens inexistentes | Anónimo | GET | 404 genérico sin datos de otros eventos | P1 |

## Recorridos críticos P0 (`tests/e2e/critical/*.spec.ts`) — pasos y verificación de base

| ID | Módulo | Página/Flujo | Rol | Acción (pasos) | Resultado esperado (UI + base) | Prioridad |
|---|---|---|---|---|---|---|
| CRIT-001 | Configurador → Leads | `/crear-experiencia` → `/admin/leads/[id]` | Anónima (móvil) → OWNER | 1) ocasión 2) fecha disponible del calendario 3) zona 4) invitadas 5) estilo 6) experiencia 7) menú 8) extras 9) homenajeada 10) presupuesto → resumen (estimado del servidor, sin costos) → datos + consentimiento → "Consultar disponibilidad" → la fundadora busca el folio y abre el lead | Folio visible; `Lead` NEW/CONFIGURATOR con teléfono normalizado `+52…`, clienta por email, `ConfigurationSnapshot` cuyo `estimate.totalCents` = `estimatedTotalCents` = total mostrado, actividad CREATED, `NotificationLog` LEAD_RECEIVED + aviso GENERIC al equipo; lead visible en admin | P0 |
| CRIT-010 | Público → Leads | `/contacto` → `/admin/leads/[id]` | Anónima (móvil) → OWNER | Formulario completo + consentimiento → "Enviar mensaje" → fundadora busca el folio | "¡Gracias…"; `Lead` NEW/CONTACT_FORM con notas, clienta, actividad, LEAD_RECEIVED; detalle muestra el mensaje | P0 |
| CRIT-002 | Leads → Cotizaciones → Pagos → Eventos → Portal | `/admin/leads/[id]` → `/admin/quotes/new?leadId` → `/admin/quotes/[id]` → `/cotizacion/[token]` → `/pago/mock/[id]` → `/pago/resultado` → `/mi-evento/[token]` → `/admin/events/[id]` | OWNER → Clienta (móvil) → OWNER | 1) "Crear cotización" desde el lead (prellenado) 2) precio calculado en vivo y guardado 3) "Enviar a la clienta" 4) clienta abre el link, "Aceptar propuesta" con nombre + términos 5) "Pagar anticipo" 6) mock "Pagar (simulado)" 7) resultado 8) "Ir a mi evento" 9) fundadora abre el evento | DRAFT con línea base = precio de catálogo, subtotal = Σ líneas, total/IVA según `pricesIncludeTax`, anticipo = total×bps; lead QUOTED; audit `quote.created`; SENT + QUOTE_SENT; propuesta pública sin costos/márgenes; ACCEPTED + Booking (anticipo, aceptó) + Event PENDING_PAYMENT; lead WON; pago DEPOSIT PAID (mock), `WebhookEvent` procesado, evento CONFIRMED + audit `event.confirmed_by_payment`, checklist instanciado (`onEventConfirmed`), BOOKING_CONFIRMED + PAYMENT_RECEIVED; portal "¡Fecha confirmada!" con Pagado = anticipo y Saldo = total − anticipo; admin muestra saldo | P0 |
| CRIT-003 | Cotizaciones | `/cotizacion/[token]` | Clienta (móvil) → OWNER | "No por ahora" → motivo → "Rechazar propuesta" → recarga → fundadora abre la cotización | "Recibimos tu respuesta", sin botón aceptar; REJECTED con motivo y fecha; sin Booking ni Event; actividad del lead con el folio; lead sigue QUOTED (regla actual); audit `quote.rejected`; aviso al equipo; admin muestra "Rechazada" + motivo | P0 |
| CRIT-004 | Portal → Invitadas | `/mi-evento/[token]` → `/e/[slug]/[guestToken]` → `/admin/events/[id]/guests` | Anfitriona (móvil) → Invitada (móvil) → OWNER | Anfitriona "Agregar invitada" → invitada abre su link, "¡Sí, ahí estaré!" → "Enviar mi respuesta" → recarga → fundadora ve RSVP → anfitriona recarga portal | Toast "Agregamos a…"; `EventGuest` HOST/PENDING; confirmación "¡Gracias…! Te esperamos"; ATTENDING + `respondedAt`, sin duplicados; admin fila "Asiste"; portal "Asiste" | P0 |
| CRIT-005 | Operación → Staff | `/admin/events/[id]/operations` → `/login` → `/staff` → `/staff/events/[id]` | OWNER → STAFF nuevo (móvil) → OWNER | Asignar staff (integrante nuevo) → staff inicia sesión → lista → evento ajeno → `/admin` → "Marcar como hecha" → fundadora recarga | Asignación + audit + STAFF_ASSIGNED con ruta real `/staff/events/<id>`; staff ve SÓLO su evento; evento ajeno = "No encontramos este evento"; `/admin` → `/staff`; tarea DONE con `completedById`; admin ve estado "Hecho" | P0 |
| CRIT-006 | Pagos | `/admin/events/[id]` (Pagos) → `/mi-evento/[token]` | OWNER → Clienta | "Registrar pago manual" (saldo, transferencia, notas) | Pago BALANCE PAID manual, `recordedById` = fundadora, audit `payment.manual_recorded`, PAYMENT_RECEIVED; cobrado = total; panel sin saldo y sin botón; portal Pagado = total, Saldo $0, "liquidada" | P0 |
| CRIT-007 | Finanzas | `/admin/events/[id]/financials` → `/admin/finance?status=CLOSED` | OWNER | Agregar costo Alimentos $5,000 y Flores $2,000.00 → "Cerrar evento" → Finanzas | 2 `EventCost` + audit `cost.created`; `closedAt` y `closingSnapshot` (venta $23,200, neto $20,000, costo real $7,000, margen $13,000 = 65%); audit `event.closed`; POST_EVENT; ya no se puede cerrar; fila de finanzas "Cerrado", $23,200, $7,000, 65.0% | P0 |
| CRIT-008 | Memory Capsule | `/memory/[token]` → `/admin/events/[id]/memory` | Invitada (móvil) → OWNER → público | Libro de visitas → subir foto PNG con consentimiento → fundadora "Aprobar" → recarga pública | Mensaje GUESTBOOK visible; `MediaAsset` PRIVATE, `approved=false`, uploader; foto NO visible antes de moderar; "Foto aprobada" → `approved=true`; galería pública con 1 foto cargada (alt con autora) | P0 |
| CRIT-009 | Auth | `/login` → `/admin` → logout | OWNER | Login, request directo, "Cerrar sesión", URL privada, request directo, atrás | Home "Hola, Ivonne"; 200 con sesión; tras logout UI → `/login?callbackUrl=…` y request → 3xx a `/login`; atrás sin datos | P0 |
| CRIT-011 | Auth | igual a CRIT-009 | SUPER_ADMIN | ídem | ídem | P0 |
| CRIT-012 | Auth | `/login` → `/staff` | STAFF (móvil) | Login, `/admin/finance` (UI y request), logout, `/staff` | `/admin*` → `/staff` (UI y 3xx); tras logout `/staff` pide login | P0 |
| CRIT-013 | Auth | `/admin/events` → `/login?callbackUrl` | Anónima → OWNER | Ruta privada → login → regreso; `callbackUrl=https://evil.example` | Vuelve a `/admin/events`; nunca sale del dominio | P0 |
| CRIT-014 | Auth | `/staff` (2 pestañas) → logout | STAFF | Petición autenticada en vuelo (2ª pestaña / prefetch) → "Cerrar sesión" → llega la respuesta → `/staff` | La cookie de sesión no reaparece; `/staff` exige login (`@regression` de TRV-BUG-06) | P0 |

## Responsive (`tests/e2e/responsive/responsive.spec.ts`) — 1440×900, 1366×768, 768×1024, 390×844

| ID | Módulo | Página/Flujo | Rol | Acción | Resultado esperado | Prioridad |
|---|---|---|---|---|---|---|
| RESP-001…006 | Público/Auth | `/`, `/experiencias`, detalle, `/crear-experiencia`, `/contacto`, `/login` | Anónimo | 4 viewports | Sin scroll horizontal (≤1 px), H1 visible, CTA principal visible, dentro del ancho y no tapado | P1 |
| RESP-007 | Público | Menú móvil (390, 768) | Anónimo | Abrir/cerrar/navegar | `aria-expanded`, foco regresa al botón, navega y cierra; en 1440 nav visible sin botón | P1 |
| RESP-008…012 | Token | cotización, pago mock, portal, RSVP, cápsula | Clienta/Invitada | 4 viewports | Igual que arriba | P1 |
| RESP-013 | Portal | `/mi-evento` | Clienta | 4 viewports | Igual | P2 |
| RESP-014…018 | Admin | dashboard, leads, detalle de evento, calendario, finanzas | OWNER | 4 viewports | Sin scroll horizontal; tablas anchas con scroll interno | P2 |
| RESP-019 | Admin | Menú del panel (390, 768) | OWNER | Abrir/Escape/navegar | Hoja de navegación abre, cierra y navega | P2 |
| RESP-020 | Staff | `/staff` | STAFF | 4 viewports | Sin scroll; tarjeta de evento usable | P1 |

## Accesibilidad (`tests/e2e/accessibility/a11y.spec.ts`)

| ID | Módulo | Página/Flujo | Rol | Acción | Resultado esperado | Prioridad |
|---|---|---|---|---|---|---|
| A11Y-001…011, 017 | Público/Token | inicio, catálogo, detalle, configurador, contacto, login, cotización, pago mock, portal, RSVP, cápsula, cómo funciona | Anónimo/Clienta | axe WCAG 2.1 A/AA | 0 violaciones critical/serious (moderate/minor = observación) | P2 |
| A11Y-012…016, 018 | Admin/Staff | dashboard, leads, evento, calendario, staff, finanzas | OWNER/STAFF | axe | 0 critical/serious | P2 |
| A11Y-020 | Auth | `/login` | OWNER | Sólo teclado | Tab ordenado, foco visible, Enter envía | P1 |
| A11Y-021 | Configurador | paso 1 | Anónima | Teclado | Tab al grupo, flechas seleccionan, Enter avanza, foco al título del paso | P1 |
| A11Y-022 | Invitadas | RSVP | Invitada | Teclado | Radio con Space/flechas, foco visible, labels | P1 |
| A11Y-023 | Público | Skip link | Anónimo | Tab + Enter | Foco en `main#contenido` | P2 |
| A11Y-024 | Público | `/contacto` | Anónimo | Labels / errores | Todos los campos con label; enviar vacío marca `aria-invalid` + alerta | P2 |
| A11Y-025 | Navegación | público y admin | Anónimo/OWNER | Landmarks | banner, nav, main, footer, `lang="es"` | P2 |
| A11Y-026 | Público | imágenes | Anónimo | `<img>` sin alt | Ninguna (o decorativa explícita) | P2 |
| A11Y-027 | Público | `prefers-reduced-motion` | Anónimo | Emular reduce | Animaciones/transiciones ≤ 1 ms | P2 |
| A11Y-028 | Cotizaciones | Diálogo aceptar | Clienta | Teclado | Foco atrapado, Escape cierra, foco regresa al disparador | P2 |
