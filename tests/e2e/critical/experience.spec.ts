/**
 * Recorridos críticos de EXPERIENCIA (P0): portal de la anfitriona → invitada → RSVP,
 * y Memory Capsule (mensaje + foto de invitada → moderación → visible al público).
 * La anfitriona y las invitadas usan el celular (@mobile); la fundadora, el panel de escritorio.
 */
import { createBookedEvent, createCapsule, expect, makePng, test, uniq } from "./_helpers";

test.describe("Recorridos críticos · experiencia", { tag: ["@critical"] }, () => {
  test(
    "[CRIT-004] la anfitriona agrega una invitada en su portal → la invitada confirma RSVP → admin y portal ven la confirmación",
    { tag: ["@P0", "@module:guests", "@mobile"] },
    async ({ page, anonPage, deskPage, db, evidence }) => {
      evidence("clienta", "Portal /mi-evento/[token] → Agregar invitada; invitada /e/[slug]/[token] → ¡Sí, ahí estaré!; owner en Invitadas");
      const { event } = await createBookedEvent(db, { status: "CONFIRMED" });
      const guestName = `Camila ${uniq("Inv")}`;

      // --- Anfitriona (celular) agrega a su invitada ---
      await page.goto(`/mi-evento/${event.portalToken}`);
      await expect(page.getByRole("heading", { level: 1, name: event.title })).toBeVisible();
      await page.getByRole("button", { name: "Agregar invitada" }).filter({ visible: true }).first().click();
      const dialog = page.getByRole("dialog", { name: "Agregar invitada" });
      await dialog.getByLabel("Nombre").fill(guestName);
      await dialog.getByRole("button", { name: "Agregar", exact: true }).click();
      await expect(page.getByText(`Agregamos a ${guestName} a tu lista`)).toBeVisible();
      await dialog.getByRole("button", { name: "Listo" }).click();

      const guest = await db.eventGuest.findFirst({ where: { eventId: event.id, name: guestName } });
      expect(guest, "invitada creada en la base").not.toBeNull();
      expect(guest!.source).toBe("HOST");
      expect(guest!.rsvpStatus).toBe("PENDING");
      const list = page.getByRole("list", { name: "Lista de invitadas" });
      await expect(list.getByRole("listitem").filter({ hasText: guestName })).toContainText("Pendiente");

      // --- Invitada (su propio celular) responde con su link personal ---
      const invitee = await anonPage();
      await invitee.goto(`/e/${event.micrositeSlug}/${guest!.token}`);
      await expect(invitee.getByLabel("Tu nombre")).toHaveValue(guestName);
      await invitee.getByText("¡Sí, ahí estaré!").click();
      await invitee.getByRole("button", { name: "Enviar mi respuesta" }).click();
      const confirmation = invitee.getByRole("heading", { name: `¡Gracias, ${guestName.split(" ")[0]}! Te esperamos` });
      // TRV-BUG-01: la respuesta se guarda pero la confirmación a veces no aparece (el form sigue sin cambios).
      // Soft: la prueba FALLA si no aparece, pero sigue validando base, admin y portal.
      await expect.soft(confirmation, "la invitada ve la confirmación tras enviar").toBeVisible();
      if (!(await confirmation.isVisible())) {
        test.info().annotations.push({
          type: "bug",
          description: "TRV-BUG-01 — RSVP guardado sin confirmación visible para la invitada (formulario sin cambios)",
        });
      }

      await expect
        .poll(async () => (await db.eventGuest.findUnique({ where: { id: guest!.id } }))?.rsvpStatus)
        .toBe("ATTENDING");
      const answered = await db.eventGuest.findUnique({ where: { id: guest!.id } });
      expect(answered!.respondedAt).not.toBeNull();
      expect(await db.eventGuest.count({ where: { eventId: event.id } }), "sin duplicados").toBe(1);

      // Persiste al recargar el link personal
      await invitee.reload();
      await expect(invitee.getByRole("heading", { name: /Te esperamos/ })).toBeVisible();

      // --- La fundadora lo ve en Invitadas y RSVP ---
      const owner = await deskPage("owner");
      await owner.goto(`/admin/events/${event.id}/guests`);
      await expect(owner.getByRole("heading", { name: "Invitadas y RSVP" })).toBeVisible();
      await expect(owner.getByRole("row").filter({ hasText: guestName })).toContainText("Asiste");

      // --- La anfitriona lo ve en su portal ---
      await page.reload();
      await expect(list.getByRole("listitem").filter({ hasText: guestName })).toContainText("Asiste");
    },
  );

  test(
    "[CRIT-008] Memory Capsule: la invitada deja mensaje y foto → la fundadora aprueba la foto → visible públicamente",
    { tag: ["@P0", "@module:memory", "@mobile"] },
    async ({ page, deskPage, db, evidence }) => {
      evidence("invitada", "/memory/[token] → Dejar mi mensaje + subir foto; owner aprueba en Memory; público la ve");
      const { event } = await createBookedEvent(db, { status: "COMPLETED", daysFromToday: -6, balancePaid: true });
      const capsule = await createCapsule(db, event.id);
      const author = `Lucía ${uniq("Mem")}`;
      const body = `Qué mañana tan bonita, gracias por todo ${uniq("txt")}`;

      await page.goto(`/memory/${capsule.shareToken}`);
      await expect(page.getByRole("heading", { level: 1, name: capsule.title })).toBeVisible();

      // Mensaje en el libro de visitas (visible de inmediato; el equipo puede ocultarlo)
      const guestbook = page.getByRole("form", { name: "Dejar un mensaje en el libro de visitas" });
      await guestbook.getByRole("textbox", { name: /^Tu nombre/ }).fill(author);
      await guestbook.getByLabel("Tu mensaje").fill(body);
      await guestbook.getByRole("button", { name: "Dejar mi mensaje" }).click();
      await expect(page.getByText("¡Gracias por tu mensaje!", { exact: false })).toBeVisible();
      await expect
        .poll(() => db.eventMessage.count({ where: { eventId: event.id, kind: "GUESTBOOK", authorName: author, body, hidden: false } }))
        .toBe(1);

      // Foto: queda privada y pendiente de revisión
      const upload = page.getByRole("region", { name: "¿Tienes fotos del día?" });
      await upload.getByRole("textbox", { name: /^Tu nombre/ }).fill(author);
      await upload.getByRole("checkbox", { name: /Confirmo que tengo permiso/ }).click();
      await upload.getByLabel("Elige tus fotos").setInputFiles({ name: "recuerdo.png", mimeType: "image/png", buffer: makePng(32) });
      await expect(upload.getByText("¡Gracias! La revisaremos antes de publicarla.")).toBeVisible();
      const media = await db.mediaAsset.findFirst({ where: { memoryCapsuleId: capsule.id } });
      expect(media, "foto registrada").not.toBeNull();
      expect(media!.approved, "pendiente de moderación").toBe(false);
      expect(media!.visibility).toBe("PRIVATE");
      expect(media!.uploaderName).toBe(author);
      expect(media!.mimeType).toBe("image/png");

      // Antes de moderar: el público ve el mensaje pero NO la foto
      await page.reload();
      await expect(page.getByText(body)).toBeVisible();
      await expect(page.getByRole("list", { name: `Fotos de ${capsule.title}` })).toHaveCount(0);

      // --- La fundadora aprueba la foto ---
      const owner = await deskPage("owner");
      await owner.goto(`/admin/events/${event.id}/memory`);
      await owner.getByRole("button", { name: /^Aprobar: / }).first().click();
      await expect(owner.getByText("Foto aprobada")).toBeVisible();
      await expect.poll(async () => (await db.mediaAsset.findUnique({ where: { id: media!.id } }))?.approved).toBe(true);

      // --- Visible públicamente ---
      await page.reload();
      const gallery = page.getByRole("list", { name: `Fotos de ${capsule.title}` });
      await expect(gallery.getByRole("listitem")).toHaveCount(1);
      await expect(gallery.getByRole("button", { name: new RegExp(`^Ver foto 1 de 1: .*${author}`) })).toBeVisible();
      // La <img> va dentro de un botón (hijos presentacionales en ARIA): se ubica por etiqueta.
      const img = gallery.locator("img").first();
      await expect(img).toBeVisible();
      await expect(img).toHaveAttribute("alt", new RegExp(author));
      await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth), { message: "la foto carga" }).toBeGreaterThan(0);
    },
  );
});
