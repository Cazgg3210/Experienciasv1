import type { Metadata } from "next";
import { Palette, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/data/status-badge";
import { cn } from "@/lib/utils";
import { countLabel } from "@/features/catalog/domain/catalog-rules";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { EMPTY_STYLE, listStylesForAdmin, nextSortOrder } from "@/features/catalog/server/queries";
import { ActiveToggle, DeleteCatalogButton } from "@/features/catalog/components/catalog-actions";
import { CatalogImage } from "@/features/catalog/components/catalog-image";
import { StyleDialog, Swatches } from "@/features/catalog/components/style-dialog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Estilos" };

export default async function CatalogStylesPage() {
  const user = await requirePagePermission("catalog:read", "/admin/catalog/styles");
  const canWrite = can(user.role, "catalog:write");
  const canUpload = can(user.role, "media:upload");
  const [styles, sortOrder] = await Promise.all([listStylesForAdmin(), nextSortOrder("style")]);

  const newButton = canWrite ? (
    <StyleDialog
      mode="create"
      defaultValues={{ ...EMPTY_STYLE, sortOrder }}
      canUpload={canUpload}
      trigger={
        <Button size="lg">
          <Plus aria-hidden />
          Nuevo estilo
        </Button>
      }
    />
  ) : null;

  return (
    <>
      <PageHeader
        title="Estilos"
        description="Paletas y ambientes que inspiran la decoración. La clienta elige uno al configurar su experiencia."
        actions={newButton}
      />
      {styles.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {styles.map((s) => {
            const used = s.counts.experiences + s.counts.events + s.counts.leads;
            return (
              <li key={s.id} className={cn("bg-card flex flex-col overflow-hidden rounded-2xl border shadow-xs", !s.active && "bg-muted/50")}>
                <div className="relative aspect-[16/9]">
                  <CatalogImage src={s.imageUrl} alt={`Referencia del estilo ${s.name}`} />
                  {!s.active ? (
                    <span className="bg-background/95 text-muted-foreground absolute top-3 left-3 rounded-full px-2 py-0.5 text-xs font-medium">
                      Inactivo
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div>
                    <h2 className="font-heading text-lg font-semibold">{s.name}</h2>
                    {s.description ? <p className="text-muted-foreground line-clamp-2 text-sm">{s.description}</p> : null}
                  </div>
                  {s.palette.length ? (
                    <Swatches colors={s.palette} />
                  ) : (
                    <p className="text-muted-foreground text-xs">Sin paleta definida.</p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {s.counts.experiences ? <StatusBadge tone="brand">{countLabel(s.counts.experiences, "experiencia", "experiencias")}</StatusBadge> : null}
                    {s.counts.events ? <StatusBadge tone="neutral">{countLabel(s.counts.events, "evento", "eventos")}</StatusBadge> : null}
                    {!used ? <StatusBadge tone="muted" dot={false}>Sin uso todavía</StatusBadge> : null}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
                    <ActiveToggle entity="style" id={s.id} name={s.name} active={s.active} disabled={!canWrite} />
                    {canWrite ? (
                      <div className="flex gap-1">
                        <StyleDialog
                          mode="edit"
                          styleId={s.id}
                          defaultValues={s.values}
                          canUpload={canUpload}
                          trigger={
                            <Button variant="outline" size="lg" aria-label={`Editar ${s.name}`}>
                              <Pencil aria-hidden />
                              Editar
                            </Button>
                          }
                        />
                        <DeleteCatalogButton entity="style" id={s.id} name={s.name} compact />
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={Palette}
          title="Aún no hay estilos"
          description="Crea estilos como “Jardín romántico” o “Boho terracota” con su paleta para guiar la decoración."
          action={newButton}
        />
      )}
    </>
  );
}
