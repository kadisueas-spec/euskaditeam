import { PhrasePicker } from "@/lib/reports/phrases";
import type { Situation } from "@/lib/reports/phrases";
import { personalBests } from "@/lib/reports/records";
import { weightDirectionFromGoal, type WeightDirection } from "@/lib/reports/weight-goal";
import { CUSTOM_LABELS, SMALL_CHANGE_KG, monthlyWeightCard, rangeWeightCard } from "@/lib/reports/weight";
import { routineNotices } from "@/lib/reports/notices";
import { previousPeriodOf } from "@/lib/reports/periods";
import { RECORDS_FOR_CELEBRATION, improvementCard } from "@/lib/reports/build-weekly";
import {
  HISTORY_LINK,
  bodySection,
  effortVolume,
  exerciseSections,
  goalSection,
  recordsSection,
  streakSection,
  volumeSection,
  cardioSection,
} from "@/lib/reports/sections";
import { capitalize, daysBetween, fmtNum, monthName, monthWords, weekRangeLabel } from "@/lib/reports/format";
import { plannedDaysInRange } from "@/lib/utils/planned-days";
import { adherencePercent } from "@/lib/utils/training-sessions";
import type { Period } from "@/lib/reports/schedule";
import type { ReportInput } from "@/lib/reports/input";
import type { BuiltReport, ReportCard } from "@/lib/reports/types";

const PHOTO_REMINDER_DAYS = 30;

function prevMonthOf(monthStart: string): Period {
  const [y, m] = monthStart.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
  return { start, end };
}

function nextMonthStartOf(monthStart: string): string {
  const [y, m] = monthStart.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}

// "Hubo avance" en un período libre (portada): 1+ mejores marcas, volumen
// que subió contra el período anterior de igual duración, o peso que se
// movió 0,5 kg o más hacia el objetivo (weightDelta llega null si el peso
// está oculto en los reportes).
export function hadProgress(p: { records: number; volumeUp: boolean; weightDelta: number | null; direction: WeightDirection }): boolean {
  if (p.records > 0 || p.volumeUp) return true;
  const d = p.weightDelta;
  if (d == null) return false;
  return (p.direction === "lose" && d <= -SMALL_CHANGE_KG) || (p.direction === "gain" && d >= SMALL_CHANGE_KG);
}

// Reporte mensual (mes calendario) o de período libre ("3 al 17 de
// noviembre"). Mismas tarjetas; cambian el período de comparación (mes
// anterior vs. período anterior de igual duración), la portada/cierre y las
// frases (las del libre son neutras: "este período").
export function buildPeriodReport(input: ReportInput): BuiltReport {
  const custom = input.kind === "custom";
  const scope = custom ? "custom" : "monthly";
  const { client, routine, periodStart: start, periodEnd: end } = input;
  const picker = new PhrasePicker(custom ? `${client.id}:custom:${start}:${end}` : `${client.id}:monthly:${start}`, scope, input.phraseHistory);
  const cards: ReportCard[] = [];
  const notices: string[] = [];
  const prev = custom ? previousPeriodOf(start, end) : prevMonthOf(start);
  const mes = monthName(start);
  const mesAnterior = monthName(prev.start);
  const coverWords = custom ? ["Tu", "progreso"] : monthWords(start);

  const period = input.sessions.filter((s) => s.date >= start && s.date <= end);
  const previous = input.sessions.filter((s) => s.date >= prev.start && s.date <= prev.end);
  const trainedDays = new Set(period.map((s) => s.date)).size;
  const { sets, volume } = effortVolume(period);
  const pbs = personalBests(input.bestSets, start, end);
  const planned = routine
    ? plannedDaysInRange({
        rangeStart: start,
        rangeEnd: end,
        plannedPerWeek: routine.daysPerWeek,
        accessActivatedAt: client.accessActivatedAt,
        routineAssignedAt: routine.assignedAt,
      })
    : 0;
  const adherence = adherencePercent(trainedDays, planned);

  // --- Portada. En el libre la frase depende de si hubo avance, que se
  // sabe recién con volumen y peso: se completa más abajo. ---
  const openingCard: Extract<ReportCard, { type: "opening" }> = { type: "opening", key: "opening", theme: "red", words: coverWords };
  if (!custom) {
    const opening = picker.pick("month.opening", { nombre: client.firstName, mes, Mes: capitalize(mes) });
    openingCard.phrase = opening?.text;
    openingCard.phraseKey = opening?.key;
  }
  cards.push(openingCard);

  // --- Entrenamientos: la frase según asistencia Y récords ---
  let adherenceSituation: Situation;
  if (adherence >= 80) adherenceSituation = "month.adherence.high";
  else if (pbs.length >= RECORDS_FOR_CELEBRATION) adherenceSituation = "month.adherence.records";
  else if (adherence >= 50) adherenceSituation = "month.adherence.mid";
  else adherenceSituation = "month.adherence.low";
  const adherencePhrase = picker.pick(adherenceSituation, {
    adherencia: adherence,
    mes_siguiente: custom ? null : monthName(nextMonthStartOf(start)),
  });
  cards.push({
    type: "count",
    key: "count",
    theme: "black",
    kicker: custom ? "En este período" : `En ${mes}`,
    value: trainedDays,
    label: trainedDays === 1 ? "entrenamiento" : "entrenamientos",
    detail: [planned > 0 ? `${trainedDays} de ${planned} planificados` : null, `${sets} series`, `${fmtNum(volume)} kg movidos`]
      .filter(Boolean)
      .join(" · "),
    phrase: adherencePhrase?.text,
    phraseKey: adherencePhrase?.key,
    link: HISTORY_LINK,
  });

  // --- Récords: la lista no repite la mejora principal (tarjeta siguiente) ---
  const records = recordsSection({ pbs, picker, on: pbs.length >= 2, excludeTop: true });
  if (records) cards.push(records);
  if (pbs.length > 0) cards.push(improvementCard(pbs[0], [], picker));

  // --- Volumen: prendido solo si SUBE; si no, apagado + aviso privado ---
  const vol = volumeSection({
    current: period,
    previous,
    currentLabel: custom ? "Este período" : capitalize(mes),
    previousLabel: custom ? "Período anterior" : capitalize(mesAnterior),
    versus: custom ? "el período anterior" : mesAnterior,
    picker,
  });
  if (vol.card) cards.push(vol.card);
  if (vol.notice) notices.push(vol.notice);

  // --- Minutos de cardio: prendida, solo si hubo cardio ---
  const cardio = cardioSection({
    current: period,
    previous,
    versus: custom ? "el período anterior" : mesAnterior,
    picker,
  });
  if (cardio) cards.push(cardio);

  // --- Racha: prendida si es récord o 3+ semanas seguidas ---
  const streak = streakSection(input, true);
  if (streak) cards.push(streak);

  // --- Cuerpo y peso ---
  const body = bodySection(input, picker);
  if (body) cards.push(body);
  const direction = weightDirectionFromGoal(input.monthGoal?.mainGoal ?? client.goal);
  let weightDelta: number | null = null;
  if (!client.hideWeight) {
    const { card, deltaKg } = custom
      ? rangeWeightCard({
          weights: input.weights,
          start,
          end,
          prevStart: prev.start,
          prevEnd: prev.end,
          direction,
          picker,
          labels: CUSTOM_LABELS,
        })
      : monthlyWeightCard({ weights: input.weights, monthStart: start, monthEnd: end, prevMonthStart: prev.start, direction, picker });
    weightDelta = deltaKg;
    if (card) cards.push(card);
  }

  if (custom) {
    const advanced = hadProgress({ records: pbs.length, volumeUp: vol.card?.type === "volume" && vol.card.percent > 0, weightDelta, direction });
    const opening = picker.pick(advanced ? "custom.opening.progress" : "custom.opening.steady", { nombre: client.firstName });
    openingCard.phrase = opening?.text;
    openingCard.phraseKey = opening?.key;
  }

  // --- Objetivo vs realidad ---
  const goal = goalSection({
    input,
    pbs,
    direction,
    weightDelta,
    picker,
    on: true,
    words: custom
      ? { inPeriod: "en este período", thisPeriod: "en este período", periodName: "este período" }
      : { inPeriod: "en el mes", thisPeriod: "este mes", periodName: mes },
    withNotices: true,
  });
  if (goal.card) cards.push(goal.card);
  notices.push(...goal.notices);

  // --- Gráficos de ejercicios (opcionales) ---
  cards.push(...exerciseSections(input.bestSets, start, end));

  // --- Invitaciones: foto y nutrición ---
  if (input.lastPhotoDate && input.lastPhotoDate <= end) {
    const days = daysBetween(input.lastPhotoDate, end);
    if (days >= PHOTO_REMINDER_DAYS) {
      const picked = picker.pick("month.photo", { dias_sin_foto: days });
      cards.push({
        type: "focus",
        key: "photo",
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
      key: "nutrition",
      theme: "card",
      word: "Nutrición",
      phrase: picked?.text,
      phraseKey: picked?.key,
      link: { label: "Ver mi plan", href: "/client/body?tab=nutricion" },
    });
  }

  // --- Lo que viene (solo en el libre, con frases neutras) ---
  if (custom) {
    const top = pbs[0];
    const focus =
      top && top.type !== "rir"
        ? { situation: "focus.exercise" as const, word: "Subir", vars: { ejercicio: top.exerciseName } }
        : { situation: "focus.keep" as const, word: "Sostener", vars: {} };
    const picked = picker.pick(focus.situation, focus.vars);
    cards.push({ type: "focus", key: "focus", theme: "black", word: focus.word, phrase: picked?.text, phraseKey: picked?.key });
  }

  // --- Mensaje del cierre de mes del coach (solo mensual) ---
  if (!custom && input.monthReviewSummary) {
    cards.push({
      type: "coach-message",
      key: "coach-message",
      theme: "oxblood",
      text: input.monthReviewSummary,
      coachName: input.coach.name,
      coachAvatarUrl: input.coach.avatarUrl,
    });
  }

  // --- Cierre firmado + imagen para compartir ---
  const closing = picker.pick("month.closing", custom ? { nombre: client.firstName } : { nombre: client.firstName, mes });
  cards.push({
    type: "closing",
    key: "closing",
    theme: "oxblood",
    words: coverWords,
    coachName: input.coach.name,
    coachAvatarUrl: input.coach.avatarUrl,
    phrase: closing?.text,
    phraseKey: closing?.key,
  });
  cards.push({
    type: "share",
    key: "share",
    theme: "black",
    monthLabel: custom ? "Progreso" : capitalize(mes),
    words: custom ? ["Tu", "progreso"] : monthWords(start),
    clientName: custom ? `${client.fullName} · ${weekRangeLabel(start, end)}` : client.fullName,
    stats: [
      { value: String(trainedDays), label: trainedDays === 1 ? "entrenamiento" : "entrenamientos" },
      ...(pbs.length > 0 ? [{ value: String(pbs.length), label: pbs.length === 1 ? "mejor marca" : "mejores marcas" }] : []),
      { value: fmtNum(volume), label: "kg movidos" },
    ],
  });

  notices.push(...routineNotices(input));
  return { cards, phraseKeys: picker.usedKeys, notices };
}

// Nombre histórico: el mensual es un período = mes calendario.
export const buildMonthlyReport = buildPeriodReport;
