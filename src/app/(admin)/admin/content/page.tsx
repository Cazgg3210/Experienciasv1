import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/session";
import { listTestimonials } from "@/features/content/server/content-service";
import { TestimonialsManager } from "@/features/content/components/testimonials-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Testimonios · Contenido" };

export default async function ContentTestimonialsPage() {
  await requirePagePermission("content:write", "/admin/content");
  const rows = await listTestimonials();
  return (
    <TestimonialsManager
      items={rows.map((t) => ({
        id: t.id,
        authorName: t.authorName,
        occasion: t.occasion,
        body: t.body,
        rating: t.rating,
        active: t.active,
        sortOrder: t.sortOrder,
      }))}
    />
  );
}
