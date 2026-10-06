# Application Test Map — Paquete 3 «Comercial admin» (carril 3)

Fuente: `docs/qa/.discovery/inventory.json` (2026-10-06, commit f26b1a1) + lectura de código en `src/features/{leads,customers,catalog,quotes}`, `src/app/(admin)/admin/{leads,customers,catalog,quotes}`, `src/app/api/admin/leads-export` y `docs/DOMAIN.md`.
Prioridades: P0 crítico · P1 principal · P2 secundario · P3 menor. Entre paréntesis, la(s) prueba(s) que cubren la fila.
Rol principal: OWNER (Ivonne). También se usan OWNER2 (Rosa) y SUPER_ADMIN donde aporta (auditoría por actor, asignaciones). La autorización de páginas/acciones por rol (staff/anónimo) es del paquete 1.

## Leads (`@module:leads`)

| ID | Módulo | Página/Flujo | Rol | Acción | Resultado esperado | Prioridad |
|---|---|---|---|---|---|---|
| M3-001 | Leads | `/admin/leads` | Owner | Abrir listado | Resumen por estado = conteos de la base (ignora filtro de estado), tabla con los leads del filtro (LEAD-001) | P1 |
| M3-002 | Leads | `/admin/leads` búsqueda | Owner | Buscar por nombre / email / código / teléfono con formato | Encuentra el lead (insensible a mayúsculas; dígitos del teléfono) (LEAD-008) | P1 |
| M3-003 | Leads | Filtros (estado, origen, asignada, señales) | Owner | Aplicar / limpiar | Sólo los leads que cumplen; URL compartible; estado vacío "Ningún lead coincide" (LEAD-009) | P2 |
| M3-004 | Leads | Filtro de fechas | Owner | Rango de fecha del evento | Incluye extremos; rango invertido se corrige (LEAD-010) | P2 |
| M3-005 | Leads | Paginación | Owner | Página 2 / página fuera de rango | 25 por página, conserva búsqueda, página > última = última (LEAD-011) | P2 |
| M3-006 | Leads | Orden | Owner | created_asc / event_asc / default | Orden correcto, sin fecha al final (LEAD-012) | P3 |
| M3-007 | Leads | Navegación por clic (Link) | Owner | Siguiente / Limpiar filtros | La URL cambia y se muestra el destino (LEAD-037) | P2 |
| M3-008 | Leads | Kanban | Owner | Mover tarjeta | Sólo transiciones válidas; persiste + STATUS_CHANGE (LEAD-013) | P2 |
| M3-009 | Leads | Kanban → Perdido | Owner | Mover a Perdido | Diálogo exige motivo; guarda `lostReason` (LEAD-014) | P1 |
| M3-010 | Leads | "Nuevo lead" | Owner | Crear lead manual | Toast `Lead L-… creado`, detalle, Lead NEW, clienta vinculada (email normalizado), asignado a quien captura, timeline CREATED (LEAD-002) | P1 |
| M3-011 | Leads | "Nuevo lead" | Owner | Enviar vacío / formatos inválidos | Errores por campo, sin llamada al servidor (LEAD-003, LEAD-004) | P1 |
| M3-012 | Leads | `createLeadAction` | Owner | Datos inválidos saltando el formulario | VALIDATION_ERROR por campo, nada en base (LEAD-005) | P1 |
| M3-013 | Leads | Duplicados | Owner | Lead con correo/teléfono de clienta existente | Reutiliza la clienta (no duplica) (LEAD-006, CUST-016) | P1 |
| M3-014 | Leads | Señales | Owner | 13 invitadas + otra zona | `specialRequest` y `outOfArea` + insignias (LEAD-007) | P2 |
| M3-015 | Leads | Notificaciones de captura manual | Owner | Crear con origen "Captura manual" / otro origen | Sin avisos de "lead entrante" (LEAD-035, LEAD-036) | P2 |
| M3-016 | Leads | Doble envío | Owner | Doble clic "Crear lead" | Un solo lead (LEAD-033) | P2 |
| M3-017 | Leads | `/admin/leads/[id]` | Owner | Abrir inexistente | "Este lead no existe" (LEAD-015) | P2 |
| M3-018 | Leads | Seguimiento › Mover a | Owner | Cambiar estado con nota | Badge, timeline "A → B", auditoría `lead.status_changed` (LEAD-016) | P1 |
| M3-019 | Leads | Máquina de estados | Owner | Opciones por estado | = `leadStatusMachine.next`; WON final (LEAD-017) | P1 |
| M3-020 | Leads | `changeLeadStatusAction` | Owner | Transiciones inválidas / mismo estado / inexistente | CONFLICT / NOT_FOUND sin cambios (LEAD-018) | P1 |
| M3-021 | Leads | Motivo de pérdida | Owner | LOST sin motivo (back) / UI / reactivar | Rechazo; con motivo se guarda; reactivar limpia (LEAD-019, LEAD-020) | P1 |
| M3-022 | Leads | Responsable | Owner | Asignar / desasignar | `assignedToId`, timeline ASSIGNED, auditoría (LEAD-021) | P1 |
| M3-023 | Leads | `assignLeadAction` | SuperAdmin | Asignar a STAFF / id inexistente | VALIDATION_ERROR, sin cambios (LEAD-022) | P1 |
| M3-024 | Leads | Registrar contacto | Owner | WhatsApp sobre lead NEW | Auto CONTACTED + `lastContactedAt` + timeline (LEAD-023) | P1 |
| M3-025 | Leads | Nota interna | Owner | Nota / mensaje corto | No cambia estado; < 2 caracteres rechazado (LEAD-024) | P2 |
| M3-026 | Leads | Editar datos | Owner | Guardar / sin cambios | Timeline "Datos actualizados: …", auditoría before/after; "No hubo cambios" (LEAD-025) | P1 |
| M3-027 | Leads | Editar datos | Owner | HTML/script en notas | Se muestra escapado (LEAD-026) | P2 |
| M3-028 | Leads | `updateLeadAction` | Owner | Referencias de catálogo inexistentes | VALIDATION_ERROR por campo (LEAD-027) | P2 |
| M3-029 | Leads | Multi-usuario | Owner2 | Operar lead creado por Ivonne | Visible y operable; auditoría con el actor real (LEAD-034) | P2 |
| M3-030 | Leads | `/api/admin/leads-export` | Owner | Exportar CSV | BOM, encabezados, filas = filtro, auditoría `leads.exported` (LEAD-028, LEAD-029) | P1 |
| M3-031 | Leads | CSV | Owner | Fórmulas `= + - @` | Se neutralizan con apóstrofo (LEAD-030) | P2 |
| M3-032 | Leads | Botón "Exportar CSV" | Owner | Con filtros activos | href con los mismos filtros (LEAD-031) | P3 |

## Clientas (`@module:customers`)

| ID | Módulo | Página/Flujo | Rol | Acción | Resultado esperado | Prioridad |
|---|---|---|---|---|---|---|
| M3-040 | Clientas | `/admin/customers` | Owner | Listado filtrado | "N clientas para …", leads/eventos por fila (CUST-001) | P1 |
| M3-041 | Clientas | Búsqueda | Owner | Nombre/correo/teléfono/Instagram/referido; sin coincidencias | Encuentra; estado vacío con "Ver todas" (CUST-002) | P1 |
| M3-042 | Clientas | Orden / paginación | Owner | Nombre A–Z / recientes / página 2 | Correctos (CUST-003, CUST-004) | P3 |
| M3-043 | Clientas | `/admin/customers/[id]` | Owner | Ficha con historial (seed) | Leads, cotizaciones, eventos, pagos, total pagado, bloqueos de borrado (CUST-005) | P1 |
| M3-044 | Clientas | Perfil | Owner | Editar | Normaliza correo/Instagram, opt-in, auditoría before/after (CUST-006) | P1 |
| M3-045 | Clientas | Perfil | Owner | Correo de otra clienta | Error de campo, sin cambios (CUST-007) | P1 |
| M3-046 | Clientas | Perfil | Owner | Datos inválidos (front / back) | Errores por campo (CUST-008, CUST-015) | P1 |
| M3-047 | Clientas | Teléfono | Owner | Teléfono de otra clienta | Sin regla de unicidad (ambigüedad documentada) (CUST-009) | P3 |
| M3-048 | Clientas | Teléfono con formato | Owner | Lead con el mismo número | Reutiliza la clienta (CUST-016) | P2 |
| M3-049 | Clientas | Eliminar | Owner | Sin historial comercial | Borra, leads quedan sin clienta, auditoría, no reaparece (CUST-010) | P1 |
| M3-050 | Clientas | Eliminar | Owner | Cancelar | Nada cambia (CUST-014) | P2 |
| M3-051 | Clientas | Eliminar con cotización / evento | Owner / SuperAdmin | UI + `deleteCustomerAction` | Botón oculto; CONFLICT con motivos (CUST-011, CUST-012) | P1 |
| M3-052 | Clientas | Ficha inexistente / id malformado | Owner | Abrir | "No encontramos a esta clienta" (CUST-013) | P2 |

## Catálogo (`@module:catalog`)

| ID | Módulo | Página/Flujo | Rol | Acción | Resultado esperado | Prioridad |
|---|---|---|---|---|---|---|
| M3-060 | Catálogo | `/admin/catalog` | Owner | Listado de experiencias | Tarjetas con precio base, switch activo, editar (CAT-001) | P1 |
| M3-061 | Catálogo | Pestañas | Owner | Navegar secciones | aria-current y encabezado de cada sección (CAT-034) | P3 |
| M3-062 | Catálogo | Nueva experiencia | Owner | Crear por UI | Slug auto, centavos, nace inactiva, auditoría (CAT-002) | P1 |
| M3-063 | Catálogo | Slug | Owner | Slug repetido (UI y back), checkSlug | "No disponible", CONFLICT, sin duplicado (CAT-003, CAT-004) | P1 |
| M3-064 | Catálogo | Validaciones | Owner | min > max, activa con $0 | Errores de campo (CAT-005) | P1 |
| M3-065 | Catálogo | Montos inválidos (back) | Owner | Negativos, decimales, enormes, personas, URL http | VALIDATION_ERROR (CAT-006, CAT-024, CAT-032) | P1 |
| M3-066 | Catálogo | Editar experiencia | Owner | Cambiar nombre/precio | Guardado + `catalog.price_changed` (CAT-007) | P1 |
| M3-067 | Catálogo | Activar/desactivar | Owner / Anónimo | Switch en listado | Efecto en `/experiencias/<slug>` + auditoría (CAT-008) | P1 |
| M3-068 | Catálogo | Activar con $0 | Owner | Switch | Rechazo + rollback (CAT-009) | P2 |
| M3-069 | Catálogo | Eliminar experiencia | Owner | Sin uso / ligada a lead | Borra / desactiva con motivo (CAT-010, CAT-011) | P1 |
| M3-070 | Catálogo | Imágenes | Owner | Subir, reordenar, quitar; archivo no imagen | ExperienceImage/MediaAsset, orden, limpieza de huérfanos; 422 por magic bytes (CAT-012, CAT-013) | P2 |
| M3-071 | Catálogo | Menús | Owner | Crear por UI; INCLUDED normaliza $0 | Centavos; precio 0 (CAT-016, CAT-017) | P1 |
| M3-072 | Catálogo | Platillos | Owner | Agregar/editar/eliminar/reordenar; reorden manipulado | Persisten; permutación inválida rechazada (CAT-018, CAT-019, CAT-020) | P1 |
| M3-073 | Catálogo | Eliminar menú | Owner | Libre / ligado a experiencia | Borra / desactiva (CAT-021) | P1 |
| M3-074 | Catálogo | Add-ons | Owner | Crear por UI, editar precio, eliminar en uso/libre | Centavos, auditoría, desactivación por cotización (CAT-022, CAT-023, CAT-025) | P1 |
| M3-075 | Catálogo | Estilos | Owner | Crear con paleta, editar, eliminar; hex inválido | Persisten; rechazo (CAT-026, CAT-027) | P2 |
| M3-076 | Catálogo | Zonas | Owner | Crear con CP y tarifa; CP inválido; traslape; eliminar | Persisten; aviso de traslape; desactivación por lead (CAT-028, CAT-029, CAT-030) | P1 |
| M3-077 | Catálogo | Presupuestos | Owner | Crear (sugerir etiqueta), editar, eliminar; max ≤ min; en uso | Persisten; validación; desactivación (CAT-031, CAT-032, CAT-033) | P2 |

## Cotizaciones (`@module:quotes`)

| ID | Módulo | Página/Flujo | Rol | Acción | Resultado esperado | Prioridad |
|---|---|---|---|---|---|---|
| M3-080 | Cotizaciones | `/admin/quotes` | Owner | Pestañas, búsqueda, parámetros basura | Filtra por estado/código/clienta; estado vacío (QUO-001) | P1 |
| M3-081 | Cotizaciones | Por vencer (48 h) | Owner | Filtro `expiring=1` | Sólo SENT que vencen en 48 h (QUO-032) | P2 |
| M3-082 | Cotizaciones | Desde lead | Owner | Crear cotización | Precarga, cálculo en vivo = oráculo, DRAFT, líneas, lead → QUOTED + QUOTE_CREATED, auditoría (QUO-002) | P0 |
| M3-083 | Cotizaciones | `/admin/quotes/new` | Owner | Clienta existente (buscador) / nueva / correo repetido | customerId correcto, sin duplicar clienta (QUO-003, QUO-004, QUO-036) | P1 |
| M3-084 | Cotizaciones | Validaciones | Owner | Front y back (invitadas, anticipo, add-ons, fechas, clienta) | Errores por campo; nada creado (QUO-005, QUO-006) | P1 |
| M3-085 | Cotizaciones | Invitadas > máximo | Owner | 13 invitadas | Avisos + consulta especial; precio por invitada (QUO-007) | P1 |
| M3-086 | Cotizaciones | QuoteEngine | Owner | `previewQuoteAction` combinaciones | = oráculo (líneas, subtotal, IVA en bps, total, anticipo, avisos) (QUO-008) | P0 |
| M3-087 | Cotizaciones | Totales en detalle | Owner | Abrir borrador | Subtotal/IVA/Total/Anticipo/Saldo = base (QUO-009) | P0 |
| M3-088 | Cotizaciones | Editor | Owner | Add-on de catálogo, concepto personalizado, guardar | Recalculado en servidor; persistido (QUO-010, QUO-011) | P1 |
| M3-089 | Cotizaciones | Descuento | Owner / Owner2 | %, monto > subtotal, sin motivo, > 100% | Total correcto; tope; rechazos; auditoría `quote.discount_applied` before/after (QUO-012, QUO-013, QUO-014, QUO-033) | P0 |
| M3-090 | Cotizaciones | Líneas inválidas | Owner | Cantidades ≤ 0, precios negativos, decimales, vacío | Rechazo sin cambios (QUO-015) | P1 |
| M3-091 | Cotizaciones | Líneas fijas | Owner | Manipular cantidad de base/menú/logística | Se ignora (QUO-016) | P1 |
| M3-092 | Cotizaciones | Precio unitario | Owner | Cambiar precio de catálogo | `quote.price_changed` (QUO-017) | P1 |
| M3-093 | Cotizaciones | Datos de la propuesta | Owner | Invitadas, título, vigencia pasada | Recalcula extras/por persona; rechazo de vigencia (QUO-018) | P1 |
| M3-094 | Cotizaciones | Enviar | Owner | Enviar a la clienta | SENT, vigencia, lead QUOTED + QUOTE_SENT, notificaciones EMAIL+WHATSAPP con token, auditoría, enlace público (QUO-019) | P0 |
| M3-095 | Cotizaciones | Enviar inválido | Owner | Sin fecha / fecha pasada / ya enviada/aceptada/rechazada / $0 | Rechazo sin notificar (QUO-020, QUO-021, QUO-013) | P1 |
| M3-096 | Cotizaciones | Expirar / reactivar | Owner | Marcar expirada, reenviar | EXPIRED → SENT con nueva vigencia (QUO-022, QUO-023) | P1 |
| M3-097 | Cotizaciones | Duplicar | Owner | Duplicar enviada con descuento | Nuevo DRAFT v1 con código/token propios (QUO-024) | P1 |
| M3-098 | Cotizaciones | Nueva versión | Owner | Desde SENT; desde DRAFT/ACCEPTED | DRAFT v+1 mismo token, enlace 404; CONFLICT (QUO-025, QUO-026) | P1 |
| M3-099 | Cotizaciones | Guardas de estado | Owner | Editar SENT / ACCEPTED | Sin editor; CONFLICT en servidor (QUO-027, QUO-028) | P1 |
| M3-100 | Cotizaciones | Impresión | Owner | `/admin/quotes/[id]/print` | Datos y totales de la base; sin costos/márgenes/notas internas (QUO-029) | P1 |
| M3-101 | Cotizaciones | IDs inexistentes | Owner | Detalle / impresión | "No encontramos este registro" (QUO-030) | P2 |
| M3-102 | Cotizaciones | Lead perdido | Owner | Detalle del lead | Sin "Crear cotización" (QUO-031) | P3 |
| M3-103 | Cotizaciones | Historial / notificaciones | Owner | Detalle tras enviar | Auditoría y notificaciones listadas (QUO-037) | P2 |
| M3-104 | Cotizaciones | Doble envío | Owner | Doble clic "Crear cotización" | Una sola (QUO-034) | P2 |
| M3-105 | Cotizaciones | IVA configurable (global) | Owner | `pricesIncludeTax=false`; tasa 8 % | IVA sumado / desglose con la tasa (QUO-038, QUO-039) | P1 |
| M3-106 | Cotizaciones | Fecha no disponible | Owner | Cotizar/enviar en fecha bloqueada | Por diseño (DOMAIN.md §Disponibilidad) la disponibilidad se valida al **aceptar** (paquete 2); el admin no la valida — NOT APPLICABLE en este paquete | P2 |
| M3-107 | Cotizaciones | Permiso `quotes:discount` | — | Rol sin permiso | Ningún rol con acceso al panel carece del permiso (OWNER/SUPER_ADMIN lo tienen; STAFF no entra a /admin): NOT APPLICABLE; se valida el registro del actor (QUO-012, QUO-033) | P2 |
