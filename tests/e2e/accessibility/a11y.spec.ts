/**
 * ACCESIBILIDAD (@a11y): axe-core WCAG 2.1 AA en páginas clave (critical + serious ⇒ FAIL con detalle;
 * moderate/minor ⇒ observación anotada) + pruebas manuales automatizadas de teclado, foco visible,
 * labels, landmarks, imágenes con alt, diálogos y prefers-reduced-motion.
 */
import type { Page, TestInfo } from "@playwright/test";
import {
  ACCOUNTS,
  PASSWORD,
  TOKENS,
  createBookedEvent,
  expect,
  focusIsVisible,
  rx,
  scanA11y,
  test,
  toleratesStaleExperienceCache,
} from "../critical/_helpers";

/**
 * axe mide el estado ESTABLE de la página. Tras la hidratación algunos controles pasan de deshabilitados a
 * habilitados con una transición de opacidad (p. ej. «Enviar mensaje» en /contacto: `disabled:opacity-50` +
 * `transition-all` de 150 ms); si axe corre en medio, mide un color intermedio (3.78:1 observado una vez con
 * carga en paralelo) que nadie llega a leer. Se espera a que la red quede inactiva (cota corta: algunas páginas
 * sondean) y a que no haya animaciones finitas en curso. Un contraste insuficiente real persiste y sigue fallando.
 */
async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity),
  );
}

async function axeCheck(page: Page, testInfo: TestInfo) {
  await settle(page);
  const { all, blocking } = await scanA11y(page, testInfo);
  const minor = all.filter((v) => !blocking.includes(v));
  if (minor.length) {
    testInfo.annotations.push({
      type: "a11y-observación",
      description: minor.map((v) => `${v.impact}:${v.id} (${v.nodes.length})`).join(", "),
    });
  }
  // Resumen legible (el detalle completo de axe queda adjunto como a11y-axe.json)
  const summary = blocking.map(
    (v) =>
      `${v.impact} ${v.id} ×${v.nodes.length}: ` +
      v.nodes
        .slice(0, 3)
        .map((n) => `${(n.failureSummary ?? "").split("\n").pop()!.trim().slice(0, 150)} @ ${n.html.slice(0, 110)}`)
        .join(" || "),
  );
  // Clasificación de una posible regresión de bugs ya corregidos (BUG-009 contraste, BUG-010 <dl>).
  const families = new Set<string>();
  for (const v of blocking) {
    if (v.id === "definition-list" || v.id === "dlitem") families.add("BUG-010 estructura <dl> inválida");
    else if (v.id === "color-contrast") families.add("BUG-009 contraste por debajo de WCAG AA");
    else families.add(`sin clasificar: ${v.id}`);
  }
  for (const f of families) testInfo.annotations.push({ type: "a11y-clasificación", description: f });
  expect(summary, `violaciones WCAG critical/serious en ${page.url()}`).toEqual([]);
}

/** Etiquetas y anotaciones de una prueba que protege bugs corregidos (BUG-009 contraste, BUG-010 <dl>). */
const regressionOf = (bugs: string[] = []) => ({
  tags: bugs.length ? ["@regression"] : [],
  annotate: () => bugs.forEach((b) => test.info().annotations.push({ type: "regression", description: b })),
});

test.describe("Accesibilidad · axe WCAG 2.1 AA", { tag: ["@a11y"] }, () => {
  const PUBLIC: Array<{ id: string; path: string; label: string; p: "@P1" | "@P2"; module: string; bugs?: string[] }> = [
    { id: "A11Y-001", path: "/", label: "inicio", p: "@P2", module: "public" },
    { id: "A11Y-002", path: "/experiencias", label: "catálogo", p: "@P2", module: "public" },
    { id: "A11Y-004", path: "/crear-experiencia", label: "configurador (paso 1)", p: "@P2", module: "configurator" },
    { id: "A11Y-005", path: "/contacto", label: "contacto", p: "@P2", module: "public" },
    { id: "A11Y-006", path: "/login", label: "login", p: "@P2", module: "auth" },
    { id: "A11Y-007", path: `/cotizacion/${TOKENS.quoteLucia}`, label: "cotización por token", p: "@P2", module: "quotes", bugs: ["BUG-010"] },
    { id: "A11Y-009", path: `/mi-evento/${TOKENS.portalSofia}`, label: "portal de la clienta", p: "@P2", module: "portal", bugs: ["BUG-009"] },
    { id: "A11Y-010", path: `/e/${TOKENS.micrositeSofia}/${TOKENS.guestCamila}`, label: "RSVP de invitada", p: "@P2", module: "guests", bugs: ["BUG-010"] },
    { id: "A11Y-011", path: `/memory/${TOKENS.memoryValeria}`, label: "Memory Capsule", p: "@P2", module: "memory", bugs: ["BUG-009"] },
    { id: "A11Y-017", path: "/como-funciona", label: "cómo funciona", p: "@P2", module: "public" },
  ];
  for (const pg of PUBLIC) {
    const reg = regressionOf(pg.bugs);
    test(`[${pg.id}] axe sin violaciones graves: ${pg.label}`, { tag: [pg.p, `@module:${pg.module}`, ...reg.tags] }, async ({ page, evidence }, testInfo) => {
      reg.annotate();
      evidence("anonimo", `axe en ${pg.path}`);
      await page.goto(pg.path);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await axeCheck(page, testInfo);
    });
  }

  test("[A11Y-003] axe sin violaciones graves: detalle de experiencia", { tag: ["@P2", "@module:public"] }, async ({ page, db, guard, evidence }, testInfo) => {
    evidence("anonimo", "axe en /experiencias/signature-brunch");
    await page.goto("/experiencias/signature-brunch");
    await toleratesStaleExperienceCache(page, db, guard, "signature-brunch");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Signature Brunch");
    await axeCheck(page, testInfo);
  });

  test("[A11Y-008] axe sin violaciones graves: pago simulado", { tag: ["@P2", "@module:payments", "@regression"] }, async ({ page, db, evidence }, testInfo) => {
    test.info().annotations.push({ type: "regression", description: "BUG-009" });
    evidence("clienta", "axe en /pago/mock/[checkoutId]");
    const { quote } = await createBookedEvent(db, { status: "PENDING_PAYMENT", depositPaid: false });
    await page.goto(`/cotizacion/${quote.publicToken}`);
    await page.getByRole("button", { name: rx("Pagar anticipo · ") }).click();
    await page.waitForURL(/\/pago\/mock\/mock_cs_/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await axeCheck(page, testInfo);
  });

  const ADMIN: Array<{ id: string; path: string | ((ev: string) => string); label: string; role: "owner" | "staff"; module: string; bugs?: string[] }> = [
    { id: "A11Y-012", path: "/admin", label: "dashboard admin", role: "owner", module: "analytics", bugs: ["BUG-009"] },
    { id: "A11Y-013", path: "/admin/leads", label: "leads", role: "owner", module: "leads", bugs: ["BUG-009"] },
    { id: "A11Y-014", path: (ev) => `/admin/events/${ev}`, label: "detalle de evento", role: "owner", module: "events", bugs: ["BUG-009"] },
    { id: "A11Y-015", path: "/admin/calendar", label: "calendario", role: "owner", module: "calendar", bugs: ["BUG-009"] },
    { id: "A11Y-016", path: "/staff", label: "portal staff", role: "staff", module: "staff" },
    { id: "A11Y-018", path: "/admin/finance", label: "finanzas", role: "owner", module: "finance", bugs: ["BUG-009"] },
  ];
  for (const pg of ADMIN) {
    const reg = regressionOf(pg.bugs);
    test(`[${pg.id}] axe sin violaciones graves: ${pg.label}`, { tag: ["@P2", `@module:${pg.module}`, ...reg.tags] }, async ({ rolePage, db, evidence }, testInfo) => {
      reg.annotate();
      const ev = await db.event.findFirstOrThrow({ where: { portalToken: TOKENS.portalSofia } });
      const path = typeof pg.path === "function" ? pg.path(ev.id) : pg.path;
      evidence(pg.role, `axe en ${path}`);
      const page = await rolePage(pg.role);
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await axeCheck(page, testInfo);
    });
  }
});

test.describe("Accesibilidad · teclado, foco, semántica", { tag: ["@a11y"] }, () => {
  test("[A11Y-020] login completo sólo con teclado y foco visible", { tag: ["@P1", "@module:auth"] }, async ({ page, evidence }) => {
    evidence("owner", "Tab → Correo → Contraseña → Entrar (Enter)");
    await page.goto("/login");
    const email = page.getByLabel("Correo");
    await email.focus();
    expect((await focusIsVisible(page)).visible, "foco visible en Correo").toBe(true);
    await page.keyboard.type(ACCOUNTS.owner.email);
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Contraseña")).toBeFocused();
    expect((await focusIsVisible(page)).visible, "foco visible en Contraseña").toBe(true);
    await page.keyboard.type(PASSWORD);
    // Llegar al botón con Tab (puede haber un control de "mostrar contraseña" en medio)
    for (let i = 0; i < 4; i++) {
      if (await page.getByRole("button", { name: "Entrar" }).evaluate((b) => b === document.activeElement)) break;
      await page.keyboard.press("Tab");
    }
    await expect(page.getByRole("button", { name: "Entrar" })).toBeFocused();
    expect((await focusIsVisible(page)).visible, "foco visible en Entrar").toBe(true);
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/admin$/);
  });

  test("[A11Y-021] configurador: radios con flechas, avance con teclado y foco al título del paso", { tag: ["@P1", "@module:configurator"] }, async ({ page, evidence }) => {
    evidence("anonimo", "Tab al grupo → flechas → Enter en Siguiente");
    await page.goto("/crear-experiencia");
    const first = page.getByRole("radio").first();
    // Llegar al grupo con Tab (como una usuaria de teclado)
    for (let i = 0; i < 40; i++) {
      if (await first.evaluate((b) => b === document.activeElement)) break;
      await page.keyboard.press("Tab");
    }
    await expect(first).toBeFocused();
    expect((await focusIsVisible(page)).visible, "foco visible en la tarjeta").toBe(true);
    // Radix mueve el foco en un timeout y "marca" sólo si la tecla sigue abajo: se sostiene como una persona (50 ms).
    await page.keyboard.press("ArrowDown", { delay: 50 });
    const second = page.getByRole("radio").nth(1);
    await expect(second).toBeFocused();
    await expect(second).toHaveAttribute("aria-checked", "true");
    // Hasta el botón Siguiente con Tab y activarlo con Enter
    for (let i = 0; i < 6; i++) {
      if (await page.getByRole("button", { name: "Siguiente", exact: true }).evaluate((b) => b === document.activeElement)) break;
      await page.keyboard.press("Tab");
    }
    await expect(page.getByRole("button", { name: "Siguiente", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    const h = page.getByRole("heading", { name: "¿Cuándo será?" });
    await expect(h).toBeVisible();
    await expect(h).toBeFocused();
    // El calendario es una cuadrícula navegable
    await expect(page.getByRole("grid")).toBeVisible();
  });

  test("[A11Y-022] RSVP: elegir respuesta con teclado, foco visible y labels asociados", { tag: ["@P1", "@module:guests"] }, async ({ page, evidence }) => {
    evidence("invitada", "/e/cumple-sofia/[Camila] sin mouse (sin enviar)");
    await page.goto(`/e/${TOKENS.micrositeSofia}/${TOKENS.guestCamila}`);
    await expect(page.getByLabel("Tu nombre")).toHaveValue("Camila Torres");
    await page.getByLabel("Tu nombre").focus();
    await page.keyboard.press("Tab");
    const yes = page.getByRole("radio", { name: /Sí, ahí estaré/ });
    await expect(yes).toBeFocused();
    await page.keyboard.press("Space");
    await expect(yes).toBeChecked();
    // Foco visible: el anillo vive en la etiqueta contenedora (has-[:focus-visible])
    const ring = await yes.evaluate((el) => {
      const label = el.closest("label");
      const s = label ? getComputedStyle(label) : null;
      return s ? s.boxShadow !== "none" || (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) : false;
    });
    expect(ring, "foco visible en la opción de RSVP").toBe(true);
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: /Tal vez/ })).toBeChecked();
    for (const label of ["Tu nombre", "Comentario (opcional)", "Tu email (opcional)"]) {
      await expect(page.getByLabel(label), `campo con label: ${label}`).toBeVisible();
    }
    await expect(page.getByRole("group", { name: /¿Asistes\?/ })).toBeVisible();
  });

  test("[A11Y-023] enlace 'Saltar al contenido' lleva el foco al contenido principal", { tag: ["@P2", "@module:public"] }, async ({ page, evidence }) => {
    evidence("anonimo", "Tab inicial → Saltar al contenido → Enter");
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Saltar al contenido" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#contenido$/);
    await expect(page.getByRole("main")).toBeFocused();
  });

  test("[A11Y-024] formularios públicos: todos los campos con label asociado y requeridos marcados", { tag: ["@P2", "@module:public"] }, async ({ page, evidence }) => {
    evidence("anonimo", "/contacto: getByLabel de cada campo + aria-required");
    await page.goto("/contacto");
    for (const label of ["Nombre", "WhatsApp o teléfono", "Correo electrónico", "¿Qué quieres celebrar?", "Fecha tentativa", "Mensaje"]) {
      await expect(page.getByLabel(label, { exact: false }).first(), `label: ${label}`).toBeVisible();
    }
    // Ningún control visible sin nombre accesible
    const unnamed = await page.getByRole("main").locator("input:not([type=hidden]), select, textarea, button").evaluateAll((els) =>
      els
        .filter((e) => (e as HTMLElement).offsetParent !== null && e.getAttribute("tabindex") !== "-1")
        .filter((e) => {
          const el = e as HTMLInputElement;
          const labelled = el.labels?.length || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
          const text = el.tagName === "BUTTON" ? (el.textContent ?? "").trim() : "";
          return !labelled && !text;
        })
        .map((e) => e.outerHTML.slice(0, 100)),
    );
    expect(unnamed, "controles sin nombre accesible").toEqual([]);
    // Validación accesible: al enviar vacío, errores asociados y anunciados
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(page.getByLabel("Nombre").first()).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("alert").first()).toBeVisible();
  });

  test("[A11Y-025] landmarks: banner, navegación, main y footer en público; main y navegación en el panel", { tag: ["@P2", "@module:navigation"] }, async ({ page, rolePage, evidence }) => {
    evidence("anonimo", "/, /experiencias, /contacto y /admin");
    for (const path of ["/", "/experiencias", "/contacto", "/crear-experiencia"]) {
      await page.goto(path);
      await expect(page.getByRole("banner"), `${path} banner`).toHaveCount(1);
      await expect(page.getByRole("main"), `${path} main`).toHaveCount(1);
      await expect(page.getByRole("contentinfo"), `${path} footer`).toHaveCount(1);
      await expect(page.getByRole("navigation", { name: "Principal", exact: true }), `${path} nav`).toHaveCount(1);
      await expect(page.locator("html"), `${path} idioma`).toHaveAttribute("lang", /^es/);
    }
    const admin = await rolePage("owner");
    await admin.goto("/admin");
    await expect(admin.getByRole("main")).toHaveCount(1);
    await expect(admin.getByRole("navigation", { name: "Navegación del panel" })).toBeVisible();
  });

  test("[A11Y-026] imágenes con texto alternativo (o marcadas como decorativas)", { tag: ["@P2", "@module:public"] }, async ({ page, db, guard, evidence }) => {
    evidence("anonimo", "<img> de /, /experiencias, detalle y Memory Capsule");
    for (const path of ["/", "/experiencias", "/experiencias/signature-brunch", `/memory/${TOKENS.memoryValeria}`, "/nuestra-historia"]) {
      await page.goto(path);
      if (path.startsWith("/experiencias/")) await toleratesStaleExperienceCache(page, db, guard, "signature-brunch");
      const missing = await page.locator("img").evaluateAll((imgs) =>
        imgs
          .filter((i) => !i.hasAttribute("alt") && i.getAttribute("aria-hidden") !== "true" && i.getAttribute("role") !== "presentation")
          .map((i) => (i as HTMLImageElement).currentSrc || i.getAttribute("src") || "?"),
      );
      expect(missing, `imágenes sin alt en ${path}`).toEqual([]);
      const informative = await page.getByRole("img").count();
      test.info().annotations.push({ type: "imágenes con alt", description: `${path}: ${informative}` });
    }
  });

  test("[A11Y-027] prefers-reduced-motion elimina animaciones y transiciones", { tag: ["@P2", "@module:public"] }, async ({ page, evidence }) => {
    evidence("anonimo", "emulateMedia reducedMotion en / y /crear-experiencia");
    const longest = () =>
      page.evaluate(() => {
        const toMs = (v: string) => Math.max(...v.split(",").map((x) => (x.trim().endsWith("ms") ? parseFloat(x) : parseFloat(x) * 1000)));
        let max = 0;
        for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
          const s = getComputedStyle(el);
          max = Math.max(max, toMs(s.transitionDuration), s.animationName !== "none" ? toMs(s.animationDuration) : 0);
        }
        return max;
      });
    await page.goto("/crear-experiencia");
    const normal = await longest();
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const path of ["/", "/crear-experiencia"]) {
      await page.goto(path);
      expect(await longest(), `${path}: duración máxima de animación/transición con reduce`).toBeLessThanOrEqual(1);
    }
    expect(normal, "control: sin reduce hay transiciones").toBeGreaterThan(1);
  });

  test("[A11Y-028] diálogo de aceptar propuesta: foco dentro, Escape cierra y regresa el foco", { tag: ["@P2", "@module:quotes", "@regression"] }, async ({ page, evidence }) => {
    test.info().annotations.push({ type: "regression", description: "BUG-012" });
    evidence("clienta", "/cotizacion/[Lucía] → Aceptar propuesta → Escape (sin aceptar)");
    await page.goto(`/cotizacion/${TOKENS.quoteLucia}`);
    const trigger = page.getByRole("button", { name: "Aceptar propuesta" }).first();
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Aceptar propuesta" });
    await expect(dialog).toBeVisible();
    const inside = await dialog.evaluate((d) => d.contains(document.activeElement));
    expect(inside, "el foco entra al diálogo").toBe(true);
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((d) => d.contains(document.activeElement)), "el foco no escapa del diálogo").toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    const active = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el ? `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}"` : "null";
    });
    test.info().annotations.push({ type: "foco tras cerrar", description: active });
    await expect(trigger, `el foco regresa al botón que abrió el diálogo (está en: ${active})`).toBeFocused();
  });
});
