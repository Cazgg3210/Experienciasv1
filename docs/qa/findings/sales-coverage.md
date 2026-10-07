# Test Coverage Matrix — Paquete 2 «Venta pública» (carril 2)

**Resultado REAL de la última corrida** (no estimado):
- Corrida completa: `E2E_LANE=2 E2E_WORKERS=3 node node_modules/@playwright/test/cli.js test tests/e2e/public tests/e2e/configurator tests/e2e/ai-designer tests/e2e/quote-public tests/e2e/payments --project=chromium --project=mobile-chrome` (reintentos = 1, default de la config) → `test-results/l2/results.json`: **105 pruebas (96 chromium + 9 mobile 390×844) + 5 de setup → 104 passed (99 + 5 setup), 6 failed, 0 flaky, 0 skipped** (2.7 min).
- Estado global: `E2E_LANE=2 E2E_SUITE=global …` (1 worker) → `test-results/l2/global/results.json`: **2 passed** (AI-009, PAY-020).
- Commit f26b1a1, build `.next-e2e`, servidor :3202, base `ivonne_rosa_e2e_l2` re-sembrada por invocación. 2026-10-06.
- Cada FAIL falló en sus 2 intentos (intento + reintento) y en corridas previas con `--repeat-each=2 --retries=0`: reproducible, no inestable.
- Una fila por escenario; si corrió en chromium y mobile, el resultado es el peor de ambos.

| ID | Módulo | Escenario | Rol | Priority | Automated | Result |
|---|---|---|---|---|---|---|
| PUB-001 | Público | / carga sin errores, con un h1, landmarks y navegación | Anónimo | P1 | ✅ `tests/e2e/public/site.spec.ts` (chromium) | PASS |
| PUB-002 | Público | /experiencias carga sin errores, con un h1, landmarks y navegación | Anónimo | P1 | ✅ `tests/e2e/public/site.spec.ts` (chromium) | PASS |
| PUB-003 | Público | /experiencias/birthday-table carga sin errores, con un h1, landmarks y navegación | Anónimo | P1 | ✅ `tests/e2e/public/site.spec.ts` (chromium) | PASS |
| PUB-004 | Público | /como-funciona carga sin errores, con un h1, landmarks y navegación | Anónimo | P2 | ✅ `tests/e2e/public/site.spec.ts` (chromium) | PASS |
| PUB-005 | Público | /nuestra-historia carga sin errores, con un h1, landmarks y navegación | Anónimo | P2 | ✅ `tests/e2e/public/site.spec.ts` (chromium) | PASS |
| PUB-006 | Público | /contacto carga sin errores, con un h1, landmarks y navegación | Anónimo | P1 | ✅ `tests/e2e/public/site.spec.ts` (chromium) | PASS |
| PUB-007 | Público | /privacidad carga sin errores, con un h1, landmarks y navegación | Anónimo | P2 | ✅ `tests/e2e/public/site.spec.ts` (chromium) | PASS |
| PUB-008 | Público | /terminos carga sin errores, con un h1, landmarks y navegación | Anónimo | P2 | ✅ `tests/e2e/public/site.spec.ts` (chromium) | PASS |
| PUB-009 | Público | /crear-experiencia carga sin errores, con un h1, landmarks y navegación | Anónimo | P1 | ✅ `tests/e2e/public/site.spec.ts` (chromium) | PASS |
| PUB-010 | Público | /crear-experiencia/ai carga sin errores, con un h1, landmarks y navegación | Anónimo | P1 | ✅ `tests/e2e/public/site.spec.ts` (chromium) | PASS |
| PUB-011 | Público | menú principal, CTA del encabezado y enlaces legales del pie llevan a su página | Anónimo | P2 | ✅ `tests/e2e/public/site.spec.ts` (chromium) | PASS |
| PUB-012 | Público | menú móvil: abre, navega y cierra | Anónimo | P2 | ✅ `tests/e2e/public/site.spec.ts` (chromium + mobile 390×844) | PASS |
| PUB-013 | Público | los CTAs del inicio llevan al configurador y al catálogo | Anónimo | P1 | ✅ `tests/e2e/public/site.spec.ts` (chromium) | PASS |
| PUB-014 | Público | /experiencias muestra exactamente las experiencias activas del catálogo y enlaza a su detalle | Anónimo | P1 | ✅ `tests/e2e/public/site.spec.ts` (chromium) | PASS |
| PUB-015 | Público | detalle de experiencia: precio desde, rango de personas y CTA al configurador con la experiencia preseleccionada | Anónimo | P1 | ✅ `tests/e2e/public/site.spec.ts` (chromium) | PASS |
| PUB-016 | Público | experiencia inexistente o inactiva → página «no disponible» con noindex (y no aparece en el catálogo) | Anónimo | P1 | ✅ `tests/e2e/public/site.spec.ts` (chromium) | PASS |
| PUB-017 | Público | filtros del catálogo: ocasión coincide con la base, grupo grande muestra consulta especial y sin resultados muestra estado vacío | Anónimo | P2 | ✅ `tests/e2e/public/site.spec.ts` (chromium) | PASS |
| PUB-018 | Público | SEO: páginas indexables con title, description, canonical y Open Graph en el <head> que ve un buscador (sin noindex) | Anónimo | P2 | ✅ `tests/e2e/public/site.spec.ts` (chromium) | PASS |
| PUB-019 | Público | páginas con token y de pago no se indexan (meta robots + X-Robots-Tag) y robots.txt/sitemap son coherentes | Anónimo | P1 | ✅ `tests/e2e/public/site.spec.ts` (chromium) | PASS |
| PUB-020 | Público | accesibilidad (axe WCAG 2.1 AA) de las páginas públicas clave | Anónimo | P2 | ✅ `tests/e2e/public/site.spec.ts` (chromium) | PASS |
| PUB-021 | Público | responsive: sin scroll horizontal y CTA visible en 1440, 1366, 768 y 390 | Anónimo | P2 | ✅ `tests/e2e/public/site.spec.ts` (chromium) | PASS |
| PUB-040 | Público | enviar el formulario crea lead CONTACT_FORM + clienta + avisos y la fundadora lo ve en /admin/leads | Anónimo | P0 | ✅ `tests/e2e/public/contact.spec.ts` (chromium + mobile 390×844) | PASS |
| PUB-041 | Público | enviar vacío muestra todos los errores por campo y no crea nada | Anónimo | P1 | ✅ `tests/e2e/public/contact.spec.ts` (chromium) | PASS |
| PUB-042 | Público | formatos inválidos (teléfono, correo, mensaje corto, fecha pasada) se rechazan en el navegador | Anónimo | P1 | ✅ `tests/e2e/public/contact.spec.ts` (chromium) | PASS |
| PUB-043 | Público | el backend valida aunque se salte el navegador (sin consentimiento, correo, teléfono, fecha pasada, campos gigantes) | Anónimo | P1 | ✅ `tests/e2e/public/contact.spec.ts` (chromium) | PASS |
| PUB-044 | Público | doble clic en «Enviar mensaje» crea un solo lead | Anónimo | P1 | ✅ `tests/e2e/public/contact.spec.ts` (chromium) | PASS |
| PUB-045 | Público | honeypot lleno: respuesta de éxito para el bot pero no se crea lead ni clienta | Anónimo | P2 | ✅ `tests/e2e/public/contact.spec.ts` (chromium) | PASS |
| PUB-046 | Público | la misma clienta (mismo correo) que escribe dos veces conserva un solo registro de clienta | Anónimo | P2 | ✅ `tests/e2e/public/contact.spec.ts` (chromium) | PASS |
| PUB-047 | Público | texto con HTML/script se muestra escapado en la confirmación y en el panel (sin ejecutar) | Anónimo | P2 | ✅ `tests/e2e/public/contact.spec.ts` (chromium) | PASS |
| CONF-001 | Configurador | recorrido completo: estimado de servidor → envío → lead NEW + clienta + snapshot + avisos → visible en /admin/leads | Anónimo | P0 | ✅ `tests/e2e/configurator/wizard.spec.ts` (chromium + mobile 390×844) | PASS |
| CONF-002 | Configurador | el estimado se recalcula en servidor al cambiar invitadas y extras (sin costos internos) | Anónimo | P1 | ✅ `tests/e2e/configurator/wizard.spec.ts` (chromium) | PASS |
| CONF-003 | Configurador | límites de invitadas en la UI: mínimo 2, máximo 40 y aviso de consulta especial | Anónimo | P1 | ✅ `tests/e2e/configurator/wizard.spec.ts` (chromium) | PASS |
| CONF-004 | Configurador | calendario: pasados, lunes, bloqueados y llenos no se pueden elegir; el paso exige fecha | Anónimo | P1 | ✅ `tests/e2e/configurator/wizard.spec.ts` (chromium) | PASS |
| CONF-005 | Configurador | datos de contacto inválidos: errores por campo y no se crea ningún lead | Anónimo | P1 | ✅ `tests/e2e/configurator/wizard.spec.ts` (chromium) | PASS |
| CONF-006 | Configurador | doble clic en «Consultar disponibilidad» crea un solo lead | Anónimo | P1 | ✅ `tests/e2e/configurator/wizard.spec.ts` (chromium) | PASS |
| CONF-007 | Configurador | recargar a mitad del wizard ofrece continuar el borrador y el envío funciona | Anónimo | P2 | ✅ `tests/e2e/configurator/wizard.spec.ts` (chromium) | PASS |
| CONF-008 | Configurador | «Otra zona»: el lead queda fuera de cobertura con la colonia y la logística «por confirmar» | Anónimo | P1 | ✅ `tests/e2e/configurator/wizard.spec.ts` (chromium) | PASS |
| CONF-009 | Configurador | grupo de 20 personas: consulta especial marcada en el lead y en la confirmación | Anónimo | P1 | ✅ `tests/e2e/configurator/wizard.spec.ts` (chromium) | PASS |
| CONF-010 | Configurador | llegar desde una experiencia (?experiencia=&ocasion=) preselecciona ocasión y experiencia | Anónimo | P1 | ✅ `tests/e2e/configurator/wizard.spec.ts` (chromium) | PASS |
| CONF-011 | Configurador | cada paso valida antes de avanzar con mensajes claros | Anónimo | P2 | ✅ `tests/e2e/configurator/wizard.spec.ts` (chromium) | PASS |
| CONF-012 | Configurador | accesibilidad del configurador (pasos 1–2 y resumen) y navegación por teclado del paso 1 | Anónimo | P2 | ✅ `tests/e2e/configurator/wizard.spec.ts` (chromium) | PASS |
| CONF-013 | Configurador | el estimado se calcula en servidor con las reglas del motor (base, extras, menú/extra por persona, logística, IVA 16 % incluido, anticipo 50 %) | Anónimo | P0 | ✅ `tests/e2e/configurator/server.spec.ts` (chromium) | PASS |
| CONF-014 | Configurador | el catálogo que recibe el navegador no incluye costos internos | Anónimo | P0 | ✅ `tests/e2e/configurator/server.spec.ts` (chromium) | PASS |
| CONF-015 | Configurador | precio manipulado en el request: el servidor lo ignora y guarda el estimado recalculado | Anónimo | P0 | ✅ `tests/e2e/configurator/server.spec.ts` (chromium) | PASS |
| CONF-016 | Configurador | disponibilidad pública: estados por día correctos y sin datos de otros eventos | Anónimo | P1 | ✅ `tests/e2e/configurator/server.spec.ts` (chromium) | PASS |
| CONF-017 | Configurador | fechas pasadas o bloqueadas se rechazan al enviar (aunque se fuerce el request) y no crean lead | Anónimo | P1 | ✅ `tests/e2e/configurator/server.spec.ts` (chromium) | PASS |
| CONF-018 | Configurador | el backend rechaza contacto inválido, consentimiento falso, límites de invitadas e ids incompatibles | Anónimo | P1 | ✅ `tests/e2e/configurator/server.spec.ts` (chromium) | PASS |
| CONF-019 | Configurador | reintento con el mismo submissionId devuelve el mismo folio sin duplicar lead, clienta ni avisos | Anónimo | P1 | ✅ `tests/e2e/configurator/server.spec.ts` (chromium) | PASS |
| CONF-020 | Configurador | día lleno: la solicitud se acepta como consulta y el equipo ve la nota «Fecha llena» | Anónimo | P2 | ✅ `tests/e2e/configurator/server.spec.ts` (chromium) | PASS |
| CONF-021 | Configurador | la misma clienta (mismo teléfono) que vuelve a escribir no se duplica | Anónimo | P2 | ✅ `tests/e2e/configurator/server.spec.ts` (chromium) | PASS |
| CONF-022 | Configurador | la clienta se reconoce entre canales por teléfono (configurador → diseñador IA / contacto) | Anónimo | P2 | ✅ `tests/e2e/configurator/server.spec.ts` (chromium) | FAIL (SAL-BUG-02) |
| CONF-023 | Configurador | analítica del embudo: inicio y resumen se registran con el id de sesión | Anónimo | P3 | ✅ `tests/e2e/configurator/server.spec.ts` (chromium) | PASS |
| CONF-024 | Configurador | resumen con líneas por persona («· N × $precio») sin texto atenuado bajo AA (axe sin color-contrast) | Anónimo | P2 | ✅ `tests/e2e/configurator/wizard.spec.ts` (chromium) | PASS (@regression BUG-009; ronda 1, carril 4, 5/5 con --repeat-each) |
| AI-001 | Diseñador IA | generar una propuesta: concepto + estimado del motor real, guardada como AiDesign y medida | Anónimo | P1 | ✅ `tests/e2e/ai-designer/ai-designer.spec.ts` (chromium + mobile 390×844) | PASS |
| AI-002 | Diseñador IA | «Quiero esta experiencia» crea un lead AI_DESIGNER ligado al diseño y la fundadora lo ve | Anónimo | P1 | ✅ `tests/e2e/ai-designer/ai-designer.spec.ts` (chromium + mobile 390×844) | PASS |
| AI-003 | Diseñador IA | el formulario exige ocasión, perfil, presupuesto, vibra y zona (sin generar nada) | Anónimo | P1 | ✅ `tests/e2e/ai-designer/ai-designer.spec.ts` (chromium) | PASS |
| AI-004 | Diseñador IA | el backend rechaza entradas inválidas del diseñador (invitadas, presupuesto, zona, colores, vibras) | Anónimo | P1 | ✅ `tests/e2e/ai-designer/ai-designer.spec.ts` (chromium) | PASS |
| AI-005 | Diseñador IA | convertir el mismo diseño dos veces devuelve el mismo folio (un solo lead) | Anónimo | P1 | ✅ `tests/e2e/ai-designer/ai-designer.spec.ts` (chromium) | PASS |
| AI-006 | Diseñador IA | convertir con diseño inexistente, fecha pasada, sin consentimiento o teléfono inválido se rechaza sin crear lead | Anónimo | P1 | ✅ `tests/e2e/ai-designer/ai-designer.spec.ts` (chromium) | PASS |
| AI-007 | Diseñador IA | un diseño de más de 30 días ya no se puede convertir | Anónimo | P2 | ✅ `tests/e2e/ai-designer/ai-designer.spec.ts` (chromium) | PASS |
| AI-008 | Diseñador IA | la propuesta respeta el presupuesto y el número de invitadas pedido (estimado del motor real) | Anónimo | P2 | ✅ `tests/e2e/ai-designer/ai-designer.spec.ts` (chromium) | PASS |
| AI-009 | Diseñador IA | AI_DESIGNER_ENABLED=false: la página muestra la pausa, el configurador oculta el acceso y el backend rechaza generar y convertir | Anónimo | P1 | ✅ `tests/e2e/ai-designer/ai-flag.global.spec.ts` (chromium-global) | PASS |
| QPUB-001 | Cotización por token | la clienta ve su propuesta SENT con montos en MXN, sin costos internos, y se registra la vista | Clienta (token) | P0 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` (chromium + mobile 390×844) | PASS |
| QPUB-002 | Cotización por token | aceptar la propuesta crea reserva + evento PENDING_PAYMENT, gana el lead y notifica | Clienta (token) | P0 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` (chromium + mobile 390×844) | PASS |
| QPUB-003 | Cotización por token | rechazar con motivo deja la cotización REJECTED, sin reserva ni evento, y avisa al equipo | Clienta (token) | P0 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` (chromium + mobile 390×844) | PASS |
| QPUB-004 | Cotización por token | aceptar exige nombre y apellido y los términos (front y back); la base no cambia | Clienta (token) | P1 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` (chromium) | PASS |
| QPUB-005 | Cotización por token | cotización con vigencia vencida: se muestra expirada, pasa a EXPIRED y no se puede aceptar | Clienta (token) | P1 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` (chromium) | PASS |
| QPUB-006 | Cotización por token | una propuesta ya aceptada no se puede volver a aceptar ni rechazar (una sola reserva) | Clienta (token) | P1 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` (chromium) | PASS |
| QPUB-007 | Cotización por token | una propuesta rechazada muestra el cierre y ya no se puede aceptar; rechazar de nuevo es idempotente | Clienta (token) | P1 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` (chromium) | PASS |
| QPUB-008 | Cotización por token | versión reemplazada: aceptar desde una pestaña con la versión vieja se rechaza y muestra la vigente | Clienta (token) | P1 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` (chromium) | PASS |
| QPUB-009 | Cotización por token | doble clic en «Aceptar y continuar» crea una sola reserva y un solo evento | Clienta (token) | P1 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` (chromium) | PASS |
| QPUB-010 | Cotización por token | tokens inválidos, inexistentes o de borradores responden 404 genérico sin datos | Anónimo | P1 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` (chromium) | PASS |
| QPUB-011 | Cotización por token | si la fecha ya se llenó, aceptar falla con aviso, la cotización sigue SENT y el equipo es notificado | Clienta (token) | P1 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` (chromium) | PASS |
| QPUB-012 | Cotización por token | la vista de una fundadora con sesión no marca la propuesta como vista por la clienta | Owner | P3 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` (chromium) | PASS |
| QPUB-013 | Cotización por token | respuesta de aceptar sólo devuelve el token del portal (sin datos internos) | Clienta (token) | P2 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` (chromium) | PASS |
| QPUB-014 | Cotización por token | accesibilidad (axe WCAG 2.1 AA) de la propuesta y del diálogo de aceptar | Clienta (token) | P2 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` (chromium) | FAIL (SAL-BUG-06) |
| QPUB-015 | Cotización por token | teclado: el diálogo de aceptar se abre con Enter, enfoca el nombre y al cerrarse devuelve el foco al botón | Clienta (token) | P3 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` (chromium) | FAIL (SAL-BUG-05) |
| PAY-001 | Pagos | anticipo: pagar en el checkout simulado confirma el evento (webhook → PAID → onEventConfirmed) | Clienta (token) | P0 | ✅ `tests/e2e/payments/payments.spec.ts` (chromium + mobile 390×844) | PASS |
| PAY-002 | Pagos | pago rechazado: queda FAILED con motivo, el evento sigue pendiente y se puede reintentar | Clienta (token) | P0 | ✅ `tests/e2e/payments/payments.spec.ts` (chromium) | PASS |
| PAY-003 | Pagos | cancelar en la pasarela regresa a la propuesta sin cobrar ni confirmar | Clienta (token) | P1 | ✅ `tests/e2e/payments/payments.spec.ts` (chromium) | PASS |
| PAY-004 | Pagos | checkout inexistente o mal formado responde 404 y la acción simulada no procede | Anónimo | P1 | ✅ `tests/e2e/payments/payments.spec.ts` (chromium) | PASS |
| PAY-005 | Pagos | pagar dos veces: el checkout ya procesado no vuelve a cobrar y el anticipo cubierto bloquea otro checkout | Clienta (token) | P1 | ✅ `tests/e2e/payments/payments.spec.ts` (chromium) | PASS |
| PAY-006 | Pagos | iniciar el checkout de nuevo reutiliza el mismo pago pendiente (sin duplicar cobros) | Clienta (token) | P1 | ✅ `tests/e2e/payments/payments.spec.ts` (chromium) | PASS |
| PAY-007 | Pagos | no se puede iniciar un pago con un token sin reserva, inexistente o datos inválidos | Anónimo | P1 | ✅ `tests/e2e/payments/payments.spec.ts` (chromium) | PASS |
| PAY-008 | Pagos | el estado del pago sólo se consulta con la firma correcta del enlace | Anónimo | P1 | ✅ `tests/e2e/payments/payments.spec.ts` (chromium) | PASS |
| PAY-009 | Pagos | webhook firmado payment.succeeded confirma una vez; el reenvío del mismo evento es idempotente | Anónimo | P1 | ✅ `tests/e2e/payments/payments.spec.ts` (chromium) | PASS |
| PAY-010 | Pagos | webhook payment.failed marca FAILED; un reintento cobrado pasa a PAID y un fallo tardío no lo degrada | Anónimo | P1 | ✅ `tests/e2e/payments/payments.spec.ts` (chromium) | PASS |
| PAY-011 | Pagos | cobro menor al esperado no marca PAID: queda en revisión manual y se avisa al equipo | Anónimo | P1 | ✅ `tests/e2e/payments/payments.spec.ts` (chromium) | PASS |
| PAY-012 | Pagos | webhook de un pago desconocido se registra sin efectos; firma inválida no procesa nada | Anónimo | P2 | ✅ `tests/e2e/payments/payments.spec.ts` (chromium) | PASS |
| PAY-013 | Pagos | reembolso reportado por la pasarela: PARTIAL_REFUND + registro REFUND + auditoría, idempotente | Anónimo | P2 | ✅ `tests/e2e/payments/payments.spec.ts` (chromium) | PASS |
| PAY-014 | Pagos | /pago/resultado espera la confirmación del webhook y se actualiza sola al llegar | Clienta (token) | P1 | ✅ `tests/e2e/payments/payments.spec.ts` (chromium) | PASS |
| PAY-015 | Pagos | enlace de pago con más de 1 h expira: no se puede pagar y no se cobra | Clienta (token) | P1 | ✅ `tests/e2e/payments/payments.spec.ts` (chromium) | PASS |
| PAY-016 | Pagos | si el saldo cambió (pago manual parcial), el enlace viejo ya no es vigente | Clienta (token) | P2 | ✅ `tests/e2e/payments/payments.spec.ts` (chromium) | PASS |
| PAY-017 | Pagos | una reserva cancelada no acepta pagos | Clienta (token) | P1 | ✅ `tests/e2e/payments/payments.spec.ts` (chromium) | PASS |
| PAY-018 | Pagos | saldo desde el portal: cobra total − anticipo y después ya no hay saldo pendiente | Clienta (token) | P2 | ✅ `tests/e2e/payments/payments.spec.ts` (chromium) | PASS |
| PAY-019 | Pagos | dos solicitudes simultáneas de checkout (dos pestañas / reintento de red) no deben duplicar el pago pendiente | Clienta (token) | P2 | ✅ `tests/e2e/payments/payments.spec.ts` (chromium) | FAIL (SAL-BUG-01) |
| PAY-020 | Pagos | PAYMENTS_ENABLED=false: «Pagar anticipo» avisa la pausa y el backend no crea pagos; al restaurar se puede pagar | Clienta (token) | P1 | ✅ `tests/e2e/payments/payments-flag.global.spec.ts` (chromium-global) | PASS |
| PAY-021 | Pagos | un checkout abierto antes de que el equipo cancele el evento ya no debe poder cobrarse | Clienta (token) | P1 | ✅ `tests/e2e/payments/payments.spec.ts` (chromium) | FAIL (SAL-BUG-03) |
| PAY-022 | Pagos | accesibilidad del checkout simulado y del resultado del pago | Clienta (token) | P2 | ✅ `tests/e2e/payments/payments.spec.ts` (chromium) | FAIL (SAL-BUG-04) |

**Total escenarios:** 98 — PASS 92 · FAIL 6 · FLAKY 0 · BLOCKED 0 · NOT TESTED 0

| Agrupación | Resultado |
|---|---|
| Módulo Público | PASS 29 · FAIL 0 · FLAKY 0 · BLOCKED 0 · NOT TESTED 0 |
| Módulo Configurador | PASS 22 · FAIL 1 · FLAKY 0 · BLOCKED 0 · NOT TESTED 0 |
| Módulo Diseñador IA | PASS 9 · FAIL 0 · FLAKY 0 · BLOCKED 0 · NOT TESTED 0 |
| Módulo Cotización por token | PASS 13 · FAIL 2 · FLAKY 0 · BLOCKED 0 · NOT TESTED 0 |
| Módulo Pagos | PASS 19 · FAIL 3 · FLAKY 0 · BLOCKED 0 · NOT TESTED 0 |
| Prioridad P0 | PASS 10 · FAIL 0 · FLAKY 0 · BLOCKED 0 · NOT TESTED 0 |
| Prioridad P1 | PASS 55 · FAIL 1 · FLAKY 0 · BLOCKED 0 · NOT TESTED 0 |
| Prioridad P2 | PASS 25 · FAIL 4 · FLAKY 0 · BLOCKED 0 · NOT TESTED 0 |
| Prioridad P3 | PASS 2 · FAIL 1 · FLAKY 0 · BLOCKED 0 · NOT TESTED 0 |

### Notas
- **PUB-016** pasa (contenido «no encontrado» + `noindex`), pero registra HTTP 200 en la anotación `http-status`: hallazgo SAL-BUG-07 (LOW, soft 404).
- **BLOCKED = 0 en la corrida final.** Las pruebas que dependen del catálogo cacheado (configurador UI, detalle de experiencia) esperan a que la caché compartida `.next-e2e/cache` sirva datos de esta base y, si no ocurre en 75 s, quedan BLOCKED por ENVIRONMENT ISSUE (ver `sales.md` §Infraestructura). En la corrida completa nº 2 (antes de esta protección) PUB-003/015/020/021 fallaron por esa causa (422 de `/api/analytics/track`).
- Historial de inestabilidad corregida (TEST BUG, no de la app): CONF-005 y CONF-018 contaban `db.lead.count()` global y otros workers creaban leads en paralelo (corrida nº 1); AI-001 leía el cuerpo de la respuesta del navegador cuando Chromium ya lo había descartado (corrida nº 3). Corregidos y estables en la corrida final.
- Webhooks (PAY-009…013): el actor es el proveedor de pagos (aparece como «Anónimo» porque no hay sesión).
- No se ejecutó cross-browser (Firefox/WebKit) en este carril: lo corre el carril 0 sobre `@P0`.
