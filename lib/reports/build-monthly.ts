import { PhrasePicker } from "@/lib/reports/phrases";
import type { Situation } from "@/lib/reports/phrases";
import { personalBests, recordRow, setValue } from "@/lib/reports/records";
import type { PersonalBest } from "@/lib/reports/records";
import { goalMentions, weightDirectionFromGoal } from "@/lib/reports/weight-goal";
import { monthlyWeightCard } from "@/lib/reports/weight";
import { routineNotices } from "@/lib/reports/notices";
import { HISTORY_LINK, STATS_LINK, improvementCard } from "@/lib/reports/build-weekly";
import {
  addDays,
  capitalize,
  daysBetween,
  fmtKg,
  fmtNum,
  monthName,
  monthWords,
  signed,
} from "@/lib/reports/format";
import { mondayKeyFor } from "@/lib/utils/week";
import { plannedDaysInRange } from "@/lib/utils/planned-days";
import { adherencePercent } from "@/lib/utils/training-sessions";
import type { ReportInput } from "@/lib/reports/input";
import type { BuiltReport, ReportCard } from "@/lib/reports/types";

const RECORDS_FOR_CELEBRATION = 3;
const STREAK_MIN_WEEKS = 3;
const PHOTO_REMINDER_DAYS = 30;

function prevMonthStartOf(monthStart: string): string {
  const [y, m] = monthStart.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
}

function nextMonthStartOf(monthStart: string): string {
  const [y, m] = monthStart.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}

// Semanas (lunes a domingo) seguidas cumpliendo todos los días de la rutina,
// contando hacia atrás desde la última semana que TERMINA dentro del mes.
function weekStreaks(input: ReportInput): { current: number; longestBefore: number } {
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

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function gluteEvidence(pb: PersonalBest): string {
  const what =
    pb.type === "rir"
      ? `ahora con RIR ${pb.current.rir} (antes ${pb.previous.rir})`
      : pb.type === "weight"
        ? `+${fmtKg(pb.delta)} kg`
        : `+${pb.delta} ${pb.delta === 1 ? "rep" : "reps"}`;
  return `Glúteos: ${lowerFirst(pb.exerciseName)} ${setValue(pb.current)}, ${what}`;
}

export function buildMonthlyReport(input: ReportInput): BuiltReport {
  const { client, routine, periodStart: monthStart, periodEnd: monthEnd } = input;
  const picker = new PhrasePicker(`${client.id}:monthly:${monthStart}`, "monthly", input.phraseHistory);
  const cards: ReportCard[] = [];
  const notices: string[] = [];
  const prevMonthStart = prevMonthStartOf(monthStart);
  const mes = monthName(monthStart);
  const mesAnterior = monthName(prevMonthStart);

  const month = input.sessions.filter((s) => s.date >= monthStart && s.date <= monthEnd);
  const prevMonth = input.sessions.filter((s) => s.date >= prevMonthStart && s.date < monthStart);
  const trainedDays = new Set(month.map((s) => s.date)).size;
  const prevTrainedSessions = prevMonth.length;
  const sets = month.reduce((s, x) => s + x.setCount, 0);
  const volume = Math.round(month.reduce((s, x) => s + x.volumeKg, 0));
  const prevVolume = Math.round(prevMonth.reduce((s, x) => s + x.volumeKg, 0));
  const pbs = personalBests(input.bestSets, monthStart, monthEnd);
  const planned = routine
    ? plannedDaysInRange({
        rangeStart: monthStart,
        rangeEnd: monthEnd,
        plannedPerWeek: routine.daysPerWeek,
        accessActivatedAt: client.accessActivatedAt,
        routineAssignedAt: routine.assignedAt,
      })
    : 0;
  const adherence = adherencePercent(trainedDays, planned);

  // --- Portada ---
  const opening = picker.pick("month.opening", { nombre: client.firstName, mes, Mes: capitalize(mes) });
  cards.push({ type: "opening", theme: "red", words: monthWords(monthStart), phrase: opening?.text, phraseKey: opening?.key });

  // --- Entrenamientos: la frase según asistencia Y récords ---
  let adherenceSituation: Situation;
  if (adherence >= 80) adherenceSituation = "month.adherence.high";
  else if (pbs.length >= RECORDS_FOR_CELEBRATION) adherenceSituation = "month.adherence.records";
  else if (adherence >= 50) adherenceSituation = "month.adherence.mid";
  else adherenceSituation = "month.adherence.low";
  const adherencePhrase = picker.pick(adherenceSituation, {
    adherencia: adherence,
    mes_siguiente: monthName(nextMonthStartOf(monthStart)),
  });
  const detailParts = [
    planned > 0 ? `${trainedDays} de ${planned} planificados` : null,
    `${sets} series`,
    `${fmtNum(volume)} kg movidos`,
  ].filter(Boolean);
  cards.push({
    type: "count",
    theme: "black",
    kicker: `En ${mes}`,
    value: trainedDays,
    label: trainedDays === 1 ? "entrenamiento" : "entrenamientos",
    detail: detailParts.join(" · "),
    phrase: adherencePhrase?.text,
    phraseKey: adherencePhrase?.key,
    link: HISTORY_LINK,
  });

  // --- Récords: la lista no repite la mejora principal (tarjeta siguiente) ---
  if (pbs.length >= 2) {
    const picked = picker.pick(pbs.length >= 4 ? "month.records.many" : "month.records.some", {
      records: pbs.length,
      records_palabra: pbs.length === 1 ? "récord" : "récords",
    });
    cards.push({
      type: "records",
      theme: "card",
      value: pbs.length,
      list: pbs.slice(1).map(recordRow),
      phrase: picked?.text,
      phraseKey: picked?.key,
      link: STATS_LINK,
    });
  }
  if (pbs.length > 0) cards.push(improvementCard(pbs[0], [], picker));

  // --- Volumen: solo si SUBE; si no, aviso privado ---
  if (prevVolume > 0) {
    const pct = Math.round(((volume - prevVolume) / prevVolume) * 100);
    if (pct > 0) {
      const picked = picker.pick("month.volume.up", { volumen_pct: pct, mes_anterior: mesAnterior });
      cards.push({
        type: "volume",
        theme: "card",
        percent: pct,
        previous: { label: capitalize(mesAnterior), volumeKg: prevVolume, sessions: prevTrainedSessions },
        current: { label: capitalize(mes), volumeKg: volume, sessions: month.length },
        phrase: picked?.text,
        phraseKey: picked?.key,
      });
    } else {
      notices.push(
        `Volumen ${pct === 0 ? "igual" : `${signed(pct, 0)} %`} vs ${mesAnterior}: ${month.length} entrenamientos contra ${prevTrainedSessions}`
      );
    }
  }

  // --- Racha: solo si es récord o 3+ semanas seguidas ---
  const streak = weekStreaks(input);
  const isRecordStreak = streak.longestBefore > 0 && streak.current > streak.longestBefore;
  if (streak.current >= STREAK_MIN_WEEKS || (isRecordStreak && streak.current >= 2)) {
    cards.push({
      type: "streak",
      theme: "black",
      value: streak.current,
      unit: "semanas",
      detail: isRecordStreak
        ? "seguidas cumpliendo todo el plan. Tu mejor racha hasta ahora"
        : "seguidas cumpliendo todo el plan",
    });
  }

  // --- Cuerpo: evaluación del mes ---
  const monthEvals = input.evaluations.filter((e) => e.date >= monthStart && e.date <= monthEnd);
  const lastEval = monthEvals[monthEvals.length - 1];
  if (lastEval && lastEval.bodyFat != null) {
    const previousEval = [...input.evaluations].reverse().find((e) => e.date < lastEval.date && e.bodyFat != null);
    const fatDiff = previousEval ? Math.round((lastEval.bodyFat - previousEval.bodyFat!) * 10) / 10 : null;
    const picked = picker.pick("body.evaluation", {
      grasa: fmtKg(lastEval.bodyFat),
      cambio_grasa: fatDiff != null && fatDiff < 0 ? ` (${signed(fatDiff)} %)` : null,
      musculo: lastEval.muscleKg != null ? fmtKg(lastEval.muscleKg) : null,
    });
    cards.push({
      type: "body",
      theme: "light",
      date: lastEval.date,
      bodyFat: lastEval.bodyFat,
      bodyFatDiff: fatDiff,
      muscleKg: lastEval.muscleKg,
      phrase: picked?.text,
      phraseKey: picked?.key,
      link: { label: "Ver en Mi Cuerpo", href: "/client/body?tab=cuerpo" },
    });
  }

  // --- Peso del mes ---
  const goalText = input.monthGoal?.mainGoal ?? client.goal;
  const direction = weightDirectionFromGoal(goalText);
  let weightDelta: number | null = null;
  if (!client.hideWeight) {
    const { card, deltaKg } = monthlyWeightCard({
      weights: input.weights,
      monthStart,
      monthEnd,
      prevMonthStart,
      direction,
      picker,
    });
    weightDelta = deltaKg;
    if (card) cards.push(card);
  }

  // --- Objetivo vs realidad: solo las líneas con dato; el resto, aviso ---
  if (input.monthGoal) {
    const goal = input.monthGoal.mainGoal;
    const evidence: string[] = [];
    if (goalMentions(goal, "fuerza")) {
      if (pbs.length > 0) evidence.push(`Fuerza: ${pbs.length} ${pbs.length === 1 ? "mejor marca" : "mejores marcas"} en el mes`);
      else notices.push("Fuerza: sin mejores marcas este mes");
    }
    if (goalMentions(goal, "gluteos")) {
      const glute = pbs.find((p) => p.muscleGroup === "Glúteos");
      if (glute) evidence.push(gluteEvidence(glute));
      else notices.push("Glúteos: sin mejores marcas en ejercicios de glúteos este mes");
    }
    if (direction && !client.hideWeight) {
      if (weightDelta == null) notices.push("Peso: sin pesajes suficientes este mes");
      else if (direction === "lose" && weightDelta < 0) evidence.push(`Peso: ${fmtKg(Math.abs(weightDelta))} kg menos de promedio`);
      else if (direction === "gain" && weightDelta > 0) evidence.push(`Peso: ${fmtKg(weightDelta)} kg más de promedio`);
      else notices.push(`Peso: ${signed(weightDelta)} kg de promedio, en contra del objetivo`);
    }
    if (goalMentions(goal, "grasa")) {
      const fat = lastEval?.bodyFat;
      const previousEval = lastEval
        ? [...input.evaluations].reverse().find((e) => e.date < lastEval.date && e.bodyFat != null)
        : undefined;
      if (fat == null) notices.push("Grasa: sin medición este mes");
      else if (previousEval?.bodyFat != null && fat < previousEval.bodyFat)
        evidence.push(`Grasa: ${fmtKg(fat)} % (antes ${fmtKg(previousEval.bodyFat)} %)`);
      else notices.push(`Grasa: ${fmtKg(fat)} % este mes, sin baja contra la medición anterior`);
    }
    if (evidence.length > 0) {
      const picked = picker.pick("month.goal.on_track");
      cards.push({ type: "goal", theme: "black", goal, evidence, phrase: picked?.text, phraseKey: picked?.key });
    } else {
      notices.push(`Objetivo de ${mes}: sin datos que mostrarle`);
    }
  } else {
    notices.push(`${client.firstName} no cargó objetivo de ${mes}`);
  }

  // --- Invitaciones: foto y nutrición ---
  if (input.lastPhotoDate && input.lastPhotoDate <= monthEnd) {
    const days = daysBetween(input.lastPhotoDate, monthEnd);
    if (days >= PHOTO_REMINDER_DAYS) {
      const picked = picker.pick("month.photo", { dias_sin_foto: days });
      cards.push({
        type: "focus",
        theme: "card",
        word: "Tu foto",
        phrase: picked?.text,
        phraseKey: picked?.key,
        link: { label: "Ir a Mi Cuerpo", href: "/client/body?tab=cuerpo" },
      });
    }
  }
  if (input.nutritionPlanName) {
    const picked = picker.pick("month.nutrition", { plan: input.nutritionPlanName });
    cards.push({
      type: "focus",
      theme: "card",
      word: "Nutrición",
      phrase: picked?.text,
      phraseKey: picked?.key,
      link: { label: "Ver mi plan", href: "/client/body?tab=nutricion" },
    });
  }

  // --- Mensaje del cierre de mes del coach ---
  if (input.monthReviewSummary) {
    cards.push({
      type: "coach-message",
      theme: "oxblood",
      text: input.monthReviewSummary,
      coachName: input.coach.name,
      coachAvatarUrl: input.coach.avatarUrl,
    });
  }

  // --- Cierre firmado + imagen para compartir ---
  const closing = picker.pick("month.closing", { nombre: client.firstName, mes });
  cards.push({
    type: "closing",
    theme: "oxblood",
    words: monthWords(monthStart),
    coachName: input.coach.name,
    coachAvatarUrl: input.coach.avatarUrl,
    phrase: closing?.text,
    phraseKey: closing?.key,
  });
  cards.push({
    type: "share",
    theme: "black",
    monthLabel: capitalize(mes),
    words: monthWords(monthStart),
    clientName: client.fullName,
    stats: [
      { value: String(trainedDays), label: trainedDays === 1 ? "entrenamiento" : "entrenamientos" },
      ...(pbs.length > 0 ? [{ value: String(pbs.length), label: pbs.length === 1 ? "mejor marca" : "mejores marcas" }] : []),
      { value: fmtNum(volume), label: "kg movidos" },
    ],
  });

  notices.push(...routineNotices(input));
  return { cards, phraseKeys: picker.usedKeys, notices };
}
