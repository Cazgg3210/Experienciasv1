/**
 * Recorridos críticos de OPERACIÓN y DINERO (P0): asignación de staff → portal staff → checklist,
 * pago manual del saldo con auditoría, y cierre del evento con costos → finanzas.
 */
import {
  createBookedEvent,
  createChecklistItem,
  createStaffUser,
  expect,
  expectNotification,
  loginViaUi,
  moneyRx,
  test,
  uniq,
} from "./_helpers";

test.describe("Recorridos críticos · operación y finanzas", { tag: ["@critical"] }, () => {
  test(
    "[CRIT-005] la fundadora asigna staff → el staff entra y ve SÓLO ese evento → marca su tarea → la fundadora la ve hecha",
    { tag: ["@P0", "@module:staff", "@mobile"] },
    async ({ page, deskPage, db, guard, evidence }) => {
      // Esperado: el evento ajeno responde "no encontrado" (el navegador registra el 404 en consola).
      guard.allow(/status of 404/);
      evidence("owner", "Operación del evento → Asignar staff; staff nuevo inicia sesión en /staff → Marcar como hecha");
      const { event } = await createBookedEvent(db, { status: "CONFIRMED" });
      const other = await createBookedEvent(db, { status: "CONFIRMED" }); // evento NO asignado (control IDOR)
      const staff = await createStaffUser(db);
      const task = await createChecklistItem(db, event.id, { title: `Montar mesa ${uniq("T")}`, assigneeId: staff.member.id });

      // --- Fundadora asigna al integrante ---
      const owner = await deskPage("owner");
      await owner.goto(`/admin/events/${event.id}/operations`);
      await owner.getByRole("button", { name: "Asignar staff" }).click();
      const dialog = owner.getByRole("dialog", { name: "Asignar staff" });
      await dialog.getByLabel("Integrante").selectOption(staff.member.id);
      await dialog.getByRole("button", { name: "Asignar", exact: true }).click();
      await expect(owner.getByText("Staff asignado y notificado")).toBeVisible();
      const assignment = await db.staffAssignment.findFirst({ where: { eventId: event.id, staffMemberId: staff.member.id } });
      expect(assignment, "asignación persistida").not.toBeNull();
      expect(await db.auditLog.count({ where: { action: "staff_assignment.created", entityId: assignment!.id } })).toBe(1);
      await expectNotification(
        db,
        { eventId: event.id, type: "STAFF_ASSIGNED", to: staff.email },
        "aviso STAFF_ASSIGNED al integrante",
      );
      const notice = await db.notificationLog.findFirst({ where: { eventId: event.id, type: "STAFF_ASSIGNED", to: staff.email } });
      expect(`${notice!.actionUrl ?? ""} ${notice!.body}`, "el aviso apunta a la ruta real del portal staff").toContain(
        `/staff/events/${event.id}`,
      );

      // --- Staff inicia sesión (celular) y ve SÓLO su evento ---
      await loginViaUi(page, staff.email, staff.password, /^\/staff/);
      await expect(page.getByRole("heading", { level: 1, name: "Mis próximos eventos" })).toBeVisible();
      const eventLinks = page.getByRole("main").getByRole("link").filter({ hasText: /./ });
      await expect(page.getByRole("link", { name: new RegExp(event.title) })).toBeVisible();
      await expect(page.getByRole("link", { name: new RegExp(other.event.title) })).toHaveCount(0);
      await expect(page.getByText("Cumpleaños de Sofía")).toHaveCount(0);
      // Sólo un evento en su lista (enlaces a /staff/events/…)
      await expect.poll(async () => {
        const hrefs = await eventLinks.evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
        return [...new Set(hrefs.filter((h) => h.startsWith("/staff/events/")))];
      }).toEqual([`/staff/events/${event.id}`]);

      // Barreras: evento ajeno ⇒ no encontrado; /admin ⇒ /staff
      const foreign = await page.goto(`/staff/events/${other.event.id}`);
      // El contenido es la barrera (con loading.tsx Next puede responder 200 al hacer streaming de notFound()).
      await expect(page.getByText("No encontramos este evento")).toBeVisible();
      await expect(page.getByText(other.event.title)).toHaveCount(0);
      test.info().annotations.push({ type: "status evento ajeno", description: String(foreign?.status()) });
      await page.goto("/admin/events");
      await expect(page).toHaveURL(/\/staff$/);

      // --- Marca su tarea ---
      await page.goto(`/staff/events/${event.id}`);
      await expect(page.getByRole("heading", { level: 1, name: event.title })).toBeVisible();
      const item = page.getByRole("listitem").filter({ hasText: task.title });
      await item.getByRole("button", { name: "Marcar como hecha" }).click();
      await expect(page.getByText("¡Tarea hecha!")).toBeVisible();
      await expect.poll(async () => (await db.eventChecklistItem.findUnique({ where: { id: task.id } }))?.status).toBe("DONE");
      const done = await db.eventChecklistItem.findUnique({ where: { id: task.id } });
      expect(done!.completedById).toBe(staff.user.id);
      expect(done!.completedAt).not.toBeNull();

      // --- La fundadora la ve hecha ---
      await owner.reload();
      await expect(owner.getByRole("combobox", { name: `Estado de la tarea ${task.title}` })).toHaveValue("DONE");
    },
  );

  test(
    "[CRIT-006] pago manual del saldo (fundadora) → saldo en cero, auditoría, notificación y portal liquidado",
    { tag: ["@P0", "@module:payments"] },
    async ({ page, deskPage, db, evidence }) => {
      evidence("owner", "Evento → Pagos → Registrar pago manual (saldo por transferencia)");
      const { event, booking, total, deposit } = await createBookedEvent(db, { status: "CONFIRMED", depositPaid: true });
      const balance = total - deposit;
      const note = `SPEI ${uniq("ref")}`;

      const owner = await deskPage("owner");
      await owner.goto(`/admin/events/${event.id}`);
      const pagos = owner.getByRole("region", { name: "Pagos" });
      await expect(pagos.getByText(moneyRx(balance)).first()).toBeVisible();
      await pagos.getByRole("button", { name: "Registrar pago manual" }).click();
      const dialog = owner.getByRole("dialog", { name: "Registrar pago manual" });
      await expect(dialog.getByLabel("Monto")).toHaveValue(String(balance / 100));
      await expect(dialog.getByLabel("Concepto")).toHaveValue("BALANCE");
      await dialog.getByLabel("Notas").fill(note);
      await dialog.getByRole("button", { name: "Registrar pago" }).click();
      await expect(owner.getByText("Pago registrado", { exact: true })).toBeVisible();

      const payment = await db.payment.findFirst({ where: { bookingId: booking.id, kind: "BALANCE" } });
      expect(payment?.status).toBe("PAID");
      expect(payment?.amountCents).toBe(balance);
      expect(payment?.provider).toBe("manual");
      expect(payment?.method).toBe("TRANSFER");
      expect(payment?.notes).toBe(note);
      const ownerUser = await db.user.findFirst({ where: { role: "OWNER", email: { contains: "ivonne" } } });
      expect(payment?.recordedById).toBe(ownerUser?.id);
      const audit = await db.auditLog.findFirst({ where: { action: "payment.manual_recorded", entityId: payment!.id } });
      expect(audit, "auditoría del pago manual").not.toBeNull();
      expect(audit!.actorId).toBe(ownerUser?.id);
      expect((audit!.after as { amountCents?: number }).amountCents).toBe(balance);
      await expectNotification(db, { eventId: event.id, type: "PAYMENT_RECEIVED" }, "comprobante a la clienta");
      const paidSum = (await db.payment.findMany({ where: { bookingId: booking.id, status: "PAID" } })).reduce(
        (s, p) => s + p.amountCents,
        0,
      );
      expect(paidSum, "lo cobrado = total").toBe(total);

      // Panel: saldo pendiente en cero y ya no se ofrece registrar otro pago
      await owner.reload();
      await expect(pagos.getByRole("button", { name: "Registrar pago manual" })).toHaveCount(0);
      // StatCard: etiqueta y valor son hermanos dentro de la tarjeta (sin rol propio) → subir dos niveles.
      await expect(pagos.getByText("Saldo pendiente", { exact: true }).locator("xpath=../..")).toContainText(moneyRx(0));

      // Portal de la clienta refleja la liquidación
      await page.goto(`/mi-evento/${event.portalToken}`);
      const pago = page.getByRole("region", { name: "Pago" });
      await expect(pago.getByRole("definition").nth(1)).toHaveText(moneyRx(total));
      await expect(pago.getByRole("definition").nth(2)).toHaveText(moneyRx(0));
      await expect(pago.getByText("¡Tu celebración está liquidada! Gracias.")).toBeVisible();
    },
  );

  test(
    "[CRIT-007] cierre del evento con costos reales → snapshot congelado y finanzas con margen correcto",
    { tag: ["@P0", "@module:finance"] },
    async ({ deskPage, db, evidence }) => {
      evidence("owner", "Evento completado → Finanzas: Agregar costo ×2 → Cerrar evento → /admin/finance");
      // Venta $23,200 IVA incluido ($3,200 IVA) ⇒ ingreso neto $20,000; liquidado; sin comisiones (pagos manuales).
      const { event } = await createBookedEvent(db, {
        status: "COMPLETED",
        daysFromToday: -10,
        totalCents: 2_320_000,
        taxCents: 320_000,
        estimatedCostCents: 900_000,
        depositPaid: true,
        balancePaid: true,
      });
      const costs = [
        { category: "Alimentos", code: "FOOD", description: `Mercado ${uniq("c")}`, pesos: "5000", cents: 500_000 },
        { category: "Flores", code: "FLOWERS", description: `Flores ${uniq("c")}`, pesos: "2,000.00", cents: 200_000 },
      ];

      const owner = await deskPage("owner");
      await owner.goto(`/admin/events/${event.id}/financials`);
      for (const c of costs) {
        await owner.getByRole("button", { name: "Agregar costo" }).click();
        const dialog = owner.getByRole("dialog", { name: "Registrar costo manual" });
        await dialog.getByRole("combobox", { name: "Categoría" }).click();
        await owner.getByRole("option", { name: c.category, exact: true }).click();
        await dialog.getByLabel("Descripción").fill(c.description);
        await dialog.getByLabel("Monto (MXN)").fill(c.pesos);
        await dialog.getByRole("button", { name: "Registrar costo" }).click();
        await expect(dialog).toBeHidden();
        await expect.poll(() => db.eventCost.count({ where: { eventId: event.id, description: c.description } })).toBe(1);
      }
      const saved = await db.eventCost.findMany({ where: { eventId: event.id }, orderBy: { createdAt: "asc" } });
      expect(saved.map((c) => [c.category, c.amountCents])).toEqual(costs.map((c) => [c.code, c.cents]));
      expect(await db.auditLog.count({ where: { action: "cost.created", entityId: { in: saved.map((c) => c.id) } } })).toBe(2);

      // Cerrar el evento
      await owner.getByRole("button", { name: "Cerrar evento" }).click();
      await owner.getByRole("alertdialog").getByRole("button", { name: "Cerrar evento" }).click();
      await expect(owner.getByText("Evento cerrado. Enviamos el agradecimiento a la clienta.")).toBeVisible();

      const closed = await db.event.findUnique({ where: { id: event.id } });
      expect(closed!.closedAt).not.toBeNull();
      const snap = closed!.closingSnapshot as {
        revenue: { totalCents: number; taxCents: number; netRevenueCents: number; paidCents: number; balanceCents: number };
        actual: { extraCostsCents: number; paymentFeesCents: number; totalCostCents: number; marginCents: number; marginBps: number };
        costsByCategory: Record<string, number>;
      };
      expect(snap.revenue.totalCents).toBe(2_320_000);
      expect(snap.revenue.netRevenueCents, "ingreso neto = venta − IVA").toBe(2_000_000);
      expect(snap.revenue.paidCents).toBe(2_320_000);
      expect(snap.revenue.balanceCents).toBe(0);
      expect(snap.actual.extraCostsCents).toBe(700_000);
      expect(snap.actual.totalCostCents, "costo real = costos manuales").toBe(700_000);
      expect(snap.actual.marginCents).toBe(1_300_000);
      expect(snap.actual.marginBps, "margen real 65%").toBe(6_500);
      expect(snap.costsByCategory.FOOD).toBe(500_000);
      expect(snap.costsByCategory.FLOWERS).toBe(200_000);
      expect(await db.auditLog.count({ where: { action: "event.closed", entityId: event.id } })).toBe(1);
      await expectNotification(db, { eventId: event.id, type: "POST_EVENT" }, "agradecimiento post-evento");

      // Ya no se puede volver a cerrar ni agregar costos
      await owner.reload();
      await expect(owner.getByRole("button", { name: "Cerrar evento" })).toHaveCount(0);

      // Finanzas: la fila del evento cerrado muestra costo real y margen 65.0%
      await owner.goto("/admin/finance?status=CLOSED");
      const row = owner.getByRole("row").filter({ hasText: event.title }).filter({ hasText: event.code });
      await expect(row).toContainText("Cerrado");
      await expect(row).toContainText(moneyRx(2_320_000));
      await expect(row).toContainText(moneyRx(700_000));
      await expect(row).toContainText("65.0%");
    },
  );
});
