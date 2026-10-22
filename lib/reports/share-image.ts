// Imagen para compartir del reporte mensual (oct-2026): 1080×1920 (historia
// de Instagram), misma composición que el póster aprobado de la última
// tarjeta — negro, rojo Euskadi, mes apilado en Bebas Neue y 2-3 números.
// Canvas puro, en el navegador del cliente.

type ShareData = {
  words: string[];
  clientName: string;
  stats: { value: string; label: string }[];
};

const W = 1080;
const H = 1920;
const RED = "#e8001c";
const INK = "#f5f5f5";
const MARGIN = 96;

// next/font renombra las familias: se usa la lista que exponen las
// variables CSS del layout (--font-bebas-neue / --font-dm-sans).
function family(variable: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return v || fallback;
}

export async function generateReportShareImage(data: ShareData): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const bebas = family("--font-bebas-neue", "'Bebas Neue', sans-serif");
  const dm = family("--font-dm-sans", "system-ui, sans-serif");
  await document.fonts.ready;

  ctx.fillStyle = "#080808";
  ctx.fillRect(0, 0, W, H);

  // Brillo rojo arriba a la derecha
  const glow = ctx.createRadialGradient(W - 120, 160, 0, W - 120, 160, 620);
  glow.addColorStop(0, "rgba(232,0,28,0.55)");
  glow.addColorStop(1, "rgba(232,0,28,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Marca
  ctx.textBaseline = "alphabetic";
  ctx.font = `400 64px ${bebas}`;
  ctx.fillStyle = INK;
  const brand = "EUSKADI ";
  ctx.fillText(brand, MARGIN, 230);
  ctx.fillStyle = RED;
  ctx.fillText("TEAM", MARGIN + ctx.measureText(brand).width, 230);

  // Mes apilado
  const monthSize = data.words.length >= 3 ? 250 : 290;
  ctx.font = `400 ${monthSize}px ${bebas}`;
  ctx.fillStyle = INK;
  let y = 330 + monthSize * 0.85;
  for (const w of data.words) {
    ctx.fillText(w.toUpperCase(), MARGIN, y);
    y += monthSize * 0.85;
  }

  ctx.font = `400 44px ${dm}`;
  ctx.fillStyle = "#a8a8a8";
  ctx.fillText(data.clientName, MARGIN, y - monthSize * 0.85 + 90);

  // Números (de abajo hacia arriba, dentro de la zona segura de historias)
  const rowH = 190;
  let rowY = H - 300 - (data.stats.length - 1) * rowH;
  for (const s of data.stats) {
    ctx.strokeStyle = "#2a2a2a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(MARGIN, rowY - 130);
    ctx.lineTo(W - MARGIN, rowY - 130);
    ctx.stroke();
    ctx.font = `400 140px ${bebas}`;
    ctx.fillStyle = RED;
    ctx.fillText(s.value, MARGIN, rowY);
    ctx.font = `500 40px ${dm}`;
    ctx.fillStyle = "#c9c9c9";
    ctx.textAlign = "right";
    ctx.fillText(s.label, W - MARGIN, rowY);
    ctx.textAlign = "left";
    rowY += rowH;
  }

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}
