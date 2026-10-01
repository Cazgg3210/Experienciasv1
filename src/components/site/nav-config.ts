/** Navegación principal del sitio público. */
export const SITE_NAV = [
  { href: "/experiencias", label: "Experiencias" },
  { href: "/como-funciona", label: "Cómo funciona" },
  { href: "/nuestra-historia", label: "Nuestra historia" },
  { href: "/contacto", label: "Contacto" },
] as const;

export const SITE_CTA = { href: "/crear-experiencia", label: "Diseña tu experiencia" } as const;
export const MY_EVENT_LINK = { href: "/mi-evento", label: "Mi evento" } as const;

export const WHATSAPP_DEFAULT_MESSAGE = "Hola Ivonne & Rosa, quiero información de una experiencia";

export const SERVICE_ZONES = ["Polanco", "Granada", "Irrigación"] as const;

export function instagramUrl(handle: string): string {
  return `https://www.instagram.com/${handle.replace(/^@/, "")}`;
}

/** ¿El link de navegación corresponde a la ruta actual? */
export function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
