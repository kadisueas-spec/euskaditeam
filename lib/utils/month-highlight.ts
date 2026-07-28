import { PERIMETER_LABELS, PERIMETER_TYPES, type PerimeterType } from "@/lib/anthropometrics/constants";

// Selección automática del logro principal del mes (jul-2026) para la
// imagen de compartir — pensada como trofeo, no como reporte. Puntúa 6
// tipos de logro candidatos y elige el de mayor score; "constancia" es
// el único que actúa como red de contención (fallback), no compite en la
// ronda principal, para no convertir "entrené algo" en un trofeo vacío
// cuando hay algo mejor que mostrar.

export type MonthHighlightType =
  | "exercise"
  | "body_fat"
  | "muscle"
  | "weight"
  | "measurement"
  | "consistency"
  | "streak";

export type MonthHighlightCandidate = {
  type: MonthHighlightType;
  score: number;
  bigNumber: string;
  phrase: string;
  backupLine: string;
};

export type MonthHighlight = {
  main: MonthHighlightCandidate;
  backups: MonthHighlightCandidate[];
};

type BodyCompositionInput = {
  weightKg: { first: number; last: number; diff: number };
  bodyFatPercentage: { first: number; last: number; diff: number } | null;
  muscleMassKg: { first: number; last: number; diff: number } | null;
} | null;

export type MonthHighlightInput = {
  monthNameOnly: string;
  clientGoal: string | null;
  trainedDays: number;
  currentWeeklyStreak: number;
  exerciseSeries: { exerciseName: string; points: { maxWeight: number }[] }[];
  bodyComposition: BodyCompositionInput;
  measurementPairs: { type: PerimeterType; first: number; last: number }[];
};

const MIN_MAIN_SCORE = 15;
const MIN_FALLBACK_TRAINED_DAYS = 8;

function fmt(n: number, maxDecimals = 1): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: maxDecimals });
}

// El objetivo del cliente es texto libre (clients.goal) — sin keyword
// claro de dirección, la candidata de peso queda descartada de plano en
// vez de arriesgar festejar el sentido equivocado.
function parseGoalDirection(goal: string | null): "lose" | "gain" | null {
  if (!goal) return null;
  const g = goal.toLowerCase();
  const loseWords = ["bajar", "perder", "reducir", "definir", "definición", "adelgazar", "grasa"];
  const gainWords = ["subir", "aumentar", "ganar", "volumen", "masa muscular", "hipertrofia", "engordar"];
  const hasLose = loseWords.some((w) => g.includes(w));
  const hasGain = gainWords.some((w) => g.includes(w));
  if (hasLose && !hasGain) return "lose";
  if (hasGain && !hasLose) return "gain";
  return null;
}

// a) Progresión en un ejercicio — score relativo (kg ganados / peso
// inicial), no absoluto, para no favorecer siempre a los ejercicios de
// más carga (sentadilla, peso muerto) sobre uno de brazos con gran salto
// proporcional.
function exerciseCandidate(
  series: MonthHighlightInput["exerciseSeries"]
): MonthHighlightCandidate | null {
  let best: { name: string; diff: number; score: number } | null = null;
  for (const s of series) {
    if (s.points.length < 2) continue;
    const first = s.points[0].maxWeight;
    const last = s.points[s.points.length - 1].maxWeight;
    const diff = last - first;
    if (diff <= 0 || first <= 0) continue;
    const score = (diff / first) * 100;
    if (!best || score > best.score) best = { name: s.exerciseName, diff, score };
  }
  if (!best) return null;
  const kg = fmt(best.diff, 2);
  return {
    type: "exercise",
    score: best.score,
    bigNumber: `${kg} KG`,
    phrase: `MÁS EN ${best.name.toUpperCase()}`,
    backupLine: `+${kg}kg en ${best.name}`,
  };
}

// b) Composición corporal — grasa y músculo compiten entre sí, gana el de
// mayor score, y ESE es el que entra a la ronda principal.
function bodyCompositionCandidate(
  body: BodyCompositionInput
): MonthHighlightCandidate | null {
  if (!body) return null;
  const candidates: MonthHighlightCandidate[] = [];

  if (body.bodyFatPercentage && body.bodyFatPercentage.diff < 0) {
    const pct = fmt(Math.abs(body.bodyFatPercentage.diff));
    candidates.push({
      type: "body_fat",
      score: Math.abs(body.bodyFatPercentage.diff) * 15,
      bigNumber: `${pct}%`,
      phrase: "MENOS DE GRASA CORPORAL",
      backupLine: `${pct}% menos de grasa`,
    });
  }

  if (body.muscleMassKg && body.muscleMassKg.diff > 0 && body.muscleMassKg.first > 0) {
    const relPercent = (body.muscleMassKg.diff / body.muscleMassKg.first) * 100;
    const kg = fmt(body.muscleMassKg.diff);
    candidates.push({
      type: "muscle",
      score: relPercent * 15,
      bigNumber: `${kg} KG`,
      phrase: "MÁS DE MÚSCULO",
      backupLine: `+${kg}kg de músculo`,
    });
  }

  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => b.score - a.score)[0];
}

// c) Peso corporal — SOLO cuenta si va en el sentido del objetivo
// declarado del cliente (ver parseGoalDirection).
function weightCandidate(
  body: BodyCompositionInput,
  goal: string | null
): MonthHighlightCandidate | null {
  if (!body || body.weightKg.first <= 0) return null;
  const direction = parseGoalDirection(goal);
  if (!direction) return null;

  const diff = body.weightKg.diff;
  if (direction === "lose" && diff >= 0) return null;
  if (direction === "gain" && diff <= 0) return null;

  const absDiff = Math.abs(diff);
  const score = (absDiff / body.weightKg.first) * 100 * 12;
  const kg = fmt(absDiff);
  return {
    type: "weight",
    score,
    bigNumber: `${kg} KG`,
    phrase: direction === "lose" ? "MENOS ESTE MES" : "MÁS ESTE MES",
    backupLine: `${direction === "lose" ? "-" : "+"}${kg}kg este mes`,
  };
}

// d) Medidas — cualquier dirección cuenta (una cintura que baja y un
// brazo que crece son logros igual de válidos), gana la de mayor |cm|.
function measurementCandidate(
  pairs: MonthHighlightInput["measurementPairs"]
): MonthHighlightCandidate | null {
  let best: { label: string; diff: number; score: number } | null = null;
  for (const p of pairs) {
    const diff = p.last - p.first;
    if (diff === 0) continue;
    const score = Math.abs(diff) * 4;
    if (!best || score > best.score) best = { label: PERIMETER_LABELS[p.type], diff, score };
  }
  if (!best) return null;
  const cm = fmt(Math.abs(best.diff));
  return {
    type: "measurement",
    score: best.score,
    bigNumber: `${cm} CM`,
    phrase: `${best.diff < 0 ? "MENOS" : "MÁS"} DE ${best.label.toUpperCase()}`,
    backupLine: `${best.diff < 0 ? "-" : "+"}${cm}cm de ${best.label.toLowerCase()}`,
  };
}

// f) Racha — la racha semanal ACTUAL (consecutiva, puede venir de antes
// de este mes), no la cuenta de semanas completas del mes — es lo que de
// verdad describe "semanas seguidas sin fallar".
function streakCandidate(currentWeeklyStreak: number): MonthHighlightCandidate | null {
  if (currentWeeklyStreak < 2) return null;
  return {
    type: "streak",
    score: currentWeeklyStreak * 12,
    bigNumber: `${currentWeeklyStreak}`,
    phrase: "SEMANAS SEGUIDAS SIN FALLAR",
    backupLine: `${currentWeeklyStreak} semanas seguidas`,
  };
}

// e) Constancia — el único fallback: si nada más alcanza el mínimo, y
// esto tampoco, mejor no compartir nada.
function consistencyCandidate(
  trainedDays: number,
  monthNameOnly: string
): MonthHighlightCandidate | null {
  if (trainedDays <= 0) return null;
  return {
    type: "consistency",
    score: trainedDays * 3,
    bigNumber: `${trainedDays}`,
    phrase: `ENTRENAMIENTOS EN ${monthNameOnly.toUpperCase()}`,
    backupLine: `${trainedDays} entrenamientos`,
  };
}

export function computeMonthHighlight(input: MonthHighlightInput): MonthHighlight | null {
  const primary = [
    exerciseCandidate(input.exerciseSeries),
    bodyCompositionCandidate(input.bodyComposition),
    weightCandidate(input.bodyComposition, input.clientGoal),
    measurementCandidate(input.measurementPairs),
    streakCandidate(input.currentWeeklyStreak),
  ]
    .filter((c): c is MonthHighlightCandidate => c != null)
    .sort((a, b) => b.score - a.score);

  const consistency = consistencyCandidate(input.trainedDays, input.monthNameOnly);

  if (primary[0] && primary[0].score >= MIN_MAIN_SCORE) {
    const backups = [...primary.slice(1), ...(consistency ? [consistency] : [])]
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);
    return { main: primary[0], backups };
  }

  if (consistency && input.trainedDays >= MIN_FALLBACK_TRAINED_DAYS) {
    return { main: consistency, backups: primary.slice(0, 2) };
  }

  return null;
}

export { PERIMETER_TYPES };
