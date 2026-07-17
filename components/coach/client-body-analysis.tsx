"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EvolutionChart,
  shortDateLabel,
  trendOf,
  type ChartPoint,
} from "@/components/charts/evaluation-evolution-chart";
import type { EvaluationDetail } from "@/lib/supabase/anthropometrics";
import {
  PERIMETER_LABELS,
  PERIMETER_TYPES,
  SKINFOLD_LABELS,
  type MeasurementType,
  type PerimeterType,
} from "@/lib/anthropometrics/constants";
import type { SkinfoldType } from "@/lib/anthropometrics/formulas";
import { formatDate } from "@/lib/utils/format-date";

const SKINFOLD_TYPES = Object.keys(SKINFOLD_LABELS) as SkinfoldType[];

// Análisis antropométrico completo para el panel del coach — mismos datos
// y componentes de chart que /client → Mi Cuerpo (BodyTab), pero con
// dashboard de tendencia, tabla comparativa fila-por-medición y
// comparación inicio/ahora con porcentaje, que el cliente no necesita ver
// con ese nivel de detalle.

function daysSinceEvaluation(dateStr: string): number {
  const target = new Date(`${dateStr}T00:00:00Z`);
  const targetDayMs = Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate()
  );
  const now = new Date();
  const todayDayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((todayDayMs - targetDayMs) / (24 * 60 * 60 * 1000));
}

function TrendStatCard({
  label,
  value,
  unit,
  delta,
  decimals = 1,
}: {
  label: string;
  value: number | null;
  unit: string;
  delta: number | null;
  decimals?: number;
}) {
  return (
    <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
      <p className="text-xs text-[#888888]">{label}</p>
      <p className="mt-1 font-display text-3xl text-[#e8001c]">
        {value != null ? `${value.toFixed(decimals)}${unit}` : "—"}
      </p>
      {delta != null && delta !== 0 && (
        <p className="mt-1 flex items-center gap-1 text-xs text-[#888888]">
          {delta > 0 ? <ArrowUp className="size-3 shrink-0" /> : <ArrowDown className="size-3 shrink-0" />}
          {Math.abs(delta).toFixed(decimals)}
          {unit} vs. anterior
        </p>
      )}
    </div>
  );
}

// Criterio elegido por Luis para la tabla comparativa: estándar de pérdida
// de grasa (% grasa ↓, pliegues ↓, perímetros ↓, masa muscular ↑ = mejora).
// Peso e IMC quedan neutrales (sin colorear) — subir o bajar puede ser el
// objetivo según el cliente, mismo motivo que ya documenta DiffStat en el
// detalle de evaluación individual.
type ImprovementDirection = "down" | "up" | "neutral";

function improvementDirection(rowKey: string): ImprovementDirection {
  if (rowKey === "bodyFat") return "down";
  if (rowKey === "muscleMass") return "up";
  if (rowKey === "weight" || rowKey === "bmi") return "neutral";
  if ((PERIMETER_TYPES as string[]).includes(rowKey)) return "down";
  if (SKINFOLD_TYPES.includes(rowKey as SkinfoldType)) return "down";
  return "neutral";
}

function deltaColorClass(direction: ImprovementDirection, delta: number | null): string {
  if (delta == null || delta === 0 || direction === "neutral") return "text-white";
  const improved = direction === "down" ? delta < 0 : delta > 0;
  return improved ? "text-green-400" : "text-[#ff6b6b]";
}

type MetricRow = {
  key: string;
  label: string;
  unit: string;
  decimals: number;
  getValue: (e: EvaluationDetail) => number | null;
};

const CORE_ROWS: MetricRow[] = [
  { key: "weight", label: "Peso", unit: " kg", decimals: 1, getValue: (e) => e.weightKg },
  {
    key: "bodyFat",
    label: "% Grasa corporal",
    unit: "%",
    decimals: 1,
    getValue: (e) => e.bodyFatPercentage,
  },
  {
    key: "muscleMass",
    label: "Masa muscular",
    unit: " kg",
    decimals: 1,
    getValue: (e) => e.muscleMassKg,
  },
  { key: "bmi", label: "IMC", unit: "", decimals: 1, getValue: (e) => e.bmi },
];

const MEASUREMENT_ROWS: MetricRow[] = [
  ...PERIMETER_TYPES.map((t) => ({
    key: t as string,
    label: PERIMETER_LABELS[t],
    unit: " cm",
    decimals: 1,
    getValue: (e: EvaluationDetail) => e.measurements[t as MeasurementType] ?? null,
  })),
  ...SKINFOLD_TYPES.map((t) => ({
    key: t as string,
    label: SKINFOLD_LABELS[t],
    unit: " mm",
    decimals: 1,
    getValue: (e: EvaluationDetail) => e.measurements[t as MeasurementType] ?? null,
  })),
];

const ALL_ROWS: MetricRow[] = [...CORE_ROWS, ...MEASUREMENT_ROWS];

type RowCell = { value: number | null; delta: number | null };

function buildRowCells(row: MetricRow, evaluations: EvaluationDetail[]) {
  let previousValue: number | null = null;
  const cells: RowCell[] = evaluations.map((e) => {
    const value = row.getValue(e);
    const delta = value != null && previousValue != null ? value - previousValue : null;
    if (value != null) previousValue = value;
    return { value, delta };
  });

  const firstValue = row.getValue(evaluations[0]);
  const lastValue = row.getValue(evaluations[evaluations.length - 1]);
  const totalDelta = firstValue != null && lastValue != null ? lastValue - firstValue : null;

  return { cells, firstValue, lastValue, totalDelta };
}

function formatValue(value: number | null, unit: string, decimals: number): string {
  return value != null ? `${value.toFixed(decimals)}${unit}` : "—";
}

function DeltaCell({
  delta,
  unit,
  decimals,
  direction,
}: {
  delta: number | null;
  unit: string;
  decimals: number;
  direction: ImprovementDirection;
}) {
  if (delta == null) return <span className="text-[#555555]">—</span>;
  return (
    <span className={`flex items-center gap-1 ${deltaColorClass(direction, delta)}`}>
      {delta !== 0 &&
        (delta > 0 ? (
          <ArrowUp className="size-3 shrink-0" />
        ) : (
          <ArrowDown className="size-3 shrink-0" />
        ))}
      {delta === 0 ? "=" : `${Math.abs(delta).toFixed(decimals)}${unit}`}
    </span>
  );
}

export function ClientBodyAnalysis({ evaluations }: { evaluations: EvaluationDetail[] }) {
  const [perimeterType, setPerimeterType] = useState<PerimeterType>("waist");
  const [skinfoldType, setSkinfoldType] = useState<SkinfoldType>(SKINFOLD_TYPES[0]);

  if (evaluations.length === 0) return null;

  const latest = evaluations[evaluations.length - 1];
  const first = evaluations[0];

  const weightPoints: ChartPoint[] = evaluations.map((e) => ({
    date: e.evaluationDate,
    label: shortDateLabel(e.evaluationDate),
    value: e.weightKg,
  }));
  const bodyFatPoints: ChartPoint[] = evaluations
    .filter((e) => e.bodyFatPercentage != null)
    .map((e) => ({
      date: e.evaluationDate,
      label: shortDateLabel(e.evaluationDate),
      value: e.bodyFatPercentage!,
    }));
  const muscleMassPoints: ChartPoint[] = evaluations
    .filter((e) => e.muscleMassKg != null)
    .map((e) => ({
      date: e.evaluationDate,
      label: shortDateLabel(e.evaluationDate),
      value: e.muscleMassKg!,
    }));
  const perimeterPoints: ChartPoint[] = evaluations
    .filter((e) => e.measurements[perimeterType] != null)
    .map((e) => ({
      date: e.evaluationDate,
      label: shortDateLabel(e.evaluationDate),
      value: e.measurements[perimeterType]!,
    }));
  const skinfoldPoints: ChartPoint[] = evaluations
    .filter((e) => e.measurements[skinfoldType] != null)
    .map((e) => ({
      date: e.evaluationDate,
      label: shortDateLabel(e.evaluationDate),
      value: e.measurements[skinfoldType]!,
    }));

  const bodyFatTrend = trendOf(bodyFatPoints);
  const muscleMassTrend = trendOf(muscleMassPoints);
  const weightTrend = trendOf(weightPoints);

  const rowsWithData = ALL_ROWS.filter((row) => evaluations.some((e) => row.getValue(e) != null));
  const showComparison = evaluations.length >= 2;
  const startVsNowRows = rowsWithData.filter((row) => {
    const { firstValue, lastValue } = buildRowCells(row, evaluations);
    return firstValue != null && lastValue != null;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Dashboard resumen */}
      <div className="grid grid-cols-2 gap-3">
        <TrendStatCard
          label="Grasa corporal"
          value={bodyFatTrend?.current ?? null}
          unit="%"
          delta={bodyFatTrend?.delta ?? null}
        />
        <TrendStatCard
          label="Masa muscular"
          value={muscleMassTrend?.current ?? null}
          unit=" kg"
          delta={muscleMassTrend?.delta ?? null}
        />
        <TrendStatCard
          label="Peso actual"
          value={weightTrend?.current ?? null}
          unit=" kg"
          delta={weightTrend?.delta ?? null}
        />
        <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
          <p className="text-xs text-[#888888]">Última evaluación</p>
          <p className="mt-1 text-sm font-medium text-white">{formatDate(latest.evaluationDate)}</p>
          <p className="mt-1 text-xs text-[#888888]">
            Hace {daysSinceEvaluation(latest.evaluationDate)} día
            {daysSinceEvaluation(latest.evaluationDate) === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {/* 2. Gráficos de evolución */}
      <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
        <EvolutionChart title="Peso corporal" unit="kg" points={weightPoints} />
      </div>

      {bodyFatPoints.length > 0 && (
        <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
          <EvolutionChart title="% de grasa corporal" unit="%" points={bodyFatPoints} />
        </div>
      )}

      {muscleMassPoints.length > 0 && (
        <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
          <EvolutionChart title="Masa muscular" unit="kg" points={muscleMassPoints} />
        </div>
      )}

      <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
        <div className="mb-4">
          <NativeSelect
            value={perimeterType}
            onChange={(e) => setPerimeterType(e.target.value as PerimeterType)}
            className="min-h-[44px] w-full"
          >
            {PERIMETER_TYPES.map((t) => (
              <option key={t} value={t}>
                {PERIMETER_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        </div>
        {perimeterPoints.length === 0 ? (
          <p className="text-sm text-[#888888]">
            Todavía no hay mediciones de {PERIMETER_LABELS[perimeterType].toLowerCase()}.
          </p>
        ) : (
          <EvolutionChart title={PERIMETER_LABELS[perimeterType]} unit="cm" points={perimeterPoints} />
        )}
      </div>

      <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
        <div className="mb-4">
          <NativeSelect
            value={skinfoldType}
            onChange={(e) => setSkinfoldType(e.target.value as SkinfoldType)}
            className="min-h-[44px] w-full"
          >
            {SKINFOLD_TYPES.map((t) => (
              <option key={t} value={t}>
                {SKINFOLD_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        </div>
        {skinfoldPoints.length === 0 ? (
          <p className="text-sm text-[#888888]">
            Todavía no hay mediciones de {SKINFOLD_LABELS[skinfoldType].toLowerCase()}.
          </p>
        ) : (
          <EvolutionChart title={SKINFOLD_LABELS[skinfoldType]} unit="mm" points={skinfoldPoints} />
        )}
      </div>

      {/* 3. Tabla comparativa completa */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
        <p className="text-sm font-medium text-white">Comparativa de todas las evaluaciones</p>
        <div className="overflow-x-auto rounded-xl border border-[#1e1e1e]">
          <Table>
            <TableHeader>
              <TableRow className="border-[#1e1e1e] hover:bg-transparent">
                <TableHead className="sticky left-0 z-10 bg-[#111111] text-[#888888]">
                  Medición
                </TableHead>
                {evaluations.map((e) => (
                  <TableHead key={e.id} className="text-right text-[#888888]">
                    {shortDateLabel(e.evaluationDate)}
                  </TableHead>
                ))}
                <TableHead className="text-right text-[#888888]">Δ total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rowsWithData.map((row) => {
                const { cells, totalDelta } = buildRowCells(row, evaluations);
                const direction = improvementDirection(row.key);
                return (
                  <TableRow key={row.key} className="border-[#1e1e1e]">
                    <TableCell className="sticky left-0 z-10 bg-[#111111] font-medium text-white">
                      {row.label}
                    </TableCell>
                    {cells.map((cell, i) => (
                      <TableCell key={evaluations[i].id} className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-white">
                            {formatValue(cell.value, row.unit, row.decimals)}
                          </span>
                          {i > 0 && (
                            <span className={`text-xs ${deltaColorClass(direction, cell.delta)}`}>
                              {cell.delta == null
                                ? ""
                                : cell.delta === 0
                                  ? "="
                                  : `${cell.delta > 0 ? "+" : "−"}${Math.abs(cell.delta).toFixed(row.decimals)}`}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <DeltaCell
                        delta={totalDelta}
                        unit={row.unit}
                        decimals={row.decimals}
                        direction={direction}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 4. Comparación inicio vs ahora */}
      {showComparison && startVsNowRows.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
          <p className="text-sm font-medium text-white">
            Inicio vs. ahora — {formatDate(first.evaluationDate)} → {formatDate(latest.evaluationDate)}
          </p>
          <div className="overflow-x-auto rounded-xl border border-[#1e1e1e]">
            <Table>
              <TableHeader>
                <TableRow className="border-[#1e1e1e] hover:bg-transparent">
                  <TableHead className="text-[#888888]">Medición</TableHead>
                  <TableHead className="text-right text-[#888888]">Inicio</TableHead>
                  <TableHead className="text-right text-[#888888]">Ahora</TableHead>
                  <TableHead className="text-right text-[#888888]">Diferencia</TableHead>
                  <TableHead className="text-right text-[#888888]">Δ %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {startVsNowRows.map((row) => {
                  const { firstValue, lastValue, totalDelta } = buildRowCells(row, evaluations);
                  const direction = improvementDirection(row.key);
                  const percentDelta =
                    firstValue != null && firstValue !== 0 && totalDelta != null
                      ? (totalDelta / Math.abs(firstValue)) * 100
                      : null;
                  return (
                    <TableRow key={row.key} className="border-[#1e1e1e]">
                      <TableCell className="font-medium text-white">{row.label}</TableCell>
                      <TableCell className="text-right text-white">
                        {formatValue(firstValue, row.unit, row.decimals)}
                      </TableCell>
                      <TableCell className="text-right text-white">
                        {formatValue(lastValue, row.unit, row.decimals)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DeltaCell
                          delta={totalDelta}
                          unit={row.unit}
                          decimals={row.decimals}
                          direction={direction}
                        />
                      </TableCell>
                      <TableCell className={`text-right ${deltaColorClass(direction, percentDelta)}`}>
                        {percentDelta != null ? `${percentDelta > 0 ? "+" : ""}${percentDelta.toFixed(1)}%` : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
