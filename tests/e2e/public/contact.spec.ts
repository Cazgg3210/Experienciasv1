/**
 * Formulario de contacto (/contacto → submitContactForm → createInboundLead) — paquete 2 "Venta pública".
 */
import { expect, test, uniq, uniqEmail, uniqPhone } from "../fixtures";
import { addDaysKey } from "../quote-public/_helpers";
import { callAction, failure, okData } from "../configurator/_helpers";
import { localDateKey } from "../../../src/lib/dates";
import type { Page } from "@playwright/test";

type ContactInput = { name: string; phone: string; email: string; occasion?: string; date?: string; message: string; consent?: boolean };

async function fillContactForm(page: Page, d: ContactInput) {
  const form = page.getByRole("form", { name: "Escríbenos" });
  await form.getByRole("textbox", { name: "Nombre", exact: true }).fill(d.name);
  await form.getByLabel("WhatsApp o teléfono").fill(d.phone);
  await form.getByLabel("Correo electrónico").fill(d.email);
  if (d.occasion) await form.getByLabel("¿Qué quieres celebrar?").selectOption({ label: d.occasion });
  if (d.date) await form.getByLabel("Fecha tentativa").fill(d.date);
  await form.getByLabel("Mensaje").fill(d.message);
  if (d.consent !== false) {
    // Con teclado: al perder el foco el campo anterior pinta su error (onTouched) y desplaza el layout;
    // un clic por coordenadas podría caer en el enlace "aviso de privacidad" del label.
    const consent = form.getByRole("checkbox", { name: /Acepto el aviso de privacidad/ });
    await consent.focus();
    await page.keyboard.press("Space");
    await expect(consent).toBeChecked();
  }
  return form;
}

async function openContact(page: Page) {
  await page.goto("/contacto");
  // El botón se habilita al hidratar (evita un envío nativo que perdería lo escrito).
  await expect(page.getByRole("button", { name: "Enviar mensaje" })).toBeEnabled();
}

const validPayload = () => ({
  name: `Contacto ${uniq("Api")}`,
  phone: uniqPhone(),
  email: uniqEmail("contacto"),
  occasion: "BIRTHDAY",
  eventDate: "",
  message: "Queremos un brunch para 8 amigas en Polanco.",
  consent: true,
  website: "",
});

test.describe("Contacto", { tag: ["@module:public"] }, () => {
  test(
    "[PUB-040] enviar el formulario crea lead CONTACT_FORM + clienta + avisos y la fundadora lo ve en /admin/leads",
    { tag: ["@P0", "@critical", "@smoke", "@mobile"] },
    async ({ page, db, rolePage, evidence }) => {
      evidence("anonimo", "Formulario de /contacto completo; owner revisa /admin/leads");
      const name = `Mariana ${uniq("Contacto")}`;
      const phone = uniqPhone();
      const email = uniqEmail("contacto");
      const date = addDaysKey(localDateKey(), 30);
      await openContact(page);
      const form = await fillContactForm(page, {
        name,
        phone: `${phone.slice(0, 2)} ${phone.slice(2, 6)} ${phone.slice(6)}`,
        email,
        occasion: "Baby brunch",
        date,
        message: "Somos 10 y nos gustaría algo con flores silvestres.",
      });
      await form.getByRole("button", { name: "Enviar mensaje" }).click();
      const done = page.getByRole("status").filter({ hasText: "Recibimos tu mensaje" });
      await expect(done.getByRole("heading", { name: `¡Gracias, ${name.split(" ")[0]}!` })).toBeVisible();

      const lead = await db.lead.findFirstOrThrow({ where: { email }, include: { activities: true } });
      await expect(done).toContainText(lead.code);
      expect(lead).toMatchObject({
        source: "CONTACT_FORM",
        status: "NEW",
        name,
        occasion: "BABY_BRUNCH",
        notes: "Somos 10 y nos gustaría algo con flores silvestres.",
      });
      expect(lead.phone?.replace(/\D/g, "")).toContain(phone);
      expect(lead.eventDate?.toISOString().slice(0, 10)).toBe(date);
      const customer = await db.customer.findUniqueOrThrow({ where: { id: lead.customerId! } });
      expect(customer).toMatchObject({ name, email, source: "CONTACT_FORM" });
      expect(lead.activities).toHaveLength(1);
      expect(lead.activities[0]).toMatchObject({ type: "CREATED", toStatus: "NEW" });
      await expect
        .poll(() => db.notificationLog.findMany({ where: { leadId: lead.id, type: "LEAD_RECEIVED" }, select: { channel: true, to: true } }))
        .toEqual(expect.arrayContaining([expect.objectContaining({ channel: "EMAIL", to: email }), expect.objectContaining({ channel: "WHATSAPP" })]));
      expect(await db.notificationLog.count({ where: { leadId: lead.id, type: "GENERIC" } })).toBe(1);
      expect(await db.analyticsEvent.count({ where: { type: "SUBMIT_LEAD", leadId: lead.id } })).toBe(1);

      const owner = await rolePage("owner");
      await owner.goto(`/admin/leads?q=${encodeURIComponent(name)}`);
      await owner.getByRole("link", { name }).first().click();
      await expect(owner.getByRole("heading", { level: 1, name })).toBeVisible();
      await expect(owner.getByText(lead.code)).toBeVisible();
      await expect(owner.getByText("Formulario de contacto").first()).toBeVisible();
    },
  );

  test(
    "[PUB-041] enviar vacío muestra todos los errores por campo y no crea nada",
    { tag: ["@P1", "@negative"] },
    async ({ page, db, evidence }) => {
      evidence("anonimo", "Enviar mensaje sin datos");
      await openContact(page);
      const actions: string[] = [];
      page.on("request", (r) => {
        if (r.method() === "POST" && r.headers()["next-action"]) actions.push(r.url());
      });
      await page.getByRole("button", { name: "Enviar mensaje" }).click();
      const form = page.getByRole("form", { name: "Escríbenos" });
      for (const msg of [
        "Escribe tu nombre",
        "Escribe tu WhatsApp o teléfono",
        "Escribe tu correo",
        "Elige qué quieres celebrar",
        "Cuéntanos un poco más (mínimo 10 caracteres)",
        "Necesitamos tu autorización para contactarte",
      ]) {
        await expect(form.getByText(msg, { exact: true })).toBeVisible();
      }
      await expect(form.getByRole("textbox", { name: "Nombre", exact: true })).toHaveAttribute("aria-invalid", "true");
      expect(actions, "la validación del navegador no debe llamar al servidor").toEqual([]);
      expect(await db.lead.count({ where: { source: "CONTACT_FORM", name: "" } })).toBe(0);
    },
  );

  test(
    "[PUB-042] formatos inválidos (teléfono, correo, mensaje corto, fecha pasada) se rechazan en el navegador",
    { tag: ["@P1", "@negative"] },
    async ({ page, db, evidence }) => {
      evidence("anonimo", "Datos con formato inválido");
      await openContact(page);
      const actions: string[] = [];
      page.on("request", (r) => {
        if (r.method() === "POST" && r.headers()["next-action"]) actions.push(r.url());
      });
      const form = await fillContactForm(page, {
        name: "Ana Pérez",
        phone: "tel: abc",
        email: "ana@",
        occasion: "Cumpleaños",
        date: "2020-01-15",
        message: "corto",
      });
      await form.getByRole("button", { name: "Enviar mensaje" }).click();
      await expect(form.getByText("Usa sólo números (puedes incluir +, espacios o guiones)")).toBeVisible();
      await expect(form.getByText("Revisa tu correo")).toBeVisible();
      await expect(form.getByText("Cuéntanos un poco más (mínimo 10 caracteres)")).toBeVisible();
      await expect(form.getByText("Elige una fecha a partir de hoy")).toBeVisible();
      await form.getByLabel("WhatsApp o teléfono").fill("55 12");
      await form.getByRole("button", { name: "Enviar mensaje" }).click();
      await expect(form.getByText("Escribe un número de 10 dígitos (con lada)")).toBeVisible();
      expect(actions, "la validación del navegador no debe llamar al servidor").toEqual([]);
      expect(await db.lead.count({ where: { email: "ana@" } })).toBe(0);
    },
  );

  test(
    "[PUB-043] el backend valida aunque se salte el navegador (sin consentimiento, correo, teléfono, fecha pasada, campos gigantes)",
    { tag: ["@P1", "@negative"] },
    async ({ db, request, baseURL, evidence }) => {
      evidence("anonimo", "submitContactForm por HTTP con payloads manipulados");
      const names: string[] = [];
      const cases: Array<[string, Record<string, unknown>, string]> = [
        ["sin consentimiento", { consent: false }, "consent"],
        ["correo inválido", { email: "no-es-correo" }, "email"],
        ["teléfono con letras", { phone: "55-ABC-1234" }, "phone"],
        ["fecha pasada", { eventDate: "2020-01-01" }, "eventDate"],
        ["fecha imposible", { eventDate: "2026-02-31" }, "eventDate"],
        ["ocasión inventada", { occasion: "FUNERAL" }, "occasion"],
        ["mensaje enorme", { message: "x".repeat(2001) }, "message"],
        ["nombre enorme", { name: "N".repeat(121) }, "name"],
      ];
      for (const [label, patch, field] of cases) {
        const payload = { ...validPayload(), ...patch };
        names.push(String(payload.name));
        const res = failure(await callAction(request, baseURL!, "submitContactForm", payload, "/contacto"));
        expect(res.code, label).toBe("VALIDATION_ERROR");
        expect(Object.keys(res.fieldErrors ?? {}), label).toContain(field);
      }
      expect(await db.lead.count({ where: { name: { in: names } } })).toBe(0);
    },
  );

  test(
    "[PUB-044] doble clic en «Enviar mensaje» crea un solo lead",
    { tag: ["@P1", "@negative"] },
    async ({ page, db, evidence }) => {
      evidence("anonimo", "Doble clic al enviar");
      const email = uniqEmail("doble");
      await openContact(page);
      const form = await fillContactForm(page, { name: `Doble ${uniq("Envio")}`, phone: uniqPhone(), email, occasion: "Reunión", message: "Mensaje de prueba de doble envío." });
      await form.getByRole("button", { name: "Enviar mensaje" }).dblclick();
      await expect(page.getByRole("heading", { name: /^¡Gracias, Doble!/ })).toBeVisible();
      await expect.poll(() => db.lead.count({ where: { email } })).toBe(1);
      expect(await db.customer.count({ where: { email } })).toBe(1);
    },
  );

  test(
    "[PUB-045] honeypot lleno: respuesta de éxito para el bot pero no se crea lead ni clienta",
    { tag: ["@P2", "@negative"] },
    async ({ db, request, baseURL, evidence }) => {
      evidence("anonimo", "Bot que llena el campo oculto «website»");
      const p = { ...validPayload(), website: "http://spam.example" };
      const data = okData(await callAction<{ code: string }>(request, baseURL!, "submitContactForm", p, "/contacto"));
      expect(data.code).toMatch(/^L-/);
      expect(await db.lead.count({ where: { code: data.code } })).toBe(0);
      expect(await db.customer.count({ where: { email: p.email } })).toBe(0);
    },
  );

  test(
    "[PUB-046] la misma clienta (mismo correo) que escribe dos veces conserva un solo registro de clienta",
    { tag: ["@P2"] },
    async ({ db, request, baseURL, evidence }) => {
      evidence("anonimo", "Dos mensajes con el mismo correo");
      const p = validPayload();
      const a = okData(await callAction<{ code: string }>(request, baseURL!, "submitContactForm", p, "/contacto"));
      const b = okData(
        await callAction<{ code: string }>(request, baseURL!, "submitContactForm", { ...p, email: p.email.toUpperCase(), message: "Segundo mensaje, otra fecha." }, "/contacto"),
      );
      expect(a.code).not.toBe(b.code);
      const leads = await db.lead.findMany({ where: { code: { in: [a.code, b.code] } } });
      expect(leads).toHaveLength(2);
      expect(new Set(leads.map((l) => l.customerId)).size).toBe(1);
      expect(await db.customer.count({ where: { email: p.email } })).toBe(1);
    },
  );

  test(
    "[PUB-047] texto con HTML/script se muestra escapado en la confirmación y en el panel (sin ejecutar)",
    { tag: ["@P2", "@negative"] },
    async ({ page, db, rolePage, evidence }) => {
      evidence("anonimo", "Nombre y mensaje con <img onerror> / <script>");
      let dialogs = 0;
      const email = uniqEmail("xss");
      const evil = `<img src=x onerror=alert(1)> ${uniq("Xss")}`;
      await openContact(page);
      page.on("dialog", (d) => {
        dialogs++;
        void d.dismiss();
      });
      const form = await fillContactForm(page, { name: evil, phone: uniqPhone(), email, occasion: "Otra celebración", message: "<script>alert('x')</script> hola equipo" });
      await form.getByRole("button", { name: "Enviar mensaje" }).click();
      await expect(page.getByRole("heading", { name: "¡Gracias, <img!" })).toBeVisible();
      const lead = await db.lead.findFirstOrThrow({ where: { email } });
      expect(lead.name).toBe(evil);
      const owner = await rolePage("owner");
      owner.on("dialog", (d) => {
        dialogs++;
        void d.dismiss();
      });
      await owner.goto(`/admin/leads/${lead.id}`);
      await expect(owner.getByRole("heading", { level: 1, name: evil })).toBeVisible();
      await expect(owner.getByText("<script>alert('x')</script> hola equipo")).toBeVisible();
      expect(dialogs, "ningún script inyectado se ejecutó").toBe(0);
    },
  );
});
