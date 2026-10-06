import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Docker/Dokploy usa "standalone". NEXT_STANDALONE=false lo desactiva (servidor E2E local en Windows,
  // donde copiar symlinks del build standalone falla con EPERM). `next start` no lo necesita.
  output: process.env.NEXT_STANDALONE === "false" ? undefined : "standalone",
  // Permite varios servidores de desarrollo en paralelo (p. ej. QA) con carpetas de build distintas.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // Permite abrir el servidor de desarrollo desde otros dispositivos de la red local (p. ej. el celular).
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean),
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  images: {
    localPatterns: [{ pathname: "/api/media/**" }, { pathname: "/images/**" }, { pathname: "/opengraph-image**" }],
    formats: ["image/avif", "image/webp"],
    dangerouslyAllowSVG: true,
    contentDispositionType: "inline",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "**.digitaloceanspaces.com" },
      { protocol: "https", hostname: "**.amazonaws.com" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
