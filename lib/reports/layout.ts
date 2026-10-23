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
//
// Textos editados (oct-2026): `texts` guarda, por clave, la frase que
// escribió el coach y la huella de los datos de la tarjeta en ese momento
// (`basis`). Solo se reemplaza la frase: números, gráficos y listas salen
// siempre de los datos. Si al regenerar la huella cambió, la tarjeta queda
// marcada para revisar.
export type EditedText = { phrase: string; basis: string };

export type CardLayout = {
  order: string[];
  enabled: Record<string, boolean>;
  texts?: Record<string, EditedText>;
};

export type ArrangedCard = {
  key: string;
  card: ReportCard; // con el texto editado ya aplicado
  original: ReportCard; // tal cual la armó el generador
  enabled: boolean;
  fixed: boolean;
  edited: boolean;
  // Editada, pero los datos de la tarjeta cambiaron desde que se escribió.
  needsReview: boolean;
};

export const EDITED_PHRASE_MAX = 300;

// Tarjetas cuya frase se muestra (y por lo tanto se puede editar). La racha
// y los gráficos de ejercicios no tienen frase; la imagen para compartir y
// los mensajes del coach tienen su propio texto.
const EDITABLE: ReportCard["type"][] = [
  "opening",
  "improvement",
  "effort",
  "adherence",
  "count",
  "records",
  "volume",
  "weight",
  "body",
  "goal",
  "focus",
  "closing",
];

export function isTextEditable(card: ReportCard): boolean {
  return EDITABLE.includes(card.type);
}

// Huella de los datos de una tarjeta: todo menos la frase y lo que elige
// el coach. Si cambia al regenerar, el texto editado puede haber quedado
// desactualizado ("subiste 3 reps" y ahora son 2).
export function cardBasis(card: ReportCard): string {
  const rest: Record<string, unknown> = { ...card };
  delete rest.phrase;
  delete rest.phraseKey;
  delete rest.on;
  return JSON.stringify(rest);
}

// La frase editada reemplaza a la del banco y pierde su clave: no cuenta
// para "no repetir en 28 días" (no es una frase del banco), pero el
// cliente la ve tal cual.
export function applyEditedText(card: ReportCard, text: EditedText | undefined): ReportCard {
  if (!text || !isTextEditable(card)) return card;
  const next = { ...card, phrase: text.phrase };
  delete next.phraseKey;
  return next;
}

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
    .map((original, i): ArrangedCard => {
      const key = cardKey(original, i);
      const fixed = isFixedCard(original);
      const enabled = fixed ? true : (layout?.enabled[key] ?? original.on !== false);
      const text = isTextEditable(original) ? layout?.texts?.[key] : undefined;
      return {
        key,
        card: applyEditedText(original, text),
        original,
        enabled,
        fixed,
        edited: !!text,
        needsReview: !!text && text.basis !== cardBasis(original),
      };
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
  const texts = parseTexts((value as { texts?: unknown }).texts);
  if (texts === null) return null;
  return texts ? { order: v.order as string[], enabled, texts } : { order: v.order as string[], enabled };
}

// undefined = no hay textos editados; null = inválido.
function parseTexts(value: unknown): Record<string, EditedText> | undefined | null {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 100) return null;
  const texts: Record<string, EditedText> = {};
  for (const [k, t] of entries) {
    if (!t || typeof t !== "object") return null;
    const { phrase, basis } = t as { phrase?: unknown; basis?: unknown };
    if (typeof phrase !== "string" || typeof basis !== "string" || basis.length > 20000) return null;
    const clean = phrase.trim().slice(0, EDITED_PHRASE_MAX);
    if (!clean) continue; // vacío = volver al original
    texts[k] = { phrase: clean, basis };
  }
  return Object.keys(texts).length > 0 ? texts : undefined;
}

// Al regenerar o cambiar el período: conservar o descartar los textos
// editados. Devuelve el layout a guardar.
export function layoutAfterRegenerate(layout: CardLayout | null, keepTexts: boolean): CardLayout | null {
  if (!layout) return null;
  if (keepTexts || !layout.texts) return layout;
  return { order: layout.order, enabled: layout.enabled };
}

// Tarjetas con texto editado cuyos datos cambiaron (para avisar al coach).
export function editedNeedingReview(cards: ReportCard[], layout: CardLayout | null): string[] {
  return arrangeCards(cards, layout)
    .filter((x) => x.needsReview)
    .map((x) => cardLabel(x.original));
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

// Reportes de rango libre generados antes de oct-2026 guardaron "Tu
// período" en portada, cierre e imagen para compartir (el título ahora es
// "Tu progreso"). Se corrige al leer, así no hace falta regenerar cada
// borrador ni tocar los ya enviados. Solo cambia esas palabras fijas: las
// frases quedan como se generaron.
const LEGACY_WORD = "período";
export function upgradeLegacyCards(cards: ReportCard[]): ReportCard[] {
  return cards.map((card) => {
    if (card.type !== "opening" && card.type !== "closing" && card.type !== "share") return card;
    const legacy = card.words.length === 2 && card.words[1].toLowerCase() === LEGACY_WORD;
    const label = card.type === "share" && card.monthLabel === "Período";
    if (!legacy && !label) return card;
    const next = { ...card, words: legacy ? [card.words[0], "progreso"] : card.words };
    return next.type === "share" && label ? { ...next, monthLabel: "Progreso" } : next;
  });
}

// La nota personal del coach va antes de la imagen para compartir (que
// cierra el reporte) o al final. Mismo lugar en la vista previa y al enviar.
export function withCoachNote(cards: ReportCard[], note: ReportCard | null): ReportCard[] {
  const base = cards.filter((c) => c.type !== "coach-note");
  if (!note) return base;
  const i = base.findIndex((c) => c.type === "share");
  return i >= 0 ? [...base.slice(0, i), note, ...base.slice(i)] : [...base, note];
}
