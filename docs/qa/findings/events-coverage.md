# Test Coverage Matrix — Paquete 4 «Eventos y experiencia» (carril 4)

Resultados **reales** de la corrida final del carril 4 (commit `f26b1a1`, build de producción local :3204, base `ivonne_rosa_e2e_l4`, 2026-10-06):

- Invocación normal (una sola): `E2E_LANE=4 E2E_WORKERS=3 pnpm.cmd exec playwright test tests/e2e/events tests/e2e/calendar tests/e2e/portal tests/e2e/guests tests/e2e/memory --project=chromium --project=mobile-chrome` (reintentos por defecto = 1) → `test-results/l4/results.json` (inicio 2026-10-06T08:01:35Z): **103 PASS · 7 FAIL · 2 FLAKY** (+5 sesiones de setup).
- Suite de estado global: `E2E_LANE=4 E2E_SUITE=global pnpm.cmd exec playwright test <mismas carpetas>` → `test-results/l4/global/results.json` (inicio 08:04:23Z): **7 PASS**.
- Total del paquete: **119 ejecuciones · 110 PASS · 7 FAIL · 2 FLAKY · 0 BLOCKED · 0 NOT TESTED** (113 escenarios únicos; 6 se repiten en 390×844).
- EVX-BUG-02 es intermitente: en esta corrida hizo FLAKY a GST-011 (escritorio y móvil) y FAIL a CAL-002; EVT-038, GST-012 y GST-015 pasaron aquí pero fallaron en las corridas previas del carril (06:55–07:59 UTC, mismas pruebas, mismo build; ver `events.md`).
- `FAIL (EVX-BUG-xx)` remite a `docs/qa/findings/events.md`. `FLAKY` = falló y pasó al reintentar (POTENTIAL FLAKY TEST, atribuido a EVX-BUG-02, intermitente por naturaleza).
- Actualización tras corregir BUG-003 (EVX-BUG-03, commit `e8165ae`, carril 4): GST-014 → PASS (`@regression`); nuevas GST-023 (PASS) y GST-024 (PASS, suite `ratelimit`). Los totales de arriba son los de la corrida original.

| ID | Módulo | Escenario | Rol | Priority | Automated | Result |
|---|---|---|---|---|---|---|
| CAL-001 | Calendario | el calendario muestra el evento en su fecha y el chip abre el detalle | Owner | P1 | ✅ tests/e2e/calendar/calendar.spec.ts | PASS |
| CAL-002 | Calendario | navegación de meses con «Siguiente», «Anterior» y «Hoy» | Owner | P1 | ✅ tests/e2e/calendar/calendar.spec.ts | FAIL (EVX-BUG-02) |
| CAL-003 | Calendario | el mes llega por URL; un parámetro inválido o lejano vuelve al mes actual | Owner | P2 | ✅ tests/e2e/calendar/calendar.spec.ts | PASS |
| CAL-004 | Calendario | los eventos cancelados no se muestran pero se cuentan en el mes | Owner | P2 | ✅ tests/e2e/calendar/calendar.spec.ts | PASS |
| CAL-005 | Calendario | días cerrados se marcan «Cerrado» y el «+» de un día abierto precarga la fecha del alta | Owner | P2 | ✅ tests/e2e/calendar/calendar.spec.ts | PASS |
| CAL-006 | Calendario | staff y anónimo no acceden al calendario ni pueden crear excepciones por request | Staff | P1 | ✅ tests/e2e/calendar/calendar.spec.ts | PASS |
| CAL-007 | Calendario | accesibilidad (WCAG 2.1 AA) del calendario | Owner | P2 | ✅ tests/e2e/calendar/calendar.spec.ts | FAIL (EVX-BUG-04) |
| CAL-008 | Calendario | bloquear un día desde el calendario lo cierra en el configurador y en el alta; al eliminarlo se reabre · suite global | Owner | P1 | ✅ tests/e2e/calendar/availability.global.spec.ts | PASS |
| CAL-009 | Calendario | capacidad especial: el día admite el máximo configurado en configurador y calendario · suite global | Owner | P1 | ✅ tests/e2e/calendar/availability.global.spec.ts | PASS |
| CAL-010 | Calendario | blackout con motivo: el alta lo explica y el configurador lo bloquea · suite global | Owner | P2 | ✅ tests/e2e/calendar/availability.global.spec.ts | PASS |
| CAL-011 | Calendario | excepciones inválidas: duplicada, en el pasado y capacidad sin máximo · suite global | Owner | P2 | ✅ tests/e2e/calendar/availability.global.spec.ts | PASS |
| CAL-012 | Calendario | cerrar un día de la semana desde el horario semanal lo cierra en configurador, alta y calendario · suite global | Owner | P1 | ✅ tests/e2e/calendar/availability.global.spec.ts | PASS |
| CAL-013 | Calendario | horario semanal inválido se rechaza en el formulario y en el backend · suite global | Owner | P2 | ✅ tests/e2e/calendar/availability.global.spec.ts | PASS |
| EVT-001 | Eventos | listado muestra eventos y filtra por estado y búsqueda (URL compartible) | Owner | P1 | ✅ tests/e2e/events/events.spec.ts | PASS |
| EVT-002 | Eventos | periodo «Pasados» lista eventos completados y no los futuros | Owner | P2 | ✅ tests/e2e/events/events.spec.ts | PASS |
| EVT-003 | Eventos | detalle: encabezado, estado y pestañas navegables sin errores | Owner | P1 | ✅ tests/e2e/events/events.spec.ts | PASS |
| EVT-004 | Eventos | evento inexistente muestra «No encontramos este evento» | Owner | P2 | ✅ tests/e2e/events/events.spec.ts | PASS |
| EVT-005 | Eventos | crear evento con nueva clienta persiste (INQUIRY, tokens, auditoría) y aparece en el listado | Owner | P0 | ✅ tests/e2e/events/events.spec.ts | PASS |
| EVT-006 | Eventos | crear evento para una clienta existente (búsqueda) la vincula sin duplicarla | Owner | P1 | ✅ tests/e2e/events/events.spec.ts | PASS |
| EVT-007 | Eventos | fecha ocupada: aviso en vivo, confirmación explícita y auditoría del override | Owner | P1 | ✅ tests/e2e/events/events.spec.ts | PASS |
| EVT-008 | Eventos | validaciones del alta en el formulario (clienta, título y fecha requeridos) | Owner | P1 | ✅ tests/e2e/events/events.spec.ts | PASS |
| EVT-009 | Eventos | el backend rechaza altas inválidas aunque se salte la validación del cliente | Owner | P1 | ✅ tests/e2e/events/events.spec.ts | PASS |
| EVT-010 | Eventos | disponibilidad del alta: día cerrado, fecha pasada y fuera de horario | Owner | P2 | ✅ tests/e2e/events/events.spec.ts | PASS |
| EVT-011 | Eventos | doble clic en «Crear evento» genera un solo evento | Owner | P3 | ✅ tests/e2e/events/events.spec.ts | PASS |
| EVT-012 | Eventos | texto con HTML en el título se muestra escapado | Owner | P2 | ✅ tests/e2e/events/events.spec.ts | PASS |
| EVT-013 | Eventos | editar título, invitadas y notas persiste y audita los cambios sensibles | Owner | P1 | ✅ tests/e2e/events/events.spec.ts | PASS |
| EVT-014 | Eventos | reprogramar a una fecha llena pide confirmación y mueve el horario | Owner | P1 | ✅ tests/e2e/events/events.spec.ts | PASS |
| EVT-015 | Eventos | un evento completado o cancelado no se puede reprogramar (UI y backend) | Owner | P1 | ✅ tests/e2e/events/events.spec.ts | PASS |
| EVT-016 | Eventos | desactivar el micrositio deja sin efecto el link de invitación; reactivarlo lo restablece | Owner | P2 | ✅ tests/e2e/events/events.spec.ts | PASS |
| EVT-017 | Eventos | confirmar un evento en consulta lo confirma, audita y dispara el ciclo de vida (checklists e inventario) | Owner | P0 | ✅ tests/e2e/events/event-status.spec.ts | PASS |
| EVT-018 | Eventos | recorrido completo de estados hasta «Completado» desde el panel | Owner | P1 | ✅ tests/e2e/events/event-status.spec.ts | PASS |
| EVT-019 | Eventos | transiciones inválidas: la UI sólo ofrece las válidas y el backend rechaza el resto | Owner | P1 | ✅ tests/e2e/events/event-status.spec.ts | PASS |
| EVT-020 | Eventos | confirmar en una fecha llena avisa del conflicto y sólo procede con confirmación explícita | Owner | P1 | ✅ tests/e2e/events/event-status.spec.ts | PASS |
| EVT-021 | Eventos | cancelar con motivo y aviso: estado, reserva, auditoría, notificación y portal/micrositio cancelados | Owner | P0 | ✅ tests/e2e/events/event-status.spec.ts | PASS |
| EVT-022 | Eventos | cancelar libera las reservas de inventario del evento | Owner | P1 | ✅ tests/e2e/events/event-status.spec.ts | PASS |
| EVT-023 | Eventos | cancelar exige motivo (UI y backend) y no aplica a eventos completados | Owner | P1 | ✅ tests/e2e/events/event-status.spec.ts | PASS |
| EVT-024 | Eventos | al cancelar, un checkout de anticipo PENDIENTE no debe poder cobrarse | Owner | P0 | ✅ tests/e2e/events/event-status.spec.ts | FAIL (EVX-BUG-01) |
| EVT-025 | Eventos | registrar el anticipo como pago manual confirma el evento, recalcula el saldo y audita | Owner | P0 | ✅ tests/e2e/events/event-payments.spec.ts | PASS |
| EVT-026 | Eventos | un pago manual mayor al saldo pendiente se rechaza en la UI y en el backend | Owner | P1 | ✅ tests/e2e/events/event-payments.spec.ts | PASS |
| EVT-027 | Eventos | pago manual: fecha futura, monto mínimo, evento cancelado y evento sin reserva se rechazan | Owner | P1 | ✅ tests/e2e/events/event-payments.spec.ts | PASS |
| EVT-028 | Eventos | reembolso parcial de un pago cobrado: estado, fila REFUND, auditoría y saldo | Owner | P0 | ✅ tests/e2e/events/event-payments.spec.ts | PASS |
| EVT-029 | Eventos | reembolsos inválidos: mayor a lo disponible, pago pendiente, fila de reembolso y doble reembolso total | Owner | P1 | ✅ tests/e2e/events/event-payments.spec.ts | PASS |
| EVT-030 | Eventos | staff y anónimo no pueden registrar pagos ni reembolsar aunque fuercen el request | Staff | P0 | ✅ tests/e2e/events/event-payments.spec.ts | PASS |
| EVT-031 | Eventos | rotar el enlace del portal invalida el anterior (404) y audita sin guardar el token completo | Owner | P1 | ✅ tests/e2e/events/event-experience.spec.ts | PASS |
| EVT-032 | Eventos | rotar la invitación general invalida el link anterior pero no los links personales | Owner | P1 | ✅ tests/e2e/events/event-experience.spec.ts | PASS |
| EVT-033 | Eventos | programa del evento: agregar, editar y eliminar momentos; sólo los visibles llegan al micrositio | Owner | P1 | ✅ tests/e2e/events/event-experience.spec.ts | PASS |
| EVT-034 | Eventos | programa: el backend no permite editar ni borrar momentos de otro evento (IDOR) ni títulos vacíos | Owner | P2 | ✅ tests/e2e/events/event-experience.spec.ts | PASS |
| EVT-035 | Eventos | mensaje del equipo a la clienta: queda en la conversación, la notifica y lo ve en su portal | Owner | P1 | ✅ tests/e2e/events/event-experience.spec.ts | PASS |
| EVT-036 | Eventos | staff y anónimo: sin acceso a /admin/events y sin poder crear ni cancelar por request directo | Staff | P0 | ✅ tests/e2e/events/event-experience.spec.ts | PASS |
| EVT-037 | Eventos | accesibilidad (WCAG 2.1 AA) del listado, el alta y el detalle de evento | Owner | P2 | ✅ tests/e2e/events/event-experience.spec.ts | FAIL (EVX-BUG-04) |
| EVT-038 | Eventos | «Limpiar filtros» regresa al listado sin filtros (navegación del cliente) | Owner | P2 | ✅ tests/e2e/events/events.spec.ts | PASS (en esta corrida; EVX-BUG-02 es intermitente y la hizo fallar en corridas previas) |
| GST-001 | Invitadas/RSVP | agregar una invitada desde el admin genera su link personal y persiste | Owner | P1 | ✅ tests/e2e/guests/guests-admin.spec.ts | PASS |
| GST-002 | Invitadas/RSVP | editar asistencia, acompañante y restricciones actualiza el resumen y audita el cambio de RSVP | Owner | P1 | ✅ tests/e2e/guests/guests-admin.spec.ts | PASS |
| GST-003 | Invitadas/RSVP | quitar una invitada la elimina, audita y desactiva su link personal | Owner | P1 | ✅ tests/e2e/guests/guests-admin.spec.ts | PASS |
| GST-004 | Invitadas/RSVP | contacto duplicado: aviso confirmable antes de guardar a otra persona con el mismo correo | Owner | P2 | ✅ tests/e2e/guests/guests-admin.spec.ts | PASS |
| GST-005 | Invitadas/RSVP | validaciones de invitada en el formulario y en el backend (incluye IDOR de invitada) | Owner | P2 | ✅ tests/e2e/guests/guests-admin.spec.ts | PASS |
| GST-006 | Invitadas/RSVP | exportar CSV: contenido correcto, BOM, auditoría, fórmulas neutralizadas y acceso restringido | Owner | P1 | ✅ tests/e2e/guests/guests-admin.spec.ts | PASS |
| GST-007 | Invitadas/RSVP | recordatorio RSVP a pendientes: notificaciones por canal, auditoría y un solo envío por día | Owner | P1 | ✅ tests/e2e/guests/guests-admin.spec.ts | PASS |
| GST-008 | Invitadas/RSVP | recordatorios bloqueados en eventos cancelados o con micrositio apagado (UI y backend) | Owner | P2 | ✅ tests/e2e/guests/guests-admin.spec.ts | PASS |
| GST-009 | Invitadas/RSVP | ocultar y volver a mostrar un mensaje para la homenajeada (moderación auditada) | Owner | P2 | ✅ tests/e2e/guests/guests-admin.spec.ts | PASS |
| GST-010 | Invitadas/RSVP | staff y anónimo no gestionan invitadas aunque fuercen el request | Staff | P1 | ✅ tests/e2e/guests/guests-admin.spec.ts | PASS |
| GST-011 | Invitadas/RSVP | confirmar asistencia con el link personal (acompañante y restricción) se refleja en admin y portal | Invitada (token) | P0 | ✅ tests/e2e/guests/rsvp.spec.ts | FLAKY (EVX-BUG-02) |
| GST-011 | Invitadas/RSVP | confirmar asistencia con el link personal (acompañante y restricción) se refleja en admin y portal · móvil 390×844 | Invitada (token) | P0 | ✅ tests/e2e/guests/rsvp.spec.ts | FLAKY (EVX-BUG-02) |
| GST-012 | Invitadas/RSVP | declinar y luego cambiar la respuesta con «Editar mi respuesta» | Invitada (token) | P1 | ✅ tests/e2e/guests/rsvp.spec.ts | PASS (en esta corrida; EVX-BUG-02 es intermitente y la hizo fallar en corridas previas) |
| GST-012 | Invitadas/RSVP | declinar y luego cambiar la respuesta con «Editar mi respuesta» · móvil 390×844 | Invitada (token) | P1 | ✅ tests/e2e/guests/rsvp.spec.ts | PASS (en esta corrida; EVX-BUG-02 es intermitente y la hizo fallar en corridas previas) |
| GST-013 | Invitadas/RSVP | con el link general una invitada nueva se registra sola y recibe su link personal | Invitada (token) | P1 | ✅ tests/e2e/guests/rsvp.spec.ts | PASS |
| GST-014 | Invitadas/RSVP | con el link general, escribir el nombre de otra invitada NO debe sobrescribir su respuesta ni entregar su link personal | Invitada (token) | P0 | ✅ tests/e2e/guests/rsvp.spec.ts | PASS — @regression BUG-003 (EVX-BUG-03 corregido; 3/3 sin reintentos) |
| GST-015 | Invitadas/RSVP | mensaje para la homenajeada: se guarda uno por invitada y se actualiza al editar | Invitada (token) | P1 | ✅ tests/e2e/guests/rsvp.spec.ts | PASS (en esta corrida; EVX-BUG-02 es intermitente y la hizo fallar en corridas previas) |
| GST-016 | Invitadas/RSVP | archivo .ics: con dirección sólo para quien confirmó; 404 para cancelado o token inválido | Invitada (token) | P1 | ✅ tests/e2e/guests/rsvp.spec.ts | PASS |
| GST-017 | Invitadas/RSVP | tokens del micrositio: otro evento, slug equivocado, micrositio apagado o token inexistente → 404 | Anónimo | P1 | ✅ tests/e2e/guests/rsvp.spec.ts | PASS |
| GST-018 | Invitadas/RSVP | privacidad del micrositio: sin dirección exacta antes de confirmar y sin datos de otras invitadas | Invitada (token) | P1 | ✅ tests/e2e/guests/rsvp.spec.ts | PASS |
| GST-019 | Invitadas/RSVP | validaciones del RSVP en el formulario y en el backend | Invitada (token) | P2 | ✅ tests/e2e/guests/rsvp.spec.ts | PASS |
| GST-020 | Invitadas/RSVP | RSVP cerrado en eventos completados y cancelados (UI y backend) | Invitada (token) | P1 | ✅ tests/e2e/guests/rsvp.spec.ts | PASS |
| GST-021 | Invitadas/RSVP | el link general no admite más de 60 invitadas | Invitada (token) | P2 | ✅ tests/e2e/guests/rsvp.spec.ts | PASS |
| GST-022 | Invitadas/RSVP | invitación sembrada de Camila (sólo lectura) y accesibilidad del micrositio | Invitada (token) | P2 | ✅ tests/e2e/guests/rsvp.spec.ts | FAIL (EVX-BUG-05) |
| GST-023 | Invitadas/RSVP | posible duplicado del link general (nombre o email de otra invitada): se marca para la anfitriona y el equipo sin tocar ni revelar a la original | Invitada (token) / Owner / Clienta (token) | P1 | ✅ tests/e2e/guests/rsvp.spec.ts | PASS — @regression BUG-003 (3/3 sin reintentos) |
| GST-024 | Invitadas/RSVP | link general: 10 respuestas por IP en 10 min; la 11ª responde RATE_LIMITED y no crea invitada | Invitada (token) | P2 | ✅ tests/e2e/guests/rsvp.ratelimit.spec.ts (`E2E_SUITE=ratelimit`) | PASS |
| MEM-001 | Memory Capsule | crear la cápsula de un evento la deja en preparación (enlace con aviso, sin fotos) | Owner | P1 | ✅ tests/e2e/memory/memory-admin.spec.ts | PASS |
| MEM-002 | Memory Capsule | publicar la cápsula desde Ajustes la abre al público con su título y mensaje | Owner | P1 | ✅ tests/e2e/memory/memory-admin.spec.ts | PASS |
| MEM-003 | Memory Capsule | cápsula duplicada, título corto o cápsula inexistente se rechazan en el backend | Owner | P2 | ✅ tests/e2e/memory/memory-admin.spec.ts | PASS |
| MEM-004 | Memory Capsule | generar un nuevo enlace invalida el anterior (404) y audita sin guardar el token | Owner | P1 | ✅ tests/e2e/memory/memory-admin.spec.ts | PASS |
| MEM-005 | Memory Capsule | aprobar una foto de invitada la publica en la galería con URL firmada | Owner | P1 | ✅ tests/e2e/memory/memory-admin.spec.ts | PASS |
| MEM-006 | Memory Capsule | ocultar una foto aprobada la retira de la galería pública | Owner | P1 | ✅ tests/e2e/memory/memory-admin.spec.ts | PASS |
| MEM-007 | Memory Capsule | elegir como portada una foto oculta la aprueba y la muestra en la portada pública | Owner | P2 | ✅ tests/e2e/memory/memory-admin.spec.ts | PASS |
| MEM-008 | Memory Capsule | eliminar una foto la borra de la base y del almacenamiento (la URL firmada deja de servir) | Owner | P1 | ✅ tests/e2e/memory/memory-admin.spec.ts | PASS |
| MEM-009 | Memory Capsule | ocultar y mostrar mensajes del libro de visitas desde la moderación | Owner | P1 | ✅ tests/e2e/memory/memory-admin.spec.ts | PASS |
| MEM-010 | Memory Capsule | fotos subidas por el equipo se publican aprobadas | Owner | P2 | ✅ tests/e2e/memory/memory-admin.spec.ts | PASS |
| MEM-011 | Memory Capsule | moderación protegida: anónimo y staff no pueden aprobar fotos ni ocultar mensajes aunque usen la ruta pública | Staff | P0 | ✅ tests/e2e/memory/memory-admin.spec.ts | PASS |
| MEM-012 | Memory Capsule | IDOR en moderación: foto o mensaje de otro evento con ids de esta cápsula → no encontrado | Owner | P1 | ✅ tests/e2e/memory/memory-admin.spec.ts | PASS |
| MEM-013 | Memory Capsule | una invitada deja un mensaje en el libro de visitas y queda en el muro y en la moderación | Invitada (token) | P0 | ✅ tests/e2e/memory/memory-public.spec.ts | PASS |
| MEM-013 | Memory Capsule | una invitada deja un mensaje en el libro de visitas y queda en el muro y en la moderación · móvil 390×844 | Invitada (token) | P0 | ✅ tests/e2e/memory/memory-public.spec.ts | PASS |
| MEM-014 | Memory Capsule | una invitada sube una foto con consentimiento: queda privada y pendiente de revisión | Invitada (token) | P0 | ✅ tests/e2e/memory/memory-public.spec.ts | PASS |
| MEM-014 | Memory Capsule | una invitada sube una foto con consentimiento: queda privada y pendiente de revisión · móvil 390×844 | Invitada (token) | P0 | ✅ tests/e2e/memory/memory-public.spec.ts | PASS |
| MEM-015 | Memory Capsule | subida pública rechaza tipos falsos, PDF, falta de consentimiento, origen ajeno y cápsulas cerradas | Anónimo | P1 | ✅ tests/e2e/memory/memory-public.spec.ts | PASS |
| MEM-016 | Memory Capsule | libro de visitas: cápsula en preparación, token inválido y mensaje vacío se rechazan; el HTML se escapa | Anónimo | P1 | ✅ tests/e2e/memory/memory-public.spec.ts | PASS |
| MEM-017 | Memory Capsule | la galería pública sólo muestra lo aprobado y visible; tokens inválidos responden 404 | Anónimo | P1 | ✅ tests/e2e/memory/memory-public.spec.ts | PASS |
| MEM-018 | Memory Capsule | cápsula sembrada de Valeria (sólo lectura) y acceso desde su portal | Clienta (token) | P2 | ✅ tests/e2e/memory/memory-public.spec.ts | PASS |
| MEM-019 | Memory Capsule | accesibilidad (WCAG 2.1 AA) de la cápsula pública | Invitada (token) | P2 | ✅ tests/e2e/memory/memory-public.spec.ts | FAIL (EVX-BUG-04) |
| MEM-020 | Memory Capsule | con MEMORY_CAPSULE_ENABLED=false la cápsula pública, la subida y el libro de visitas quedan cerrados · suite global | Anónimo | P1 | ✅ tests/e2e/memory/memory.global.spec.ts | PASS |
| PORT-001 | Portal | portal de Sofía (confirmado): datos del evento, pago, invitadas y sin datos internos | Clienta (token) | P0 | ✅ tests/e2e/portal/portal.spec.ts | PASS |
| PORT-001 | Portal | portal de Sofía (confirmado): datos del evento, pago, invitadas y sin datos internos · móvil 390×844 | Clienta (token) | P0 | ✅ tests/e2e/portal/portal.spec.ts | PASS |
| PORT-002 | Portal | portal de Fernanda (pendiente de pago): anticipo pendiente y CTA de pago con el monto correcto | Clienta (token) | P1 | ✅ tests/e2e/portal/portal.spec.ts | PASS |
| PORT-002 | Portal | portal de Fernanda (pendiente de pago): anticipo pendiente y CTA de pago con el monto correcto · móvil 390×844 | Clienta (token) | P1 | ✅ tests/e2e/portal/portal.spec.ts | PASS |
| PORT-003 | Portal | tokens inválidos, inexistentes o rotados responden 404 genérico | Anónimo | P1 | ✅ tests/e2e/portal/portal.spec.ts | PASS |
| PORT-004 | Portal | resumen imprimible del evento | Clienta (token) | P2 | ✅ tests/e2e/portal/portal.spec.ts | PASS |
| PORT-005 | Portal | solicitar acceso: respuesta neutral y enlace enviado sólo a correos registrados (sin enumeración) | Anónimo | P1 | ✅ tests/e2e/portal/portal.spec.ts | PASS |
| PORT-006 | Portal | solicitar acceso valida el correo en el formulario y en el backend | Anónimo | P2 | ✅ tests/e2e/portal/portal.spec.ts | PASS |
| PORT-007 | Portal | editar preferencias guarda, avisa al equipo en la conversación, audita y se refleja en la invitación | Clienta (token) | P1 | ✅ tests/e2e/portal/portal.spec.ts | PASS |
| PORT-008 | Portal | preferencias inválidas (playlist, colores, enlace javascript:) se rechazan | Clienta (token) | P2 | ✅ tests/e2e/portal/portal.spec.ts | PASS |
| PORT-009 | Portal | editar la dirección (más de 48 h antes) actualiza el evento y lo audita | Clienta (token) | P1 | ✅ tests/e2e/portal/portal.spec.ts | PASS |
| PORT-010 | Portal | a menos de 48 h la dirección ya no se puede editar (UI y backend) | Clienta (token) | P1 | ✅ tests/e2e/portal/portal.spec.ts | PASS |
| PORT-011 | Portal | mensaje de la anfitriona llega al equipo (conversación del admin + aviso) | Clienta (token) | P0 | ✅ tests/e2e/portal/portal.spec.ts | PASS |
| PORT-012 | Portal | la anfitriona agrega invitadas; duplicados y contactos inválidos se rechazan | Clienta (token) | P1 | ✅ tests/e2e/portal/portal.spec.ts | PASS |
| PORT-013 | Portal | la anfitriona sólo puede quitar invitadas pendientes que ella agregó | Clienta (token) | P1 | ✅ tests/e2e/portal/portal.spec.ts | PASS |
| PORT-014 | Portal | la lista de la anfitriona tiene un máximo de 60 invitadas | Clienta (token) | P1 | ✅ tests/e2e/portal/portal.spec.ts | PASS |
| PORT-015 | Portal | el token de un evento no permite tocar invitadas ni datos de otro evento (IDOR) | Clienta (token) | P0 | ✅ tests/e2e/portal/portal.spec.ts | PASS |
| PORT-016 | Portal | evento cancelado: aviso amable y sin cambios posibles desde el portal | Clienta (token) | P1 | ✅ tests/e2e/portal/portal.spec.ts | PASS |
| PORT-017 | Portal | tras un evento completado la clienta deja su opinión una sola vez | Clienta (token) | P1 | ✅ tests/e2e/portal/portal.spec.ts | PASS |
| PORT-018 | Portal | antes de completarse el evento no se puede opinar (UI y backend) | Clienta (token) | P1 | ✅ tests/e2e/portal/portal.spec.ts | PASS |
| PORT-019 | Portal | texto con HTML en las preferencias se muestra escapado en portal e invitación | Clienta (token) | P2 | ✅ tests/e2e/portal/portal.spec.ts | PASS |
| PORT-020 | Portal | accesibilidad (WCAG 2.1 AA) del portal y del acceso por correo | Clienta (token) | P2 | ✅ tests/e2e/portal/portal.spec.ts | PASS |

### Totales por módulo y prioridad

| Módulo | Prioridad | PASS | FAIL | FLAKY | Otros |
|---|---|---|---|---|---|
| Calendario | P1 | 5 | 1 | 0 | 0 |
| Calendario | P2 | 6 | 1 | 0 | 0 |
| Eventos | P0 | 7 | 1 | 0 | 0 |
| Eventos | P1 | 21 | 0 | 0 | 0 |
| Eventos | P2 | 7 | 1 | 0 | 0 |
| Eventos | P3 | 1 | 0 | 0 | 0 |
| Invitadas/RSVP | P0 | 0 | 1 | 2 | 0 |
| Invitadas/RSVP | P1 | 14 | 0 | 0 | 0 |
| Invitadas/RSVP | P2 | 6 | 1 | 0 | 0 |
| Memory Capsule | P0 | 5 | 0 | 0 | 0 |
| Memory Capsule | P1 | 12 | 0 | 0 | 0 |
| Memory Capsule | P2 | 4 | 1 | 0 | 0 |
| Portal | P0 | 4 | 0 | 0 | 0 |
| Portal | P1 | 13 | 0 | 0 | 0 |
| Portal | P2 | 5 | 0 | 0 | 0 |
| **Total** | | **110** | **7** | **2** | **0** |

### No probado en este paquete (y por qué)

| Área | Estado | Motivo |
|---|---|---|
| Contenido de las pestañas Operaciones / Finanzas del evento, cierre financiero (`events:close`) | NOT TESTED (aquí) | Paquete 5 (OPS/FIN); aquí sólo se valida la navegación entre pestañas (EVT-003) |
| `/admin/settings/availability` (buffer, anticipación) y flags desde la UI de ajustes | NOT TESTED (aquí) | Paquete 5 (SET); el flag de Memory se cambió vía `Setting` en MEM-020 |
| Llave de deduplicación compartida entre recordatorios manuales y `/api/cron/notifications` | NOT TESTED (aquí) | El cron pertenece al paquete 1 (API) |
| Recálculo de precio/inventario al cambiar invitadas/experiencia en eventos con reserva | NOT TESTED | Sin requisito documentado; registrado como riesgo en `events.md` |
| Cross-browser (Firefox/WebKit) de los P0 del paquete | NOT TESTED (aquí) | Lo corre el carril 0 (`E2E_CROSS_BROWSER=1`) |
| Proveedores de pago reales (Stripe/Mercado Pago) | NOT APPLICABLE | Servicio externo de pago; el gate usa el proveedor mock |
