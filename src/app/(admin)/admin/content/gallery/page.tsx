import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/session";
import { listGallery } from "@/features/content/server/content-service";
import { GalleryManager } from "@/features/content/components/gallery-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Galería · Contenido" };

export default async function ContentGalleryPage() {
  await requirePagePermission("content:write", "/admin/content/gallery");
  const items = await listGallery();
  return <GalleryManager items={items.map((g) => ({ id: g.id, alt: g.alt, featured: g.featured, url: g.url }))} />;
}
