# Application Test Map — Paquete 4 «Eventos y experiencia» (carril 4)

Fuente: inventario `docs/qa/.discovery/inventory.json` (83 páginas, 170 acciones; drift: ninguno) + lectura de
`src/features/{events,bookings,portal,guests,memory-capsule,payments}`. Commit `f26b1a1`. Prioridades: P0 crítico · P1 principal · P2 secundario · P3 menor.
Prefijos de prueba: EVT (eventos admin), CAL (calendario/disponibilidad), PORT (portal clienta), GST (invitadas/RSVP), MEM (Memory Capsule).

## Eventos (admin) — `/admin/events*` (permiso `events:read_all` / `events:write` / `events:cancel`)

| ID | Módulo | Página/Flujo | Rol | Acción | Resultado esperado | Prioridad |
|---|---|---|---|---|---|---|
| MAP-EVT-01 | Eventos | /admin/events | Owner | Listar, filtrar por estado/periodo/búsqueda (GET) | Filtros en URL, resultados correctos, estado vacío «No hay eventos con estos filtros» | P1 |
| MAP-EVT-02 | Eventos | /admin/events | Owner | «Limpiar filtros» | Vuelve a /admin/events sin filtros | P2 |
| MAP-EVT-03 | Eventos | /admin/events/[id] (+ pestañas) | Owner | Ver detalle y navegar Resumen/Invitadas/Operaciones/Finanzas/Memory | Encabezado, estado, pestaña activa `aria-current` | P1 |
| MAP-EVT-04 | Eventos | /admin/events/[id] inexistente | Owner | URL manipulada | «No encontramos este evento» | P2 |
| MAP-EVT-05 | Eventos | /admin/events/new · `createEventAction` | Owner | Alta manual con nueva clienta / clienta existente | Evento INQUIRY, tokens 256 bits, clienta creada o vinculada, `event.created` auditado | P0 |
| MAP-EVT-06 | Eventos | /admin/events/new · `checkEventAvailabilityAction` | Owner | Disponibilidad en vivo (lleno, cerrado, pasado, fuera de horario, anticipación) | Indicador correcto; fecha no disponible exige «Crear de todos modos» y se audita el override | P1 |
| MAP-EVT-07 | Eventos | /admin/events/new | Owner | Validaciones cliente + backend (Zod) | Errores por campo; la base no cambia | P1 |
| MAP-EVT-08 | Eventos | `updateEventAction` | Owner | Editar datos, reprogramar (fecha llena), micrositio on/off | Persistencia, `event.updated` con before/after en campos sensibles, confirmación de disponibilidad | P1 |
| MAP-EVT-09 | Eventos | `updateEventAction` | Owner | Reprogramar COMPLETED/CANCELLED | `SCHEDULE_LOCKED` (409), fecha de sólo lectura en UI | P1 |
| MAP-EVT-10 | Eventos | `transitionEventAction` | Owner | Transiciones válidas (INQUIRY→CONFIRMED→…→COMPLETED) | Estado + auditoría; al confirmar `onEventConfirmed` (checklists + inventario) | P0 |
| MAP-EVT-11 | Eventos | `transitionEventAction` | Owner | Transiciones inválidas / a CANCELLED sin motivo / fecha llena | `INVALID_TRANSITION`, `REASON_REQUIRED`, conflicto de capacidad confirmable | P1 |
| MAP-EVT-12 | Eventos | `cancelEventAction` | Owner | Cancelar con motivo y aviso | CANCELLED + booking cancelado + auditoría + notificación (sin motivo) + portal/micrositio cancelados | P0 |
| MAP-EVT-13 | Eventos | `cancelEventAction` | Owner | Cancelar con inventario reservado | Reservas CANCELLED + movimientos RELEASE | P1 |
| MAP-EVT-14 | Eventos / Pagos | `cancelEventAction` + checkout abierto | Owner + Clienta | Cancelar con pago PENDING de checkout | El checkout deja de ser cobrable; no se registra PAID en un evento cancelado | P0 |
| MAP-EVT-15 | Eventos / Pagos | `recordManualPaymentAction` | Owner | Pago manual (anticipo) | PAID manual, evento CONFIRMED, auditoría, notificaciones, saldo recalculado (panel y portal) | P0 |
| MAP-EVT-16 | Eventos / Pagos | `recordManualPaymentAction` | Owner | Monto > saldo, fecha futura, < $1, decimales, evento cancelado/sin reserva | Rechazo con mensaje; sin filas nuevas | P1 |
| MAP-EVT-17 | Eventos / Pagos | `refundPaymentAction` | Owner | Reembolso parcial/total | PARTIAL_REFUND/REFUNDED, fila REFUND, auditoría, saldo | P0 |
| MAP-EVT-18 | Eventos / Pagos | `refundPaymentAction` | Owner | Exceso, pago pendiente, reembolso de reembolso, doble total | Rechazo; sin efectos | P1 |
| MAP-EVT-19 | Eventos | `rotateEventTokenAction` | Owner | Rotar portal / invitación | Token viejo 404; links personales siguen; auditoría sin token completo | P1 |
| MAP-EVT-20 | Eventos | `saveTimelineItemAction` / `deleteTimelineItemAction` | Owner | Programa (visible / sólo equipo), editar, borrar, IDOR | Micrositio sólo visibles; portal todos; IDOR → NOT_FOUND | P1 |
| MAP-EVT-21 | Eventos | `addAdminMessageAction` | Owner | Responder a la clienta con aviso | Mensaje ADMIN + notificación + visible en portal | P1 |
| MAP-EVT-22 | Eventos | /admin/events* + acciones | Staff / Anónimo | Acceso UI y replay de acciones | Redirect `/staff` o login; acciones `denied`; base intacta | P0 |
| MAP-EVT-23 | Eventos | /admin/events, /new, /[id] | Owner | Accesibilidad AA | Sin violaciones critical/serious | P2 |

## Calendario y disponibilidad — `/admin/calendar` (permiso `events:read_all`, `availability:write`)

| ID | Módulo | Página/Flujo | Rol | Acción | Resultado esperado | Prioridad |
|---|---|---|---|---|---|---|
| MAP-CAL-01 | Calendario | /admin/calendar?month= | Owner | Ver eventos en su fecha, capacidad por día, abrir evento | Chip en la celda del día, «Lleno/Cerrado/N libres» | P1 |
| MAP-CAL-02 | Calendario | /admin/calendar | Owner | Navegar meses (Anterior/Siguiente/Hoy) | Cambia el mes y la URL | P1 |
| MAP-CAL-03 | Calendario | /admin/calendar?month=<inválido> | Owner | Parámetro inválido/lejano | Mes actual | P2 |
| MAP-CAL-04 | Calendario | /admin/calendar | Owner | Cancelados ocultos y contados; «+» precarga fecha del alta | Contador «(no se muestran)», `/admin/events/new?date=` | P2 |
| MAP-CAL-05 | Disponibilidad (global) | `createAvailabilityExceptionAction` / `deleteAvailabilityExceptionAction` | Owner | Bloqueo, blackout, capacidad especial; eliminar | Configurador y alta reflejan el cambio; auditoría | P1 |
| MAP-CAL-06 | Disponibilidad (global) | `saveWeeklyRulesAction` | Owner | Cerrar un día de la semana | Configurador CLOSED; calendario «Cerrado»; auditoría | P1 |
| MAP-CAL-07 | Disponibilidad (global) | Reglas/excepciones inválidas | Owner | Duplicado, pasado, sin máximo, fin<inicio, 6 reglas, día repetido | Rechazo; base intacta | P2 |
| MAP-CAL-08 | Calendario | /admin/calendar + acciones | Staff / Anónimo | Acceso y replay | Redirect + `denied` | P1 |
| MAP-CAL-09 | Calendario | /admin/calendar | Owner | Accesibilidad AA | Sin violaciones critical/serious | P2 |

## Portal de la clienta — `/mi-evento*` (token `Event.portalToken`)

| ID | Módulo | Página/Flujo | Rol | Acción | Resultado esperado | Prioridad |
|---|---|---|---|---|---|---|
| MAP-PORT-01 | Portal | /mi-evento/[token] | Clienta | Ver evento, pago, invitadas, programa | Datos correctos, sin notas internas ni datos de otros eventos, noindex | P0 |
| MAP-PORT-02 | Portal | /mi-evento/[token] (PENDING_PAYMENT) | Clienta | Ver anticipo pendiente | CTA «Pagar anticipo · $X» con X = anticipo − pagado | P1 |
| MAP-PORT-03 | Portal | /mi-evento/<inválido> | Anónimo | Token inválido/inexistente/rotado | 404 genérico «Este enlace no es válido» | P1 |
| MAP-PORT-04 | Portal | /mi-evento/[token]/resumen | Clienta | Resumen imprimible | Datos del evento | P2 |
| MAP-PORT-05 | Portal | /mi-evento · `requestPortalAccessAction` | Anónimo | Pedir enlace por correo | Respuesta neutral; PORTAL_ACCESS sólo a correos registrados | P1 |
| MAP-PORT-06 | Portal | `updatePreferencesAction` | Clienta | Preferencias (válidas e inválidas) | Persistencia + mensaje SYSTEM + auditoría; rechazo de URL/colores inválidos | P1 |
| MAP-PORT-07 | Portal | `updateAddressAction` | Clienta | Dirección (>48 h y <48 h) | Persistencia + auditoría / `ADDRESS_LOCKED` | P1 |
| MAP-PORT-08 | Portal | `sendHostMessageAction` | Clienta | Mensaje al equipo | En conversación admin + aviso al equipo | P0 |
| MAP-PORT-09 | Portal / Invitadas | `addHostGuestAction` / `removeHostGuestAction` | Clienta | Agregar/quitar invitadas, duplicados, límite 60, IDOR | Reglas HOST+PENDING, `GUEST_LIMIT`, NOT_FOUND cruzado | P1 |
| MAP-PORT-10 | Portal | `submitReviewAction` | Clienta | Opinión tras COMPLETED (una vez) | Review creada; 2.º envío CONFLICT; antes de completar `REVIEW_NOT_AVAILABLE` | P1 |
| MAP-PORT-11 | Portal | Evento cancelado | Clienta | Ver / intentar cambios | Aviso de cancelación; acciones `EVENT_CLOSED` | P1 |
| MAP-PORT-12 | Portal | /mi-evento, /mi-evento/[token] | Clienta | Accesibilidad AA, XSS escapado, 390 px sin scroll horizontal | Sin violaciones; HTML escapado | P2 |

## Invitadas y RSVP — `/admin/events/[id]/guests`, `/e/[slug]/[token]`

| ID | Módulo | Página/Flujo | Rol | Acción | Resultado esperado | Prioridad |
|---|---|---|---|---|---|---|
| MAP-GST-01 | Invitadas | `saveGuestAction` / `deleteGuestAction` | Owner | Alta, edición (RSVP, acompañante, dieta), baja | Persistencia, `guest.rsvp_changed` / `guest.deleted`, link personal 404 tras baja | P1 |
| MAP-GST-02 | Invitadas | `saveGuestAction` | Owner | Contacto duplicado / inválidos / IDOR | Aviso confirmable `DUPLICATE_GUEST`; rechazo; NOT_FOUND cruzado | P2 |
| MAP-GST-03 | Invitadas | /api/events/[id]/guests.csv | Owner / Staff / Anónimo | Exportar CSV | 200 + BOM + columnas + fórmulas neutralizadas + `guests.exported`; 401/403/404 | P1 |
| MAP-GST-04 | Invitadas | `sendRsvpRemindersAction` | Owner | Recordatorios a pendientes | RSVP_REMINDER por canal, 1 por día, auditoría; bloqueado en cancelado/micrositio apagado | P1 |
| MAP-GST-05 | Invitadas | `moderateHonoreeMessageAction` | Owner | Ocultar/mostrar mensaje a homenajeada | `hidden` + auditoría; conteo en portal | P2 |
| MAP-GST-06 | RSVP | /e/[slug]/[guestToken] · `submitRsvpAction` | Invitada | Confirmar / declinar / cambiar | Persistencia, confirmación visible, dirección exacta sólo al confirmar, reflejo en admin/portal | P0 |
| MAP-GST-07 | RSVP | /e/[slug]/[inviteToken] | Invitada | Auto-registro con link general | Invitada SELF_RSVP + redirección a su link personal | P1 |
| MAP-GST-08 | RSVP | /e/[slug]/[inviteToken] | Invitada | Escribir el nombre de otra invitada | No sobrescribe su RSVP ni entrega su link personal | P0 |
| MAP-GST-09 | RSVP | Mensaje a la homenajeada | Invitada | Crear/editar mensaje | 1 mensaje HONOREE por invitada; sorpresa (no visible en portal) | P1 |
| MAP-GST-10 | RSVP | /e/[slug]/[token]/calendar.ics | Invitada | Descargar .ics | text/calendar; dirección sólo si confirmó; 404 cancelado/token inválido | P1 |
| MAP-GST-11 | RSVP | /e/* con tokens ajenos/inválidos | Anónimo | Manipular slug/token | 404 genérico «Esta invitación no está disponible» | P1 |
| MAP-GST-12 | RSVP | Privacidad del micrositio | Invitada | Ver HTML | Sin dirección antes de confirmar, sin otras invitadas, email enmascarado | P1 |
| MAP-GST-13 | RSVP | Validaciones, cerrado (COMPLETED/CANCELLED), límite 60 | Invitada | Envíos inválidos | Errores de campo, `RSVP_CLOSED`, `EVENT_CANCELLED`, `GUEST_LIMIT` | P2 |
| MAP-GST-14 | Invitadas | /admin/events/[id]/guests + acciones | Staff / Anónimo | Acceso y replay | Redirect + `denied` | P1 |
| MAP-GST-15 | RSVP | /e/cumple-sofia/<Camila> | Invitada | Lectura + accesibilidad AA | Página correcta; sin violaciones | P2 |

## Memory Capsule — `/admin/events/[id]/memory`, `/memory/[token]`, `/api/memory/[token]/upload`

| ID | Módulo | Página/Flujo | Rol | Acción | Resultado esperado | Prioridad |
|---|---|---|---|---|---|---|
| MAP-MEM-01 | Memory | `createCapsuleAction` / `updateCapsuleAction` | Owner | Crear (en preparación) y publicar | Estado + auditoría; enlace con aviso / con contenido | P1 |
| MAP-MEM-02 | Memory | `rotateShareTokenAction` | Owner | Nuevo enlace | Enlace viejo 404, auditoría con pista de 4 caracteres | P1 |
| MAP-MEM-03 | Memory | `setMediaApprovalAction` / `setCoverAction` / `deleteCapsuleMediaAction` | Owner | Aprobar, ocultar, portada, eliminar | Galería pública refleja; URL firmada; borrado de almacenamiento; auditoría | P1 |
| MAP-MEM-04 | Memory | `setMessageHiddenAction` | Owner | Ocultar/mostrar mensajes del libro | Muro público refleja; auditoría | P1 |
| MAP-MEM-05 | Memory | Subida del equipo | Owner | Subir PNG | Aprobada, `uploadedBy` | P2 |
| MAP-MEM-06 | Memory | Acciones de moderación | Anónimo / Staff | Replay vía /memory/[token] y /admin | `denied`; base intacta | P0 |
| MAP-MEM-07 | Memory | IDOR de moderación | Owner | Ids de otra cápsula/evento | NOT_FOUND | P1 |
| MAP-MEM-08 | Memory | /memory/[token] · `submitGuestbookMessageAction` | Invitada | Libro de visitas | GUESTBOOK visible en el muro y en moderación | P0 |
| MAP-MEM-09 | Memory | /api/memory/[token]/upload | Invitada | Subir foto con consentimiento | MediaAsset PRIVATE, pendiente; no visible hasta aprobar | P0 |
| MAP-MEM-10 | Memory | /api/memory/[token]/upload | Anónimo | Tipo falso, PDF, sin consentimiento, CSRF, token, cápsula cerrada | 422/400/403/404 sin archivos | P1 |
| MAP-MEM-11 | Memory | Libro de visitas inválido / XSS | Anónimo | Envíos inválidos | NOT_FOUND / errores; HTML escapado | P1 |
| MAP-MEM-12 | Memory | /memory/[token] | Anónimo | Sólo aprobado/visible; token inválido 404; cápsula sembrada; AA | Aislamiento correcto | P1 |
| MAP-MEM-13 | Memory (global) | Flag `MEMORY_CAPSULE_ENABLED=false` | Todos | Abrir cápsula / subir / libro / admin / portal | Aviso amable; 404/NOT_FOUND; alerta admin; sin enlace en portal | P1 |
