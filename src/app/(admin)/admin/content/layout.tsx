import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { requirePagePermission } from "@/server/auth/session";
import { SubNav } from "@/features/settings/components/sub-nav";

export const metadata: Metadata = { title: "Contenido" };

export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission("content:write", "/admin/content");
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sitio público"
        title="Contenido"
        description="Testimonios, preguntas frecuentes y galería que se muestran en el sitio. Los cambios se publican al guardar."
        className="mb-0"
      />
      <SubNav
        label="Secciones de contenido"
        orientation="horizontal"
        items={[
          { href: "/admin/content", label: "Testimonios", icon: "testimonials", exact: true },
          { href: "/admin/content/faq", label: "Preguntas frecuentes", icon: "faq" },
          { href: "/admin/content/gallery", label: "Galería", icon: "gallery" },
        ]}
      />
      {children}
    </div>
  );
}
