import { PhrasePicker } from "@/lib/reports/phrases";
import type { PhraseVars, Situation } from "@/lib/reports/phrases";
import { pbValue, personalBests, recordDiff, recordRow, typedHeadline } from "@/lib/reports/records";
import type { PersonalBest } from "@/lib/reports/records";
import { weightDirectionFromGoal } from "@/lib/reports/weight-goal";
import { WEEK_LABELS, rangeWeightCard } from "@/lib/reports/weight";
import { routineNotices } from "@/lib/reports/notices";
import {
  HISTORY_LINK,
  STATS_LINK,
  bodySection,
  effortVolume,
  exerciseSections,
  goalSection,
  recordsSection,
  streakSection,
  volumeSection,
} from "@/lib/reports/sections";
import { addDays, daysBetween, fmtKg, fmtNum, signed } from "@/lib/reports/format";
import type { ReportInput } from "@/lib/reports/input";
import type { BuiltReport, ReportCard } from "@/lib/reports/types";

const WEEKDAY_LABELS = ["L", "M", "M", "J", "V"];
const MAX_EXTRA_RECORDS = 6;
// A partir de cuántas mejores marcas la apertura festeja aunque la
// asistencia no haya sido perfecta (aprobado oct-2026).
export const RECORDS_FOR_CELEBRATION = 3;
const WEIGH_REMINDER_DAYS = 10;
const PHOTO_REMINDER_DAYS = 30;

export { HISTORY_LINK, STATS_LINK };

function withKg(s: { weight: number | null; reps: number | null }): string {
  return s.weight ? `${fmtKg(s.weight)} kg × ${s.reps ?? 0}` : `${s.reps ?? 0} reps`;
}

// Tarjeta de la mejora más importante, compartida con el mensual y el libre.
export function improvementCard(
  top: PersonalBest,
  more: PersonalBest[],
  picker: PhrasePicker
): ReportCard {
  // Tipos de registro (oct-2026): su propio número, unidad y frases.
  if (top.typed) {
    const head = typedHeadline(top);
    const picked = picker.pick("record.typed", { ejercicio: top.exerciseName, mejora: recordDiff(top) });
    return {
      type: "improvement",
      key: "improvement",
      theme: "black",
      kicker: "Tu mejor avance",
      exercise: top.exerciseName,
      value: head.value,
      unit: head.unit,
      detail: `${pbValue(top, top.current)} — antes ${pbValue(top, top.previous)}`,
      more: more.map(recordRow),
      phrase: picked?.text,
      phraseKey: picked?.key,
      link: STATS_LINK,
    };
  }
  const situation: Situation =
    top.type === "weight" ? "record.weight" : top.type === "reps" ? "record.reps" : "record.rir";
  const vars: PhraseVars = {
    ejercicio: top.exerciseName,
    kg: top.current.weight ? fmtKg(top.current.weight) : null,
    kg_antes: top.previous.weight ? fmtKg(top.previous.weight) : null,
    reps: top.current.reps,
    rir: top.current.rir,
    rir_antes: top.previous.rir,
    delta_kg: top.type === "weight" ? fmtKg(top.delta) : null,
    delta_reps: top.type === "reps" ? top.delta : null,
    delta_rir: top.type === "rir" ? top.delta : null,
  };
  const picked = picker.pick(situation, vars);
  return {
    type: "improvement",
    key: "improvement",
    theme: "black",
    kicker: "Tu mejor avance",
    exercise: top.exerciseName,
    value: top.type === "weight" ? signed(top.delta).replace(/,0$/, "") : `+${top.delta}`,
    unit: top.type === "weight" ? "kg" : top.type === "reps" ? "reps" : "RIR",
    detail: `${withKg(top.current)} — antes ${withKg(top.previous)}`,
    more: more.map(recordRow),
    phrase: picked?.text,
    phraseKey: picked?.key,
    link: STATS_LINK,
  };
}

export function buildWeeklyReport(input: ReportInput): BuiltReport {
  const { client, routine, periodStart, periodEnd } = input;
  const picker = new PhrasePicker(`${client.id}:weekly:${periodStart}`, "weekly", input.phraseHistory);
  const cards: ReportCard[] = [];
  const notices: string[] = [];

  const week = input.sessions.filter((s) => s.date >= periodStart && s.date <= periodEnd);
  const prevWeek = input.sessions.filter((s) => s.date >= addDays(periodStart, -7) && s.date <= addDays(periodEnd, -7));
  const trainedDays = new Set(week.map((s) => s.date)).size;
  const planned = routine ? Math.min(routine.daysPerWeek, 5) : 0;
  const pbs = personalBests(input.bestSets, periodStart, periodEnd);
  const base: PhraseVars = { nombre: client.firstName, dias_hechos: trainedDays, dias_plan: planned };

  // --- Apertura: según asistencia Y récords ---
  const before = input.sessions.filter((s) => s.date < periodStart);
  const twoWeeksBefore = before.filter((s) => s.date >= addDays(periodStart, -14));
  const returned = trainedDays > 0 && before.length > 0 && twoWeeksBefore.length === 0;
  let opening: Situation;
  if (trainedDays === 0) {
    opening = "opening.none";
    notices.push("Sin entrenamientos esta semana: sumale una nota personal o descartá el reporte");
  } else if (returned) opening = "opening.returned";
  else if (pbs.length >= RECORDS_FOR_CELEBRATION) opening = "opening.records";
  else if (planned > 0 && trainedDays >= planned)
    opening = pbs.length > 0 ? "opening.complete_progress" : "opening.complete";
  else opening = "opening.partial";
  const openingPhrase = picker.pick(opening, base);
  cards.push({
    type: "opening",
    key: "opening",
    theme: "red",
    words: ["Tu", "semana"],
    phrase: openingPhrase?.text,
    phraseKey: openingPhrase?.key,
  });

  // --- Mejora principal, o esfuerzo si no hubo récords ---
  if (pbs.length > 0) {
    cards.push(improvementCard(pbs[0], pbs.slice(1, 1 + MAX_EXTRA_RECORDS), picker));
  } else if (trainedDays > 0) {
    const { sets, volume } = effortVolume(week);
    const picked = picker.pick("record.none", { series: sets, volumen: fmtNum(volume) });
    cards.push({
      type: "effort",
      key: "effort",
      theme: "black",
      sets,
      volumeKg: volume,
      phrase: picked?.text,
      phraseKey: picked?.key,
      link: STATS_LINK,
    });
  }

  // --- Asistencia lunes a viernes ---
  if (planned > 0) {
    const days = WEEKDAY_LABELS.map((label, i) => {
      const date = addDays(periodStart, i);
      const names = week.filter((s) => s.date === date).map((s) => s.dayName ?? "Entrenamiento");
      return { label, dayName: names.length ? names.join(" + ") : null };
    });
    const situation: Situation =
      trainedDays === 0 ? "adherence.none" : trainedDays >= planned ? "adherence.complete" : "adherence.partial";
    const picked = picker.pick(situation, base);
    cards.push({
      type: "adherence",
      key: "adherence",
      theme: "card",
      done: trainedDays,
      planned,
      days,
      phrase: picked?.text,
      phraseKey: picked?.key,
      link: HISTORY_LINK,
    });
  }

  // --- Cuerpo: evaluación nueva; si no, peso (los dos disponibles) ---
  const direction = weightDirectionFromGoal(input.monthGoal?.mainGoal ?? client.goal);
  const body = bodySection(input, picker);
  let weightDelta: number | null = null;
  if (body) cards.push(body);
  if (!client.hideWeight) {
    const { card, deltaKg } = rangeWeightCard({
      weights: input.weights,
      start: periodStart,
      end: periodEnd,
      prevStart: addDays(periodStart, -7),
      prevEnd: addDays(periodStart, -1),
      direction,
      picker,
      labels: WEEK_LABELS,
    });
    weightDelta = deltaKg;
    // Con evaluación nueva en la semana, el peso queda disponible pero apagado.
    if (card) cards.push(body ? { ...card, on: false } : card);
  }

  // --- Opcionales (apagadas por defecto, el coach las prende) ---
  const volume = volumeSection({
    current: week,
    previous: prevWeek,
    currentLabel: "Esta semana",
    previousLabel: "Semana anterior",
    versus: "la semana pasada",
    picker,
  });
  if (volume.card) cards.push({ ...volume.card, on: false });
  const streak = streakSection(input, false);
  if (streak) cards.push(streak);
  const records = recordsSection({ pbs, picker, on: false, excludeTop: false });
  if (records) cards.push(records);
  const goal = goalSection({
    input,
    pbs,
    direction,
    weightDelta,
    picker,
    on: false,
    words: { inPeriod: "en la semana", thisPeriod: "esta semana", periodName: "esta semana" },
    withNotices: false,
  });
  if (goal.card) cards.push(goal.card);
  cards.push(...exerciseSections(input.bestSets, periodStart, periodEnd));

  // --- Lo que viene ---
  const nextMonday = addDays(periodStart, 7);
  const lastWeigh = input.weights.length ? input.weights[input.weights.length - 1].date : null;
  let focus: { situation: Situation; word: string; vars?: PhraseVars };
  if (planned > 0 && trainedDays < planned) {
    focus = { situation: "focus.days", word: `${planned} días` };
  } else if (routine?.endsAt && routine.endsAt >= nextMonday && routine.endsAt <= addDays(nextMonday, 6)) {
    focus = { situation: "focus.meso_end", word: "Cerrar fuerte" };
  } else if (!client.hideWeight && (!lastWeigh || daysBetween(lastWeigh, periodEnd) >= WEIGH_REMINDER_DAYS)) {
    focus = { situation: "focus.weigh", word: "Pesate" };
  } else if (input.lastPhotoDate && daysBetween(input.lastPhotoDate, periodEnd) >= PHOTO_REMINDER_DAYS) {
    focus = {
      situation: "focus.photo",
      word: "Foto",
      vars: { dias_sin_foto: daysBetween(input.lastPhotoDate, periodEnd) },
    };
  } else if (pbs.length > 0 && pbs[0].type !== "rir") {
    focus = { situation: "focus.exercise", word: "Subir", vars: { ejercicio: pbs[0].exerciseName } };
  } else {
    focus = { situation: "focus.keep", word: "Sostener" };
  }
  const focusPhrase = picker.pick(focus.situation, { ...base, ...focus.vars });
  cards.push({
    type: "focus",
    key: "focus",
    theme: "black",
    word: focus.word,
    phrase: focusPhrase?.text,
    phraseKey: focusPhrase?.key,
  });

  notices.push(...routineNotices(input));
  return { cards, phraseKeys: picker.usedKeys, notices };
}
