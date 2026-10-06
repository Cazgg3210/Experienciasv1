/**
 * API de archivos y exportaciones:
 *  - /api/media/[id]: públicos libres; privados sólo con firma HMAC vigente (?exp&sig).
 *  - /api/media/upload: sesión + permiso + mismo origen; magic bytes (no extensión/Content-Type); tamaño; staff sólo evidencias de SUS eventos.
 *  - /api/memory/[token]/upload: mismo origen, cápsula publicada, consentimiento.
 *  - CSV: /api/admin/leads-export, /api/events/[id]/guests.csv, /admin/finance/export → auth + contenido + anti-inyección de fórmulas + auditoría.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, uniq, createLead } from "../fixtures";
import { ROOT, createEventGraph, seedIds, signedMediaPath, token } from "../permissions/_helpers";
import type { APIRequestContext, APIResponse } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";

const PNG = readFileSync(path.join(ROOT, "public/images/og.png"));
const FAKE_JPG = Buffer.from("esto no es una imagen, es texto plano disfrazado\n");
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>');
const HTML = Buffer.from("<!doctype html><html><body><script>alert(document.cookie)</script></body></html>");

async function upload(api: APIRequestContext, baseURL: string, fields: Record<string, string>, file: { name: string; mimeType: string; buffer: Buffer } | null, headers: Record<string, string> = { Origin: baseURL }): Promise<APIResponse> {
  return api.post("/api/media/upload", {
    headers,
    multipart: { ...(file ? { file } : {}), ...fields },
    failOnStatusCode: false,
  });
}

async function privateExternalAsset(db: PrismaClient) {
  return db.mediaAsset.create({
    data: { driver: "EXTERNAL", url: "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3", mimeType: "image/jpeg", visibility: "PRIVATE", purpose: "EVENT" },
  });
}

test.describe("API — /api/media/[id] (URLs firmadas)", { tag: ["@module:api"] }, () => {
  test("[API-060] privado sin firma o con firma inválida/ajena/vencida → 403; firma vigente → redirect", { tag: ["@P0", "@negative"] }, async ({ apiAs, db, evidence }) => {
    const asset = await privateExternalAsset(db);
    const other = await privateExternalAsset(db);
    evidence("anonimo", `MediaAsset privado ${asset.id}`);
    const anon = await apiAs(null);
    const get = (u: string) => anon.get(u, { maxRedirects: 0, failOnStatusCode: false });
    expect((await get(`/api/media/${asset.id}`)).status()).toBe(403);
    const good = signedMediaPath(asset.id);
    const u = new URL(good, "http://x");
    const exp = u.searchParams.get("exp")!;
    const sig = u.searchParams.get("sig")!;
    expect((await get(`/api/media/${asset.id}?exp=${exp}&sig=${sig.slice(0, -3)}abc`)).status()).toBe(403);
    expect((await get(`/api/media/${asset.id}?exp=${Number(exp) + 60}&sig=${sig}`)).status(), "exp alterado").toBe(403);
    expect((await get(signedMediaPath(other.id).replace(other.id, asset.id))).status(), "firma de otro archivo").toBe(403);
    expect((await get(signedMediaPath(asset.id, -10))).status(), "firma vencida").toBe(403);
    expect((await get(`/api/media/${asset.id}?exp=${exp}`)).status(), "sin sig").toBe(403);
    const ok = await get(good);
    expect(ok.status()).toBe(302);
    expect(ok.headers()["location"]).toBe("https://images.unsplash.com/photo-1464349095431-e9a21285b5f3");
  });

  test("[API-061] público: libre; id malformado o inexistente → 404 genérico", { tag: ["@P2"] }, async ({ apiAs, db, evidence }) => {
    const pub = await db.mediaAsset.findFirstOrThrow({ where: { visibility: "PUBLIC" } });
    evidence("anonimo", pub.id);
    const anon = await apiAs(null);
    const res = await anon.get(`/api/media/${pub.id}`, { maxRedirects: 0, failOnStatusCode: false });
    expect(res.status()).toBe(302);
    for (const bad of ["..%2F..%2Fetc%2Fpasswd", "abc", "cxxxxxxxxxxxxxxxxxxxxxxxx"]) {
      const r = await anon.get(`/api/media/${bad}`, { maxRedirects: 0, failOnStatusCode: false });
      expect(r.status(), bad).toBe(404);
      expect(await r.text()).toBe("No encontrado");
    }
  });
});

test.describe("API — /api/media/upload", { tag: ["@module:api"] }, () => {
  test("[API-062] sin sesión → 401; con sesión pero Origin ajeno o sin Origin → 403 (CSRF); nada se guarda", { tag: ["@P0", "@negative"] }, async ({ apiAs, baseURL, db, evidence }) => {
    evidence("owner", "subidas sin sesión / cross-origin");
    const before = await db.mediaAsset.count();
    const anon = await apiAs(null);
    expect((await upload(anon, baseURL!, { purpose: "GALLERY" }, { name: "a.png", mimeType: "image/png", buffer: PNG })).status()).toBe(401);
    const owner = await apiAs("owner");
    expect((await upload(owner, baseURL!, { purpose: "GALLERY" }, { name: "a.png", mimeType: "image/png", buffer: PNG }, { Origin: "https://evil.example" })).status()).toBe(403);
    expect((await upload(owner, baseURL!, { purpose: "GALLERY" }, { name: "a.png", mimeType: "image/png", buffer: PNG }, {})).status()).toBe(403);
    expect((await upload(owner, baseURL!, { purpose: "GALLERY" }, { name: "a.png", mimeType: "image/png", buffer: PNG }, { "Sec-Fetch-Site": "cross-site", Origin: baseURL! })).status()).toBe(403);
    expect(await db.mediaAsset.count()).toBe(before);
  });

  test("[API-063] magic bytes falsos (texto .jpg), SVG con script y HTML → rechazados sin MediaAsset", { tag: ["@P0", "@negative"] }, async ({ apiAs, baseURL, db, evidence }) => {
    evidence("owner", "tipo real por magic bytes");
    const owner = await apiAs("owner");
    const before = await db.mediaAsset.count();
    for (const f of [
      { name: "foto.jpg", mimeType: "image/jpeg", buffer: FAKE_JPG },
      { name: "logo.svg", mimeType: "image/svg+xml", buffer: SVG },
      { name: "foto.png", mimeType: "image/png", buffer: HTML },
    ]) {
      const res = await upload(owner, baseURL!, { purpose: "GALLERY" }, f);
      expect(res.status(), f.name).toBe(422);
      expect((await res.json()).error).toMatch(/Formato no permitido/);
    }
    expect(await db.mediaAsset.count()).toBe(before);
  });

  test("[API-064] archivo que supera UPLOAD_MAX_MB → rechazado con mensaje de tamaño", { tag: ["@P1", "@negative"] }, async ({ apiAs, baseURL, db, evidence }) => {
    const maxMb = Number(process.env.UPLOAD_MAX_MB ?? 8);
    evidence("owner", `${maxMb + 1} MB con cabecera PNG válida`);
    const big = Buffer.concat([PNG.subarray(0, 64), Buffer.alloc((maxMb + 1) * 1024 * 1024, 0)]);
    const before = await db.mediaAsset.count();
    const res = await upload(await apiAs("owner"), baseURL!, { purpose: "GALLERY" }, { name: "enorme.png", mimeType: "image/png", buffer: big });
    expect([413, 422]).toContain(res.status());
    expect((await res.json()).error).toContain(`${maxMb} MB`);
    expect(await db.mediaAsset.count()).toBe(before);
  });

  test("[API-065] campos inválidos (sin archivo, propósito inexistente) → 400", { tag: ["@P2", "@negative"] }, async ({ apiAs, baseURL, evidence }) => {
    evidence("owner");
    const owner = await apiAs("owner");
    expect((await upload(owner, baseURL!, { purpose: "GALLERY" }, null)).status()).toBe(400);
    expect((await upload(owner, baseURL!, { purpose: "HACK" }, { name: "a.png", mimeType: "image/png", buffer: PNG })).status()).toBe(400);
  });

  test("[API-066] owner sube PNG real → MediaAsset privado en base y se sirve sólo con URL firmada", { tag: ["@P1"] }, async ({ apiAs, baseURL, db, evidence }) => {
    evidence("owner", "subida a S3 local (RustFS)");
    const res = await upload(await apiAs("owner"), baseURL!, { purpose: "OTHER", alt: "Prueba E2E" }, { name: "evil-name/../x.png", mimeType: "image/png", buffer: PNG });
    test.skip(res.status() >= 500 && /storage|s3|subir/i.test(await res.text()), "BLOCKED: almacenamiento S3 local no disponible");
    expect(res.status(), await res.text()).toBe(200);
    const body = await res.json();
    const row = await db.mediaAsset.findUniqueOrThrow({ where: { id: body.id } });
    expect(row).toMatchObject({ visibility: "PRIVATE", mimeType: "image/png", sizeBytes: PNG.length, purpose: "OTHER" });
    expect(row.storageKey).not.toContain("evil-name");
    expect(row.storageKey).not.toContain("..");
    expect(body.url).toMatch(new RegExp(`^/api/media/${body.id}\\?exp=\\d+&sig=`));
    const anon = await apiAs(null);
    expect((await anon.get(`/api/media/${body.id}`, { maxRedirects: 0, failOnStatusCode: false })).status()).toBe(403);
    const signed = await anon.get(body.url, { maxRedirects: 0, failOnStatusCode: false });
    expect(signed.status()).toBe(302);
    expect(signed.headers()["cache-control"]).toContain("private");
  });

  test("[API-067] staff: sólo evidencias de checklist de eventos ASIGNADOS (otro propósito o evento ajeno → 403)", { tag: ["@P0"] }, async ({ apiAs, baseURL, db, evidence }) => {
    const ids = await seedIds(db);
    const mine = await createEventGraph(db, { assignStaffMemberIds: [ids.staffMemberId] });
    const foreign = await createEventGraph(db, {});
    evidence("staff", `evento asignado ${mine.eventId} / ajeno ${foreign.eventId}`);
    const staff = await apiAs("staff");
    const file = { name: "evidencia.png", mimeType: "image/png", buffer: PNG };
    const before = await db.mediaAsset.count();
    expect((await upload(staff, baseURL!, { purpose: "GALLERY" }, file)).status()).toBe(403);
    expect((await upload(staff, baseURL!, { purpose: "CHECKLIST_EVIDENCE" }, file)).status()).toBe(403);
    const res = await upload(staff, baseURL!, { purpose: "CHECKLIST_EVIDENCE", eventId: foreign.eventId }, file);
    expect(res.status()).toBe(403);
    expect((await res.json()).error).toBe("No estás asignada a este evento.");
    expect(await db.mediaAsset.count()).toBe(before);
    // Control positivo: su evento → 200 y queda PRIVADA aunque pida PUBLIC
    const ok = await upload(staff, baseURL!, { purpose: "CHECKLIST_EVIDENCE", eventId: mine.eventId, visibility: "PUBLIC" }, file);
    test.skip(ok.status() >= 500, "BLOCKED: almacenamiento S3 local no disponible");
    expect(ok.status(), await ok.text()).toBe(200);
    const row = await db.mediaAsset.findUniqueOrThrow({ where: { id: (await ok.json()).id } });
    expect(row.visibility).toBe("PRIVATE");
    expect(row.eventId).toBe(mine.eventId);
  });

  test("[API-068] subida pública a cápsula: Origin ajeno → 403; sin consentimiento → 400; válida → 201 privada y pendiente de revisión", { tag: ["@P1"] }, async ({ playwright, baseURL, db, evidence }) => {
    const ev = await createEventGraph(db, { status: "COMPLETED", daysAhead: -5, capsule: { published: true } });
    evidence("invitada", `/api/memory/${ev.capsule!.shareToken}/upload`);
    const url = `/api/memory/${ev.capsule!.shareToken}/upload`;
    const file = { name: "fiesta.png", mimeType: "image/png", buffer: PNG };
    const cross = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Origin: "https://evil.example" } });
    expect((await cross.post(url, { multipart: { file, name: "Ana", consent: "true" }, failOnStatusCode: false })).status()).toBe(403);
    await cross.dispose();
    const same = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL! } });
    const noConsent = await same.post(url, { multipart: { file, name: "Ana", consent: "false" }, failOnStatusCode: false });
    expect(noConsent.status()).toBe(400);
    const fake = await same.post(url, { multipart: { file: { name: "x.jpg", mimeType: "image/jpeg", buffer: FAKE_JPG }, name: "Ana", consent: "true" }, failOnStatusCode: false });
    expect([400, 422]).toContain(fake.status());
    expect(await db.mediaAsset.count({ where: { memoryCapsuleId: ev.capsule!.id } })).toBe(0);
    const ok = await same.post(url, { multipart: { file, name: "Ana", consent: "true" }, failOnStatusCode: false });
    test.skip(ok.status() >= 500, "BLOCKED: almacenamiento S3 local no disponible");
    expect(ok.status(), await ok.text()).toBe(201);
    const row = await db.mediaAsset.findUniqueOrThrow({ where: { id: (await ok.json()).id } });
    expect(row).toMatchObject({ visibility: "PRIVATE", approved: false, consent: true, memoryCapsuleId: ev.capsule!.id, uploaderName: "Ana" });
    await same.dispose();
  });
});

test.describe("API — exportaciones CSV", { tag: ["@module:api"] }, () => {
  test("[API-070] leads CSV: anónimo 401, staff 403; owner obtiene CSV con BOM, encabezados y fórmulas neutralizadas (auditado)", { tag: ["@P0"] }, async ({ apiAs, db, evidence }) => {
    const evil = `=HYPERLINK("http://evil.example","clic") ${uniq("x")}`;
    const lead = await createLead(db, { name: evil, phone: "+525512345678" });
    evidence("owner", `lead ${lead.id} con nombre "=HYPERLINK(...)"`);
    expect((await (await apiAs(null)).get("/api/admin/leads-export", { failOnStatusCode: false })).status()).toBe(401);
    const staffRes = await (await apiAs("staff")).get("/api/admin/leads-export", { failOnStatusCode: false });
    expect(staffRes.status()).toBe(403);
    expect(await staffRes.text()).not.toContain(evil);

    const auditBefore = await db.auditLog.count({ where: { action: "leads.exported" } });
    const res = await (await apiAs("owner")).get("/api/admin/leads-export");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(res.headers()["content-disposition"]).toMatch(/attachment; filename="leads-\d{4}-\d{2}-\d{2}\.csv"/);
    expect(res.headers()["cache-control"]).toContain("no-store");
    const csv = await res.text();
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1).split("\r\n")[0]).toBe("Código,Nombre,Teléfono,Email,Ocasión,Experiencia,Fecha del evento,Invitadas,Presupuesto,Estimado (MXN),Estado,Origen,Zona,Fuera de cobertura,Consulta especial,Asignada a,Motivo de pérdida,Creado,Último contacto");
    const line = csv.split("\r\n").find((l) => l.startsWith(lead.code))!;
    expect(line, "fila del lead").toBeTruthy();
    expect(line).toContain(`"'=HYPERLINK(""http://evil.example"",""clic"")`);
    expect(line).toContain("'+525512345678");
    expect(await db.auditLog.count({ where: { action: "leads.exported" } })).toBe(auditBefore + 1);
  });

  test("[API-071] guests.csv: anónimo 401, staff 403 (incluso de su evento), evento inexistente 404; owner CSV neutralizado", { tag: ["@P0"] }, async ({ apiAs, db, evidence }) => {
    const ids = await seedIds(db);
    const ev = await createEventGraph(db, { assignStaffMemberIds: [ids.staffMemberId] });
    await db.eventGuest.create({ data: { eventId: ev.eventId, name: "@SUM(1+1)*cmd|' /C calc'!A0", token: token(), source: "HOST", dietaryNotes: "-2+3" } });
    evidence("owner", `evento ${ev.eventId} con invitada "@SUM(...)"`);
    const url = `/api/events/${ev.eventId}/guests.csv`;
    expect((await (await apiAs(null)).get(url, { failOnStatusCode: false })).status()).toBe(401);
    expect((await (await apiAs("staff")).get(url, { failOnStatusCode: false })).status()).toBe(403);
    expect((await (await apiAs("owner")).get("/api/events/cxxxxxxxxxxxxxxxxxxxxxxxx/guests.csv", { failOnStatusCode: false })).status()).toBe(404);
    const res = await (await apiAs("owner")).get(url);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    const csv = await res.text();
    expect(csv).toContain("'@SUM(1+1)*cmd|' /C calc'!A0");
    expect(csv).toContain("'-2+3");
    expect(csv).not.toMatch(/(^|,)@SUM/m);
    expect(await db.auditLog.count({ where: { action: "guests.exported", entityId: ev.eventId } })).toBe(1);
  });

  test("[API-072] finanzas CSV (/admin/finance/export): anónimo → login, staff → /staff; owner CSV con montos y títulos neutralizados", { tag: ["@P0"] }, async ({ apiAs, db, evidence }) => {
    const ev = await createEventGraph(db, { withBooking: true, totalCents: 1_234_500, daysAhead: 3 });
    const title = `=1+1 ${uniq("Fin")}`;
    await db.event.update({ where: { id: ev.eventId }, data: { title } });
    evidence("owner", `evento ${ev.eventId} con título "=1+1 …"`);
    const anon = await (await apiAs(null)).get("/admin/finance/export", { maxRedirects: 0, failOnStatusCode: false });
    expect(anon.status()).toBe(307);
    expect(anon.headers()["location"]).toBe("/login?callbackUrl=%2Fadmin%2Ffinance%2Fexport");
    const staff = await (await apiAs("staff")).get("/admin/finance/export", { maxRedirects: 0, failOnStatusCode: false });
    expect(staff.status()).toBe(307);
    expect(staff.headers()["location"]).toBe("/staff");
    const month = (await db.event.findUniqueOrThrow({ where: { id: ev.eventId } })).eventDate.toISOString().slice(0, 7);
    const res = await (await apiAs("owner")).get(`/admin/finance/export?month=${month}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-disposition"]).toContain(`finanzas-ivonne-rosa-${month}.csv`);
    const csv = await res.text();
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const line = csv.split("\r\n").find((l) => l.includes(ev.code))!;
    expect(line, "fila del evento").toBeTruthy();
    expect(line).toContain(`'${title}`);
    expect(line).toContain("12345"); // venta en pesos (12,345.00)
    expect(await db.auditLog.count({ where: { action: "finance.exported" } })).toBeGreaterThan(0);
  });
});
