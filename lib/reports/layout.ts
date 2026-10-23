import type { ReportCard } from "@/lib/reports/types";

// Tarjetas elegidas por el coach (oct-2026), guardadas en
// progress_reports.card_layout. Se aplican sobre el catálogo que arma el
// generador (cards): sobreviven a "Volver a generar" porque van por clave,
// no por posición. La portada va siempre primero y el cierre y la imagen
// para compartir siempre al final: no se apagan ni se mueven.
//
// Lo privado ("Solo lo ves vos") nunca es una tarjeta de cards — vive en
// progress_report_private —, así que ningún interruptor lo puede mandar al
// cliente. El peso con "No mostrar peso en reportes" directamente no se
// genera, así que tampoco se puede prender.
export type CardLayout = {
  order: string[];
  enabled: Record<string, boolean>;
};

export type ArrangedCard = {
  key: string;
  card: ReportCard;
  enabled: boolean;
  fixed: boolean;
};

const FIXED_FIRST: ReportCard["type"][] = ["opening"];
const FIXED_LAST: ReportCard["type"][] = ["closing", "share"];

export function cardKey(card: ReportCard, index: number): string {
  return card.key ?? `${card.type}-${index}`;
}

export function isFixedCard(card: ReportCard): boolean {
  return FIXED_FIRST.includes(card.type) || FIXED_LAST.includes(card.type);
}

export function arrangeCards(cards: ReportCard[], layout: CardLayout | null): ArrangedCard[] {
  const items = cards
    .filter((c) => c.type !== "coach-note")
    .map((card, i): ArrangedCard => {
      const key = cardKey(card, i);
      const fixed = isFixedCard(card);
      const enabled = fixed ? true : (layout?.enabled[key] ?? card.on !== false);
      return { key, card, enabled, fixed };
    });

  const head = items.filter((x) => FIXED_FIRST.includes(x.card.type));
  const tail = items.filter((x) => FIXED_LAST.includes(x.card.type));
  const middle = items.filter((x) => !x.fixed);
  if (layout?.order.length) {
    const rank = new Map(layout.order.map((k, i) => [k, i]));
    // Orden estable: las que el coach ordenó, en su orden; las nuevas (que
    // aparecieron al regenerar) quedan después, en el orden del generador.
    middle.sort((a, b) => (rank.get(a.key) ?? Infinity) - (rank.get(b.key) ?? Infinity));
  }
  return [...head, ...middle, ...tail];
}

// Lo que efectivamente ve el cliente: las prendidas, en orden.
export function clientCards(cards: ReportCard[], layout: CardLayout | null): ReportCard[] {
  return arrangeCards(cards, layout)
    .filter((x) => x.enabled)
    .map((x) => x.card);
}

// Valida lo que llega de la bandeja antes de guardarlo.
export function parseCardLayout(value: unknown): CardLayout | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { order?: unknown; enabled?: unknown };
  if (!Array.isArray(v.order) || !v.order.every((k) => typeof k === "string")) return null;
  if (!v.enabled || typeof v.enabled !== "object") return null;
  const enabled: Record<string, boolean> = {};
  for (const [k, on] of Object.entries(v.enabled as Record<string, unknown>)) {
    if (typeof on !== "boolean") return null;
    enabled[k] = on;
  }
  if (v.order.length > 300 || Object.keys(enabled).length > 300) return null;
  return { order: v.order as string[], enabled };
}

// Etiqueta para el panel "Tarjetas" de la bandeja.
export function cardLabel(card: ReportCard): string {
  switch (card.type) {
    case "opening":
      return "Portada";
    case "improvement":
      return `Mejor avance · ${card.exercise}`;
    case "effort":
      return "Esfuerzo (series y kilos)";
    case "adherence":
      return `Asistencia · ${card.done} de ${card.planned}`;
    case "count":
      return `Entrenamientos · ${card.value}`;
    case "records":
      return `Mejores marcas · ${card.value}`;
    case "volume":
      return `Volumen · ${card.percent > 0 ? "+" : ""}${card.percent} %`;
    case "streak":
      return `Racha · ${card.value} ${card.unit}`;
    case "weight":
      return `Peso · ${card.headline} kg`;
    case "body":
      return "Evaluación corporal";
    case "goal":
      return "Objetivo vs realidad";
    case "exercise":
      return `Gráfico · ${card.exercise}`;
    case "focus":
      return `Lo que viene · ${card.word}`;
    case "coach-message":
      return "Tu mensaje de cierre de mes";
    case "closing":
      return "Cierre firmado";
    case "share":
      return "Imagen para compartir";
    case "coach-note":
      return "Tu nota";
  }
}

// La nota personal del coach va antes de la imagen para compartir (que
// cierra el reporte) o al final. Mismo lugar en la vista previa y al enviar.
export function withCoachNote(cards: ReportCard[], note: ReportCard | null): ReportCard[] {
  const base = cards.filter((c) => c.type !== "coach-note");
  if (!note) return base;
  const i = base.findIndex((c) => c.type === "share");
  return i >= 0 ? [...base.slice(0, i), note, ...base.slice(i)] : [...base, note];
}
