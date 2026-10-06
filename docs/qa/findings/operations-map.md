# Application Test Map — Paquete 5 «Operación y back-office» (carril 5)

Fuente: inventario `docs/qa/.discovery/inventory.json` (2026-10-06), commit f26b1a1, entorno TEST (build de producción local :3205, base `ivonne_rosa_e2e_l5`).
Prioridades: P0 crítico · P1 principal · P2 secundario · P3 menor. Las filas usan el mismo ID que la prueba automatizada.
Páginas cubiertas: /admin/operations (+templates, +templates/[id]), /admin/events/[id]/operations, /admin/events/[id]/financials, /staff, /staff/events/[id], /admin/staff (+new, +[id]), /admin/inventory (+[id], +events, +events/[eventId], +conflicts), /admin/purchases (+new, +[id]), /admin/vendors (+new, +[id], +[id]/edit), /admin/finance (+export), /admin/analytics, /admin/settings (todas las secciones), /admin/content (+faq, +gallery), /admin/notifications, /api/cron/notifications.

| ID | Módulo | Página/Flujo | Rol | Acción | Resultado esperado | Prioridad |
|---|---|---|---|---|---|---|
| CNT-001 | Contenido | /admin/content | Owner | Nuevo testimonio | crear un testimonio guarda autora, calificación y visibilidad y se audita | P1 |
| CNT-002 | Contenido | Nuevo testimonio vacío | Owner | Nuevo testimonio vacío | el testimonio exige autora (2+) y texto (10+) | P2 |
| CNT-003 | Contenido | Testimonio | Owner | Editar → Visible off → Eliminar | editar, ocultar y eliminar un testimonio persiste en la base (con auditoría) | P1 |
| CNT-006 | Contenido | /admin/content/faq | Owner | Nueva pregunta → filtro Pagos | crear una pregunta frecuente con categoría la guarda, la audita y la filtra por categoría | P1 |
| CNT-007 | Contenido | FAQ | Owner | Editar → Visible off → Eliminar | editar, ocultar y eliminar una pregunta frecuente persiste (con auditoría) | P1 |
| CNT-008 | Contenido | Nueva pregunta vacía | Owner | Nueva pregunta vacía | la pregunta frecuente exige pregunta y respuesta (5+) | P2 |
| CNT-010 | Contenido | /admin/content/gallery | Owner | subir → alt → Destacada → Eliminar | subir una foto a la galería, ponerle texto alternativo, destacarla y eliminarla | P1 |
| CNT-011 | Contenido | Galería | Owner | alt de 2 caracteres en una imagen del seed | el texto alternativo exige 3+ caracteres (sin cambios en base) | P2 |
| CNT-012 | Contenido | Galería | Owner | subir texto con extensión .png | un archivo que no es imagen se rechaza al subirlo a la galería | P2 |
| CNT-020 | Contenido | /admin/content | Owner | Nuevo testimonio (orden 0) → / (anónima) → Visible off → / | un testimonio visible con orden 0 aparece primero en la portada; oculto desaparece | P1 |
| CNT-021 | Contenido | /admin/content/faq | Owner | Nueva pregunta (orden 0) → /como-funciona → Visible off | una pregunta general visible aparece en «Cómo funciona»; oculta desaparece | P1 |
| CNT-022 | Contenido | /admin/content/faq | Owner | Subir / Bajar | subir/bajar una pregunta frecuente intercambia su posición con la vecina | P2 |
| CNT-023 | Contenido | /admin/content | Owner | Bajar testimonio (1.º) → la UI se refresca → Subir | reordenar testimonios persiste el orden y la lista se actualiza en pantalla | P2 |
| CNT-024 | Contenido | /admin/content/gallery | Owner | Bajar imagen 1 → la tarjeta pasa a #2 → Subir | reordenar fotos de la galería persiste el orden y la tarjeta cambia de posición | P2 |
| FIN-001 | Finanzas | Finanzas del evento | Owner | Agregar costo | registrar un costo manual lo guarda en centavos, lo suma al total y lo audita | P1 |
| FIN-002 | Finanzas | Agregar costo con datos inválidos | Owner | Agregar costo con datos inválidos | el costo manual exige descripción (3+) y monto mayor a $0 | P2 |
| FIN-003 | Finanzas | Costos manuales | Owner | Editar costo | editar un costo manual actualiza monto y categoría con auditoría antes/después | P1 |
| FIN-004 | Finanzas | Costos manuales | Owner | Eliminar costo | eliminar un costo manual lo quita del costo real y queda en auditoría | P1 |
| FIN-005 | Finanzas | Evento con venta $23,200 (IVA $3,200), compra recibida, staff, costo manual y comisión | Owner | Evento con venta $23,200 (IVA $3,200), compra recibida, staff, costo manual y comisión | la rentabilidad del evento cuadra con la base: venta − IVA − costos reales = margen | P0 |
| FIN-006 | Finanzas | Evento COMPLETED | Owner | Agregar costo (captura) → Cerrar evento → replay de createEventCost | cerrar un evento completado congela números, audita, notifica a la clienta y bloquea costos | P0 |
| FIN-007 | Finanzas | Evento cerrado | Owner | pestaña Resumen / Operaciones: encabezado | el encabezado del evento (todas las pestañas) indica que el evento está cerrado | P3 |
| FIN-008 | Finanzas | Evento CONFIRMED sin botón; captura closeEvent en COMPLETED | Owner | replay al CONFIRMED y al mismo (doble) | sólo se cierran eventos completados; el doble cierre se rechaza (backend) | P1 |
| FIN-010 | Finanzas | /admin/finance?status=CLOSED | Owner | /admin/finance?status=CLOSED | /admin/finance muestra KPIs y el filtro «Cerrados» incluye el evento cerrado | P1 |
| FIN-011 | Finanzas | GET /admin/finance/export?status=CLOSED (owner y anónimo) | Owner | GET /admin/finance/export?status=CLOSED (owner y anónimo) | la exportación CSV trae BOM, encabezados, filas en pesos y queda auditada; sin sesión → 401 | P1 |
| FIN-012 | Finanzas | /admin/analytics | Owner | /admin/analytics | /admin/analytics renderiza con datos reales sin errores de consola | P2 |
| FIN-013 | Finanzas | Evento titulado =1+1 | Owner | exportación CSV | el CSV neutraliza fórmulas en textos (título que empieza con «=») | P2 |
| INV-001 | Inventario | /admin/inventory | Owner | Buscar | el inventario lista artículos con indicadores y la búsqueda filtra por SKU | P1 |
| INV-002 | Inventario | Inventario | Owner | Nuevo artículo | alta de artículo: SKU en mayúsculas, movimiento de alta y auditoría; aparece al recargar | P1 |
| INV-003 | Inventario | Nuevo artículo con SKU existente en minúsculas | Owner | Nuevo artículo con SKU existente en minúsculas | el SKU es único sin distinguir mayúsculas (no crea duplicado) | P2 |
| INV-004 | Inventario | Nuevo artículo con SKU inválido y nombre vacío | Owner | Nuevo artículo con SKU inválido y nombre vacío | el alta valida formato de SKU y nombre (front y back) | P2 |
| INV-005 | Inventario | Detalle del artículo | Owner | Editar | editar un artículo cambia sus datos sin tocar cantidades y audita sólo lo que cambió | P1 |
| INV-006 | Inventario | Inventario | Owner | Incluir inactivos; replay de addReservation con artículo inactivo | un artículo inactivo se oculta del listado y no se puede reservar (backend) | P1 |
| INV-007 | Inventario | Detalle | Owner | Ajustar stock → Entrada por compra +5 | entrada por compra suma al total, registra el movimiento y audita | P0 |
| INV-008 | Inventario | Ajustar stock | Owner | Pérdida 50 de 6 utilizables; replay con LOSS 999 | una baja mayor a lo utilizable se bloquea en la UI y en el backend (nunca negativo) | P1 |
| INV-009 | Inventario | Ajustar stock | Owner | Enviar a mantenimiento 3 → Regreso 1 → Ajuste −2 | mantenimiento (enviar y regresar) y ajuste por conteo restando mantienen 0 ≤ mant ≤ total | P1 |
| INV-010 | Inventario | Artículo con utilizable = umbral | Owner | Entrada por compra | el indicador de stock bajo aparece al llegar al umbral y desaparece al reponer | P1 |
| INV-011 | Inventario | Reservas del evento | Owner | Agregar artículo | agregar un artículo a un evento crea la reserva y su movimiento | P1 |
| INV-012 | Inventario | Reservas | Owner | Editar cantidad 3 → 7 | editar la cantidad reservada registra el delta y lo audita | P1 |
| INV-013 | Inventario | Reservas | Owner | Entregar → Regreso (4 buenas + 1 dañada) | salida y regreso con piezas dañadas: reserva RETURNED, baja del total y auditoría de merma | P1 |
| INV-014 | Inventario | Registrar regreso con suma incorrecta | Owner | Registrar regreso con suma incorrecta | el regreso exige que buenas + dañadas sumen lo que salió | P2 |
| INV-015 | Inventario | Reservas | Owner | Liberar reserva | liberar una reserva la cancela, registra RELEASE y la lista como liberada | P1 |
| INV-016 | Inventario | Reservas | Owner | Entregar todo (2) | «Entregar todo» pasa todas las reservas pendientes a En evento | P1 |
| INV-017 | Inventario | Reservas de evento CANCELLED | Owner | Liberar todo | un evento cancelado que aún aparta piezas se libera con «Liberar todo» | P1 |
| INV-018 | Inventario | Reservas | Owner | Recalcular desde requerimientos (experiencia propia: 1/invitada + 2 fijos) | recalcular desde requerimientos reserva por invitada y fijos según la experiencia | P1 |
| INV-019 | Inventario | Captura recalculate en evento activo | Owner | replay con id de evento COMPLETED | un evento completado no se recalcula (botón oculto + backend CONFLICT) | P2 |
| INV-020 | Inventario | Conflictos de inventario (artículo propio: 5 utilizables, 3 + 3 reservados) | Owner | Conflictos de inventario (artículo propio: 5 utilizables, 3 + 3 reservados) | dos eventos el mismo día que sobre-reservan un artículo aparecen en Conflictos | P1 |
| INV-021 | Inventario | Conflictos | Owner | 30 / 60 / 90 días | el rango de conflictos se elige entre 30, 60 y 90 días | P3 |
| INV-022 | Inventario | /admin/inventory/events | Owner | /admin/inventory/events | «Reservas por evento» lista el evento próximo con su conteo y abre su detalle | P2 |
| INV-023 | Inventario | /admin/inventory/<id inexistente> | Owner | /admin/inventory/<id inexistente> | un artículo inexistente muestra «no encontrado» | P3 |
| INV-024 | Inventario | Agregar artículo ya reservado | Owner | Agregar artículo ya reservado | no se puede reservar dos veces el mismo artículo en el evento | P2 |
| INV-025 | Inventario | /admin/inventory | Owner | escribir en Buscar y activar Incluir inactivos (navegación en el cliente) | los filtros del inventario (búsqueda y «Incluir inactivos») actualizan la URL y la lista sin recargar | P1 |
| NOT-001 | Notificaciones | /admin/notifications?q=…&channel=…&status=… | Owner | /admin/notifications?q=…&channel=…&status=… | la bandeja busca por asunto y filtra por canal, tipo y estado | P1 |
| NOT-002 | Notificaciones | /admin/notifications?id=<id> | Owner | Marcar como no leído | abrir un mensaje lo marca como leído y se puede volver a marcar como no leído | P1 |
| NOT-003 | Notificaciones | /admin/notifications?unread=1&q=… | Owner | /admin/notifications?unread=1&q=… | el filtro «sin leer» muestra sólo pendientes y respeta la lectura | P2 |
| NOT-004 | Notificaciones | /admin/notifications | Owner | Marcar todo como leído | «Marcar todo como leído» deja la bandeja sin pendientes | P1 |
| NOT-005 | Notificaciones | Bandeja | Owner | Ejecutar recordatorios ahora (2 veces) con eventos propios a 5 días y a 30 h | «Ejecutar recordatorios ahora» genera 7 días y 48 h una sola vez (idempotente) y se audita | P0 |
| NOT-006 | Notificaciones | POST /api/cron/notifications con Authorization: Bearer $CRON_SECRET (2 veces) | Anónimo | POST /api/cron/notifications con Authorization: Bearer $CRON_SECRET (2 veces) | el cron /api/cron/notifications con el secreto correcto ejecuta las reglas sin duplicar | P1 |
| NOT-007 | Notificaciones | Cada STAFF_ASSIGNED de la base | Staff | su actionUrl abierto por la persona asignada (Lupita) | los avisos STAFF_ASSIGNED de la bandeja enlazan a una ruta real del portal (/staff/events/<id>) | P3 |
| OPS-001 | Operaciones | Operaciones | Owner | tablero → Orden de producción | el tablero muestra los eventos de los próximos 14 días y enlaza a su orden de producción | P1 |
| OPS-002 | Operaciones | Orden de producción | Owner | Generar desde plantillas (2 veces) | generar checklist desde plantillas crea las tareas activas una sola vez (idempotente) | P0 |
| OPS-003 | Operaciones | Captura instantiateChecklist en evento activo | Owner | replay con id de evento cancelado | un evento cancelado no permite generar checklist (UI oculta + backend CONFLICT) | P1 |
| OPS-004 | Operaciones | Checklist | Owner | Agregar tarea | agregar una tarea personalizada la guarda con fase, área y evidencia y persiste al recargar | P1 |
| OPS-005 | Operaciones | Checklist | Owner | Agregar tarea con título corto | la tarea personalizada exige título de 3+ caracteres (sin registro en base) | P2 |
| OPS-006 | Operaciones | Checklist | Owner | estado Pendiente → Hecho → Pendiente | cambiar el estado a Hecho registra fecha y autora; reabrir la limpia | P1 |
| OPS-007 | Operaciones | Checklist | Owner | Hecho sin evidencia + replay de updateChecklistItem con status DONE | una tarea con evidencia obligatoria no se puede cerrar sin foto (UI y backend) | P1 |
| OPS-008 | Operaciones | Checklist | Owner | Detalles: responsable, notas, fecha | responsable, notas y fecha límite de una tarea se guardan por separado (las notas no se borran) | P2 |
| OPS-009 | Operaciones | Checklist | Owner | Detalles → Eliminar tarea | eliminar una tarea la quita del checklist y queda en auditoría | P1 |
| OPS-010 | Operaciones | Staff | Owner | Asignar staff (Lupita) → NotificationLog STAFF_ASSIGNED → staff abre el enlace | asignar staff crea la asignación con su tarifa, notifica y el enlace lleva a /staff/events/<id> | P0 |
| OPS-011 | Operaciones | Staff | Owner | Asignar duplicado | no se puede asignar dos veces a la misma persona con la misma función | P2 |
| OPS-012 | Operaciones | Staff | Owner | Asignar con horario invertido | la hora de salida debe ser posterior a la de entrada | P2 |
| OPS-013 | Operaciones | Staff | Owner | switches Confirmada / Pagada | confirmar y marcar como pagada una asignación persiste y audita el pago | P1 |
| OPS-014 | Operaciones | Staff | Owner | Editar asignación | editar una asignación cambia función y monto acordado (centavos) y lo audita | P1 |
| OPS-015 | Operaciones | Staff | Owner | Quitar a Lupita; luego staff abre /staff/events/<id> | quitar una asignación libera sus tareas abiertas y el staff deja de ver el evento | P1 |
| OPS-016 | Operaciones | Transporte y montaje | Owner | Guardar logística | guardar salida, montaje y desmontaje persiste en hora CDMX y queda en auditoría | P1 |
| OPS-017 | Operaciones | Transporte y montaje | Owner | montaje 13:00 para evento de 12:00 | el montaje después del inicio del evento se rechaza en el servidor (sin cambios) | P2 |
| OPS-018 | Operaciones | Add-ons | Owner | Guardar notas; staff (Lupita) ve la nota en su portal | las notas operativas de un add-on se guardan y las ve el staff asignado | P2 |
| OPS-019 | Operaciones | Orden de producción de evento cancelado | Owner | Orden de producción de evento cancelado | la orden de un evento cancelado es de sólo referencia (sin asignar ni editar logística) | P2 |
| OPS-020 | Operaciones | /admin/events/<id inexistente>/operations | Owner | /admin/events/<id inexistente>/operations | la orden de producción de un evento inexistente muestra «no encontrado» | P2 |
| OPS-021 | Operaciones | Operaciones | Owner | Tareas vencidas | las tareas vencidas aparecen en el tablero con enlace al checklist del evento | P2 |
| OPS-022 | Operaciones | Plantillas | Owner | lista → detalle | la lista agrupa las plantillas del seed por fase y abre el detalle con sus tareas | P1 |
| OPS-023 | Operaciones | Plantillas | Owner | Nueva plantilla (Activa = no) | crear una plantilla (inactiva) redirige a su detalle, persiste y se audita | P1 |
| OPS-024 | Operaciones | Plantilla | Owner | Guardar cambios | editar nombre, orden y descripción de una plantilla persiste y se audita | P1 |
| OPS-025 | Operaciones | Plantilla | Owner | Agregar tarea / Editar / Eliminar | tareas de plantilla: agregar con desfase, editar y eliminar (auditado) | P1 |
| OPS-026 | Operaciones | Plantilla | Owner | Agregar tarea con 400 días | el desfase máximo de una tarea de plantilla es de 365 días (validación del servidor) | P2 |
| OPS-027 | Operaciones | Plantilla | Owner | Eliminar plantilla | eliminar una plantilla borra sus tareas modelo, regresa a la lista y se audita | P1 |
| OPS-028 | Operaciones | /admin/operations/templates/<id inválido> | Owner | /admin/operations/templates/<id inválido> | una plantilla inexistente o con id inválido muestra «no encontrado» | P2 |
| OPS-029 | Operaciones | Plantilla activa propia | Owner | Generar en evento A → desactivar → Generar en evento B | una plantilla general activa se copia al generar checklists; al desactivarla deja de copiarse | P1 |
| OPS-030 | Operaciones | Captura createAssignment y replay idéntico | Owner | rechazo por duplicado | la acción de asignar staff repetida por la fundadora es idempotente respecto a duplicados (backend) | P2 |
| PUR-001 | Compras | /admin/purchases y /admin/purchases?event=<id> | Owner | /admin/purchases y /admin/purchases?event=<id> | la lista de compras muestra totales y filtra por evento | P1 |
| PUR-002 | Compras | /admin/purchases/new?eventId=<id> | Owner | Registrar compra | registrar una compra para un evento guarda el monto en centavos y se audita | P0 |
| PUR-003 | Compras | Nueva compra vacía | Owner | Nueva compra vacía | la compra exige concepto (3+) y monto esperado | P2 |
| PUR-004 | Compras | Compra | Owner | Marcar como ordenada → Volver a solicitada | marcar como ordenada y volver a solicitada actualiza estado y fecha de orden | P1 |
| PUR-005 | Compras | Compra | Owner | Marcar como recibida ($1,450.75) → Finanzas del evento | recibir con monto real lo guarda en centavos y suma al costo real del evento | P0 |
| PUR-006 | Compras | Compra | Owner | Cancelar compra (motivo) → Reabrir compra | cancelar con motivo lo deja en notas e historial; reabrir la regresa a solicitada | P1 |
| PUR-007 | Compras | Replay de markPurchaseOrdered y receivePurchase con ids de compras RECEIVED / CANCELLED | Owner | Replay de markPurchaseOrdered y receivePurchase con ids de compras RECEIVED / CANCELLED | transiciones inválidas (recibida→ordenada, cancelada→recibida) se rechazan en el backend | P1 |
| PUR-008 | Compras | Compra recibida | Owner | Corregir monto real | corregir el monto real de una compra recibida exige motivo y queda auditado | P1 |
| PUR-009 | Compras | Replay de updateActualAmount con id de compra REQUESTED | Owner | Replay de updateActualAmount con id de compra REQUESTED | corregir el monto real de una compra no recibida se rechaza en el backend | P2 |
| PUR-010 | Compras | Compra | Owner | Adjuntar ticket o factura → Quitar | adjuntar un comprobante (imagen) lo liga a la compra y se puede quitar | P1 |
| PUR-011 | Compras | Compra | Owner | Adjuntar archivo de texto con extensión .png | un archivo que no es imagen ni PDF se rechaza como comprobante | P2 |
| PUR-012 | Compras | Compra de evento cerrado; replay de receivePurchase | Owner | Compra de evento cerrado; replay de receivePurchase | en un evento cerrado no se puede recibir una compra (UI + backend) | P1 |
| PUR-013 | Compras | Compra | Owner | Detalles → Guardar cambios | editar los detalles de una compra persiste y aparece en el historial | P2 |
| PUR-014 | Compras | Nueva compra: combo de proveedores + replay con vendorId bloqueado | Owner | Nueva compra: combo de proveedores + replay con vendorId bloqueado | un proveedor bloqueado no se ofrece ni se acepta en el backend al registrar compras | P2 |
| PUR-020 | Proveedores | /admin/vendors y ?q= | Owner | /admin/vendors y ?q= | la lista de proveedores muestra los del seed y filtra por búsqueda | P1 |
| PUR-021 | Proveedores | /admin/vendors/new | Owner | Crear proveedor | alta de proveedor con contacto y calificación persiste y se audita | P1 |
| PUR-022 | Proveedores | /admin/vendors/new con datos inválidos | Owner | /admin/vendors/new con datos inválidos | el alta valida correo, teléfono y WhatsApp (sin crear registro) | P2 |
| PUR-023 | Proveedores | /admin/vendors/<id>/edit | Owner | Estado = Bloqueado | bloquear un proveedor queda auditado y oculta «Nueva compra» | P1 |
| PUR-024 | Proveedores | Detalle de proveedor | Owner | Eliminar | eliminar un proveedor sin compras lo borra y se audita | P1 |
| PUR-025 | Proveedores | Proveedor con compras; replay de deleteVendor | Owner | Proveedor con compras; replay de deleteVendor | un proveedor con compras no se puede borrar (botón deshabilitado + backend CONFLICT) | P1 |
| SET-001 | Ajustes | /admin/settings | SuperAdmin | cada sección del menú | todas las secciones de configuración cargan desde la navegación lateral | P1 |
| SET-002 | Ajustes | /admin/settings | Owner | Versión de términos | datos del negocio: guardar la versión de términos persiste y queda auditado | P1 |
| SET-003 | Ajustes | /admin/settings | Owner | WhatsApp del negocio inválido | datos del negocio: un WhatsApp con letras se rechaza sin guardar | P2 |
| SET-004 | Ajustes | /admin/settings/pricing | Owner | IVA 16 → 17; auditoría | precios: cambiar el IVA a 17 % se guarda en bps, se describe el cambio y se audita | P0 |
| SET-005 | Ajustes | /admin/settings/pricing | Owner | mínimo 10, máximo 8 | precios: el máximo de invitadas no puede ser menor al mínimo | P2 |
| SET-006 | Ajustes | /admin/settings/availability | Owner | Anticipación mínima | disponibilidad: cambiar la anticipación mínima persiste y se restaura | P1 |
| SET-007 | Ajustes | /admin/settings/availability | Owner | mínimo 60, máximo 30 | disponibilidad: «Reservas con hasta» debe superar la anticipación mínima | P2 |
| SET-008 | Ajustes | /admin/settings/notifications | Owner | Correo del equipo | notificaciones: el correo del equipo se guarda (validado) y se restaura | P1 |
| SET-009 | Ajustes | Funciones | Owner | Mensajes por WhatsApp off → WhatsApp de prueba → Restablecer | apagar WhatsApp deja los mensajes como OMITIDOS; restablecer vuelve al valor de entorno (auditado) | P0 |
| SET-010 | Ajustes | Funciones | Owner | Diseñador con IA off → /crear-experiencia/ai (anónima) → Restablecer | apagar el diseñador con IA muestra la pausa en el sitio; restablecerlo lo devuelve | P1 |
| SET-011 | Ajustes / Notificaciones | Integraciones | Owner | Enviar email de prueba | el email de prueba queda registrado (simulado) en la bandeja a nombre de quien lo pide | P1 |
| SET-012 | Ajustes / Notificaciones | Integraciones | Owner | Enviar WhatsApp de prueba | el WhatsApp de prueba se registra hacia el número del negocio | P1 |
| SET-013 | Usuarios / Ajustes | Usuarios | SuperAdmin | Nueva usuaria (Fundadora) → login | superadmin crea una fundadora que puede iniciar sesión en el panel | P0 |
| SET-014 | Usuarios / Ajustes | Usuarios | SuperAdmin | Rol: Staff → Fundadora | cambiar el rol de una usuaria persiste y queda auditado | P1 |
| SET-015 | Usuarios / Ajustes | Usuarios | SuperAdmin | Desactivar → login falla → Reactivar → login ok | desactivar una cuenta impide el login; reactivarla lo devuelve (auditado) | P0 |
| SET-016 | Usuarios / Ajustes | Usuarios | SuperAdmin | Contraseña → Restablecer | restablecer la contraseña invalida la anterior y no guarda la contraseña en auditoría | P1 |
| SET-017 | Usuarios / Ajustes | Nueva usuaria con correo existente / contraseña con el correo | SuperAdmin | Nueva usuaria con correo existente / contraseña con el correo | no se crean cuentas duplicadas ni con contraseñas que contienen el correo | P2 |
| SET-018 | Usuarios / Ajustes | Usuarios | SuperAdmin | fila «(tú)» | la propia cuenta no puede cambiar su rol ni desactivarse desde la lista | P2 |
| SET-019 | Ajustes | Restablecer contraseña | SuperAdmin | /admin/settings/audit?entityId=<user> | las acciones sensibles aparecen en la bitácora con actor, diff y filtros | P1 |
| SET-020 | Ajustes | /admin/settings/audit con parámetros basura | SuperAdmin | /admin/settings/audit con parámetros basura | filtros inválidos de la bitácora se ignoran sin romper la página | P3 |
| SET-021 | Ajustes | /admin/settings/integrations | Owner | /admin/settings/integrations | Integraciones muestra proveedores, webhooks, cron y prueba de mensajes | P2 |
| SET-022 | Usuarios / Ajustes | Usuarios | SuperAdmin | Nueva usuaria (Staff) vinculada → login /staff | una usuaria STAFF creada y vinculada a su ficha ve su portal | P1 |
| STF-001 | Staff | /staff | Staff | /staff | Lupita ve sólo sus eventos asignados (Sofía y Daniela, no Mariana) | P0 |
| STF-002 | Staff | /staff | Staff | /staff | Carlos (staff2) ve sus eventos asignados y no los ajenos | P1 |
| STF-003 | Staff | Portal | Staff | Marcar como hecha; owner revisa la orden de producción | marcar una tarea como hecha persiste y la fundadora la ve completada por Lupita | P0 |
| STF-004 | Staff | Portal | Staff | Empezar → Volver a pendiente | empezar, volver a pendiente y reabrir cambian el estado en la base | P1 |
| STF-005 | Staff | Portal | Staff | Agregar nota; owner → Detalles de la tarea | la nota para coordinación se guarda y la ve la fundadora | P1 |
| STF-006 | Staff | Portal | Staff | tarea de otra integrante (lectura) + replay de staffUpdateChecklistItem con su id | una tarea asignada a otra persona es de sólo lectura y el backend rechaza el cambio | P1 |
| STF-007 | Staff | Portal | Staff | Marcar como hecha sin foto | una tarea con foto obligatoria no se marca como hecha sin evidencia | P1 |
| STF-008 | Staff | /staff/events/<id de Bridal Brunch de Mariana> | Staff | /staff/events/<id de Bridal Brunch de Mariana> | un evento no asignado abierto por URL responde «No encontramos este evento» sin filtrar datos | P0 |
| STF-009 | Staff | Lupita (COORDINATOR) y Carlos (CHEF) en el mismo evento propio | Staff | Lupita (COORDINATOR) y Carlos (CHEF) en el mismo evento propio | el detalle muestra horario y equipo pero nunca montos; el teléfono de la clienta sólo a coordinación/chofer | P1 |
| STF-010 | Staff | Portal | Staff | Tomar o subir foto (obligatoria) → Marcar como hecha | subir la foto de evidencia la liga a la tarea y entonces sí se puede cerrar | P1 |
| STF-011 | Staff | Portal en 390×844 (y 1440 en chromium) | Staff | Portal en 390×844 (y 1440 en chromium) | el portal staff se usa en celular sin scroll horizontal y con el CTA visible | P2 |
| STF-012 | Staff | /admin/staff | Owner | Buscar / Estado | la lista de staff muestra al equipo y filtra por nombre y estado | P1 |
| STF-013 | Staff | /admin/staff/new | Owner | Agregar al equipo | alta de integrante guarda tarifa en centavos, días y función, y se audita | P1 |
| STF-014 | Staff | /admin/staff/new con datos inválidos | Owner | /admin/staff/new con datos inválidos | el alta valida nombre, teléfono y correo (sin crear registro) | P2 |
| STF-015 | Staff | Detalle de integrante | Owner | Guardar cambios; luego Asignar staff en un evento | editar un integrante (tarifa, tipo, desactivar) persiste y deja de ofrecerse al asignar | P1 |
| STF-016 | Staff | Detalle de integrante | Owner | Eliminar integrante | eliminar un integrante sin historial lo borra y se audita | P1 |
| STF-017 | Staff | Captura deleteStaffMember de un integrante sin historial | Owner | replay con id de uno con asignaciones | un integrante con historial no se puede eliminar (UI oculta + backend CONFLICT) | P2 |
| STF-018 | Staff | Detalle de integrante | Owner | Crear acceso; luego login con la cuenta nueva | crear acceso genera una cuenta STAFF ligada que puede iniciar sesión en /staff | P0 |
| STF-019 | Staff | Crear acceso con el correo de Lupita | Owner | Crear acceso con el correo de Lupita | no se puede crear un acceso con un correo que ya tiene cuenta | P1 |
| STF-020 | Staff | Detalle | Owner | Restablecer contraseña; login con la vieja (falla) y la nueva (entra) | restablecer la contraseña invalida la anterior y habilita la nueva | P1 |
| STF-021 | Staff | Detalle | Owner | Desactivar acceso / Reactivar acceso, con una sesión abierta de la cuenta | desactivar el acceso bloquea el login y la sesión abierta; reactivar lo devuelve | P0 |
| STF-022 | Staff | /admin/staff/<id inexistente> | Owner | /admin/staff/<id inexistente> | el detalle de un integrante inexistente muestra «no encontrado» | P3 |
| STF-023 | Staff | Evento propio CANCELLED con Lupita asignada | Staff | Evento propio CANCELLED con Lupita asignada | un evento asignado pero cancelado ya no aparece ni se puede abrir | P1 |
| STF-024 | Staff | axe en /staff y /staff/events/<id> | Staff | axe en /staff y /staff/events/<id> | el portal staff (lista y detalle con checklist) no tiene violaciones WCAG 2.1 AA graves | P2 |
