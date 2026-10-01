#!/usr/bin/env node
/**
 * Genera los secretos de producción y los imprime listos para pegar en Dokploy → Environment.
 * No escribe archivos ni envía nada a internet.
 *
 * Uso:
 *   node scripts/generate-secrets.mjs --domain tudominio.mx
 *   node scripts/generate-secrets.mjs --domain tudominio.mx --admin-email tu@correo.mx
 *
 * En el VPS (sin Node instalado):
 *   docker run --rm -v "$PWD/scripts:/s" node:22-alpine node /s/generate-secrets.mjs --domain tudominio.mx
 */
import { randomBytes, randomInt } from "node:crypto";

const args = process.argv.slice(2);
const arg = (name, fallback = "") => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const domain = arg("domain", "tudominio.mx").replace(/^https?:\/\//, "").replace(/\/$/, "");
const adminEmail = arg("admin-email", `admin@${domain}`);

/** Secreto opaco de N bytes en base64url (seguro para URLs y variables de entorno). */
const secret = (bytes = 32) => randomBytes(bytes).toString("base64url");
/** Hex (sólo 0-9a-f): ideal para contraseñas dentro de una URL de conexión. */
const hex = (bytes = 24) => randomBytes(bytes).toString("hex");
/** Contraseña legible para la primera cuenta (se cambia después de entrar). */
function readablePassword(length = 16) {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!#%+=?@"];
  const all = sets.join("");
  const chars = sets.map((s) => s[randomInt(s.length)]);
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

const dbPassword = hex(24);

const out = `# ===== Generado ${new Date().toISOString()} — guárdalo en un gestor de contraseñas =====

# 1) Contraseña para crear la base en Dokploy (Database → PostgreSQL → Database Password)
#    Luego arma DATABASE_URL con la "Internal Connection URL" (ya incluye esta contraseña).
POSTGRES_PASSWORD=${dbPassword}

# 2) Pega esto en Dokploy → Application → Environment
APP_URL=https://${domain}
AUTH_URL=https://${domain}
AUTH_TRUST_HOST=true
AUTH_SECRET=${secret(32)}
CRON_SECRET=${secret(32)}
INTERNAL_APP_URL=http://127.0.0.1:3000
# Sólo para PAYMENT_PROVIDER=mock. Con Stripe/Mercado Pago usa el secreto que te da su panel de webhooks.
PAYMENT_WEBHOOK_SECRET=${secret(32)}
SEED_ADMIN_EMAIL=${adminEmail}
SEED_ADMIN_PASSWORD=${readablePassword(16)}
SEED_ADMIN_NAME=Administración
`;

process.stdout.write(out);
