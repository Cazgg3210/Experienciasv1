import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CircleAlert, Images, MessageSquareHeart, Share2, SlidersHorizontal, Sparkles } from "lucide-react";
import { Section } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/data/status-badge";
import { StatCard } from "@/components/data/stat-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatLongDate } from "@/lib/dates";
import { isEnabled } from "@/lib/flags";
import { requirePagePermission } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { defaultCapsuleMessage, defaultCapsuleTitle } from "@/features/memory-capsule/domain/capsule";
import { getAdminMemoryPage } from "@/features/memory-capsule/server/queries";
import { CreateCapsuleForm } from "@/features/memory-capsule/components/create-capsule-form";
import { CapsuleSettingsForm } from "@/features/memory-capsule/components/capsule-settings-form";
import { SharePanel } from "@/features/memory-capsule/components/share-panel";
import { AdminPhotoUploader } from "@/features/memory-capsule/components/admin-photo-uploader";
import { MediaModerationGrid } from "@/features/memory-capsule/components/media-moderation-grid";
import { MessagesModeration } from "@/features/memory-capsule/components/messages-moderation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Memory Capsule" };

const AUTHOR_LABELS = { CUSTOMER: "Clienta", GUEST: "Invitada", ADMIN: "Equipo", SYSTEM: "Sistema" } as const;

export default async function EventMemoryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("memory:write");
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/i.test(id)) notFound();

  const [data, enabled] = await Promise.all([getAdminMemoryPage(id), isEnabled("MEMORY_CAPSULE_ENABLED")]);
  if (!data) notFound();
  const { event, capsule, media, messages, summary } = data;
  const canModerate = can(user.role, "media:moderate");

  return (
    <div className="space-y-8">
      {/* El layout del evento ya muestra el encabezado (h1) y las pestañas; aquí va el h2 de la sección. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="eyebrow">Memory Capsule</p>
          <h2 className="font-heading text-2xl font-semibold text-balance sm:text-3xl">
            {capsule?.title ?? "Aún no hay Memory Capsule"}
          </h2>
          <p className="text-muted-foreground text-sm">
            {capsule
              ? "Galería, mensajes y enlace privado para compartir con la clienta y sus invitadas."
              : `Recuerdo digital del ${formatLongDate(event.eventDate)}: fotos, mensajes y un enlace privado.`}
          </p>
        </div>
        {capsule ? (
          <StatusBadge tone={capsule.published ? "success" : "warning"} className="self-start sm:self-auto">
            {capsule.published ? "Publicada" : "En preparación"}
          </StatusBadge>
        ) : null}
      </div>

      {!enabled ? (
        <Alert>
          <CircleAlert aria-hidden />
          <AlertTitle>La Memory Capsule está desactivada</AlertTitle>
          <AlertDescription>
            El módulo está apagado en Configuración → Funciones. Puedes preparar la cápsula, pero el enlace público
            no se mostrará a nadie hasta que se vuelva a activar.
          </AlertDescription>
        </Alert>
      ) : null}

      {!capsule ? (
        <Card className="max-w-2xl">
          <CardHeader>
            <div className="bg-sage-soft text-olive mb-2 flex size-10 items-center justify-center rounded-full">
              <Sparkles className="size-5" aria-hidden />
            </div>
            <CardTitle className="font-heading text-2xl">Crea la Memory Capsule de este evento</CardTitle>
            <CardDescription>
              Un espacio privado con la galería, los mensajes de las invitadas y un enlace para compartir. Se crea en
              preparación: nadie la verá hasta que la publiques.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateCapsuleForm
              eventId={event.id}
              defaultTitle={defaultCapsuleTitle(event.title)}
              defaultMessage={defaultCapsuleMessage(event.honoreeName)}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
          <div className="min-w-0 space-y-10">
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Fotos" value={String(summary.total)} />
              <StatCard label="Visibles" value={String(summary.approved)} />
              <StatCard label="Por revisar" value={String(summary.pending)} tone={summary.pending ? "warning" : "default"} />
            </div>

            <Section
              title="Fotos"
              description="Aprueba u oculta las fotos, elige la portada y elimina lo que no deba estar."
            >
              <AdminPhotoUploader eventId={event.id} capsuleId={capsule.id} />
              {canModerate ? (
                <MediaModerationGrid
                  capsuleId={capsule.id}
                  media={media.map((m) => ({
                    id: m.id,
                    url: m.url,
                    alt: m.alt,
                    uploaderName: m.uploaderName,
                    uploadedByTeam: m.uploadedByTeam,
                    consent: m.consent,
                    approved: m.approved,
                    isCover: m.isCover,
                    createdAtLabel: formatDateTime(m.createdAt),
                  }))}
                />
              ) : (
                <p className="text-muted-foreground text-sm">No tienes permiso para moderar fotos.</p>
              )}
            </Section>

            <Section
              title="Mensajes"
              description="Mensajes para la homenajeada y del libro de visitas. Oculta los que no deban mostrarse."
            >
              {canModerate ? (
                <MessagesModeration
                  eventId={event.id}
                  messages={messages
                    .filter((m) => m.kind !== "HOST_THREAD")
                    .map((m) => ({
                      id: m.id,
                      kind: m.kind,
                      authorName: m.authorName,
                      authorLabel: AUTHOR_LABELS[m.authorType],
                      body: m.body,
                      hidden: m.hidden,
                      createdAtLabel: formatDateTime(m.createdAt),
                    }))}
                />
              ) : (
                <p className="text-muted-foreground text-sm">No tienes permiso para moderar mensajes.</p>
              )}
            </Section>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start" aria-label="Compartir y ajustes">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Share2 className="text-olive size-4" aria-hidden />
                  Compartir
                </CardTitle>
                <CardDescription>Envía el enlace a {event.customerName} para que lo comparta con sus invitadas.</CardDescription>
              </CardHeader>
              <CardContent>
                <SharePanel
                  capsuleId={capsule.id}
                  shareUrl={capsule.shareUrl}
                  whatsappUrl={capsule.whatsappUrl}
                  customerName={event.customerName}
                  hasCustomerPhone={!!event.customerPhone}
                  published={capsule.published}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <SlidersHorizontal className="text-olive size-4" aria-hidden />
                  Ajustes
                </CardTitle>
                <CardDescription>Actualizado {formatDateTime(capsule.updatedAt)}</CardDescription>
              </CardHeader>
              <CardContent>
                <CapsuleSettingsForm
                  key={capsule.updatedAt.toISOString()}
                  capsule={{
                    id: capsule.id,
                    title: capsule.title,
                    message: capsule.message,
                    published: capsule.published,
                    allowGuestUploads: capsule.allowGuestUploads,
                  }}
                />
              </CardContent>
            </Card>

            <Card className="bg-sand-soft/60">
              <CardContent className="space-y-2 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <Images className="text-olive size-4" aria-hidden />
                  Cómo funciona
                </p>
                <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-xs">
                  <li>Las fotos del equipo se publican aprobadas; las de invitadas llegan ocultas.</li>
                  <li>Sólo las fotos visibles aparecen en la cápsula (con enlaces temporales).</li>
                  <li>
                    <MessageSquareHeart className="mr-1 inline size-3" aria-hidden />
                    Los mensajes se muestran al instante; puedes ocultarlos aquí.
                  </li>
                </ul>
              </CardContent>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}
