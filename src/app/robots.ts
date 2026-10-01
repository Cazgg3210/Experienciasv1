import type { MetadataRoute } from "next";

/** Zonas privadas (paneles, portales por token, pagos, API): nunca indexar. */
const DISALLOW = [
  "/admin",
  "/staff",
  "/mi-evento",
  "/e/",
  "/memory",
  "/cotizacion",
  "/pago",
  "/api/",
  "/login",
  "/sin-acceso",
  // Diseñador IA: genera contenido por solicitud (costo); el configurador sí se indexa.
  "/crear-experiencia/ai",
];

// Sin env(): robots.txt se genera en build (donde puede no haber DATABASE_URL).
function baseUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export default function robots(): MetadataRoute.Robots {
  const base = baseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/experiencias", "/crear-experiencia"],
        disallow: DISALLOW,
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
