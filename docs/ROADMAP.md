# Roadmap

## Estado actual (MVP — Fase 1)

Commerce (sitio, catálogo, configurador, IA con reglas, leads, cotizaciones, aceptación, pagos con webhook),
Experience (portal de clienta, micrositio, RSVP, mensajes, Memory Capsule), Operations (eventos, calendario y
disponibilidad, orden de producción, checklists, staff, inventario, proveedores, compras), Intelligence (costeo,
márgenes estimado/real, cierre, dashboard, analytics del embudo), plataforma (RBAC, auditoría, notificaciones,
feature flags, Docker/Dokploy, CI).

## Fase 2 — Operations OS (recomendado, próximos 2–3 meses)

1. **Pasarela real en producción**: activar Mercado Pago (más adopción en México, OXXO/SPEI) o Stripe con sus
   credenciales; pruebas en sandbox; conciliación diaria.
2. **WhatsApp Cloud API** con plantillas aprobadas por Meta (cotización enviada, recordatorios, confirmaciones) y
   bandeja de entrada de respuestas.
3. **Worker + Redis** para notificaciones y tareas (sustituir cron HTTP), reintentos con backoff.
4. **Calendario de staff** y disponibilidad por persona con confirmación desde `/staff`; pagos al staff.
5. **Inventario**: kits por experiencia, check-in con escaneo QR, depreciación y renta a proveedores.
6. **Facturación electrónica (CFDI 4.0)** vía PAC (Facturama/Facturapi) desde la reserva.
7. **Contratos y firma** simple (PDF con términos aceptados + firma).
8. **Reportes**: costo por invitada, contribución por experiencia, ingreso por add-ons, recompra y referidos.

## Fase 3 — Experience Layer

- Micrositio avanzado (temas por estilo, música embebida, agenda con mapa), invitación digital animada.
- Memory Capsule premium: auto-video/recap, timeline, descarga en ZIP, impresión de álbum.
- Programa de referidos con códigos (ya existe `referralCode` por clienta) y recompensas.
- Encuestas NPS automatizadas y publicación de reseñas en el sitio.

## Fase 4 — Intelligence

- AI Designer con LLM en producción (Anthropic/OpenAI ya soportados) + imágenes de moodboard.
- Recomendaciones de add-ons por historial, pricing dinámico por temporada/demanda.
- Pronóstico de demanda por zona y fechas; BI (Metabase) sobre réplica de lectura.

## Fase 5 — Escala

- Nuevas células geográficas (Lomas, Anzures, Roma/Condesa; luego Santa Fe/Interlomas) — ya configurables como zonas.
- B2B boutique (marcas, inmobiliarias, clínicas): cotizador corporativo, facturación, paquetes recurrentes.
- Multi-ciudad (multi-tenant ligero por ciudad), marketplace de proveedores si se justifica.

## Deuda técnica conocida / mejoras

- Pruebas E2E en CI con base efímera y build cacheado.
- Observabilidad: Sentry (variable `SENTRY_DSN` prevista) y métricas.
- CDN para imágenes públicas (`STORAGE_PUBLIC_URL`) y thumbnails.
- Migrar a Next.js 16 / Prisma 7 cuando Auth.js v5 y el ecosistema estabilicen.
