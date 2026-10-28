import type { PhrasePicker } from "@/lib/reports/phrases";
import { isTypedTracking, pbValue, recordDiff, recordRow, setValue } from "@/lib/reports/records";
import type { DayBestSet, PersonalBest } from "@/lib/reports/records";
import { goalMentions } from "@/lib/reports/weight-goal";
import type { WeightDirection } from "@/lib/reports/weight-goal";
import { addDays, fmtKg, signed } from "@/lib/reports/format";
import { mondayKeyFor } from "@/lib/utils/week";
import type { ReportInput, SessionSummary } from "@/lib/reports/input";
import type { ReportCard } from "@/lib/reports/types";

// Secciones compartidas por los tres reportes (semanal, mensual y libre).
// Cada una arma su tarjeta del catálogo con clave estable; `on` decide si
// va prendida por defecto (el coach la cambia en la bandeja).

export const STATS_LINK = { label: "Ver en Estadísticas", href: "/client/progress/stats" };
export const HISTORY_LINK = { label: "Ver historial", href: "/client/progress" };
const BODY_LINK = { label: "Ver en Mi Cuerpo", href: "/client/body?tab=cuerpo" };

const STREAK_MIN_WEEKS = 3;
const EXERCISE_WINDOW_DAYS = 84; // 12 semanas

function sum(sessions: SessionSummary[], k: "setCount" | "volumeKg"): number {
  return sessions.reduce((s, x) => s + x[k], 0);
}

// --- Volumen contra el período anterior ---
// Sube → prendida. Igual o baja → apagada (el coach decide) + aviso privado.
export function volumeSection(params: {
  current: SessionSummary[];
  previous: SessionSummary[];
  currentLabel: string;
  previousLabel: string; // "Agosto", "Semana anterior", "Período anterior"
  versus: string; // para frases y avisos: "agosto", "la semana pasada", "el período anterior"
  picker: PhrasePicker;
}): { card: ReportCard | null; notice: string | null } {
  const { current, previous, currentLabel, previousLabel, versus, picker } = params;
  const volume = Math.round(sum(current, "volumeKg"));
  const prevVolume = Math.round(sum(previous, "volumeKg"));
  if (prevVolume <= 0 || volume <= 0) return { card: null, notice: null };
  const pct = Math.round(((volume - prevVolume) / prevVolume) * 100);
  const up = pct > 0;
  const picked = picker.pick(up ? "month.volume.up" : pct === 0 ? "month.volume.even" : "month.volume.down", {
    volumen_pct: pct,
    mes_anterior: versus,
  });
  return {
    card: {
      type: "volume",
      key: "volume",
      on: up,
      theme: "card",
      kicker: `Contra ${versus}`,
      percent: pct,
      previous: { label: previousLabel, volumeKg: prevVolume, sessions: previous.length },
      current: { label: currentLabel, volumeKg: volume, sessions: current.length },
      phrase: picked?.text,
      phraseKey: picked?.key,
    },
    notice: up
      ? null
      : `Volumen ${pct === 0 ? "igual" : `${signed(pct, 0)} %`} vs ${versus}: ${current.length} entrenamientos contra ${previous.length}`,
  };
}

// --- Racha de semanas cumpliendo todo el plan ---
// Semanas (lunes a domingo) seguidas, contando hacia atrás desde la última
// semana que TERMINA dentro del período.
export function weekStreaks(input: ReportInput): { current: number; longestBefore: number } {
  const perWeek = input.routine?.daysPerWeek ?? 0;
  if (perWeek <= 0) return { current: 0, longestBefore: 0 };
  const byWeek = new Map<string, Set<string>>();
  for (const s of input.sessions) {
    const k = mondayKeyFor(s.date);
    if (!byWeek.has(k)) byWeek.set(k, new Set());
    byWeek.get(k)!.add(s.date);
  }
  const complete = (k: string) => (byWeek.get(k)?.size ?? 0) >= perWeek;

  let last = mondayKeyFor(input.periodEnd);
  if (addDays(last, 6) > input.periodEnd) last = addDays(last, -7);
  let current = 0;
  for (let w = last; complete(w); w = addDays(w, -7)) current++;

  const weeks = [...byWeek.keys()].filter((k) => addDays(k, 6) < input.periodStart).sort();
  let longestBefore = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of weeks) {
    if (!complete(k)) {
      run = 0;
    } else {
      run = prev && addDays(prev, 7) === k && complete(prev) ? run + 1 : 1;
      longestBefore = Math.max(longestBefore, run);
    }
    prev = k;
  }
  return { current, longestBefore };
}

// Prendida solo si es récord o 3+ semanas seguidas (aprobado); con al menos
// una semana queda disponible apagada.
export function streakSection(input: ReportInput, defaultAllowed: boolean): ReportCard | null {
  const streak = weekStreaks(input);
  if (streak.current < 1) return null;
  const isRecord = streak.longestBefore > 0 && streak.current > streak.longestBefore;
  const meetsRule = streak.current >= STREAK_MIN_WEEKS || (isRecord && streak.current >= 2);
  return {
    type: "streak",
    key: "streak",
    on: defaultAllowed && meetsRule,
    theme: "black",
    value: streak.current,
    unit: streak.current === 1 ? "semana" : "semanas",
    detail: isRecord
      ? `${streak.current === 1 ? "cumpliendo" : "seguidas cumpliendo"} todo el plan. Tu mejor racha hasta ahora`
      : `${streak.current === 1 ? "cumpliendo" : "seguidas cumpliendo"} todo el plan`,
  };
}

// --- Evaluación corporal del período ---
export function bodySection(input: ReportInput, picker: PhrasePicker): ReportCard | null {
  const inPeriod = input.evaluations.filter((e) => e.date >= input.periodStart && e.date <= input.periodEnd);
  const last = inPeriod[inPeriod.length - 1];
  if (!last || last.bodyFat == null) return null;
  const previousEval = [...input.evaluations].reverse().find((e) => e.date < last.date && e.bodyFat != null);
  const fatDiff = previousEval ? Math.round((last.bodyFat - previousEval.bodyFat!) * 10) / 10 : null;
  const picked = picker.pick("body.evaluation", {
    grasa: fmtKg(last.bodyFat),
    cambio_grasa: fatDiff != null && fatDiff < 0 ? ` (${signed(fatDiff)} %)` : null,
    musculo: last.muscleKg != null ? fmtKg(last.muscleKg) : null,
  });
  return {
    type: "body",
    key: "body",
    theme: "light",
    date: last.date,
    bodyFat: last.bodyFat,
    bodyFatDiff: fatDiff,
    muscleKg: last.muscleKg,
    phrase: picked?.text,
    phraseKey: picked?.key,
    link: BODY_LINK,
  };
}

// --- Mejores marcas (lista) ---
// `excludeTop`: el mensual no repite en la lista la mejora principal, que
// tiene su propia tarjeta.
export function recordsSection(params: {
  pbs: PersonalBest[];
  picker: PhrasePicker;
  on: boolean;
  excludeTop: boolean;
}): ReportCard | null {
  const { pbs, picker, on, excludeTop } = params;
  const list = (excludeTop ? pbs.slice(1) : pbs).map(recordRow);
  if (list.length === 0) return null;
  const picked = picker.pick(pbs.length >= 4 ? "month.records.many" : "month.records.some", {
    records: pbs.length,
    records_palabra: pbs.length === 1 ? "récord" : "récords",
  });
  return {
    type: "records",
    key: "records",
    on,
    theme: "card",
    value: pbs.length,
    list,
    phrase: picked?.text,
    phraseKey: picked?.key,
    link: STATS_LINK,
  };
}

// --- Objetivo vs realidad: solo líneas con dato; el resto, aviso ---
function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function gluteEvidence(pb: PersonalBest): string {
  if (pb.typed) return `Glúteos: ${lowerFirst(pb.exerciseName)} ${pbValue(pb, pb.current)}, ${recordDiff(pb)}`;
  const what =
    pb.type === "rir"
      ? `ahora con RIR ${pb.current.rir} (antes ${pb.previous.rir})`
      : pb.type === "weight"
        ? `+${fmtKg(pb.delta)} kg`
        : `+${pb.delta} ${pb.delta === 1 ? "rep" : "reps"}`;
  return `Glúteos: ${lowerFirst(pb.exerciseName)} ${setValue(pb.current)}, ${what}`;
}

export function goalSection(params: {
  input: ReportInput;
  pbs: PersonalBest[];
  direction: WeightDirection;
  weightDelta: number | null;
  picker: PhrasePicker;
  on: boolean;
  words: { inPeriod: string; thisPeriod: string; periodName: string }; // "en el mes" / "este mes" / "septiembre"
  // Los avisos solo cuando la tarjeta va prendida por defecto (en el
  // semanal es opcional y llenaría la bandeja de ruido).
  withNotices: boolean;
}): { card: ReportCard | null; notices: string[] } {
  const { input, pbs, direction, weightDelta, picker, on, words, withNotices } = params;
  const notices: string[] = [];
  if (!input.monthGoal) {
    if (withNotices) notices.push(`${input.client.firstName} no cargó objetivo de ${words.periodName}`);
    return { card: null, notices };
  }
  const goal = input.monthGoal.mainGoal;
  const evidence: string[] = [];
  if (goalMentions(goal, "fuerza")) {
    if (pbs.length > 0) evidence.push(`Fuerza: ${pbs.length} ${pbs.length === 1 ? "mejor marca" : "mejores marcas"} ${words.inPeriod}`);
    else notices.push(`Fuerza: sin mejores marcas ${words.thisPeriod}`);
  }
  if (goalMentions(goal, "gluteos")) {
    const glute = pbs.find((p) => p.muscleGroup === "Glúteos");
    if (glute) evidence.push(gluteEvidence(glute));
    else notices.push(`Glúteos: sin mejores marcas en ejercicios de glúteos ${words.thisPeriod}`);
  }
  if (direction && !input.client.hideWeight) {
    if (weightDelta == null) notices.push(`Peso: sin pesajes suficientes ${words.thisPeriod}`);
    else if (direction === "lose" && weightDelta < 0) evidence.push(`Peso: ${fmtKg(Math.abs(weightDelta))} kg menos de promedio`);
    else if (direction === "gain" && weightDelta > 0) evidence.push(`Peso: ${fmtKg(weightDelta)} kg más de promedio`);
    else notices.push(`Peso: ${signed(weightDelta)} kg de promedio, en contra del objetivo`);
  }
  if (goalMentions(goal, "grasa")) {
    const inPeriod = input.evaluations.filter((e) => e.date >= input.periodStart && e.date <= input.periodEnd);
    const last = inPeriod[inPeriod.length - 1];
    const fat = last?.bodyFat;
    const previousEval = last
      ? [...input.evaluations].reverse().find((e) => e.date < last.date && e.bodyFat != null)
      : undefined;
    if (fat == null) notices.push(`Grasa: sin medición ${words.thisPeriod}`);
    else if (previousEval?.bodyFat != null && fat < previousEval.bodyFat)
      evidence.push(`Grasa: ${fmtKg(fat)} % (antes ${fmtKg(previousEval.bodyFat)} %)`);
    else notices.push(`Grasa: ${fmtKg(fat)} % ${words.thisPeriod}, sin baja contra la medición anterior`);
  }
  if (evidence.length === 0) {
    notices.push(`Objetivo de ${words.periodName}: sin datos que mostrarle`);
    return { card: null, notices: withNotices ? notices : [] };
  }
  const picked = picker.pick("month.goal.on_track");
  return {
    card: { type: "goal", key: "goal", on, theme: "black", goal, evidence, phrase: picked?.text, phraseKey: picked?.key },
    notices: withNotices ? notices : [],
  };
}

// --- Gráficos de ejercicios puntuales (siempre opcionales) ---
// Uno por cada ejercicio entrenado en el período: mejor peso por sesión en
// las últimas 12 semanas hasta el fin del período.
export function exerciseSections(bestSets: DayBestSet[], periodStart: string, periodEnd: string): ReportCard[] {
  const trained = new Map<string, string>();
  for (const s of bestSets) {
    // Solo peso + reps: en los otros tipos el peso es lastre (o no hay).
    if (s.date >= periodStart && s.date <= periodEnd && s.weight && !isTypedTracking(s)) trained.set(s.exerciseId, s.exerciseName);
  }
  const from = addDays(periodEnd, -EXERCISE_WINDOW_DAYS);
  const cards: ReportCard[] = [];
  for (const [exerciseId, name] of [...trained].sort((a, b) => a[1].localeCompare(b[1], "es"))) {
    const points = bestSets
      .filter((s) => s.exerciseId === exerciseId && s.date >= from && s.date <= periodEnd && s.weight)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => ({ date: s.date, kg: s.weight as number }));
    if (points.length < 2) continue;
    const first = points[0].kg;
    const last = points[points.length - 1].kg;
    const diff = Math.round((last - first) * 100) / 100;
    cards.push({
      type: "exercise",
      key: `exercise:${exerciseId}`,
      on: false,
      theme: "light",
      exercise: name,
      headline: diff > 0 ? `+${fmtKg(diff)}` : fmtKg(last),
      detail: `${fmtKg(first)} kg → ${fmtKg(last)} kg · últimas 12 semanas`,
      points,
      link: STATS_LINK,
    });
  }
  return cards;
}

export function effortVolume(sessions: SessionSummary[]): { sets: number; volume: number } {
  return { sets: sum(sessions, "setCount"), volume: Math.round(sum(sessions, "volumeKg")) };
}


// --- Minutos de cardio (oct-2026, tipos de registro) ---
// Prendida por defecto, solo si hubo cardio en el período. Compara con el
// período anterior (misma duración / mes anterior / semana pasada).
export function cardioSection(params: {
  current: SessionSummary[];
  previous: SessionSummary[];
  versus: string;
  picker: PhrasePicker;
}): ReportCard | null {
  const byExercise = new Map<string, { name: string; seconds: number }>();
  for (const s of params.current) {
    for (const c of s.cardio ?? []) {
      const e = byExercise.get(c.exerciseId) ?? { name: c.exerciseName, seconds: 0 };
      e.seconds += c.seconds;
      byExercise.set(c.exerciseId, e);
    }
  }
  const seconds = [...byExercise.values()].reduce((a, e) => a + e.seconds, 0);
  if (seconds <= 0) return null;
  const minutes = Math.round(seconds / 60);
  const prevSeconds = params.previous.reduce(
    (a, s) => a + (s.cardio ?? []).reduce((b, c) => b + c.seconds, 0),
    0
  );
  const previousMinutes = prevSeconds > 0 ? Math.round(prevSeconds / 60) : null;
  const up = previousMinutes != null && minutes > previousMinutes;
  const picked = up
    ? params.picker.pick("cardio.up", { minutos: minutes, delta_min: minutes - previousMinutes!, antes: params.versus })
    : params.picker.pick("cardio.minutes", { minutos: minutes });
  return {
    type: "cardio",
    key: "cardio",
    theme: "card",
    minutes,
    previousMinutes,
    versus: params.versus,
    exercises: [...byExercise.values()]
      .map((e) => ({ name: e.name, minutes: Math.round(e.seconds / 60) }))
      .sort((a, b) => b.minutes - a.minutes),
    phrase: picked?.text,
    phraseKey: picked?.key,
    link: STATS_LINK,
  };
}
