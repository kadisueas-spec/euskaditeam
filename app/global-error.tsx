"use client";

// Último recurso: solo se monta si el ROOT layout (app/layout.tsx) explota.
// Reemplaza <html>/<body> por completo, así que no depende de nada que
// pueda fallar junto con el layout — nada de next/font ni componentes
// compartidos, solo hex directo y la fuente del sistema.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          padding: 24,
          textAlign: "center",
          background: "#080808",
          color: "#f5f5f5",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <span
          style={{
            display: "flex",
            width: 64,
            height: 64,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "9999px",
            border: "1px solid rgba(232,0,28,0.3)",
            background: "rgba(232,0,28,0.1)",
            fontSize: 28,
          }}
        >
          ⚠️
        </span>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            Algo se rompió
          </h1>
          <p style={{ color: "#888888", fontSize: 14, maxWidth: 280 }}>
            No es tu culpa, es nuestra. Reintentá o volvé al inicio.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={reset}
            style={{
              height: 32,
              padding: "0 16px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg, #e8001c, #ff4d4d)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Reintentar
          </button>
          <a
            href="/"
            style={{
              height: 32,
              display: "inline-flex",
              alignItems: "center",
              padding: "0 16px",
              borderRadius: 10,
              border: "1px solid #1e1e1e",
              color: "#f5f5f5",
              fontSize: 14,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Volver al inicio
          </a>
        </div>
      </body>
    </html>
  );
}
