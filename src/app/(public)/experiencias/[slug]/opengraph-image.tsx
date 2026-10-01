import { ImageResponse } from "next/og";
import { formatMXN } from "@/lib/money";
import { guestRangeLabel } from "@/features/marketing/domain/display";
import { getExperienceDetail } from "@/features/marketing/server/queries";

/** Imagen OpenGraph por experiencia (nombre, tagline y precio desde). */
export const alt = "Experiencia Ivonne & Rosa";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

const IVORY = "#f7f3ec";
const OLIVE = "#5c6b4e";
const CHARCOAL = "#2f2c2a";
const TAUPE = "#a48f7e";
const SAGE_SOFT = "#e5eadb";

// Next 15 pasa `params` como objeto en rutas de imagen (en 16 será Promise): `await` cubre ambos casos.
export default async function ExperienceOgImage({ params }: { params: { slug: string } | Promise<{ slug: string }> }) {
  const { slug } = await params;
  const experience = await getExperienceDetail(slug).catch(() => null);
  const name = experience?.name ?? "Experiencias íntimas";
  const tagline = experience?.tagline ?? "Tú reúne a las tuyas. Nosotras hacemos el resto.";
  const price = experience
    ? `Desde ${formatMXN(experience.basePriceCents)} · ${guestRangeLabel(experience.minGuests, experience.maxGuests)}`
    : "Brunches y celebraciones para 6–12 personas";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: IVORY, fontFamily: "serif" }}>
        <div style={{ width: 28, height: "100%", background: OLIVE }} />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "64px 72px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 40, color: OLIVE }}>Ivonne &amp; Rosa</div>
            <div style={{ fontSize: 22, letterSpacing: 5, color: TAUPE, textTransform: "uppercase" }}>CDMX</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: name.length > 22 ? 84 : 104, color: CHARCOAL, lineHeight: 1.02, letterSpacing: -2 }}>{name}</div>
            <div style={{ marginTop: 28, fontSize: 36, color: CHARCOAL, opacity: 0.8, lineHeight: 1.25, maxWidth: 960 }}>{tagline}</div>
          </div>
          <div style={{ display: "flex" }}>
            <div
              style={{
                display: "flex",
                background: SAGE_SOFT,
                color: OLIVE,
                fontSize: 28,
                padding: "14px 28px",
                borderRadius: 999,
              }}
            >
              {price}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
