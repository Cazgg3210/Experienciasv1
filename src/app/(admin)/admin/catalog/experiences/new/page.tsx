import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import {
  EMPTY_EXPERIENCE,
  getEngineSettings,
  getExperienceOptions,
  listPlaceholderImages,
  nextSortOrder,
} from "@/features/catalog/server/queries";
import { ExperienceEditor } from "@/features/catalog/components/experience-editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nueva experiencia" };

export default async function NewExperiencePage() {
  const user = await requirePagePermission("catalog:write", "/admin/catalog/experiences/new");
  const [options, settings, placeholders, sortOrder] = await Promise.all([
    getExperienceOptions(),
    getEngineSettings(),
    listPlaceholderImages(),
    nextSortOrder("experience"),
  ]);
  return (
    <>
      <PageHeader
        back={{ href: "/admin/catalog", label: "Experiencias" }}
        title="Nueva experiencia"
        description="Empieza por lo básico y el precio; la experiencia se crea inactiva para que la revises antes de publicarla."
      />
      <ExperienceEditor
        mode="create"
        defaultValues={{ ...EMPTY_EXPERIENCE, sortOrder }}
        options={options}
        settings={settings}
        placeholders={placeholders}
        canWrite
        canPrice={can(user.role, "pricing:write")}
      />
    </>
  );
}
