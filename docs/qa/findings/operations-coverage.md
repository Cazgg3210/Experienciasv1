# Test Coverage Matrix — Paquete 5 «Operación y back-office» (carril 5)

Resultado REAL de la última corrida del carril 5 (2026-10-06, commit f26b1a1): suite regular `test-results/l5/results.json` (proyectos chromium + mobile-chrome, reintentos = 1) y suite global `test-results/l5/global/results.json` (E2E_SUITE=global, 1 worker).
Result: PASS / FAIL (bug) / FLAKY / BLOCKED / NOT TESTED. Las pruebas @mobile muestran el resultado por proyecto.

| ID | Módulo | Escenario | Rol | Priority | Automated | Result |
|---|---|---|---|---|---|---|
| CNT-001 | Contenido | crear un testimonio guarda autora, calificación y visibilidad y se audita | Owner | P1 | ✅ tests/e2e/content/content.spec.ts | PASS |
| CNT-002 | Contenido | el testimonio exige autora (2+) y texto (10+) | Owner | P2 | ✅ tests/e2e/content/content.spec.ts | PASS |
| CNT-003 | Contenido | editar, ocultar y eliminar un testimonio persiste en la base (con auditoría) | Owner | P1 | ✅ tests/e2e/content/content.spec.ts | PASS |
| CNT-006 | Contenido | crear una pregunta frecuente con categoría la guarda, la audita y la filtra por categoría | Owner | P1 | ✅ tests/e2e/content/content.spec.ts | PASS |
| CNT-007 | Contenido | editar, ocultar y eliminar una pregunta frecuente persiste (con auditoría) | Owner | P1 | ✅ tests/e2e/content/content.spec.ts | PASS |
| CNT-008 | Contenido | la pregunta frecuente exige pregunta y respuesta (5+) | Owner | P2 | ✅ tests/e2e/content/content.spec.ts | PASS |
| CNT-010 | Contenido | subir una foto a la galería, ponerle texto alternativo, destacarla y eliminarla | Owner | P1 | ✅ tests/e2e/content/content.spec.ts | PASS |
| CNT-011 | Contenido | el texto alternativo exige 3+ caracteres (sin cambios en base) | Owner | P2 | ✅ tests/e2e/content/content.spec.ts | PASS |
| CNT-012 | Contenido | un archivo que no es imagen se rechaza al subirlo a la galería | Owner | P2 | ✅ tests/e2e/content/content.spec.ts | PASS |
| CNT-020 | Contenido | un testimonio visible con orden 0 aparece primero en la portada; oculto desaparece | Owner | P1 | ✅ tests/e2e/content/content.global.spec.ts (global) | PASS |
| CNT-021 | Contenido | una pregunta general visible aparece en «Cómo funciona»; oculta desaparece | Owner | P1 | ✅ tests/e2e/content/content.global.spec.ts (global) | PASS |
| CNT-022 | Contenido | subir/bajar una pregunta frecuente intercambia su posición con la vecina | Owner | P2 | ✅ tests/e2e/content/content.global.spec.ts (global) | FAIL (OPX-BUG-02) |
| CNT-023 | Contenido | reordenar testimonios persiste el orden y la lista se actualiza en pantalla | Owner | P2 | ✅ tests/e2e/content/content.global.spec.ts (global) | PASS |
| CNT-024 | Contenido | reordenar fotos de la galería persiste el orden y la tarjeta cambia de posición | Owner | P2 | ✅ tests/e2e/content/content.global.spec.ts (global) | PASS |
| FIN-001 | Finanzas | registrar un costo manual lo guarda en centavos, lo suma al total y lo audita | Owner | P1 | ✅ tests/e2e/finance/finance.spec.ts | PASS |
| FIN-002 | Finanzas | el costo manual exige descripción (3+) y monto mayor a $0 | Owner | P2 | ✅ tests/e2e/finance/finance.spec.ts | PASS |
| FIN-003 | Finanzas | editar un costo manual actualiza monto y categoría con auditoría antes/después | Owner | P1 | ✅ tests/e2e/finance/finance.spec.ts | PASS |
| FIN-004 | Finanzas | eliminar un costo manual lo quita del costo real y queda en auditoría | Owner | P1 | ✅ tests/e2e/finance/finance.spec.ts | PASS |
| FIN-005 | Finanzas | la rentabilidad del evento cuadra con la base: venta − IVA − costos reales = margen | Owner | P0 | ✅ tests/e2e/finance/finance.spec.ts | PASS |
| FIN-006 | Finanzas | cerrar un evento completado congela números, audita, notifica a la clienta y bloquea costos | Owner | P0 | ✅ tests/e2e/finance/finance.spec.ts | PASS |
| FIN-007 | Finanzas | el encabezado del evento (todas las pestañas) indica que el evento está cerrado | Owner | P3 | ✅ tests/e2e/finance/finance.spec.ts | FAIL (OPX-BUG-03) |
| FIN-008 | Finanzas | sólo se cierran eventos completados; el doble cierre se rechaza (backend) | Owner | P1 | ✅ tests/e2e/finance/finance.spec.ts | PASS |
| FIN-010 | Finanzas | /admin/finance muestra KPIs y el filtro «Cerrados» incluye el evento cerrado | Owner | P1 | ✅ tests/e2e/finance/finance.spec.ts | PASS |
| FIN-011 | Finanzas | la exportación CSV trae BOM, encabezados, filas en pesos y queda auditada; sin sesión → 401 | Owner | P1 | ✅ tests/e2e/finance/finance.spec.ts | PASS |
| FIN-012 | Finanzas | /admin/analytics renderiza con datos reales sin errores de consola | Owner | P2 | ✅ tests/e2e/finance/finance.spec.ts | PASS |
| FIN-013 | Finanzas | el CSV neutraliza fórmulas en textos (título que empieza con «=») | Owner | P2 | ✅ tests/e2e/finance/finance.spec.ts | PASS |
| INV-001 | Inventario | el inventario lista artículos con indicadores y la búsqueda filtra por SKU | Owner | P1 | ✅ tests/e2e/inventory/inventory.spec.ts | PASS |
| INV-002 | Inventario | alta de artículo: SKU en mayúsculas, movimiento de alta y auditoría; aparece al recargar | Owner | P1 | ✅ tests/e2e/inventory/inventory.spec.ts | PASS |
| INV-003 | Inventario | el SKU es único sin distinguir mayúsculas (no crea duplicado) | Owner | P2 | ✅ tests/e2e/inventory/inventory.spec.ts | PASS |
| INV-004 | Inventario | el alta valida formato de SKU y nombre (front y back) | Owner | P2 | ✅ tests/e2e/inventory/inventory.spec.ts | PASS |
| INV-005 | Inventario | editar un artículo cambia sus datos sin tocar cantidades y audita sólo lo que cambió | Owner | P1 | ✅ tests/e2e/inventory/inventory.spec.ts | PASS |
| INV-006 | Inventario | un artículo inactivo se oculta del listado y no se puede reservar (backend) | Owner | P1 | ✅ tests/e2e/inventory/inventory.spec.ts | PASS |
| INV-007 | Inventario | entrada por compra suma al total, registra el movimiento y audita | Owner | P0 | ✅ tests/e2e/inventory/inventory.spec.ts | PASS |
| INV-008 | Inventario | una baja mayor a lo utilizable se bloquea en la UI y en el backend (nunca negativo) | Owner | P1 | ✅ tests/e2e/inventory/inventory.spec.ts | PASS |
| INV-009 | Inventario | mantenimiento (enviar y regresar) y ajuste por conteo restando mantienen 0 ≤ mant ≤ total | Owner | P1 | ✅ tests/e2e/inventory/inventory.spec.ts | PASS |
| INV-010 | Inventario | el indicador de stock bajo aparece al llegar al umbral y desaparece al reponer | Owner | P1 | ✅ tests/e2e/inventory/inventory.spec.ts | PASS |
| INV-011 | Inventario | agregar un artículo a un evento crea la reserva y su movimiento | Owner | P1 | ✅ tests/e2e/inventory/inventory.spec.ts | PASS |
| INV-012 | Inventario | editar la cantidad reservada registra el delta y lo audita | Owner | P1 | ✅ tests/e2e/inventory/inventory.spec.ts | PASS |
| INV-013 | Inventario | salida y regreso con piezas dañadas: reserva RETURNED, baja del total y auditoría de merma | Owner | P1 | ✅ tests/e2e/inventory/inventory.spec.ts | PASS |
| INV-014 | Inventario | el regreso exige que buenas + dañadas sumen lo que salió | Owner | P2 | ✅ tests/e2e/inventory/inventory.spec.ts | PASS |
| INV-015 | Inventario | liberar una reserva la cancela, registra RELEASE y la lista como liberada | Owner | P1 | ✅ tests/e2e/inventory/inventory.spec.ts | PASS |
| INV-016 | Inventario | «Entregar todo» pasa todas las reservas pendientes a En evento | Owner | P1 | ✅ tests/e2e/inventory/inventory.spec.ts | PASS |
| INV-017 | Inventario | un evento cancelado que aún aparta piezas se libera con «Liberar todo» | Owner | P1 | ✅ tests/e2e/inventory/inventory.spec.ts | PASS |
| INV-018 | Inventario | recalcular desde requerimientos reserva por invitada y fijos según la experiencia | Owner | P1 | ✅ tests/e2e/inventory/inventory.spec.ts | PASS |
| INV-019 | Inventario | un evento completado no se recalcula (botón oculto + backend CONFLICT) | Owner | P2 | ✅ tests/e2e/inventory/inventory.spec.ts | PASS |
| INV-020 | Inventario | dos eventos el mismo día que sobre-reservan un artículo aparecen en Conflictos | Owner | P1 | ✅ tests/e2e/inventory/inventory.spec.ts | PASS |
| INV-021 | Inventario | el rango de conflictos se elige entre 30, 60 y 90 días | Owner | P3 | ✅ tests/e2e/inventory/inventory.spec.ts | PASS |
| INV-022 | Inventario | «Reservas por evento» lista el evento próximo con su conteo y abre su detalle | Owner | P2 | ✅ tests/e2e/inventory/inventory.spec.ts | PASS |
| INV-023 | Inventario | un artículo inexistente muestra «no encontrado» | Owner | P3 | ✅ tests/e2e/inventory/inventory.spec.ts | PASS |
| INV-024 | Inventario | no se puede reservar dos veces el mismo artículo en el evento | Owner | P2 | ✅ tests/e2e/inventory/inventory.spec.ts | PASS |
| INV-025 | Inventario | los filtros del inventario (búsqueda y «Incluir inactivos») actualizan la URL y la lista sin recargar | Owner | P1 | ✅ tests/e2e/inventory/inventory.spec.ts | FAIL (OPX-BUG-01) |
| NOT-001 | Notificaciones | la bandeja busca por asunto y filtra por canal, tipo y estado | Owner | P1 | ✅ tests/e2e/notifications/inbox.spec.ts | PASS |
| NOT-002 | Notificaciones | abrir un mensaje lo marca como leído y se puede volver a marcar como no leído | Owner | P1 | ✅ tests/e2e/notifications/inbox.spec.ts | FLAKY (OPX-BUG-02) |
| NOT-003 | Notificaciones | el filtro «sin leer» muestra sólo pendientes y respeta la lectura | Owner | P2 | ✅ tests/e2e/notifications/inbox.spec.ts | PASS |
| NOT-004 | Notificaciones | «Marcar todo como leído» deja la bandeja sin pendientes | Owner | P1 | ✅ tests/e2e/notifications/notifications.global.spec.ts (global) | PASS |
| NOT-005 | Notificaciones | «Ejecutar recordatorios ahora» genera 7 días y 48 h una sola vez (idempotente) y se audita | Owner | P0 | ✅ tests/e2e/notifications/notifications.global.spec.ts (global) | PASS |
| NOT-006 | Notificaciones | el cron /api/cron/notifications con el secreto correcto ejecuta las reglas sin duplicar | Anónimo | P1 | ✅ tests/e2e/notifications/notifications.global.spec.ts (global) | PASS |
| NOT-007 | Notificaciones | los avisos STAFF_ASSIGNED de la bandeja enlazan a una ruta real del portal (/staff/events/<id>) | Staff | P3 | ✅ tests/e2e/notifications/inbox.spec.ts | FAIL (OPX-BUG-04) |
| OPS-001 | Operaciones | el tablero muestra los eventos de los próximos 14 días y enlaza a su orden de producción | Owner | P1 | ✅ tests/e2e/operations/operations.spec.ts | PASS |
| OPS-002 | Operaciones | generar checklist desde plantillas crea las tareas activas una sola vez (idempotente) | Owner | P0 | ✅ tests/e2e/operations/operations.spec.ts | PASS |
| OPS-003 | Operaciones | un evento cancelado no permite generar checklist (UI oculta + backend CONFLICT) | Owner | P1 | ✅ tests/e2e/operations/operations.spec.ts | PASS |
| OPS-004 | Operaciones | agregar una tarea personalizada la guarda con fase, área y evidencia y persiste al recargar | Owner | P1 | ✅ tests/e2e/operations/operations.spec.ts | PASS |
| OPS-005 | Operaciones | la tarea personalizada exige título de 3+ caracteres (sin registro en base) | Owner | P2 | ✅ tests/e2e/operations/operations.spec.ts | PASS |
| OPS-006 | Operaciones | cambiar el estado a Hecho registra fecha y autora; reabrir la limpia | Owner | P1 | ✅ tests/e2e/operations/operations.spec.ts | PASS |
| OPS-007 | Operaciones | una tarea con evidencia obligatoria no se puede cerrar sin foto (UI y backend) | Owner | P1 | ✅ tests/e2e/operations/operations.spec.ts | PASS |
| OPS-008 | Operaciones | responsable, notas y fecha límite de una tarea se guardan por separado (las notas no se borran) | Owner | P2 | ✅ tests/e2e/operations/operations.spec.ts | PASS |
| OPS-009 | Operaciones | eliminar una tarea la quita del checklist y queda en auditoría | Owner | P1 | ✅ tests/e2e/operations/operations.spec.ts | PASS |
| OPS-010 | Operaciones | asignar staff crea la asignación con su tarifa, notifica y el enlace lleva a /staff/events/<id> | Owner | P0 | ✅ tests/e2e/operations/operations.spec.ts | PASS |
| OPS-011 | Operaciones | no se puede asignar dos veces a la misma persona con la misma función | Owner | P2 | ✅ tests/e2e/operations/operations.spec.ts | PASS |
| OPS-012 | Operaciones | la hora de salida debe ser posterior a la de entrada | Owner | P2 | ✅ tests/e2e/operations/operations.spec.ts | PASS |
| OPS-013 | Operaciones | confirmar y marcar como pagada una asignación persiste y audita el pago | Owner | P1 | ✅ tests/e2e/operations/operations.spec.ts | PASS |
| OPS-014 | Operaciones | editar una asignación cambia función y monto acordado (centavos) y lo audita | Owner | P1 | ✅ tests/e2e/operations/operations.spec.ts | PASS |
| OPS-015 | Operaciones | quitar una asignación libera sus tareas abiertas y el staff deja de ver el evento | Owner | P1 | ✅ tests/e2e/operations/operations.spec.ts | PASS |
| OPS-016 | Operaciones | guardar salida, montaje y desmontaje persiste en hora CDMX y queda en auditoría | Owner | P1 | ✅ tests/e2e/operations/operations.spec.ts | PASS |
| OPS-017 | Operaciones | el montaje después del inicio del evento se rechaza en el servidor (sin cambios) | Owner | P2 | ✅ tests/e2e/operations/operations.spec.ts | PASS |
| OPS-018 | Operaciones | las notas operativas de un add-on se guardan y las ve el staff asignado | Owner | P2 | ✅ tests/e2e/operations/operations.spec.ts | PASS |
| OPS-019 | Operaciones | la orden de un evento cancelado es de sólo referencia (sin asignar ni editar logística) | Owner | P2 | ✅ tests/e2e/operations/operations.spec.ts | PASS |
| OPS-020 | Operaciones | la orden de producción de un evento inexistente muestra «no encontrado» | Owner | P2 | ✅ tests/e2e/operations/operations.spec.ts | PASS |
| OPS-021 | Operaciones | las tareas vencidas aparecen en el tablero con enlace al checklist del evento | Owner | P2 | ✅ tests/e2e/operations/operations.spec.ts | PASS |
| OPS-022 | Operaciones | la lista agrupa las plantillas del seed por fase y abre el detalle con sus tareas | Owner | P1 | ✅ tests/e2e/operations/templates.spec.ts | PASS |
| OPS-023 | Operaciones | crear una plantilla (inactiva) redirige a su detalle, persiste y se audita | Owner | P1 | ✅ tests/e2e/operations/templates.spec.ts | PASS |
| OPS-024 | Operaciones | editar nombre, orden y descripción de una plantilla persiste y se audita | Owner | P1 | ✅ tests/e2e/operations/templates.spec.ts | PASS |
| OPS-025 | Operaciones | tareas de plantilla: agregar con desfase, editar y eliminar (auditado) | Owner | P1 | ✅ tests/e2e/operations/templates.spec.ts | PASS |
| OPS-026 | Operaciones | el desfase máximo de una tarea de plantilla es de 365 días (validación del servidor) | Owner | P2 | ✅ tests/e2e/operations/templates.spec.ts | PASS |
| OPS-027 | Operaciones | eliminar una plantilla borra sus tareas modelo, regresa a la lista y se audita | Owner | P1 | ✅ tests/e2e/operations/templates.spec.ts | PASS |
| OPS-028 | Operaciones | una plantilla inexistente o con id inválido muestra «no encontrado» | Owner | P2 | ✅ tests/e2e/operations/templates.spec.ts | PASS |
| OPS-029 | Operaciones | una plantilla general activa se copia al generar checklists; al desactivarla deja de copiarse | Owner | P1 | ✅ tests/e2e/operations/operations.global.spec.ts (global) | PASS |
| OPS-030 | Operaciones | la acción de asignar staff repetida por la fundadora es idempotente respecto a duplicados (backend) | Owner | P2 | ✅ tests/e2e/operations/operations.spec.ts | PASS |
| PUR-001 | Compras | la lista de compras muestra totales y filtra por evento | Owner | P1 | ✅ tests/e2e/purchasing/purchases.spec.ts | PASS |
| PUR-002 | Compras | registrar una compra para un evento guarda el monto en centavos y se audita | Owner | P0 | ✅ tests/e2e/purchasing/purchases.spec.ts | PASS |
| PUR-003 | Compras | la compra exige concepto (3+) y monto esperado | Owner | P2 | ✅ tests/e2e/purchasing/purchases.spec.ts | PASS |
| PUR-004 | Compras | marcar como ordenada y volver a solicitada actualiza estado y fecha de orden | Owner | P1 | ✅ tests/e2e/purchasing/purchases.spec.ts | PASS |
| PUR-005 | Compras | recibir con monto real lo guarda en centavos y suma al costo real del evento | Owner | P0 | ✅ tests/e2e/purchasing/purchases.spec.ts | PASS |
| PUR-006 | Compras | cancelar con motivo lo deja en notas e historial; reabrir la regresa a solicitada | Owner | P1 | ✅ tests/e2e/purchasing/purchases.spec.ts | PASS |
| PUR-007 | Compras | transiciones inválidas (recibida→ordenada, cancelada→recibida) se rechazan en el backend | Owner | P1 | ✅ tests/e2e/purchasing/purchases.spec.ts | PASS |
| PUR-008 | Compras | corregir el monto real de una compra recibida exige motivo y queda auditado | Owner | P1 | ✅ tests/e2e/purchasing/purchases.spec.ts | PASS |
| PUR-009 | Compras | corregir el monto real de una compra no recibida se rechaza en el backend | Owner | P2 | ✅ tests/e2e/purchasing/purchases.spec.ts | PASS |
| PUR-010 | Compras | adjuntar un comprobante (imagen) lo liga a la compra y se puede quitar | Owner | P1 | ✅ tests/e2e/purchasing/purchases.spec.ts | PASS |
| PUR-011 | Compras | un archivo que no es imagen ni PDF se rechaza como comprobante | Owner | P2 | ✅ tests/e2e/purchasing/purchases.spec.ts | PASS |
| PUR-012 | Compras | en un evento cerrado no se puede recibir una compra (UI + backend) | Owner | P1 | ✅ tests/e2e/purchasing/purchases.spec.ts | PASS |
| PUR-013 | Compras | editar los detalles de una compra persiste y aparece en el historial | Owner | P2 | ✅ tests/e2e/purchasing/purchases.spec.ts | PASS |
| PUR-014 | Compras | un proveedor bloqueado no se ofrece ni se acepta en el backend al registrar compras | Owner | P2 | ✅ tests/e2e/purchasing/purchases.spec.ts | PASS |
| PUR-020 | Proveedores | la lista de proveedores muestra los del seed y filtra por búsqueda | Owner | P1 | ✅ tests/e2e/purchasing/vendors.spec.ts | PASS |
| PUR-021 | Proveedores | alta de proveedor con contacto y calificación persiste y se audita | Owner | P1 | ✅ tests/e2e/purchasing/vendors.spec.ts | PASS |
| PUR-022 | Proveedores | el alta valida correo, teléfono y WhatsApp (sin crear registro) | Owner | P2 | ✅ tests/e2e/purchasing/vendors.spec.ts | PASS |
| PUR-023 | Proveedores | bloquear un proveedor queda auditado y oculta «Nueva compra» | Owner | P1 | ✅ tests/e2e/purchasing/vendors.spec.ts | PASS |
| PUR-024 | Proveedores | eliminar un proveedor sin compras lo borra y se audita | Owner | P1 | ✅ tests/e2e/purchasing/vendors.spec.ts | PASS |
| PUR-025 | Proveedores | un proveedor con compras no se puede borrar (botón deshabilitado + backend CONFLICT) | Owner | P1 | ✅ tests/e2e/purchasing/vendors.spec.ts | PASS |
| SET-001 | Ajustes | todas las secciones de configuración cargan desde la navegación lateral | SuperAdmin | P1 | ✅ tests/e2e/settings/settings.spec.ts | PASS |
| SET-002 | Ajustes | datos del negocio: guardar la versión de términos persiste y queda auditado | Owner | P1 | ✅ tests/e2e/settings/settings.global.spec.ts (global) | PASS |
| SET-003 | Ajustes | datos del negocio: un WhatsApp con letras se rechaza sin guardar | Owner | P2 | ✅ tests/e2e/settings/settings.global.spec.ts (global) | PASS |
| SET-004 | Ajustes | precios: cambiar el IVA a 17 % se guarda en bps, se describe el cambio y se audita | Owner | P0 | ✅ tests/e2e/settings/settings.global.spec.ts (global) | PASS |
| SET-005 | Ajustes | precios: el máximo de invitadas no puede ser menor al mínimo | Owner | P2 | ✅ tests/e2e/settings/settings.global.spec.ts (global) | PASS |
| SET-006 | Ajustes | disponibilidad: cambiar la anticipación mínima persiste y se restaura | Owner | P1 | ✅ tests/e2e/settings/settings.global.spec.ts (global) | PASS |
| SET-007 | Ajustes | disponibilidad: «Reservas con hasta» debe superar la anticipación mínima | Owner | P2 | ✅ tests/e2e/settings/settings.global.spec.ts (global) | PASS |
| SET-008 | Ajustes | notificaciones: el correo del equipo se guarda (validado) y se restaura | Owner | P1 | ✅ tests/e2e/settings/settings.global.spec.ts (global) | PASS |
| SET-009 | Ajustes | apagar WhatsApp deja los mensajes como OMITIDOS; restablecer vuelve al valor de entorno (auditado) | Owner | P0 | ✅ tests/e2e/settings/settings.global.spec.ts (global) | PASS |
| SET-010 | Ajustes | apagar el diseñador con IA muestra la pausa en el sitio; restablecerlo lo devuelve | Owner | P1 | ✅ tests/e2e/settings/settings.global.spec.ts (global) | PASS |
| SET-011 | Ajustes / Notificaciones | el email de prueba queda registrado (simulado) en la bandeja a nombre de quien lo pide | Owner | P1 | ✅ tests/e2e/settings/settings.spec.ts | PASS |
| SET-012 | Ajustes / Notificaciones | el WhatsApp de prueba se registra hacia el número del negocio | Owner | P1 | ✅ tests/e2e/settings/settings.spec.ts | PASS |
| SET-013 | Usuarios / Ajustes | superadmin crea una fundadora que puede iniciar sesión en el panel | SuperAdmin | P0 | ✅ tests/e2e/settings/settings.spec.ts | PASS |
| SET-014 | Usuarios / Ajustes | cambiar el rol de una usuaria persiste y queda auditado | SuperAdmin | P1 | ✅ tests/e2e/settings/settings.spec.ts | PASS |
| SET-015 | Usuarios / Ajustes | desactivar una cuenta impide el login; reactivarla lo devuelve (auditado) | SuperAdmin | P0 | ✅ tests/e2e/settings/settings.spec.ts | PASS |
| SET-016 | Usuarios / Ajustes | restablecer la contraseña invalida la anterior y no guarda la contraseña en auditoría | SuperAdmin | P1 | ✅ tests/e2e/settings/settings.spec.ts | PASS |
| SET-017 | Usuarios / Ajustes | no se crean cuentas duplicadas ni con contraseñas que contienen el correo | SuperAdmin | P2 | ✅ tests/e2e/settings/settings.spec.ts | PASS |
| SET-018 | Usuarios / Ajustes | la propia cuenta no puede cambiar su rol ni desactivarse desde la lista | SuperAdmin | P2 | ✅ tests/e2e/settings/settings.spec.ts | PASS |
| SET-019 | Ajustes | las acciones sensibles aparecen en la bitácora con actor, diff y filtros | SuperAdmin | P1 | ✅ tests/e2e/settings/settings.spec.ts | PASS |
| SET-020 | Ajustes | filtros inválidos de la bitácora se ignoran sin romper la página | SuperAdmin | P3 | ✅ tests/e2e/settings/settings.spec.ts | PASS |
| SET-021 | Ajustes | Integraciones muestra proveedores, webhooks, cron y prueba de mensajes | Owner | P2 | ✅ tests/e2e/settings/settings.spec.ts | PASS |
| SET-022 | Usuarios / Ajustes | una usuaria STAFF creada y vinculada a su ficha ve su portal | SuperAdmin | P1 | ✅ tests/e2e/settings/settings.spec.ts | PASS |
| STF-001 | Staff | Lupita ve sólo sus eventos asignados (Sofía y Daniela, no Mariana) | Staff | P0 | ✅ tests/e2e/staff/staff-portal.spec.ts | PASS (chromium) · PASS (mobile-chrome) |
| STF-002 | Staff | Carlos (staff2) ve sus eventos asignados y no los ajenos | Staff | P1 | ✅ tests/e2e/staff/staff-portal.spec.ts | PASS (chromium) · PASS (mobile-chrome) |
| STF-003 | Staff | marcar una tarea como hecha persiste y la fundadora la ve completada por Lupita | Staff | P0 | ✅ tests/e2e/staff/staff-portal.spec.ts | PASS (chromium) · PASS (mobile-chrome) |
| STF-004 | Staff | empezar, volver a pendiente y reabrir cambian el estado en la base | Staff | P1 | ✅ tests/e2e/staff/staff-portal.spec.ts | PASS |
| STF-005 | Staff | la nota para coordinación se guarda y la ve la fundadora | Staff | P1 | ✅ tests/e2e/staff/staff-portal.spec.ts | PASS |
| STF-006 | Staff | una tarea asignada a otra persona es de sólo lectura y el backend rechaza el cambio | Staff | P1 | ✅ tests/e2e/staff/staff-portal.spec.ts | PASS |
| STF-007 | Staff | una tarea con foto obligatoria no se marca como hecha sin evidencia | Staff | P1 | ✅ tests/e2e/staff/staff-portal.spec.ts | PASS |
| STF-008 | Staff | un evento no asignado abierto por URL responde «No encontramos este evento» sin filtrar datos | Staff | P0 | ✅ tests/e2e/staff/staff-portal.spec.ts | PASS |
| STF-009 | Staff | el detalle muestra horario y equipo pero nunca montos; el teléfono de la clienta sólo a coordinación/chofer | Staff | P1 | ✅ tests/e2e/staff/staff-portal.spec.ts | PASS |
| STF-010 | Staff | subir la foto de evidencia la liga a la tarea y entonces sí se puede cerrar | Staff | P1 | ✅ tests/e2e/staff/staff-portal.spec.ts | PASS |
| STF-011 | Staff | el portal staff se usa en celular sin scroll horizontal y con el CTA visible | Staff | P2 | ✅ tests/e2e/staff/staff-portal.spec.ts | PASS (chromium) · PASS (mobile-chrome) |
| STF-012 | Staff | la lista de staff muestra al equipo y filtra por nombre y estado | Owner | P1 | ✅ tests/e2e/staff/staff-admin.spec.ts | PASS |
| STF-013 | Staff | alta de integrante guarda tarifa en centavos, días y función, y se audita | Owner | P1 | ✅ tests/e2e/staff/staff-admin.spec.ts | PASS |
| STF-014 | Staff | el alta valida nombre, teléfono y correo (sin crear registro) | Owner | P2 | ✅ tests/e2e/staff/staff-admin.spec.ts | PASS |
| STF-015 | Staff | editar un integrante (tarifa, tipo, desactivar) persiste y deja de ofrecerse al asignar | Owner | P1 | ✅ tests/e2e/staff/staff-admin.spec.ts | PASS |
| STF-016 | Staff | eliminar un integrante sin historial lo borra y se audita | Owner | P1 | ✅ tests/e2e/staff/staff-admin.spec.ts | PASS |
| STF-017 | Staff | un integrante con historial no se puede eliminar (UI oculta + backend CONFLICT) | Owner | P2 | ✅ tests/e2e/staff/staff-admin.spec.ts | PASS |
| STF-018 | Staff | crear acceso genera una cuenta STAFF ligada que puede iniciar sesión en /staff | Owner | P0 | ✅ tests/e2e/staff/staff-admin.spec.ts | PASS |
| STF-019 | Staff | no se puede crear un acceso con un correo que ya tiene cuenta | Owner | P1 | ✅ tests/e2e/staff/staff-admin.spec.ts | PASS |
| STF-020 | Staff | restablecer la contraseña invalida la anterior y habilita la nueva | Owner | P1 | ✅ tests/e2e/staff/staff-admin.spec.ts | PASS |
| STF-021 | Staff | desactivar el acceso bloquea el login y la sesión abierta; reactivar lo devuelve | Owner | P0 | ✅ tests/e2e/staff/staff-admin.spec.ts | PASS |
| STF-022 | Staff | el detalle de un integrante inexistente muestra «no encontrado» | Owner | P3 | ✅ tests/e2e/staff/staff-admin.spec.ts | PASS |
| STF-023 | Staff | un evento asignado pero cancelado ya no aparece ni se puede abrir | Staff | P1 | ✅ tests/e2e/staff/staff-portal.spec.ts | PASS |
| STF-024 | Staff | el portal staff (lista y detalle con checklist) no tiene violaciones WCAG 2.1 AA graves | Staff | P2 | ✅ tests/e2e/staff/staff-portal.spec.ts | FAIL (OPX-BUG-05) |

## Totales

- **Total 154 escenarios** — PASS 148 · FAIL 5 · FLAKY 1 · BLOCKED 0 · NOT TESTED 0
- P0: PASS 17 · FAIL 0 · FLAKY 0 · BLOCKED 0 · NOT TESTED 0
- P1: PASS 84 · FAIL 1 · FLAKY 1 · BLOCKED 0 · NOT TESTED 0
- P2: PASS 43 · FAIL 2 · FLAKY 0 · BLOCKED 0 · NOT TESTED 0
- P3: PASS 4 · FAIL 2 · FLAKY 0 · BLOCKED 0 · NOT TESTED 0

### Por módulo

- Contenido: PASS 13 · FAIL 1 · FLAKY 0 · BLOCKED 0 · NOT TESTED 0
- Finanzas: PASS 11 · FAIL 1 · FLAKY 0 · BLOCKED 0 · NOT TESTED 0
- Inventario: PASS 24 · FAIL 1 · FLAKY 0 · BLOCKED 0 · NOT TESTED 0
- Notificaciones: PASS 5 · FAIL 1 · FLAKY 1 · BLOCKED 0 · NOT TESTED 0
- Operaciones: PASS 30 · FAIL 0 · FLAKY 0 · BLOCKED 0 · NOT TESTED 0
- Compras: PASS 14 · FAIL 0 · FLAKY 0 · BLOCKED 0 · NOT TESTED 0
- Proveedores: PASS 6 · FAIL 0 · FLAKY 0 · BLOCKED 0 · NOT TESTED 0
- Ajustes: PASS 15 · FAIL 0 · FLAKY 0 · BLOCKED 0 · NOT TESTED 0
- Usuarios: PASS 7 · FAIL 0 · FLAKY 0 · BLOCKED 0 · NOT TESTED 0
- Staff: PASS 23 · FAIL 1 · FLAKY 0 · BLOCKED 0 · NOT TESTED 0
