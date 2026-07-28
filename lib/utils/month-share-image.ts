// Imagen para compartir el resumen del mes (jul-2026, v6) — formato
// historia 1080x1920, Canvas API pura (sin html2canvas ni dependencias
// nuevas). v5 resolvió la composición (zonas seguras de Instagram,
// jerarquía de bloques) pero el ACABADO se veía barato: demasiadas
// partículas multicolor, todo en mayúsculas compitiendo, rojo plano,
// fondo sin textura. v6 no toca la estructura — ajusta el acabado hacia
// una estética tipo campaña deportiva (Nike / poster de boxeo): fondo
// oscuro con grano sutil, un elemento dominante (el número, con
// degradado real), jerarquía tipográfica real (mayúsculas SOLO en número
// y frase del logro), y muy pocos adornos dorados en vez de confeti de
// cumpleaños.

import type { MonthHighlightType } from "@/lib/utils/month-highlight";

export type MonthShareData = {
  clientFirstName: string;
  monthLabel: string;
  bigNumber: string;
  phrase: string;
  backups: string[];
  highlightType: MonthHighlightType;
  // Misma frase que ya arma closingMessage() en MonthRecapClosing — la
  // "voz Euskadi" de la imagen reusa ese texto en vez de inventar copy
  // nuevo, ver components/client/month-recap/closing.tsx.
  voiceLine: string;
};

// Variante del saludo según el tipo de logro elegido — mismo criterio que
// el resto de la selección (computeMonthHighlight): body_fat/muscle/weight/
// measurement son distintos caminos hacia el mismo relato ("cambió tu
// cuerpo"), así que comparten variante.
function greetingSubtitle(type: MonthHighlightType): string {
  switch (type) {
    case "exercise":
      return "Mirá lo que levantaste este mes";
    case "body_fat":
    case "muscle":
    case "weight":
    case "measurement":
      return "Mirá cómo cambió tu cuerpo este mes";
    case "streak":
      return "Mirá lo que sostuviste este mes";
    case "consistency":
    default:
      return "Mirá lo que lograste este mes";
  }
}

const WIDTH = 1080;
const HEIGHT = 1920;

const BG = "#080808";
const CARD_BORDER = "#1e1e1e";
const TEXT = "#f5f5f5";

// Paleta dorada reforzada — reemplaza el dorado/ámbar/rojo/blanco/violeta/
// celeste de v5. Solo dos tonos de dorado + blanco muy tenue.
const GOLD_LIGHT = "240,217,140"; // #F0D98C
const GOLD_DARK = "212,175,55"; // #D4AF37
const WHITE_RGB = "255,255,255";
// Garnet — el "rojo con profundidad" del halo de fondo: un resplandor
// apagado, no el rojo vibrante de marca (ese queda reservado al número).
const GARNET = "138,20,36";

// Zonas verticales en px sobre 1920 — zonas seguras de historias de
// Instagram. DEAD_TOP/DEAD_BOTTOM son las franjas que la interfaz de
// Instagram tapa; ningún texto puede caer ahí.
const DEAD_TOP = 250;
const DEAD_BOTTOM = 1600;
// Solo el saludo tiene una franja fija — el resto (respaldo/voz/firma)
// fluye dinámicamente a partir de acá, ver cursorY en generateMonthShareImage.
const ZONE_GREETING_END = 450;
const HERO_CENTER = 800; // centro óptico pedido para el bloque protagonista

// Márgenes laterales — Instagram no tapa los costados, pero texto pegado
// al borde se ve mal igual. 110px (subido desde 80): "el espacio vacío
// es lo que comunica valor".
const SIDE_MARGIN = 110;
const MAX_TEXT_WIDTH = WIDTH - SIDE_MARGIN * 2; // 860

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Halo suave — radial genérico, color parametrizable. Se usa tanto para
// el resplandor granate de fondo como para el halo detrás del número
// (mismo recurso visual, dos intensidades distintas).
function drawGlow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  alpha: number,
  rgb: string = GARNET
) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  g.addColorStop(0, `rgba(${rgb}, ${alpha})`);
  g.addColorStop(0.55, `rgba(${rgb}, ${alpha * 0.35})`);
  g.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
}

// Textura de grano — una capa de ruido muy leve sobre el fondo. Es lo que
// separa una imagen "digital plana" de una con acabado real; se genera
// una vez como tile chico (128px) y se repite como pattern en vez de
// escribir ruido pixel a pixel sobre los 1080x1920 completos.
function createNoisePattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const size = 128;
  const noiseCanvas = document.createElement("canvas");
  noiseCanvas.width = size;
  noiseCanvas.height = size;
  const nctx = noiseCanvas.getContext("2d");
  if (!nctx) return null;
  const imageData = nctx.createImageData(size, size);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const v = Math.random() * 255;
    imageData.data[i] = v;
    imageData.data[i + 1] = v;
    imageData.data[i + 2] = v;
    imageData.data[i + 3] = 255;
  }
  nctx.putImageData(imageData, 0, 0);
  return ctx.createPattern(noiseCanvas, "repeat");
}

// Destello de 4 puntas (parecido al ✨ de iOS, nunca el emoji en sí — se
// renderiza distinto por dispositivo/red social y en Canvas puede salir
// vacío). Lados curvados HACIA ADENTRO (el punto de control de cada curva
// va más cerca del centro que el punto medio recto entre puntas) — esa
// concavidad es lo que separa un destello de una cruz/diamante genérico.
// Colores parametrizables: los pocos destellos grandes cerca del número
// llevan glow propio, los chicos dispersos no (para no ensuciar el resto
// de la imagen).
function drawSparkle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  alpha: number,
  centerRgb: string,
  tipRgb: string,
  glow: boolean
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;

  if (glow) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.2);
    g.addColorStop(0, `rgba(${tipRgb}, 0.3)`);
    g.addColorStop(1, `rgba(${tipRgb}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  grad.addColorStop(0, `rgb(${centerRgb})`);
  grad.addColorStop(1, `rgb(${tipRgb})`);
  ctx.fillStyle = grad;

  const inner = r * 0.22;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(inner, -inner, r, 0);
  ctx.quadraticCurveTo(inner, inner, 0, r);
  ctx.quadraticCurveTo(-inner, inner, -r, 0);
  ctx.quadraticCurveTo(-inner, -inner, 0, -r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Punto de luz — un simple resplandor circular, más discreto que un
// destello de 4 puntas. Reemplaza al confeti de papelitos y a las
// chispas lineales de v5 (multicolor, ruidoso); acá solo dorado/blanco.
function drawLightDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  alpha: number,
  rgb: string
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb}, 0.9)`);
  g.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function pickUniqueCells(totalCells: number, count: number): number[] {
  const idx = Array.from({ length: totalCells }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, count);
}

type ExclusionRect = { left: number; right: number; top: number; bottom: number };

function isInsideExclusion(x: number, y: number, rect: ExclusionRect): boolean {
  return x > rect.left && x < rect.right && y > rect.top && y < rect.bottom;
}

// Partículas de celebración — v6: "el lujo es escaso". 18-24 en total (no
// 55-70), solo dorado + algún blanco muy tenue (nada de violeta/celeste),
// sin confeti de papelitos. 3 destellos grandes (28-36px, casi opacos) se
// concentran cerca del número; el resto (puntos de luz y destellos chicos,
// 6-14px, opacidad 25-60%) se reparte disperso y sutil por el resto del
// canvas vía una grilla invisible 6×10 (celdas únicas, sin grilla visible).
// Ninguna partícula puede caer dentro de exclusionRect (el bloque número +
// frase) — si el sorteo cae ahí adentro, se reubica: los destellos grandes
// reintentan otro ángulo/distancia, los chicos se mueven a otra celda de la
// grilla en vez de simplemente descartarse.
function drawCelebrationParticles(
  ctx: CanvasRenderingContext2D,
  cx: number,
  numberCenterY: number,
  exclusionRect: ExclusionRect
) {
  const largeCount = 3;
  for (let i = 0; i < largeCount; i++) {
    let x = cx;
    let y = numberCenterY;
    let placed = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 150 + Math.random() * 210;
      x = cx + Math.cos(angle) * dist;
      y = numberCenterY + Math.sin(angle) * dist * 0.55;
      if (!isInsideExclusion(x, y, exclusionRect)) {
        placed = true;
        break;
      }
    }
    if (!placed) continue;
    const r = 28 + Math.random() * 8;
    const alpha = 0.85 + Math.random() * 0.15;
    drawSparkle(ctx, x, y, r, alpha, GOLD_LIGHT, GOLD_DARK, true);
  }

  const cols = 6;
  const rows = 10;
  const cellW = WIDTH / cols;
  const cellH = HEIGHT / rows;
  const smallCount = 18;
  // Orden aleatorio de TODAS las celdas (no solo smallCount): si una celda
  // cae tapada por la exclusión, se pasa a la siguiente del orden — eso es
  // "reubicar" la partícula en otra zona, no perderla.
  const cellOrder = pickUniqueCells(cols * rows, cols * rows);

  let placedCount = 0;
  for (const cellIndex of cellOrder) {
    if (placedCount >= smallCount) break;
    const col = cellIndex % cols;
    const row = Math.floor(cellIndex / cols);

    let x = 0;
    let y = 0;
    let placed = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      x = col * cellW + cellW * 0.2 + Math.random() * cellW * 0.6;
      y = row * cellH + cellH * 0.2 + Math.random() * cellH * 0.6;
      if (!isInsideExclusion(x, y, exclusionRect)) {
        placed = true;
        break;
      }
    }
    if (!placed) continue;
    placedCount++;

    const isWhite = Math.random() < 0.15;
    const size = 6 + Math.random() * 8;
    const alpha = isWhite ? 0.15 + Math.random() * 0.2 : 0.25 + Math.random() * 0.35;

    if (Math.random() < 0.5) {
      drawSparkle(
        ctx,
        x,
        y,
        size,
        alpha,
        isWhite ? WHITE_RGB : GOLD_LIGHT,
        isWhite ? WHITE_RGB : GOLD_DARK,
        false
      );
    } else {
      drawLightDot(ctx, x, y, size, alpha, isWhite ? WHITE_RGB : GOLD_DARK);
    }
  }
  ctx.globalAlpha = 1;
}

// Tamaño de fuente que se achica hasta entrar en maxWidth — "12,5 KG" y
// "100" no pueden usar el mismo tamaño fijo sin que uno se corte.
function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  family: string,
  weight: number,
  startSize: number,
  maxWidth: number,
  minSize = 80,
  style: "normal" | "italic" = "normal"
): number {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${style === "italic" ? "italic " : ""}${weight} ${size}px "${family}"`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 6;
  }
  return size;
}

// Wrap simple por palabras — la frase de cierre del coach ("Así se
// construye una temporada. Nos vemos el mes que viene.") es larga; en una
// sola línea forzaría un tamaño ilegible. Devuelve las líneas resultantes
// al tamaño de fuente ya seteado en ctx.
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Encuentra el tamaño más grande (bajando desde startSize) que deja la
// frase de cierre en maxLines líneas o menos, dentro de maxWidth.
function fitWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  family: string,
  weight: number,
  startSize: number,
  maxWidth: number,
  maxLines: number,
  minSize: number,
  style: "normal" | "italic" = "normal"
): { size: number; lines: string[] } {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${style === "italic" ? "italic " : ""}${weight} ${size}px "${family}"`;
    const lines = wrapLines(ctx, text, maxWidth);
    if (lines.length <= maxLines) return { size, lines };
    size -= 4;
  }
  ctx.font = `${style === "italic" ? "italic " : ""}${weight} ${minSize}px "${family}"`;
  return { size: minSize, lines: wrapLines(ctx, text, maxWidth) };
}

function setLetterSpacing(ctx: CanvasRenderingContext2D, value: string) {
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = value;
}

// Marca las zonas muertas con líneas punteadas — SOLO para revisar en
// desarrollo (ver app/scratch-month-preview). Nunca se llama con
// debugZones:true desde ShareMonthButton (el flujo real de la app).
function drawDebugZones(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.setLineDash([14, 10]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#00E5FF";
  [DEAD_TOP, DEAD_BOTTOM].forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  });
  ctx.fillStyle = "#00E5FF";
  ctx.font = '700 26px "DM Sans"';
  ctx.textAlign = "left";
  ctx.fillText("ZONA MUERTA (Instagram) — abajo de esta línea empieza lo seguro", 16, DEAD_TOP - 14);
  ctx.fillText("ZONA MUERTA (Instagram) — arriba de esta línea empieza lo tapado", 16, DEAD_BOTTOM + 34);

  ctx.setLineDash([6, 8]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.moveTo(0, ZONE_GREETING_END);
  ctx.lineTo(WIDTH, ZONE_GREETING_END);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath();
  ctx.moveTo(SIDE_MARGIN, 0);
  ctx.lineTo(SIDE_MARGIN, HEIGHT);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(WIDTH - SIDE_MARGIN, 0);
  ctx.lineTo(WIDTH - SIDE_MARGIN, HEIGHT);
  ctx.stroke();
  ctx.restore();
}

export async function generateMonthShareImage(
  data: MonthShareData,
  options?: { debugZones?: boolean }
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  await Promise.all([
    document.fonts.load('400 900px "Bebas Neue"'),
    document.fonts.load('700 40px "DM Sans"'),
    document.fonts.load('400 32px "DM Sans"'),
    document.fonts.load('italic 400 40px "DM Sans"'),
    document.fonts.load('400 48px "Anton"'),
  ]).catch(() => {});

  const logo = await loadImage("/brand/euskadi-logo.png");

  const cx = WIDTH / 2;
  // Posición fija del número (no depende de measureText, así se puede usar
  // antes de dibujarlo para anclar el halo y las partículas cercanas).
  const numberBaseline = ZONE_GREETING_END + 25 + 700 * 0.72;
  const numberCenterY = numberBaseline - 700 * 0.36;

  // Tamaños reales del número y la frase — se necesitan ADELANTADOS (antes
  // de dibujar fondo/tridente/partículas) para poder calcular la zona de
  // exclusión de partículas y el centro vertical real del tridente. Se
  // reusan más abajo en vez de recalcularlos (fitFontSize deja ctx.font ya
  // seteado al tamaño ganador).
  const numberSize = fitFontSize(ctx, data.bigNumber, "Bebas Neue", 400, 700, 820, 110);
  const numberWidth = ctx.measureText(data.bigNumber).width;
  const phraseBaseline = numberBaseline + 95;
  const phraseSize = fitFontSize(ctx, data.phrase, "DM Sans", 700, 38, MAX_TEXT_WIDTH, 26);
  setLetterSpacing(ctx, `${phraseSize * 0.15}px`);
  const phraseWidth = ctx.measureText(data.phrase).width;
  setLetterSpacing(ctx, "0px");

  // Zona de exclusión: el bloque completo número + frase del logro, con
  // margen. Ninguna partícula puede caer acá adentro (ver
  // drawCelebrationParticles) y es el ancla vertical del tridente de fondo
  // (punto 1/2 del ajuste jul-2026 — antes el tridente y las partículas se
  // ubicaban solo respecto al número, y tapaban la frase o los dígitos).
  const numberTop = numberBaseline - numberSize * 0.8;
  const phraseBottom = phraseBaseline + phraseSize * 0.3;
  const heroBlockCenterY = (numberTop + phraseBottom) / 2;
  const exclusionRect = {
    left: cx - Math.max(numberWidth, phraseWidth) / 2 - 50,
    right: cx + Math.max(numberWidth, phraseWidth) / 2 + 50,
    top: numberTop - 24,
    bottom: phraseBottom + 24,
  };

  // Fondo — degradado radial NEUTRO y sutil (#141414 centro → #080808
  // bordes), no el rojo de AuthHero: el rojo queda reservado como acento
  // detrás del número, no como wash de toda la imagen (ver v6, punto 4/5).
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const bgGlow = ctx.createRadialGradient(cx, HERO_CENTER, 0, cx, HERO_CENTER, 1500);
  bgGlow.addColorStop(0, "#141414");
  bgGlow.addColorStop(0.35, "#101010");
  bgGlow.addColorStop(0.65, "#0d0d0d");
  bgGlow.addColorStop(1, BG);
  ctx.fillStyle = bgGlow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Grano — capa de ruido muy leve (2-3.5%) sobre todo el fondo, lo que le
  // da el acabado "con textura" en vez de plano digital.
  const noise = createNoisePattern(ctx);
  if (noise) {
    ctx.save();
    ctx.globalAlpha = 0.035;
    ctx.fillStyle = noise;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.restore();
  }

  // Tridente de fondo — casi imperceptible (10% de opacidad, dentro de
  // 8-12% pedido), centrado detrás del BLOQUE COMPLETO número+frase
  // (heroBlockCenterY, no el HERO_CENTER fijo) y más angosto que alto
  // (60% del ancho respecto al alto) para que las puntas laterales no
  // lleguen a la altura del número: es una marca de agua, no un
  // protagonista, y no puede atravesar los dígitos.
  const tridenteH = HEIGHT * 0.72;
  const tridenteW = tridenteH * 0.6;
  if (logo) {
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.drawImage(
      logo,
      cx - tridenteW / 2,
      heroBlockCenterY - tridenteH / 2,
      tridenteW,
      tridenteH
    );
    ctx.restore();
  }

  // Partículas de celebración — ver drawCelebrationParticles (18-24,
  // doradas, casi todas chicas y tenues, se dibujan antes que el número/
  // texto para que nunca los tapen, y ninguna puede caer dentro de
  // exclusionRect).
  drawCelebrationParticles(ctx, cx, numberCenterY, exclusionRect);

  // Halo rojo detrás del número — ahora un resplandor granate difuso
  // (GARNET, no el rojo vibrante de marca) y mucho más grande/sutil que
  // en v5, para que se sienta como profundidad y no como wash brillante.
  drawGlow(ctx, cx, numberCenterY, 780, 0.22, GARNET);

  // Número protagonista — el único elemento que "grita": mayúsculas,
  // enorme (65-80% del ancho), con degradado vertical real (#FF1F38 →
  // #A80014) en vez de rojo plano. numberSize ya se calculó arriba (se
  // necesitaba temprano para la zona de exclusión de partículas).
  const numberGradient = ctx.createLinearGradient(
    0,
    numberBaseline - numberSize * 0.78,
    0,
    numberBaseline + numberSize * 0.08
  );
  numberGradient.addColorStop(0, "#FF1F38");
  numberGradient.addColorStop(1, "#A80014");
  ctx.fillStyle = numberGradient;
  ctx.font = `400 ${numberSize}px "Bebas Neue"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(data.bigNumber, cx, numberBaseline);

  // Frase del logro — la única otra cosa en mayúsculas, pero chica, gris
  // claro (no rojo) y con tracking amplio: apoya al número, no compite.
  // phraseBaseline/phraseSize ya se calcularon arriba (idem numberSize).
  ctx.fillStyle = "#C4C4C4";
  ctx.font = `700 ${phraseSize}px "DM Sans"`;
  setLetterSpacing(ctx, `${phraseSize * 0.15}px`);
  ctx.fillText(data.phrase, cx, phraseBaseline);
  setLetterSpacing(ctx, "0px");

  // Saludo personal — sentence case (Bebas Neue no tiene minúsculas
  // reales, así que pasa a DM Sans bold para que "sentence case" se vea
  // como tal). Encabezado, no titular: no compite con el número.
  const headline = data.clientFirstName
    ? `¡Felicitaciones, ${data.clientFirstName}!`
    : "¡Felicitaciones!";
  const headlineBaseline = DEAD_TOP + 110;
  const headlineSize = fitFontSize(ctx, headline, "DM Sans", 700, 56, MAX_TEXT_WIDTH, 32);
  ctx.fillStyle = TEXT;
  ctx.font = `700 ${headlineSize}px "DM Sans"`;
  ctx.fillText(headline, cx, headlineBaseline);

  const subtitle = greetingSubtitle(data.highlightType);
  const subtitleBaseline = headlineBaseline + 70;
  const subtitleSize = fitFontSize(ctx, subtitle, "DM Sans", 500, 34, MAX_TEXT_WIDTH, 24);
  ctx.fillStyle = "#8A8A8A";
  ctx.font = `500 ${subtitleSize}px "DM Sans"`;
  ctx.fillText(subtitle, cx, subtitleBaseline);

  const monthBaseline = subtitleBaseline + 52;
  ctx.fillStyle = "#666666";
  ctx.font = '400 24px "DM Sans"';
  ctx.fillText(data.monthLabel, cx, monthBaseline);

  // Datos de respaldo — sentence case, chicos, tarjeta con más padding
  // interno. El flujo vertical es dinámico (arranca después de la frase,
  // con gap fijo) para que la separación se sienta igual de clara pidan
  // 0, 1 o 2 líneas de respaldo. Los gaps de acá abajo están ajustados
  // para caber, en el peor caso (2 respaldos + voz de 2 líneas), dentro
  // de la zona segura (hasta DEAD_BOTTOM) — no son el +40% parejo pedido
  // porque ese presupuesto de espacio es fijo; la sensación de "más aire"
  // sale de la tipografía más chica/liviana y los márgenes laterales
  // más anchos, no solo de gaps más grandes.
  let cursorY = phraseBaseline + 65;
  if (data.backups.length > 0) {
    const cardW = WIDTH * 0.81;
    const cardX = cx - cardW / 2;
    const rowH = 70;
    const cardPad = 54;
    const cardH = cardPad * 2 + data.backups.length * rowH - (rowH - 44);
    const cardY = cursorY;

    roundedRectPath(ctx, cardX, cardY, cardW, cardH, 16);
    ctx.fillStyle = "rgba(17, 17, 17, 0.88)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = CARD_BORDER;
    ctx.stroke();

    ctx.textAlign = "left";
    data.backups.forEach((line, i) => {
      const rowY = cardY + cardPad + i * rowH + 24;
      roundedRectPath(ctx, cardX + cardPad, rowY - 16, 14, 14, 3);
      ctx.fillStyle = "#e8001c";
      ctx.fill();
      ctx.fillStyle = TEXT;
      ctx.font = '400 36px "DM Sans"';
      ctx.fillText(line, cardX + cardPad + 30, rowY);
    });
    ctx.textAlign = "center";

    cursorY = cardY + cardH + 65;
  }

  // Voz Euskadi — misma frase que MonthRecapClosing, ahora en sentence
  // case + cursiva sutil + gris claro (antes era Bebas Neue mayúscula
  // blanca, competía con el saludo). Sigue sin inventarse copy nueva.
  const { size: voiceSize, lines: voiceLines } = fitWrappedText(
    ctx,
    data.voiceLine,
    "DM Sans",
    400,
    36,
    MAX_TEXT_WIDTH,
    2,
    24,
    "italic"
  );
  const voiceLineHeight = voiceSize * 1.3;
  const voiceFirstBaseline = cursorY + voiceSize * 0.9;
  ctx.fillStyle = "#B8B8B8";
  ctx.font = `italic 400 ${voiceSize}px "DM Sans"`;
  voiceLines.forEach((line, i) => {
    ctx.fillText(line, cx, voiceFirstBaseline + i * voiceLineHeight);
  });
  cursorY = voiceFirstBaseline + (voiceLines.length - 1) * voiceLineHeight + 50;

  // Firma Euskadi Team al pie — lockup horizontal (tridente + wordmark en
  // línea), la única excepción que se mantiene en mayúsculas/Anton: es el
  // wordmark de marca, no una oración. Es la firma en algo que va a
  // circular en redes: +46% sobre la versión anterior (26px->38px de
  // fuente, ícono 30px->44px, tracking y gap escalados en proporción) para
  // que se lea a tamaño real de feed, no solo mirando la imagen entera.
  const footerCenterY = Math.min(cursorY, DEAD_BOTTOM - 30);
  const footerText = "EUSKADI TEAM";
  ctx.font = '400 38px "Anton"';
  setLetterSpacing(ctx, "4px");
  const footerTextWidth = ctx.measureText(footerText).width;
  const iconSize = 44;
  const gap = 16;
  const footerTotalWidth = logo ? iconSize + gap + footerTextWidth : footerTextWidth;
  const footerStartX = cx - footerTotalWidth / 2;
  if (logo) {
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.drawImage(logo, footerStartX, footerCenterY - iconSize / 2, iconSize, iconSize);
    ctx.restore();
  }
  ctx.fillStyle = TEXT;
  ctx.textAlign = "left";
  ctx.fillText(footerText, footerStartX + (logo ? iconSize + gap : 0), footerCenterY + 13);
  setLetterSpacing(ctx, "0px");
  ctx.textAlign = "left";

  if (options?.debugZones) drawDebugZones(ctx);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}
