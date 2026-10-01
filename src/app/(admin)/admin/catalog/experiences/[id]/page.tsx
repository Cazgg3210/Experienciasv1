import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/data/status-badge";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import {
  getEngineSettings,
  getExperienceEditorData,
  getExperienceOptions,
  isPlausibleId,
  listPlaceholderImages,
} from "@/features/catalog/server/queries";
import { ExperienceEditor } from "@/features/catalog/components/experience-editor";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!isPlausibleId(id)) return { title: "Experiencia" };
  const data = await getExperienceEditorData(id).catch(() => null);
  return { title: data ? data.name : "Experiencia" };
}

export default async function ExperienceEditorPage({ params }: Props) {
  const user = await requirePagePermission("catalog:read", "/admin/catalog");
  const { id } = await params;
  if (!isPlausibleId(id)) notFound();
  const data = await getExperienceEditorData(id);
  if (!data) notFound();

  const [options, settings, placeholders] = await Promise.all([
    getExperienceOptions(data.values),
    getEngineSettings(),
    listPlaceholderImages(),
  ]);
  const canWrite = can(user.role, "catalog:write");
  const usage = [
    data.counts.events ? `${data.counts.events} ${data.counts.events === 1 ? "evento" : "eventos"}` : null,
    data.counts.quotes ? `${data.counts.quotes} ${data.counts.quotes === 1 ? "cotización" : "cotizaciones"}` : null,
    data.counts.leads ? `${data.counts.leads} ${data.counts.leads === 1 ? "lead" : "leads"}` : null,
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/catalog", label: "Experiencias" }}
        eyebrow={
          <span className="inline-flex flex-wrap items-center gap-2 normal-case">
            <StatusBadge tone={data.values.active ? "success" : "muted"}>{data.values.active ? "Activa" : "Inactiva"}</StatusBadge>
            {data.values.featured ? <StatusBadge tone="brand">Destacada</StatusBadge> : null}
          </span>
        }
        title={data.name}
        description={usage.length ? `Usada en ${usage.join(", ")}.` : "Todavía no se ha usado en cotizaciones ni eventos."}
        actions={
          data.values.active ? (
            <Button asChild variant="outline" size="lg">
              <Link href={`/experiencias/${data.values.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden />
                Ver en el sitio
                <span className="sr-only">(se abre en otra pestaña)</span>
              </Link>
            </Button>
          ) : null
        }
      />
      <ExperienceEditor
        mode="edit"
        experienceId={data.id}
        version={data.updatedAt.toISOString()}
        defaultValues={data.values}
        options={options}
        settings={settings}
        images={data.images}
        placeholders={placeholders}
        canWrite={canWrite}
        canPrice={can(user.role, "pricing:write")}
        deletable={canWrite}
      />
    </>
  );
}
