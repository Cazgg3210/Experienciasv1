import type { Metadata } from "next";

/**
 * Layout de experiencias privadas por token (portal clienta, micrositio, cotización,
 * checkout, memory capsule). Sin navegación de marketing y sin indexación.
 *
 * NO agregar `loading.tsx` aquí ni en los segmentos intermedios (`cotizacion/`, `mi-evento/`, `e/`, `memory/`,
 * `pago/`), ni envolver `children` en <Suspense>: cada `[token]/layout.tsx` valida el token antes de su propio
 * límite de carga para responder un 404 real y genérico. Lo vigila tests/unit/route-not-found-contract.test.ts.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function ExperienceLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh">{children}</div>;
}
