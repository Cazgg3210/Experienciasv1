# Operación diaria (manual para Ivonne, Rosa y el equipo)

> Objetivo: pasar de "dos personas coordinando manualmente cada detalle" a "una operación repetible donde la
> tecnología absorbe la complejidad y las fundadoras conservan el toque humano".

## Ritmo semanal sugerido

| Cuándo | Qué revisar | Dónde |
|---|---|---|
| Cada mañana | Resumen: próximos 7 días, pendientes críticos, pagos pendientes, RSVP incompleto, inventario en conflicto | `/admin` |
| Cada mañana | Leads nuevos (responder < 24 h) | `/admin/leads?status=NEW` |
| Lunes | Calendario de la semana, staff asignado, compras por hacer | `/admin/calendar`, `/admin/operations`, `/admin/purchases` |
| T-7 / T-3 / T-1 | Checklist de cada evento, faltantes de inventario, alergias confirmadas | `/admin/events/[id]/operations` |
| Día del evento | Orden de producción impresa, checklist de montaje/evento/desmontaje (staff desde su teléfono) | `/staff` |
| Después del evento | Registrar compras reales y costos, subir fotos, publicar Memory Capsule, cerrar evento | `/admin/events/[id]/financials`, `/memory` |
| Mensual | Finanzas y márgenes, analytics del embudo, ajustar precios/costos | `/admin/finance`, `/admin/analytics`, `/admin/catalog` |

## 1. Leads

1. Llegan del configurador, el diseñador IA, el formulario de contacto o se capturan a mano (WhatsApp, Instagram).
2. Revisa el snapshot (lo que la clienta configuró y el estimado), marca **Contactado** al escribirle
   (botón de WhatsApp con mensaje sugerido) y registra notas/llamadas en el timeline.
3. Leads **fuera de cobertura** o **consulta especial** (> 12 personas) aparecen marcados: decide si se atienden.
4. Si no avanza, márcalo **Perdido** con motivo (alimenta el aprendizaje).

## 2. Cotizar

1. Desde el lead: **Crear cotización** (se precarga todo). Ajusta add-ons, conceptos, descuento (queda auditado).
2. Revisa **costo y margen**: si aparece en ámbar/rojo está bajo el mínimo o negativo — corrige antes de enviar.
3. **Enviar**: sale por email y WhatsApp con el enlace seguro `/cotizacion/...` (vigencia configurable, 7 días por defecto).
4. Si la clienta pide cambios después de enviarla: **Crear nueva versión**.

## 3. Reserva y pagos

1. La clienta acepta en línea (nombre + términos) → se crea la reserva y el evento en *Pendiente de pago*.
2. Paga el anticipo (50% por defecto). Cuando la pasarela confirma, el evento pasa a **Confirmado** automáticamente,
   se generan checklists y se reserva el inventario.
3. ¿Pagó por transferencia o efectivo? En el evento → **Registrar pago manual** (con comprobante).
4. El saldo vence N días antes del evento (configurable); el sistema envía recordatorios.
5. Reembolsos: desde el panel de pagos del evento (quedan auditados).

## 4. Preparar el evento

- **Portal de la clienta** (`/mi-evento/...`): ahí invita amigas, paga, ajusta preferencias y te escribe.
  Comparte su enlace desde el encabezado del evento (copiar / WhatsApp).
- **Invitadas**: el RSVP llega solo; en *Invitadas* ves confirmadas/pendientes/no asisten, alergias y exportas CSV.
  Botón para recordar a las pendientes.
- **Orden de producción** (`Operaciones` del evento): menú y cantidades, restricciones, vajilla/mantelería reservada,
  add-ons, staff (con horario y monto), horarios de salida/montaje/desmontaje y checklist por fases. Imprimible.
- **Staff**: asigna personas; reciben aviso y ven sus eventos y tareas en `/staff` desde el teléfono (sin ver finanzas).
- **Inventario**: revisa *Conflictos* (p. ej. dos eventos el mismo día que necesitan las mismas copas).
- **Compras**: crea las compras del evento (flores, repostería, bebidas…) y avanza Solicitada → Ordenada → Recibida
  capturando el **monto real** y el comprobante.

## 5. Después del evento

1. Marca el evento **Completado**.
2. Registra costos reales faltantes (compras recibidas, costos manuales como hielo/estacionamiento).
3. Revisa **Finanzas** del evento (venta, costo estimado vs real, margen estimado vs real) y **Cierra el evento**:
   se guarda el snapshot y se envía el seguimiento (Memory Capsule + solicitud de reseña).
4. Memory Capsule: sube fotos, modera las de invitadas (requieren consentimiento), elige portada y publica.

## 6. Configuración

- `/admin/catalog`: experiencias, menús, add-ons, estilos, zonas, rangos de presupuesto (cambios de precio auditados).
- `/admin/calendar`: días operativos, máximo de eventos por día, bloqueos y blackouts.
- `/admin/settings`: negocio, precios y márgenes (IVA, anticipo, margen mínimo, comisión), disponibilidad,
  notificaciones, funciones (feature flags), integraciones, usuarios y auditoría.
- `/admin/content`: testimonios, preguntas frecuentes y galería del sitio.
- `/admin/notifications`: bandeja de mensajes enviados (en modo demo los mensajes no salen; puedes abrir los de
  WhatsApp para enviarlos manualmente).

## 7. Tareas automáticas (cron)

Dokploy ejecuta cada 15 minutos `GET /api/cron/notifications` con `Authorization: Bearer $CRON_SECRET`:
vence cotizaciones, avisa cotizaciones por vencer, recordatorios de pago, RSVP, eventos en 7 días y 48 h,
seguimiento post-evento y solicitud de reseña (idempotente: nunca duplica mensajes).

## 8. Monitoreo

- `GET /api/health` (vida) y `GET /api/health/db` (base de datos).
- Logs estructurados JSON en Dokploy; cada error mostrado al usuario trae una **referencia** (errorId) para buscar en logs.
- Auditoría en `/admin/settings/audit`.
