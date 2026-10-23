// Banco de frases de los reportes (oct-2026) — transcripción de
// docs/plan-reportes.md, sección 3 + cambios aprobados (sección 5). Voz de
// Luis: plural "damos/vamos", esfuerzo antes que números, nunca reproche,
// voseo, solo 👏🏻 y 🫡. Nunca se inventa un dato: si a una variante le
// falta una variable, esa variante no se usa.
//
// Cada frase tiene una clave estable "situación.n" (ej. "weight.down.3")
// que se guarda en progress_reports.phrase_keys para no repetirla en los
// reportes de las últimas 4 semanas.

type Scope = "weekly" | "monthly" | "custom";
type Variant = { text: string; scope?: Scope };

const PRIORITY_MARKERS = [
  "Cumpliste con lo que pudiste y eso es lo que importa",
  "cumpliste con lo que pudiste y eso es lo que importa",
  "Todo el esfuerzo vale la pena",
];

export const PHRASE_BANK = {
  // Apertura semanal
  "opening.records": [
    { text: "Excelente el trabajo de esta semana! Orgulloso del progreso que estás teniendo👏🏻👏🏻" },
  ],
  "opening.complete_progress": [
    { text: "{nombre}, qué semana! Excelente el trabajo, orgulloso del progreso que estás teniendo 👏🏻👏🏻" },
    { text: "{nombre}, cumpliste todo y encima mejoraste. Así se construye 👏🏻" },
    { text: "Semana completa y con avances, {nombre}. Esto es lo que buscamos" },
    { text: "{nombre}, no fallaste ni un día y se nota en los números. Orgulloso 👏🏻" },
  ],
  "opening.complete": [
    { text: "{nombre}, cumpliste con todo esta semana. El progreso es más que números, entrenaste intenso y eso es lo que te va a hacer mejorar" },
    { text: "Semana completa, {nombre}. No siempre se ve en los números, pero el trabajo está hecho 🫡" },
    { text: "{nombre}, estuviste todos los días. La constancia es la que después trae los resultados" },
  ],
  "opening.partial": [
    { text: "{nombre}, cumpliste con lo que pudiste y eso es lo que importa. La próxima semana damos todo de vuelta" },
    { text: "{dias_hechos} de {dias_plan} esta semana, {nombre}. Lo que hiciste suma, y la que viene vamos por todo 🫡" },
    { text: "{nombre}, hubo semanas más fáciles, pero estuviste. La próxima la encaramos con todo" },
    { text: "No fue la semana completa, {nombre}, pero cada entrenamiento cuenta. Seguimos" },
  ],
  "opening.returned": [
    { text: "{nombre}, me alegra que hayas retomado, hay que seguir esforzándonos todo lo que podamos 🫡" },
    { text: "Qué bueno verte de vuelta, {nombre}. Lo más difícil era volver y ya lo hiciste" },
    { text: "{nombre}, retomaste y eso es lo que importa. Ahora a sostenerlo juntos" },
    { text: "Volviste, {nombre}! Arrancamos de nuevo y vamos de a poco pero firmes 🫡" },
  ],
  "opening.none": [
    { text: "{nombre}, esta semana no se pudo entrenar, pasa. La que viene arrancamos de nuevo juntos" },
    { text: "Semana sin entrenamientos, {nombre}. No pasa nada, lo importante es volver. Te espero en el próximo entrenamiento 🫡" },
    { text: "{nombre}, a veces la semana no da. Lo que importa es la próxima, y ahí vamos con todo" },
  ],

  // Mejora más importante (contra la mejor marca histórica)
  "record.weight": [
    { text: "Le subiste {delta_kg} kg a {ejercicio}. Ahora movés {kg} kg × {reps} 👏🏻" },
    { text: "{ejercicio}: de {kg_antes} a {kg} kg. Todo el esfuerzo vale la pena" },
    { text: "+{delta_kg} kg en {ejercicio}. Así se progresa, semana a semana" },
    { text: "{kg} kg en {ejercicio}, {delta_kg} kg más que tu mejor marca. Vamos por más" },
  ],
  "record.reps": [
    { text: "Con {kg} kg en {ejercicio} hiciste {delta_reps} reps más. Eso es fuerza nueva" },
    { text: "{ejercicio}: {reps} reps con {kg} kg, {delta_reps} más que tu mejor marca 👏🏻" },
    { text: "Mismo peso en {ejercicio}, más reps. El próximo paso es subir el kilaje" },
  ],
  "record.rir": [
    { text: "{ejercicio} te salió más fácil: mismo peso y reps, pero te sobraron {delta_rir} reps más. Te estás haciendo más fuerte" },
    { text: "En {ejercicio} pasaste de RIR {rir_antes} a RIR {rir}. Te está costando menos, eso es que te estás haciendo más fuerte 🫡" },
    { text: "{ejercicio} con más resto que tu mejor marca. Todo el esfuerzo vale la pena 👏🏻" },
  ],
  "record.none": [
    { text: "Esta semana fueron {series} series y {volumen} kg movidos. El progreso es más que números, lo diste todo", scope: "weekly" },
    { text: "{series} series hechas. Cumpliste con lo que pudiste y eso es lo que importa" },
    { text: "Sin récords esta semana, pero con {series} series encima. Eso después se nota", scope: "weekly" },
  ],

  // Asistencia lunes a viernes
  "adherence.complete": [
    { text: "{dias_hechos} de {dias_plan}. Semana completa 👏🏻" },
    { text: "No faltaste ni un día" },
    { text: "{dias_hechos} de {dias_plan}: así se hace" },
  ],
  "adherence.partial": [
    { text: "{dias_hechos} de {dias_plan} esta semana. Cada día cuenta" },
    { text: "Hiciste {dias_hechos} de {dias_plan}. La que viene vamos por los {dias_plan}" },
  ],
  "adherence.none": [{ text: "Esta semana no hubo entrenamientos. El lunes arrancamos de nuevo" }],

  // Peso — se festeja solo en la dirección del objetivo (ver weight-goal.ts).
  // Los valores semanales son PROMEDIOS de la semana, nunca "hoy".
  "weight.down": [
    { text: "{delta_peso} kg menos esta semana. Todo el esfuerzo vale la pena! Y vamos por más", scope: "weekly" },
    { text: "Bajaste {delta_peso} kg. Se está notando el trabajo 👏🏻" },
    { text: "{peso} kg esta semana, {delta_peso} menos que la semana pasada. Seguimos así", scope: "weekly" },
  ],
  "weight.trend_down": [
    { text: "{peso} kg esta semana, {delta_peso} menos que en {mes_inicio}. Seguimos así 👏🏻", scope: "weekly" },
    { text: "{peso} kg en este período, {delta_peso} menos que en {mes_inicio}. Seguimos así 👏🏻", scope: "custom" },
  ],
  "weight.up": [
    { text: "+{delta_peso} kg esta semana, justo lo que buscamos para ganar masa", scope: "weekly" },
    { text: "Subiste {delta_peso} kg. El plan está funcionando, a seguir comiendo y entrenando" },
  ],
  "weight.stable": [
    { text: "Peso estable esta semana. Las semanas firmes también son parte del proceso", scope: "weekly" },
    { text: "Sin cambios en la balanza esta semana. Importa la tendencia de varias semanas, no un día", scope: "weekly" },
    { text: "Te mantuviste en {peso} kg. Seguimos sumando" },
  ],

  "body.evaluation": [
    { text: "Evaluación nueva: {grasa}% de grasa{cambio_grasa}. Mirá el detalle en Mi Cuerpo" },
    { text: "Tu nueva medición ya está: {grasa}% de grasa y {musculo} kg de músculo" },
    { text: "Te medí: {grasa}% de grasa{cambio_grasa}. Todo el esfuerzo vale la pena" },
  ],

  // Lo que viene (semanal)
  "focus.days": [{ text: "La próxima semana vamos por los {dias_plan} días. Organizate desde el lunes 🫡" }],
  "focus.exercise": [{ text: "En {ejercicio} estás para subir de nuevo. Esa es la próxima meta" }],
  "focus.keep": [{ text: "Mantener lo que venimos haciendo. Así, semana a semana" }],
  "focus.meso_end": [{ text: "Esta es la última semana del mesociclo. Cerramos fuerte" }],
  "focus.weigh": [{ text: "Acordate de registrar tu peso esta semana, así vemos cómo venís" }],
  "focus.photo": [{ text: "Hace {dias_sin_foto} días que no subís una foto. Sacate una esta semana así comparamos" }],

  // Mensual
  "month.opening": [
    { text: "{nombre}, este fue tu {mes}. Vamos a repasarlo juntos" },
    { text: "{Mes} terminado, {nombre}. Mirá todo lo que hiciste" },
    { text: "{nombre}, así fue tu {mes} en Euskadi Team" },
    // Período libre ("3 al 17 de noviembre"): frases neutras.
    { text: "{nombre}, este fue tu período. Vamos a repasarlo juntos", scope: "custom" },
    { text: "Período terminado, {nombre}. Mirá todo lo que hiciste", scope: "custom" },
    { text: "{nombre}, así fue este período en Euskadi Team", scope: "custom" },
  ],
  // El número de entrenamientos ya está grande en la tarjeta: las frases no lo repiten.
  "month.adherence.records": [
    { text: "Excelente el trabajo de este mes! Orgulloso del progreso que estás teniendo👏🏻👏🏻", scope: "monthly" },
    { text: "Excelente el trabajo de este período! Orgulloso del progreso que estás teniendo👏🏻👏🏻", scope: "custom" },
  ],
  "month.adherence.high": [
    { text: "Orgulloso de tu constancia 👏🏻👏🏻" },
    { text: "{adherencia}% de lo planificado. Así se hace" },
  ],
  "month.adherence.mid": [
    { text: "Cumpliste con lo que pudiste, el mes que viene damos todo de vuelta", scope: "monthly" },
    { text: "Cumpliste con lo que pudiste y eso es lo que importa. Ahora damos todo de vuelta", scope: "custom" },
  ],
  "month.adherence.low": [
    { text: "Fue un mes difícil. Lo importante es seguir, y en {mes_siguiente} vamos con todo 🫡", scope: "monthly" },
    { text: "Fue un período difícil. Lo importante es seguir, y ahora vamos con todo 🫡", scope: "custom" },
  ],
  "month.records.many": [
    { text: "{records} récords en un mes. Todo el esfuerzo vale la pena! 👏🏻", scope: "monthly" },
    { text: "{records} récords en este período. Todo el esfuerzo vale la pena! 👏🏻", scope: "custom" },
    { text: "{records} récords en una semana. Todo el esfuerzo vale la pena! 👏🏻", scope: "weekly" },
  ],
  "month.records.some": [
    { text: "{records} {records_palabra} este mes. Cada uno es un paso adelante", scope: "monthly" },
    { text: "{records} {records_palabra} en este período. Cada uno es un paso adelante", scope: "custom" },
    { text: "{records} {records_palabra} esta semana. Cada uno es un paso adelante", scope: "weekly" },
  ],
  // {mes_anterior}: "agosto", "la semana pasada", "el período anterior".
  "month.volume.up": [{ text: "{volumen_pct}% más volumen que en {mes_anterior}. Vamos por más" }],
  // Volumen parejo o menor: la tarjeta va apagada por defecto, el coach
  // decide si la muestra. Nunca en tono de reproche.
  "month.volume.even": [
    { text: "Un mes parejo con {mes_anterior}. Sostener también es avanzar", scope: "monthly" },
    { text: "Una semana pareja con la anterior. Sostener también es avanzar", scope: "weekly" },
    { text: "Un período parejo con el anterior. Sostener también es avanzar", scope: "custom" },
  ],
  "month.volume.down": [
    { text: "Menos volumen que {mes_anterior}, y está bien: hay meses así. Seguimos", scope: "monthly" },
    { text: "Menos volumen que la semana pasada, y está bien: hay semanas así. Seguimos", scope: "weekly" },
    { text: "Menos volumen que en el período anterior, y está bien: hay períodos así. Seguimos", scope: "custom" },
  ],
  "month.goal.on_track": [{ text: "Vamos por buen camino con lo que te propusiste. Seguimos 🫡" }],
  "month.photo": [{ text: "Hace {dias_sin_foto} días que no subís una foto. Sacate una y la comparamos con la anterior" }],
  "month.nutrition": [{ text: "Seguí con tu plan {plan}, que está armado para lo que buscás" }],
  "month.closing": [
    { text: "Otro mes más que sumamos, {nombre}. Orgulloso de lo que hiciste 👏🏻", scope: "monthly" },
    { text: "Así cerramos {mes}. Orgulloso de lo que hiciste, a seguir" },
    { text: "Un mes más sumado. Vamos juntos por el próximo", scope: "monthly" },
    { text: "Otro período más que sumamos, {nombre}. Orgulloso de lo que hiciste 👏🏻", scope: "custom" },
    { text: "Así cerramos este período. Orgulloso de lo que hiciste, a seguir", scope: "custom" },
    { text: "Un período más sumado. Vamos juntos por el próximo", scope: "custom" },
  ],
} satisfies Record<string, Variant[]>;

export type Situation = keyof typeof PHRASE_BANK;
export type PhraseVars = Record<string, string | number | null | undefined>;
export type PickedPhrase = { text: string; key: string };

// Completa {variables}. null si falta alguna (esa variante no se usa).
export function fillTemplate(template: string, vars: PhraseVars): string | null {
  let missing = false;
  const text = template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = vars[name];
    if (value === null || value === undefined || value === "") {
      missing = true;
      return "";
    }
    return String(value);
  });
  return missing ? null : text;
}

function isPriority(text: string): boolean {
  return PRIORITY_MARKERS.some((m) => text.includes(m));
}

function markerOf(text: string): string | null {
  const m = PRIORITY_MARKERS.find((p) => text.includes(p));
  return m ? m.toLowerCase() : null;
}

// PRNG determinístico (mulberry32) sembrado con un hash del texto: el mismo
// cliente/período elige las mismas variantes si se vuelve a generar con los
// mismos datos.
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// history: phrase_key → cuándo se ENVIÓ por última vez (ms), de los
// reportes enviados al cliente en los últimos 28 días.
export class PhrasePicker {
  private readonly rand: () => number;
  private readonly usedHere = new Set<string>();
  private readonly markersHere = new Set<string>();
  private readonly scope: Scope;
  private readonly history: Map<string, number>;

  constructor(seed: string, scope: Scope, history: Map<string, number> = new Map()) {
    this.rand = mulberry32(hashSeed(seed));
    this.scope = scope;
    this.history = history;
  }

  pick(situation: Situation, vars: PhraseVars = {}): PickedPhrase | null {
    const variants: Variant[] = PHRASE_BANK[situation];
    const candidates: { key: string; text: string; weight: number }[] = [];
    variants.forEach((v, i) => {
      if (v.scope && v.scope !== this.scope) return;
      const key = `${situation}.${i + 1}`;
      if (this.usedHere.has(key)) return;
      const text = fillTemplate(v.text, vars);
      if (text === null) return;
      candidates.push({ key, text, weight: isPriority(v.text) ? 2 : 1 });
    });
    if (candidates.length === 0) return null;

    // El mismo remate prioritario ("Todo el esfuerzo vale la pena") dos
    // veces en un reporte suena repetido aunque las frases sean distintas:
    // se evita mientras quede otra variante.
    const notEchoing = candidates.filter((c) => !this.markersHere.has(markerOf(c.text) ?? ""));
    if (notEchoing.length > 0) candidates.splice(0, candidates.length, ...notEchoing);

    const fresh = candidates.filter((c) => !this.history.has(c.key));
    let chosen: { key: string; text: string };
    if (fresh.length > 0) {
      const total = fresh.reduce((s, c) => s + c.weight, 0);
      let r = this.rand() * total;
      chosen = fresh[fresh.length - 1];
      for (const c of fresh) {
        r -= c.weight;
        if (r < 0) {
          chosen = c;
          break;
        }
      }
    } else {
      // Todas usadas en los últimos 28 días: la que se mandó hace más tiempo.
      chosen = [...candidates].sort(
        (a, b) => (this.history.get(a.key) ?? 0) - (this.history.get(b.key) ?? 0)
      )[0];
    }
    this.usedHere.add(chosen.key);
    const marker = markerOf(chosen.text);
    if (marker) this.markersHere.add(marker);
    return chosen;
  }

  get usedKeys(): string[] {
    return [...this.usedHere];
  }
}
