"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es-MX">
      <body style={{ fontFamily: "Georgia, serif", background: "#f7f3ec", color: "#2f2c2a", margin: 0 }}>
        <main style={{ maxWidth: 480, margin: "15vh auto", padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 28 }}>Algo salió mal</h1>
          <p style={{ fontFamily: "sans-serif", fontSize: 14 }}>
            Ya estamos revisando. Referencia: <code>{error.digest ?? "sin-ref"}</code>
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "10px 20px",
              borderRadius: 999,
              border: 0,
              background: "#5c6b4e",
              color: "#f7f3ec",
            }}
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
