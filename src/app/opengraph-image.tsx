import { ImageResponse } from "next/og";

/** Imagen OpenGraph por defecto del sitio (1200×630): fondo ivory, wordmark olive y promesa. */
export const alt = "Ivonne & Rosa — experiencias íntimas llave en mano en CDMX";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const IVORY = "#f7f3ec";
const OLIVE = "#5c6b4e";
const CHARCOAL = "#2f2c2a";
const TAUPE = "#a48f7e";
const SAND = "#e8dcc8";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: IVORY,
          padding: "72px 80px",
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 56, height: 2, background: TAUPE }} />
          <div style={{ fontSize: 24, letterSpacing: 6, color: TAUPE, textTransform: "uppercase" }}>
            Experiencias íntimas · CDMX
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 132, color: OLIVE, lineHeight: 1, letterSpacing: -3 }}>Ivonne &amp; Rosa</div>
          <div style={{ marginTop: 36, fontSize: 44, color: CHARCOAL, lineHeight: 1.2, maxWidth: 900 }}>
            Tú reúne a las tuyas. Nosotras hacemos el resto.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 26, color: CHARCOAL }}>Brunches y experiencias para 6–12 personas</div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ width: 22, height: 22, borderRadius: 11, background: OLIVE }} />
            <div style={{ width: 22, height: 22, borderRadius: 11, background: "#a3b18a" }} />
            <div style={{ width: 22, height: 22, borderRadius: 11, background: SAND }} />
            <div style={{ width: 22, height: 22, borderRadius: 11, background: "#e9c9be" }} />
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
