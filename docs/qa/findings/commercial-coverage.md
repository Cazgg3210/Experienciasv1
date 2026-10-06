# Test Coverage Matrix — Paquete 3 «Comercial admin» (carril 3)

**Resultado REAL de la última corrida** (no estimado):
- Corrida completa (una invocación): `E2E_LANE=3 E2E_WORKERS=3 node node_modules/@playwright/test/cli.js test tests/e2e/leads tests/e2e/customers tests/e2e/catalog tests/e2e/quotes --project=chromium` (reintentos = 1, default de la config; base re-sembrada) → `test-results/l3/results.json`: **120 pruebas + 5 de setup → 117 passed + 5 setup, 3 failed, 0 flaky, 0 skipped** (2.8 min).
- Estado global: `E2E_LANE=3 E2E_SUITE=global node node_modules/@playwright/test/cli.js test tests/e2e/leads tests/e2e/customers tests/e2e/catalog tests/e2e/quotes` (1 worker, serial) → `test-results/l3/global/results.json`: **2 passed** (QUO-038, QUO-039).
- Commit f26b1a1, build `.next-e2e`, servidor :3203, base `ivonne_rosa_e2e_l3`, 2026-10-06. Proyecto chromium 1440×900.
- Cada FAIL falló en el intento y en el reintento, y antes 2/2 con `--repeat-each=2 --retries=0`: reproducible, no inestable.
- `Automated`: ✅ ruta del spec. Rol = el de `evidence()` (rol principal de la prueba).

| ID | Módulo | Escenario | Rol | Priority | Automated | Result |
|---|---|---|---|---|---|---|
| LEAD-001 | Leads | el resumen por estado y la tabla reflejan exactamente lo que hay en la base | Owner | P1 | ✅ tests/e2e/leads/leads-list.spec.ts | PASS |
| LEAD-002 | Leads | crear lead manual: toast, detalle, clienta vinculada, timeline y persistencia | Owner | P1 | ✅ tests/e2e/leads/leads-detail.spec.ts | PASS |
| LEAD-003 | Leads | requeridos vacíos: el formulario muestra errores y no llama al servidor | Owner | P1 | ✅ tests/e2e/leads/leads-detail.spec.ts | PASS |
| LEAD-004 | Leads | formatos inválidos de teléfono y correo se rechazan en el formulario | Owner | P2 | ✅ tests/e2e/leads/leads-detail.spec.ts | PASS |
| LEAD-005 | Leads | el servidor rechaza capturas inválidas aunque se salte el formulario | Owner | P1 | ✅ tests/e2e/leads/leads-detail.spec.ts | PASS |
| LEAD-006 | Leads | duplicados: la misma clienta (correo con otra capitalización o mismo teléfono) se reutiliza | Owner | P1 | ✅ tests/e2e/leads/leads-detail.spec.ts | PASS |
| LEAD-007 | Leads | señales automáticas: grupo grande = consulta especial y zona escrita = fuera de cobertura | Owner | P2 | ✅ tests/e2e/leads/leads-detail.spec.ts | PASS |
| LEAD-008 | Leads | la búsqueda encuentra por nombre, correo, código y teléfono con formato | Owner | P1 | ✅ tests/e2e/leads/leads-list.spec.ts | PASS |
| LEAD-009 | Leads | filtros por estado, origen y señales; estado vacío con búsqueda sin coincidencias | Owner | P2 | ✅ tests/e2e/leads/leads-list.spec.ts | PASS |
| LEAD-010 | Leads | filtro por rango de fecha del evento (incluye extremos y corrige rango invertido) | Owner | P2 | ✅ tests/e2e/leads/leads-list.spec.ts | PASS |
| LEAD-011 | Leads | paginación de 25 en 25 conservando la búsqueda | Owner | P2 | ✅ tests/e2e/leads/leads-list.spec.ts | PASS |
| LEAD-012 | Leads | orden por creación ascendente y por fecha del evento | Owner | P3 | ✅ tests/e2e/leads/leads-list.spec.ts | PASS |
| LEAD-013 | Leads | kanban: mover una tarjeta respeta la máquina de estados y persiste | Owner | P2 | ✅ tests/e2e/leads/leads-list.spec.ts | PASS |
| LEAD-014 | Leads | kanban: pasar a Perdido exige motivo (diálogo) y lo guarda | Owner | P1 | ✅ tests/e2e/leads/leads-list.spec.ts | PASS |
| LEAD-015 | Leads | detalle de un lead inexistente muestra 'Este lead no existe' | Owner | P2 | ✅ tests/e2e/leads/leads-detail.spec.ts | PASS |
| LEAD-016 | Leads | cambiar estado con nota: badge, timeline, base y auditoría | Owner | P1 | ✅ tests/e2e/leads/leads-detail.spec.ts | PASS |
| LEAD-017 | Leads | el selector sólo ofrece las transiciones válidas de leadStatusMachine (y WON es final) | Owner | P1 | ✅ tests/e2e/leads/leads-detail.spec.ts | PASS |
| LEAD-018 | Leads | el servidor rechaza transiciones inválidas y no modifica el lead | Owner | P1 | ✅ tests/e2e/leads/leads-detail.spec.ts | PASS |
| LEAD-019 | Leads | Perdido sin motivo (o sólo espacios) se rechaza en el servidor | Owner | P1 | ✅ tests/e2e/leads/leads-detail.spec.ts | PASS |
| LEAD-020 | Leads | marcar Perdido en el detalle exige motivo; reactivar limpia el motivo | Owner | P1 | ✅ tests/e2e/leads/leads-detail.spec.ts | PASS |
| LEAD-021 | Leads | asignar y desasignar responsable: timeline y auditoría | Owner | P1 | ✅ tests/e2e/leads/leads-detail.spec.ts | PASS |
| LEAD-022 | Leads | no se puede asignar un lead a personal STAFF ni a un id inexistente (backend) | SuperAdmin | P1 | ✅ tests/e2e/leads/leads-detail.spec.ts | PASS |
| LEAD-023 | Leads | registrar un WhatsApp sobre un lead nuevo lo pasa a Contactado automáticamente | Owner | P1 | ✅ tests/e2e/leads/leads-detail.spec.ts | PASS |
| LEAD-024 | Leads | una nota interna no cambia estado ni último contacto; mensaje corto se rechaza | Owner | P2 | ✅ tests/e2e/leads/leads-detail.spec.ts | PASS |
| LEAD-025 | Leads | editar datos del lead: campos cambiados en timeline y auditoría; sin cambios avisa | Owner | P1 | ✅ tests/e2e/leads/leads-detail.spec.ts | PASS |
| LEAD-026 | Leads | HTML/script en notas e inspiración se muestra escapado (sin ejecutar) | Owner | P2 | ✅ tests/e2e/leads/leads-detail.spec.ts | PASS |
| LEAD-027 | Leads | editar con referencias de catálogo inexistentes se rechaza en el servidor | Owner | P2 | ✅ tests/e2e/leads/leads-detail.spec.ts | PASS |
| LEAD-028 | Leads | el CSV trae encabezados, BOM y exactamente los leads filtrados, y queda auditado | Owner | P1 | ✅ tests/e2e/leads/leads-list.spec.ts | PASS |
| LEAD-029 | Leads | el CSV respeta filtros de estado y señales | Owner | P2 | ✅ tests/e2e/leads/leads-list.spec.ts | PASS |
| LEAD-030 | Leads | el CSV neutraliza inyección de fórmulas (=, +, -, @) | Owner | P2 | ✅ tests/e2e/leads/leads-list.spec.ts | PASS |
| LEAD-031 | Leads | el botón Exportar CSV conserva los filtros activos | Owner | P3 | ✅ tests/e2e/leads/leads-list.spec.ts | PASS |
| LEAD-033 | Leads | doble clic en Crear lead registra un solo lead | Owner | P2 | ✅ tests/e2e/leads/leads-detail.spec.ts | PASS |
| LEAD-034 | Leads | otra fundadora (Rosa) ve y opera el lead creado por Ivonne; la auditoría registra a quien actuó | Owner2 (Rosa) | P2 | ✅ tests/e2e/leads/leads-detail.spec.ts | PASS |
| LEAD-035 | Leads | captura desde el panel con origen 'Captura manual' no envía notificaciones | Owner | P2 | ✅ tests/e2e/leads/leads-detail.spec.ts | PASS |
| LEAD-036 | Leads | captura desde el panel con otro origen no avisa a la fundadora de su propio registro | Owner | P3 | ✅ tests/e2e/leads/leads-detail.spec.ts | FAIL (COM-BUG-01) |
| LEAD-037 | Leads | 'Siguiente' y 'Limpiar filtros' navegan con un clic (misma ruta, otros searchParams) | Owner | P2 | ✅ tests/e2e/leads/leads-list.spec.ts | FAIL (COM-BUG-03) |
| CUST-001 | Clientas | el listado filtrado muestra el conteo y las filas que hay en la base | Owner | P1 | ✅ tests/e2e/customers/customers.spec.ts | PASS |
| CUST-002 | Clientas | búsqueda por nombre, correo, teléfono, Instagram y código de referido; sin coincidencias | Owner | P1 | ✅ tests/e2e/customers/customers.spec.ts | PASS |
| CUST-003 | Clientas | orden por nombre (A–Z) y por más recientes | Owner | P3 | ✅ tests/e2e/customers/customers.spec.ts | PASS |
| CUST-004 | Clientas | paginación de clientas conservando búsqueda | Owner | P3 | ✅ tests/e2e/customers/customers.spec.ts | PASS |
| CUST-005 | Clientas | la ficha muestra historial de leads, cotizaciones, eventos y pagos de la clienta (seed) | Owner | P1 | ✅ tests/e2e/customers/customers.spec.ts | PASS |
| CUST-006 | Clientas | editar perfil normaliza Instagram/correo, guarda y audita antes/después | Owner | P1 | ✅ tests/e2e/customers/customers.spec.ts | PASS |
| CUST-007 | Clientas | no se permite usar el correo de otra clienta (aunque cambie mayúsculas) | Owner | P1 | ✅ tests/e2e/customers/customers.spec.ts | PASS |
| CUST-008 | Clientas | validaciones del perfil en el formulario (correo, teléfono, Instagram) | Owner | P2 | ✅ tests/e2e/customers/customers.spec.ts | PASS |
| CUST-009 | Clientas | dos clientas pueden compartir teléfono: no hay validación de unicidad (ambigüedad de requisito) | Owner | P3 | ✅ tests/e2e/customers/customers.spec.ts | PASS |
| CUST-010 | Clientas | eliminar clienta sin historial comercial: sus leads quedan sin clienta, auditado y no reaparece | Owner | P1 | ✅ tests/e2e/customers/customers.spec.ts | PASS |
| CUST-011 | Clientas | una clienta con cotización no se puede eliminar (UI oculta el botón y el backend lo rechaza) | Owner | P1 | ✅ tests/e2e/customers/customers.spec.ts | PASS |
| CUST-012 | Clientas | una clienta con reserva y evento (seed) no se puede eliminar desde el backend | SuperAdmin | P1 | ✅ tests/e2e/customers/customers.spec.ts | PASS |
| CUST-013 | Clientas | ficha inexistente o con id malformado muestra 'No encontramos a esta clienta' | Owner | P2 | ✅ tests/e2e/customers/customers.spec.ts | PASS |
| CUST-014 | Clientas | cancelar la eliminación no borra nada | Owner | P2 | ✅ tests/e2e/customers/customers.spec.ts | PASS |
| CUST-015 | Clientas | el servidor valida el perfil aunque se salte el formulario | Owner | P1 | ✅ tests/e2e/customers/customers.spec.ts | PASS |
| CUST-016 | Clientas | una clienta con teléfono guardado con formato se reutiliza al llegar un lead con ese número | Owner | P2 | ✅ tests/e2e/customers/customers.spec.ts | FAIL (COM-BUG-02) |
| CAT-001 | Catálogo | el listado de experiencias muestra cada experiencia de la base con su precio base | Owner | P1 | ✅ tests/e2e/catalog/catalog-experiences.spec.ts | PASS |
| CAT-002 | Catálogo | crear experiencia por UI: slug automático, precios en centavos, nace inactiva y queda auditada | Owner | P1 | ✅ tests/e2e/catalog/catalog-experiences.spec.ts | PASS |
| CAT-003 | Catálogo | slug ya usado: aviso 'No disponible' en vivo y el servidor no crea duplicado | Owner | P1 | ✅ tests/e2e/catalog/catalog-experiences.spec.ts | PASS |
| CAT-004 | Catálogo | backend: checkSlug informa disponibilidad y crear/editar con slug duplicado da CONFLICT | Owner | P1 | ✅ tests/e2e/catalog/catalog-experiences.spec.ts | PASS |
| CAT-005 | Catálogo | validaciones del editor: mínimo > máximo y activar con precio $0 | Owner | P1 | ✅ tests/e2e/catalog/catalog-experiences.spec.ts | PASS |
| CAT-006 | Catálogo | backend rechaza montos negativos, con más de 2 decimales o enormes, y personas fuera de rango | Owner | P1 | ✅ tests/e2e/catalog/catalog-experiences.spec.ts | PASS |
| CAT-007 | Catálogo | editar experiencia: precio y nombre se guardan, el cambio de precio queda en auditoría | Owner | P1 | ✅ tests/e2e/catalog/catalog-experiences.spec.ts | PASS |
| CAT-008 | Catálogo | activar/desactivar desde el listado cambia la visibilidad en el sitio público | Owner | P1 | ✅ tests/e2e/catalog/catalog-experiences.spec.ts | PASS |
| CAT-009 | Catálogo | no se puede activar una experiencia con precio base $0 (rollback del switch) | Owner | P2 | ✅ tests/e2e/catalog/catalog-experiences.spec.ts | PASS |
| CAT-010 | Catálogo | eliminar una experiencia sin uso la borra, queda auditado y no reaparece | Owner | P1 | ✅ tests/e2e/catalog/catalog-experiences.spec.ts | PASS |
| CAT-011 | Catálogo | eliminar una experiencia ligada a un lead la desactiva (integridad) en lugar de borrarla | Owner | P1 | ✅ tests/e2e/catalog/catalog-experiences.spec.ts | PASS |
| CAT-012 | Catálogo | subir dos fotos, reordenarlas y quitar una (MediaUploader → S3 local) | Owner | P2 | ✅ tests/e2e/catalog/catalog-experiences.spec.ts | PASS |
| CAT-013 | Catálogo | un archivo que no es imagen (magic bytes) se rechaza y no se agrega a la galería | Owner | P2 | ✅ tests/e2e/catalog/catalog-experiences.spec.ts | PASS |
| CAT-016 | Catálogo | crear menú por UI con upgrade por persona (precio y costo en centavos) | Owner | P1 | ✅ tests/e2e/catalog/catalog-entities.spec.ts | PASS |
| CAT-017 | Catálogo | un menú 'Incluido' guarda precio $0 aunque se envíe otro monto (sin cobros fantasma) | Owner | P2 | ✅ tests/e2e/catalog/catalog-entities.spec.ts | PASS |
| CAT-018 | Catálogo | platillos: agregar, editar y eliminar con persistencia | Owner | P1 | ✅ tests/e2e/catalog/catalog-entities.spec.ts | PASS |
| CAT-019 | Catálogo | reordenar platillos (subir/bajar y 'Ordenar por tiempo') persiste el orden | Owner | P2 | ✅ tests/e2e/catalog/catalog-entities.spec.ts | PASS |
| CAT-020 | Catálogo | backend: reordenar con ids ajenos o incompletos se rechaza sin cambiar el orden | Owner | P2 | ✅ tests/e2e/catalog/catalog-entities.spec.ts | PASS |
| CAT-021 | Catálogo | eliminar menú: sin uso se borra; ligado a una experiencia se desactiva | Owner | P1 | ✅ tests/e2e/catalog/catalog-entities.spec.ts | PASS |
| CAT-022 | Catálogo | crear add-on por persona por UI (precio/costo en centavos, categoría de costo) | Owner | P1 | ✅ tests/e2e/catalog/catalog-entities.spec.ts | PASS |
| CAT-023 | Catálogo | editar precio de un add-on queda auditado (catalog.price_changed) | Owner | P1 | ✅ tests/e2e/catalog/catalog-entities.spec.ts | PASS |
| CAT-024 | Catálogo | backend rechaza montos/cantidades inválidas en add-ons | Owner | P1 | ✅ tests/e2e/catalog/catalog-entities.spec.ts | PASS |
| CAT-025 | Catálogo | eliminar add-on usado en una cotización lo desactiva; sin uso se borra | Owner | P1 | ✅ tests/e2e/catalog/catalog-entities.spec.ts | PASS |
| CAT-026 | Catálogo | estilo: crear con paleta, editar y eliminar (sin uso) | Owner | P2 | ✅ tests/e2e/catalog/catalog-entities.spec.ts | PASS |
| CAT-027 | Catálogo | backend: paleta con colores no hex y slug inválido se rechazan | Owner | P3 | ✅ tests/e2e/catalog/catalog-entities.spec.ts | PASS |
| CAT-028 | Catálogo | zona: crear con códigos postales y tarifa; un CP inválido se marca y no se agrega | Owner | P1 | ✅ tests/e2e/catalog/catalog-entities.spec.ts | PASS |
| CAT-029 | Catálogo | zona con códigos postales que ya cubre otra zona: se guarda y avisa del traslape | Owner | P2 | ✅ tests/e2e/catalog/catalog-entities.spec.ts | PASS |
| CAT-030 | Catálogo | eliminar zona: ligada a un lead se desactiva; libre se borra | Owner | P2 | ✅ tests/e2e/catalog/catalog-entities.spec.ts | PASS |
| CAT-031 | Catálogo | rango de presupuesto: crear (con etiqueta sugerida), editar y eliminar | Owner | P2 | ✅ tests/e2e/catalog/catalog-entities.spec.ts | PASS |
| CAT-032 | Catálogo | rango de presupuesto inválido: máximo ≤ mínimo (UI) y montos negativos (backend) | Owner | P2 | ✅ tests/e2e/catalog/catalog-entities.spec.ts | PASS |
| CAT-033 | Catálogo | eliminar un rango ligado a un lead lo desactiva | Owner | P3 | ✅ tests/e2e/catalog/catalog-entities.spec.ts | PASS |
| CAT-034 | Catálogo | las pestañas del catálogo cargan cada sección y marcan la activa | Owner | P3 | ✅ tests/e2e/catalog/catalog-entities.spec.ts | PASS |
| QUO-001 | Cotizaciones | listado: pestañas por estado, búsqueda por código/clienta/título y estado vacío | Owner | P1 | ✅ tests/e2e/quotes/quotes-lifecycle.spec.ts | PASS |
| QUO-002 | Cotizaciones | crear cotización desde un lead: precarga, cálculo en vivo = oráculo, lead pasa a Cotizado | Owner | P0 | ✅ tests/e2e/quotes/quotes-create.spec.ts | PASS |
| QUO-003 | Cotizaciones | crear desde /admin/quotes/new buscando una clienta existente | Owner | P1 | ✅ tests/e2e/quotes/quotes-create.spec.ts | PASS |
| QUO-004 | Cotizaciones | clienta nueva desde la cotización: se crea con origen manual y un correo repetido reutiliza la existente | Owner | P1 | ✅ tests/e2e/quotes/quotes-create.spec.ts | PASS |
| QUO-005 | Cotizaciones | validaciones del formulario: clienta, contacto e invitadas | Owner | P1 | ✅ tests/e2e/quotes/quotes-create.spec.ts | PASS |
| QUO-006 | Cotizaciones | el servidor rechaza invitadas fuera de rango, anticipo > 100% y add-ons con cantidad inválida | Owner | P1 | ✅ tests/e2e/quotes/quotes-create.spec.ts | PASS |
| QUO-007 | Cotizaciones | invitadas por encima del máximo de la experiencia: avisos de validación y consulta especial; se cotiza por invitada | Owner | P1 | ✅ tests/e2e/quotes/quotes-create.spec.ts | PASS |
| QUO-008 | Cotizaciones | precio calculado en servidor: la vista previa coincide con el oráculo en combinaciones de menú, add-ons, zona e invitadas | Owner | P0 | ✅ tests/e2e/quotes/quotes-create.spec.ts | PASS |
| QUO-009 | Cotizaciones | el detalle muestra subtotal, IVA incluido, total, anticipo y saldo exactamente como en la base | Owner | P0 | ✅ tests/e2e/quotes/quotes-pricing.spec.ts | PASS |
| QUO-010 | Cotizaciones | agregar add-on del catálogo y un concepto personalizado: recálculo en servidor y guardado | Owner | P1 | ✅ tests/e2e/quotes/quotes-pricing.spec.ts | PASS |
| QUO-011 | Cotizaciones | líneas de catálogo: el servidor fija precio/costo, aplica invitadas facturables y tope de cantidad | Owner | P1 | ✅ tests/e2e/quotes/quotes-pricing.spec.ts | PASS |
| QUO-012 | Cotizaciones | descuento por porcentaje con motivo: total recalculado y auditoría before/after | Owner | P0 | ✅ tests/e2e/quotes/quotes-pricing.spec.ts | PASS |
| QUO-013 | Cotizaciones | descuento por monto mayor al subtotal: se limita al subtotal (total $0) y la propuesta no se puede enviar | Owner | P1 | ✅ tests/e2e/quotes/quotes-pricing.spec.ts | PASS |
| QUO-014 | Cotizaciones | descuento sin motivo, > 100% o negativo se rechaza en el servidor sin tocar la cotización | Owner | P1 | ✅ tests/e2e/quotes/quotes-pricing.spec.ts | PASS |
| QUO-015 | Cotizaciones | cantidades negativas/cero, precios negativos o con decimales y conceptos vacíos se rechazan | Owner | P1 | ✅ tests/e2e/quotes/quotes-pricing.spec.ts | PASS |
| QUO-016 | Cotizaciones | experiencia base, menú y logística no cambian de cantidad aunque se manipule la petición | Owner | P1 | ✅ tests/e2e/quotes/quotes-pricing.spec.ts | PASS |
| QUO-017 | Cotizaciones | cambiar el precio unitario de una línea de catálogo queda auditado (quote.price_changed) | Owner | P1 | ✅ tests/e2e/quotes/quotes-pricing.spec.ts | PASS |
| QUO-018 | Cotizaciones | datos de la propuesta: cambiar invitadas recalcula extras y add-ons por persona; vigencia pasada se rechaza | Owner | P1 | ✅ tests/e2e/quotes/quotes-pricing.spec.ts | PASS |
| QUO-019 | Cotizaciones | enviar: estado SENT, vigencia, lead Cotizado, notificaciones email+WhatsApp, auditoría y enlace público | Owner | P0 | ✅ tests/e2e/quotes/quotes-lifecycle.spec.ts | PASS |
| QUO-020 | Cotizaciones | no se envía sin fecha del evento ni con fecha pasada; queda en borrador y sin notificaciones | Owner | P1 | ✅ tests/e2e/quotes/quotes-lifecycle.spec.ts | PASS |
| QUO-021 | Cotizaciones | reenviar una cotización enviada, aceptada o rechazada da CONFLICT y no notifica de nuevo | Owner | P1 | ✅ tests/e2e/quotes/quotes-lifecycle.spec.ts | PASS |
| QUO-022 | Cotizaciones | marcar expirada y reactivar/reenviar con nueva vigencia | Owner | P1 | ✅ tests/e2e/quotes/quotes-lifecycle.spec.ts | PASS |
| QUO-023 | Cotizaciones | sólo las enviadas pueden marcarse expiradas (borrador/expirada/aceptada → CONFLICT) | Owner | P1 | ✅ tests/e2e/quotes/quotes-lifecycle.spec.ts | PASS |
| QUO-024 | Cotizaciones | duplicar crea un borrador nuevo (código y token propios) con los mismos conceptos y totales | Owner | P1 | ✅ tests/e2e/quotes/quotes-lifecycle.spec.ts | PASS |
| QUO-025 | Cotizaciones | nueva versión: vuelve a borrador con versión +1, mismo token y el enlace público deja de funcionar | Owner | P1 | ✅ tests/e2e/quotes/quotes-lifecycle.spec.ts | PASS |
| QUO-026 | Cotizaciones | nueva versión sobre borrador o aceptada se rechaza (máquina de estados) | Owner | P1 | ✅ tests/e2e/quotes/quotes-lifecycle.spec.ts | PASS |
| QUO-027 | Cotizaciones | una cotización enviada es de sólo lectura: sin editor en la UI y el servidor rechaza cambios | Owner | P1 | ✅ tests/e2e/quotes/quotes-lifecycle.spec.ts | PASS |
| QUO-028 | Cotizaciones | una cotización aceptada no ofrece enviar, expirar ni nueva versión | Owner | P1 | ✅ tests/e2e/quotes/quotes-lifecycle.spec.ts | PASS |
| QUO-029 | Cotizaciones | vista de impresión: datos y totales de la base, sin costos, márgenes ni notas internas | Owner | P1 | ✅ tests/e2e/quotes/quotes-lifecycle.spec.ts | PASS |
| QUO-030 | Cotizaciones | detalle e impresión de una cotización inexistente muestran 'No encontramos este registro' | Owner | P2 | ✅ tests/e2e/quotes/quotes-lifecycle.spec.ts | PASS |
| QUO-031 | Cotizaciones | crear cotización desde un lead PERDIDO: la UI no lo ofrece | Owner | P3 | ✅ tests/e2e/quotes/quotes-lifecycle.spec.ts | PASS |
| QUO-032 | Cotizaciones | 'Por vencer (48 h)' sólo lista enviadas cuya vigencia termina en las próximas 48 horas | Owner | P2 | ✅ tests/e2e/quotes/quotes-lifecycle.spec.ts | PASS |
| QUO-033 | Cotizaciones | otra fundadora (Rosa) aplica un descuento y la auditoría registra su correo | Owner2 (Rosa) | P2 | ✅ tests/e2e/quotes/quotes-pricing.spec.ts | PASS |
| QUO-034 | Cotizaciones | doble clic en 'Crear cotización' crea una sola cotización | Owner | P2 | ✅ tests/e2e/quotes/quotes-create.spec.ts | PASS |
| QUO-036 | Cotizaciones | buscador de clientas: teclado (↓/Enter), sin coincidencias y 'Cambiar' | Owner | P2 | ✅ tests/e2e/quotes/quotes-create.spec.ts | PASS |
| QUO-037 | Cotizaciones | el detalle muestra historial (auditoría) y notificaciones enviadas | Owner | P2 | ✅ tests/e2e/quotes/quotes-lifecycle.spec.ts | PASS |
| QUO-038 | Cotizaciones | con 'precios sin IVA' el IVA (16%) se suma al subtotal y se muestra como '+IVA' | Owner | P1 | ✅ tests/e2e/quotes/pricing.global.spec.ts (chromium-global) | PASS |
| QUO-039 | Cotizaciones | con IVA incluido y tasa 8% el desglose usa la tasa configurada (bps) sin cambiar el total | Owner | P2 | ✅ tests/e2e/quotes/pricing.global.spec.ts (chromium-global) | PASS |

## Escenarios del mapa no automatizados

| ID | Módulo | Escenario | Rol | Priority | Automated | Result |
|---|---|---|---|---|---|---|
| M3-106 | Cotizaciones | Cotizar/enviar en fecha no disponible | Owner | P2 | — (por diseño la disponibilidad se valida al aceptar, paquete 2; DOMAIN.md §Disponibilidad) | NOT APPLICABLE |
| M3-107 | Cotizaciones | Descuento con un rol sin `quotes:discount` | — | P2 | — (OWNER y SUPER_ADMIN tienen el permiso; STAFF no entra a /admin — barrera cubierta por el paquete 1) | NOT APPLICABLE |
| — | Todos | Responsive 768/390 y cross-browser de estas pantallas admin | Owner | P2 | — (fuera de este paquete: carril 0 transversal) | NOT TESTED |
| — | Todos | RBAC por rol (staff/anónimo) de páginas y acciones del paquete | Staff / Anónimo | P1 | — (paquete 1 «Acceso y seguridad») | NOT TESTED (aquí) |

## Totales (deben coincidir con results.json)

| Módulo | P0 | P1 | P2 | P3 | Total | PASS | FAIL | FLAKY | BLOCKED |
|---|---|---|---|---|---|---|---|---|---|
| Leads | 0 | 17 | 16 | 3 | 36 | 34 | 2 | 0 | 0 |
| Clientas | 0 | 9 | 4 | 3 | 16 | 15 | 1 | 0 | 0 |
| Catálogo | 0 | 18 | 11 | 3 | 32 | 32 | 0 | 0 | 0 |
| Cotizaciones | 5 | 25 | 7 | 1 | 38 | 38 | 0 | 0 | 0 |
| **Total** | **5** | **69** | **38** | **10** | **122** | **119** | **3** | **0** | **0** |

Por prioridad: P0 5/5 PASS (100 %) · P1 69/69 PASS (100 %) · P2 36/38 (COM-BUG-02, COM-BUG-03) · P3 9/10 (COM-BUG-01).
