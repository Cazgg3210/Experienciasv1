import { isPlausibleToken } from "@/lib/tokens";
import { getInviteCalendar } from "@/features/guests/server/invite-queries";

export const dynamic = "force-dynamic";

/** Descarga .ics ("Agregar a mi calendario") del evento de la invitación. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  if (!isPlausibleToken(token)) return new Response("No encontrado", { status: 404 });
  const ics = await getInviteCalendar(slug, token);
  if (!ics) return new Response("No encontrado", { status: 404 });
  return new Response(ics.content, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ics.filename.replace(/[^a-z0-9.-]/gi, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
