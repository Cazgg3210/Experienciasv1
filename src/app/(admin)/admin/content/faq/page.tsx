import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/session";
import { listExperienceOptions, listFaqs } from "@/features/content/server/content-service";
import { FaqManager } from "@/features/content/components/faq-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Preguntas frecuentes · Contenido" };

export default async function ContentFaqPage() {
  await requirePagePermission("content:write", "/admin/content/faq");
  const [rows, experiences] = await Promise.all([listFaqs(), listExperienceOptions()]);
  return (
    <FaqManager
      experiences={experiences}
      items={rows.map((f) => ({
        id: f.id,
        question: f.question,
        answer: f.answer,
        category: f.category,
        experience: f.experience,
        active: f.active,
        sortOrder: f.sortOrder,
      }))}
    />
  );
}
