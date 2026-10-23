import { mondayKeyFor } from "@/lib/utils/week";
import { addDays, capitalize, fmtKg, monthName, signed } from "@/lib/reports/format";
import type { PhrasePicker } from "@/lib/reports/phrases";
import type { ReportCard } from "@/lib/reports/types";
import type { WeightDirection } from "@/lib/reports/weight-goal";

type WeightLog = { date: string; kg: number };

// Cambio menor a esto se considera "chico": el titular pasa a ser la
// tendencia desde el inicio (aprobado oct-2026).
export const SMALL_CHANGE_KG = 0.5;
// "Peso estable" solo si de verdad casi no se movió: el texto nunca puede
// contradecir el gráfico (con −0,2 kg el último punto ya se ve más abajo).
const STABLE_KG = 0.25;
const SERIES_MAX_WEEKS = 16;

function avg(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function averageBetween(weights: WeightLog[], from: string, to: string): { kg: number; count: number } | null {
  const vals = weights.filter((w) => w.date >= from && w.date <= to).map((w) => w.kg);
  const a = avg(vals);
  // Sin redondear: las diferencias se calculan sobre el valor real y se
  // redondean solo al mostrar (88,84 → 87,57 es −1,3, no 88,8 − 87,6 = −1,2).
  return a == null ? null : { kg: a, count: vals.length };
}

// Promedio por semana (lunes a domingo), desde la primera semana COMPLETA
// con datos (el primer lunes en o después del primer pesaje) — así un
// pesaje suelto de un domingo no arma una semana de un solo dato. La última
// semana se corta en `lastWeekEnd` (semanal: el viernes del reporte).
export function weeklySeries(
  weights: WeightLog[],
  lastWeekStart: string,
  lastWeekEnd: string
): { weekStart: string; kg: number }[] {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return [];
  let start = mondayKeyFor(sorted[0].date);
  if (start < sorted[0].date) start = addDays(start, 7);
  const earliest = addDays(lastWeekStart, -7 * (SERIES_MAX_WEEKS - 1));
  if (start < earliest) start = earliest;

  const out: { weekStart: string; kg: number }[] = [];
  for (let w = start; w <= lastWeekStart; w = addDays(w, 7)) {
    const end = w === lastWeekStart ? lastWeekEnd : addDays(w, 6);
    const a = averageBetween(weights, w, end);
    if (a) out.push({ weekStart: w, kg: a.kg });
  }
  return out;
}

type RangeLabels = { kicker: string; detail: string; detailShort: string; last: string };

export const WEEK_LABELS: RangeLabels = {
  kicker: "Tu peso esta semana",
  detail: "Promedio de la semana contra el de la semana anterior",
  detailShort: "Promedio de la semana",
  last: "esta semana",
};

export const CUSTOM_LABELS: RangeLabels = {
  kicker: "Tu peso en este período",
  detail: "Promedio de este período contra el anterior de igual duración",
  detailShort: "Promedio de este período",
  last: "fin del período",
};

// Tarjeta de peso de un rango (semanal o libre): promedio del rango contra
// el del período anterior de igual duración. Si el cambio es chico, el
// titular es la tendencia desde el inicio de la serie (aprobado oct-2026).
export function rangeWeightCard(params: {
  weights: WeightLog[];
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
  direction: WeightDirection;
  picker: PhrasePicker;
  labels: RangeLabels;
}): { card: ReportCard | null; deltaKg: number | null } {
  const { weights, start, end, prevStart, prevEnd, direction, picker, labels } = params;
  const current = averageBetween(weights, start, end);
  if (!current) return { card: null, deltaKg: null };
  const previous = averageBetween(weights, prevStart, prevEnd);
  const series = weeklySeries(weights, mondayKeyFor(end), end);
  const delta = previous ? round1(current.kg - previous.kg) : null;
  const link = { label: "Ver en Mi Cuerpo", href: "/client/body?tab=peso" };
  const base = { type: "weight" as const, key: "weight", theme: "light" as const, series, lastLabel: labels.last, link };

  if (delta != null && Math.abs(delta) >= SMALL_CHANGE_KG) {
    const vars = { delta_peso: fmtKg(Math.abs(delta)), peso: fmtKg(current.kg) };
    const festeja = (delta < 0 && direction === "lose") || (delta > 0 && direction === "gain");
    const picked = festeja ? picker.pick(delta < 0 ? "weight.down" : "weight.up", vars) : null;
    return {
      deltaKg: delta,
      card: {
        ...base,
        kicker: labels.kicker,
        headline: festeja ? signed(delta) : fmtKg(current.kg),
        fromTo: `${fmtKg(previous!.kg)} kg → ${fmtKg(current.kg)} kg`,
        detail: labels.detail,
        phrase: picked?.text,
        phraseKey: picked?.key,
      },
    };
  }

  // Cambio chico: titular = tendencia desde el inicio de la serie.
  const first = series[0];
  const trend = first && series.length >= 3 ? round1(current.kg - first.kg) : null;
  if (trend != null && Math.abs(trend) >= SMALL_CHANGE_KG && (trend < 0 ? direction === "lose" : direction === "gain")) {
    const mes = monthName(first.weekStart);
    const picked =
      trend < 0
        ? picker.pick("weight.trend_down", { peso: fmtKg(current.kg), delta_peso: fmtKg(Math.abs(trend)), mes_inicio: mes })
        : null;
    return {
      deltaKg: delta,
      card: {
        ...base,
        kicker: `Tu peso desde ${mes}`,
        headline: signed(trend),
        fromTo: `${fmtKg(first.kg)} kg → ${fmtKg(current.kg)} kg`,
        detail: null,
        phrase: picked?.text,
        phraseKey: picked?.key,
      },
    };
  }

  const stable = delta != null && Math.abs(delta) < STABLE_KG;
  const picked = stable ? picker.pick("weight.stable", { peso: fmtKg(current.kg) }) : null;
  return {
    deltaKg: delta,
    card: {
      ...base,
      kicker: labels.kicker,
      headline: fmtKg(current.kg),
      fromTo: previous ? `${fmtKg(previous.kg)} kg → ${fmtKg(current.kg)} kg` : null,
      detail: labels.detailShort,
      phrase: picked?.text,
      phraseKey: picked?.key,
    },
  };
}

// Tarjeta de peso del reporte SEMANAL (lunes a viernes contra la semana
// anterior completa).
export function weeklyWeightCard(params: {
  weights: WeightLog[];
  periodStart: string;
  periodEnd: string;
  direction: WeightDirection;
  picker: PhrasePicker;
}): ReportCard | null {
  return rangeWeightCard({
    weights: params.weights,
    start: params.periodStart,
    end: params.periodEnd,
    prevStart: addDays(params.periodStart, -7),
    prevEnd: addDays(params.periodStart, -1),
    direction: params.direction,
    picker: params.picker,
    labels: WEEK_LABELS,
  }).card;
}

// Tarjeta de peso del reporte MENSUAL: promedio del mes contra el del mes
// anterior.
export function monthlyWeightCard(params: {
  weights: WeightLog[];
  monthStart: string;
  monthEnd: string;
  prevMonthStart: string;
  direction: WeightDirection;
  picker: PhrasePicker;
}): { card: ReportCard | null; deltaKg: number | null } {
  const { weights, monthStart, monthEnd, prevMonthStart, direction, picker } = params;
  const current = averageBetween(weights, monthStart, monthEnd);
  if (!current) return { card: null, deltaKg: null };
  const previous = averageBetween(weights, prevMonthStart, addDays(monthStart, -1));
  const delta = previous ? round1(current.kg - previous.kg) : null;
  const mes = monthName(monthStart);
  const series = weeklySeries(weights, mondayKeyFor(monthEnd), monthEnd).filter(
    (p) => p.weekStart <= monthEnd
  );
  const base = {
    type: "weight" as const,
    key: "weight",
    theme: "light" as const,
    series,
    lastLabel: `fin de ${mes}`,
    link: { label: "Ver en Mi Cuerpo", href: "/client/body?tab=peso" },
  };
  const detail = previous
    ? `Promedio de ${monthName(prevMonthStart)} (${previous.count} ${previous.count === 1 ? "pesaje" : "pesajes"}) contra ${mes} (${current.count} ${current.count === 1 ? "pesaje" : "pesajes"})`
    : `Promedio de ${mes}`;

  if (delta != null && Math.abs(delta) >= SMALL_CHANGE_KG) {
    const festeja = (delta < 0 && direction === "lose") || (delta > 0 && direction === "gain");
    const picked = festeja
      ? picker.pick(delta < 0 ? "weight.down" : "weight.up", { delta_peso: fmtKg(Math.abs(delta)), peso: fmtKg(current.kg) })
      : null;
    return {
      deltaKg: delta,
      card: {
        ...base,
        kicker: festeja ? "Tu peso" : `Tu peso en ${mes}`,
        headline: festeja ? signed(delta) : fmtKg(current.kg),
        fromTo: `${fmtKg(previous!.kg)} kg → ${fmtKg(current.kg)} kg`,
        detail,
        phrase: picked?.text,
        phraseKey: picked?.key,
      },
    };
  }
  const stable = delta != null && Math.abs(delta) < STABLE_KG;
  const picked = stable ? picker.pick("weight.stable", { peso: fmtKg(current.kg) }) : null;
  return {
    deltaKg: delta,
    card: {
      ...base,
      kicker: `Tu peso en ${mes}`,
      headline: fmtKg(current.kg),
      fromTo: previous ? `${fmtKg(previous.kg)} kg → ${fmtKg(current.kg)} kg` : null,
      detail,
      phrase: picked?.text,
      phraseKey: picked?.key,
    },
  };
}

export function capitalizedMonth(date: string): string {
  return capitalize(monthName(date));
}
