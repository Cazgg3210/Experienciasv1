import type { Metadata } from "next";

/**
 * Layout de experiencias privadas por token (portal clienta, micrositio, cotización,
 * checkout, memory capsule). Sin navegación de marketing y sin indexación.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function ExperienceLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh">{children}</div>;
}
