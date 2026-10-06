/**
 * Sitio público (marketing + catálogo + SEO) — paquete 2 "Venta pública".
 * Todas las páginas públicas renderizan sin errores de consola (guard), con landmarks y metadatos SEO.
 */
import { expect, scanA11y, test, uniq } from "../fixtures";
import { ensureFreshExperienceDetail, formatMXN } from "../configurator/_helpers";
import { createSentQuote } from "../quote-public/_helpers";

const PAGES: Array<{ id: string; path: string; h1: RegExp; prio: "@P1" | "@P2" }> = [
  { id: "PUB-001", path: "/", h1: /Momentos bonitos, listos para disfrutar/, prio: "@P1" },
  { id: "PUB-002", path: "/experiencias", h1: /Experiencias para celebrar a las tuyas/, prio: "@P1" },
  { id: "PUB-003", path: "/experiencias/birthday-table", h1: /^Birthday Table$/, prio: "@P1" },
  { id: "PUB-004", path: "/como-funciona", h1: /.+/, prio: "@P2" },
  { id: "PUB-005", path: "/nuestra-historia", h1: /.+/, prio: "@P2" },
  { id: "PUB-006", path: "/contacto", h1: /Platiquemos de tu próxima reunión/, prio: "@P1" },
  { id: "PUB-007", path: "/privacidad", h1: /privacidad/i, prio: "@P2" },
  { id: "PUB-008", path: "/terminos", h1: /Términos/i, prio: "@P2" },
  { id: "PUB-009", path: "/crear-experiencia", h1: /Diseñemos juntas tu celebración/, prio: "@P1" },
  { id: "PUB-010", path: "/crear-experiencia/ai", h1: /Cuéntanos la idea/, prio: "@P1" },
];

test.describe("Sitio público", { tag: ["@module:public"] }, () => {
  for (const p of PAGES) {
    test(`[${p.id}] ${p.path} carga sin errores, con un h1, landmarks y navegación`, { tag: [p.prio, "@smoke"] }, async ({ page, request, db, evidence }) => {
      evidence("anonimo", `GET ${p.path}`);
      if (p.path.startsWith("/experiencias/")) await ensureFreshExperienceDetail(request, db, [p.path.split("/")[2]!]);
      const res = await page.goto(p.path);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(p.h1);
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByRole("banner")).toBeVisible();
      await expect(page.getByRole("contentinfo")).toBeVisible();
      await expect(page).toHaveTitle(/Ivonne & Rosa/);
      // Sin textos de relleno olvidados.
      const body = await page.locator("body").innerText();
      for (const re of [/lorem ipsum/i, /\bTODO\b/, /\bundefined\b/, /\bNaN\b/, /\[object Object\]/]) expect(body).not.toMatch(re);
    });
  }

  test(
    "[PUB-011] menú principal, CTA del encabezado y enlaces legales del pie llevan a su página",
    { tag: ["@P2"] },
    async ({ page, evidence }) => {
      evidence("anonimo", "Navegación desktop 1440");
      await page.goto("/");
      const nav = page.getByRole("navigation", { name: "Principal" });
      for (const [label, path, h1] of [
        ["Experiencias", "/experiencias", /Experiencias para celebrar/],
        ["Cómo funciona", "/como-funciona", /.+/],
        ["Nuestra historia", "/nuestra-historia", /.+/],
        ["Contacto", "/contacto", /Platiquemos/],
      ] as const) {
        await nav.getByRole("link", { name: label }).click();
        await expect(page).toHaveURL(new RegExp(`${path}$`));
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(h1);
      }
      await page.getByRole("banner").getByRole("link", { name: "Diseña tu experiencia" }).click();
      await expect(page).toHaveURL(/\/crear-experiencia$/);
      await page.goBack();
      await expect(page).toHaveURL(/\/contacto$/);
      const footer = page.getByRole("contentinfo");
      await footer.getByRole("link", { name: /privacidad/i }).click();
      await expect(page).toHaveURL(/\/privacidad$/);
      await page.getByRole("contentinfo").getByRole("link", { name: /Términos/i }).click();
      await expect(page).toHaveURL(/\/terminos$/);
    },
  );

  test(
    "[PUB-012] menú móvil: abre, navega y cierra",
    { tag: ["@P2", "@mobile"] },
    async ({ page, evidence }) => {
      evidence("anonimo", "Menú hamburguesa en 390×844");
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/");
      await page.getByRole("button", { name: "Abrir menú" }).click();
      const menu = page.getByRole("dialog", { name: "Menú" });
      await expect(menu).toBeVisible();
      await menu.getByRole("navigation", { name: "Principal (móvil)" }).getByRole("link", { name: "Contacto" }).click();
      await expect(page).toHaveURL(/\/contacto$/);
      await expect(page.getByRole("dialog", { name: "Menú" })).toBeHidden();
      await page.getByRole("button", { name: "Abrir menú" }).click();
      await page.getByRole("button", { name: "Cerrar menú" }).click();
      await expect(page.getByRole("dialog", { name: "Menú" })).toBeHidden();
    },
  );

  test(
    "[PUB-013] los CTAs del inicio llevan al configurador y al catálogo",
    { tag: ["@P1"] },
    async ({ page, evidence }) => {
      evidence("anonimo", "Hero del inicio");
      await page.goto("/");
      await page.getByRole("main").getByRole("link", { name: "Diseña tu experiencia" }).first().click();
      await expect(page).toHaveURL(/\/crear-experiencia$/);
      await expect(page.getByRole("heading", { level: 2, name: "¿Qué celebramos?" })).toBeVisible();
      await page.goto("/");
      await page.getByRole("main").getByRole("link", { name: "Ver experiencias" }).first().click();
      await expect(page).toHaveURL(/\/experiencias$/);
    },
  );

  test(
    "[PUB-014] /experiencias muestra exactamente las experiencias activas del catálogo y enlaza a su detalle",
    { tag: ["@P1"] },
    async ({ page, db, request, evidence }) => {
      evidence("anonimo", "Catálogo vs base de datos");
      const active = await db.experience.findMany({ where: { active: true }, select: { name: true, slug: true } });
      await ensureFreshExperienceDetail(request, db, [active[0]!.slug]);
      await page.goto("/experiencias");
      const main = page.getByRole("main");
      await expect(main.getByText(`${active.length} experiencias`, { exact: true })).toBeVisible();
      for (const e of active) {
        await expect(main.getByRole("link", { name: e.name, exact: true })).toHaveAttribute("href", `/experiencias/${e.slug}`);
      }
      await main.getByRole("link", { name: active[0]!.name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/experiencias/${active[0]!.slug}$`));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(active[0]!.name);
    },
  );

  test(
    "[PUB-015] detalle de experiencia: precio desde, rango de personas y CTA al configurador con la experiencia preseleccionada",
    { tag: ["@P1"] },
    async ({ page, db, request, evidence }) => {
      evidence("anonimo", "/experiencias/karaoke-mimosas → Diseña esta experiencia");
      const exp = await db.experience.findUniqueOrThrow({ where: { slug: "karaoke-mimosas" } });
      await ensureFreshExperienceDetail(request, db, [exp.slug]);
      await page.goto(`/experiencias/${exp.slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(exp.name);
      await expect(page.getByRole("main")).toContainText(formatMXN(exp.basePriceCents));
      const cta = page.getByRole("complementary").getByRole("link", { name: "Diseña esta experiencia" });
      await expect(cta).toHaveAttribute("href", `/crear-experiencia?experiencia=${exp.slug}`);
      await cta.click();
      await expect(page.getByText(`Partimos de ${exp.name}`)).toBeVisible();
      // JSON-LD del servicio presente para buscadores.
      await page.goto(`/experiencias/${exp.slug}`);
      const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t));
      expect(ld.flat().some((x: { "@type"?: string; name?: string }) => x["@type"] === "Service" && x.name === exp.name)).toBe(true);
    },
  );

  test(
    "[PUB-016] experiencia inexistente o inactiva → página «no disponible» con noindex, HTTP 404 real (y no aparece en el catálogo)",
    { tag: ["@P1", "@negative", "@regression"] },
    async ({ page, db, guard, evidence }) => {
      test.info().annotations.push({ type: "regression", description: "BUG-013" });
      evidence("anonimo", "Slug inexistente, con caracteres raros e inactivo");
      guard.allow(/404/); // si la ruta responde 404 real, el navegador lo registra en consola
      const inactive = await db.experience.create({
        data: { slug: uniq("e2e-oculta").toLowerCase(), name: `E2E Oculta ${uniq("x")}`, description: "no visible", basePriceCents: 100, active: false }, // nunca activa: el catálogo se cachea 60 s
      });
      const statuses: Record<string, number | undefined> = {};
      for (const slug of ["no-existe-esta-mesa", "%3Cscript%3Ealert(1)%3C%2Fscript%3E", inactive.slug]) {
        const res = await page.goto(`/experiencias/${slug}`);
        statuses[slug] = res?.status();
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Esta mesa ya no está puesta");
        await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
        await expect(page.getByText(inactive.name)).toHaveCount(0);
      }
      test.info().annotations.push({ type: "http-status", description: JSON.stringify(statuses) });
      // Sin soft-404: inexistente, inválido e inactivo responden 404 real (no 200 con contenido de error).
      expect(statuses, "HTTP de /experiencias/<slug> no disponible").toEqual({
        "no-existe-esta-mesa": 404,
        "%3Cscript%3Ealert(1)%3C%2Fscript%3E": 404,
        [inactive.slug]: 404,
      });
      await page.goto("/experiencias");
      await expect(page.getByRole("link", { name: inactive.name })).toHaveCount(0);
    },
  );

  test(
    "[PUB-017] filtros del catálogo: ocasión coincide con la base, grupo grande muestra consulta especial y sin resultados muestra estado vacío",
    { tag: ["@P2"] },
    async ({ page, db, evidence }) => {
      evidence("anonimo", "/experiencias?ocasion=…&personas=…");
      const bridal = await db.experience.findMany({ where: { active: true, occasions: { has: "BRIDAL" } }, select: { name: true } });
      await page.goto("/experiencias?ocasion=bridal");
      const main = page.getByRole("main");
      await expect(main.getByText(bridal.length === 1 ? "1 experiencia" : `${bridal.length} experiencias`, { exact: false }).first()).toBeVisible();
      for (const e of bridal) await expect(main.getByRole("link", { name: e.name, exact: true })).toBeVisible();
      await page.goto("/experiencias?personas=20");
      await expect(page.getByText(/Lo tratamos como consulta especial/)).toBeVisible();
      await page.goto("/experiencias?ocasion=bridal&tipo=karaoke&estilo=no-existe");
      await expect(page.getByRole("heading", { name: "Ninguna experiencia coincide con tu búsqueda" })).toBeVisible();
      await page.goto("/experiencias?personas=abc&ocasion=%3Cb%3E");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Experiencias para celebrar/);
    },
  );

  test(
    "[PUB-018] SEO: páginas indexables con title, description, canonical y Open Graph en el <head> que ve un buscador (sin noindex)",
    { tag: ["@P2"] },
    async ({ request, evidence }) => {
      // Next 15.5 transmite los metadatos al final del <body> para navegadores y bots con JS (Googlebot);
      // los rastreadores sin JS (redes sociales: facebookexternalhit, Twitterbot, WhatsApp) los reciben en el <head>.
      evidence("anonimo", "HTML servido a un rastreador sin JS (facebookexternalhit)");
      const problems: string[] = [];
      for (const path of ["/", "/experiencias", "/experiencias/birthday-table", "/como-funciona", "/nuestra-historia", "/contacto", "/privacidad", "/terminos", "/crear-experiencia"]) {
        const html = await (await request.get(path, { headers: { "user-agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)" } })).text();
        const head = html.slice(0, html.indexOf("</head>"));
        const has = (re: RegExp, what: string) => {
          if (!re.test(head)) problems.push(`${path}: falta ${what}`);
        };
        has(/<title>[^<]*Ivonne &amp; Rosa[^<]*<\/title>/, "title con la marca");
        has(/<meta name="description" content="[^"]{40,}"/, "meta description (≥40)");
        has(new RegExp(`<link rel="canonical" href="[^"]*${path === "/" ? "/?" : path}"`), "canonical");
        has(/<meta property="og:title" content="[^"]+"/, "og:title");
        has(/<meta property="og:image" content="https?:\/\/[^"]+"/, "og:image absoluta");
        has(/<meta property="og:locale" content="es_MX"/, "og:locale es_MX");
        if (/<meta name="robots" content="[^"]*noindex/.test(head)) problems.push(`${path}: tiene noindex`);
      }
      expect(problems).toEqual([]);
      const html = await (await request.get("/experiencias/birthday-table", { headers: { "user-agent": "facebookexternalhit/1.1" } })).text();
      const ogUrl = /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1];
      test.info().annotations.push({ type: "og:image", description: String(ogUrl) });
      const u = new URL(ogUrl!.replace(/&amp;/g, "&"));
      const og = await request.get(u.pathname + u.search);
      expect(og.status()).toBe(200);
      expect(og.headers()["content-type"]).toContain("image/");
    },
  );

  test(
    "[PUB-019] páginas con token y de pago no se indexan (meta robots + X-Robots-Tag) y robots.txt/sitemap son coherentes",
    { tag: ["@P1", "@permissions"] },
    async ({ page, db, request, evidence }) => {
      evidence("anonimo", "Cabeceras/meta de /cotizacion, robots.txt y sitemap.xml");
      const { quote } = await createSentQuote(db);
      const res = await page.goto(`/cotizacion/${quote.publicToken}`);
      expect(res?.headers()["x-robots-tag"] ?? "").toContain("noindex");
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
      const robots = await (await request.get("/robots.txt")).text();
      for (const path of ["/admin", "/cotizacion", "/pago", "/mi-evento", "/memory", "/crear-experiencia/ai"]) {
        expect(robots, `robots.txt Disallow ${path}`).toContain(`Disallow: ${path}`);
      }
      const sitemap = await (await request.get("/sitemap.xml")).text();
      const active = await db.experience.findMany({ where: { active: true }, select: { slug: true } });
      for (const e of active) expect(sitemap).toContain(`/experiencias/${e.slug}</loc>`);
      const inactive = await db.experience.findMany({ where: { active: false }, select: { slug: true } });
      for (const e of inactive) expect(sitemap).not.toContain(`/experiencias/${e.slug}<`);
      expect(sitemap).not.toContain("/cotizacion/");
    },
  );

  test(
    "[PUB-020] accesibilidad (axe WCAG 2.1 AA) de las páginas públicas clave",
    { tag: ["@P2", "@a11y"] },
    async ({ page, request, db }, testInfo) => {
      test.info().annotations.push({ type: "rol", description: "anonimo" });
      await ensureFreshExperienceDetail(request, db, ["birthday-table"]);
      const blocking: string[] = [];
      for (const path of ["/", "/experiencias", "/experiencias/birthday-table", "/como-funciona", "/contacto", "/nuestra-historia"]) {
        await page.goto(path);
        // Espera a que terminen hidratación y transiciones CSS: axe mide colores a mitad de una animación
        // (p. ej. el botón que se habilita al hidratar) y reportaría contraste falso.
        await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
        if (path === "/contacto") await expect(page.getByRole("button", { name: "Enviar mensaje" })).toBeEnabled();
        const r = await scanA11y(page, testInfo);
        blocking.push(...r.blocking.map((v) => `${path} → ${v.id} (${v.impact}): ${v.help} [${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}]`));
      }
      expect(blocking).toEqual([]);
    },
  );

  test(
    "[PUB-021] responsive: sin scroll horizontal y CTA visible en 1440, 1366, 768 y 390",
    { tag: ["@P2", "@responsive"] },
    async ({ page, request, db, evidence }) => {
      evidence("anonimo", "Viewports del estándar");
      await ensureFreshExperienceDetail(request, db, ["birthday-table"]);
      const issues: string[] = [];
      for (const vp of [{ w: 1440, h: 900 }, { w: 1366, h: 768 }, { w: 768, h: 1024 }, { w: 390, h: 844 }]) {
        await page.setViewportSize({ width: vp.w, height: vp.h });
        for (const path of ["/", "/experiencias", "/experiencias/birthday-table", "/contacto", "/crear-experiencia"]) {
          await page.goto(path);
          await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          if (overflow > 1) issues.push(`${path} @${vp.w}: scroll horizontal ${overflow}px`);
        }
        await page.goto("/");
        await expect(page.getByRole("main").getByRole("link", { name: "Diseña tu experiencia" }).first(), `CTA @${vp.w}`).toBeInViewport();
      }
      expect(issues).toEqual([]);
    },
  );
});
