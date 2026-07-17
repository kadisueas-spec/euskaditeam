"use client";

import { useState } from "react";
import { Pencil, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import {
  EvolutionChart,
  shortDateLabel,
  type ChartPoint,
} from "@/components/charts/evaluation-evolution-chart";
import { saveWeightLog } from "@/app/client/progress/weight-actions";
import { parseDecimalInput, sanitizeDecimalInput } from "@/lib/utils/decimal-input";
import type { WeightLogEntry } from "@/lib/supabase/weight-logs";
import { formatDate } from "@/lib/utils/format-date";

type Range = "week" | "month" | "all";
const RANGE_LABEL: Record<Range, string> = { week: "Semana", month: "Mes", all: "Todo" };
const RANGES: Range[] = ["week", "month", "all"];

// Mismo criterio de "día" que ya usa getOrCreateInProgressWorkout (UTC,
// consistente en toda la app) — así "hoy" no depende de la zona horaria
// del navegador del cliente.
function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function filterByRange(logs: WeightLogEntry[], range: Range): WeightLogEntry[] {
  if (range === "all") return logs;
  const days = range === "week" ? 7 : 30;
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return logs.filter((l) => l.date >= cutoffStr);
}

// Input + Guardar/Cancelar reusado tanto por la tarjeta de "hoy" como por
// cada fila editable del historial — un solo lugar con la lógica de
// guardado, sanitización decimal y manejo de error/red.
function WeightEntryForm({
  date,
  initialValue,
  onSaved,
  onCancel,
}: {
  date: string;
  initialValue: string;
  onSaved: (entry: { date: string; weightKg: number }) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const weightKg = parseDecimalInput(value);
    if (weightKg == null) {
      setError("Ingresá un peso válido.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await saveWeightLog(date, weightKg);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onSaved({ date, weightKg });
    } catch {
      setError("Sin conexión. Revisá tu red y reintentá.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type="text"
            inputMode="decimal"
            autoFocus
            value={value}
            onChange={(e) => setValue(sanitizeDecimalInput(e.target.value))}
            placeholder="68,5"
            className="h-14 pr-11 text-center font-display text-2xl"
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-[#888888]">
            kg
          </span>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button variant="outline" className="h-11 flex-1" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button className="h-11 flex-1" onClick={handleSave} disabled={saving}>
          {saving && <Spinner size="sm" className="border-white/30 border-t-white" />}
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </div>
  );
}

function TodayWeightCard({
  todayEntry,
  onSaved,
}: {
  todayEntry: WeightLogEntry | undefined;
  onSaved: (entry: { date: string; weightKg: number }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const today = todayDateString();

  if (editing) {
    return (
      <div className="rounded-2xl border border-[#e8001c]/40 bg-[#e8001c]/5 p-4">
        <p className="mb-3 text-xs font-semibold text-[#e8001c] uppercase">
          {todayEntry ? "Editar peso de hoy" : "Registrar peso de hoy"}
        </p>
        <WeightEntryForm
          date={today}
          initialValue={todayEntry ? String(todayEntry.weightKg) : ""}
          onSaved={(entry) => {
            onSaved(entry);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  if (todayEntry) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
        <div>
          <p className="text-xs text-[#888888]">Peso de hoy</p>
          <p className="mt-1 font-display text-3xl text-[#e8001c]">
            {todayEntry.weightKg} <span className="text-sm text-[#888888]">kg</span>
          </p>
        </div>
        <Button
          variant="outline"
          className="h-11 gap-1.5"
          onClick={() => setEditing(true)}
        >
          <Pencil className="size-3.5" />
          Editar
        </Button>
      </div>
    );
  }

  return (
    <Button className="h-14 w-full gap-2 text-base" onClick={() => setEditing(true)}>
      <Scale className="size-5" />
      Registrar mi peso de hoy
    </Button>
  );
}

function HistoryRow({
  entry,
  onSaved,
}: {
  entry: WeightLogEntry;
  onSaved: (entry: { date: string; weightKg: number }) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="rounded-lg border border-[#e8001c]/40 bg-[#e8001c]/5 p-3">
        <p className="mb-2 text-xs font-semibold text-[#e8001c] uppercase">
          Editando {formatDate(entry.date)}
        </p>
        <WeightEntryForm
          date={entry.date}
          initialValue={String(entry.weightKg)}
          onSaved={(saved) => {
            onSaved(saved);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex min-h-[44px] w-full items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm text-left transition-transform active:scale-[0.98]"
      >
        <span className="text-[#888888]">{formatDate(entry.date)}</span>
        <span className="flex items-center gap-2 font-mono text-white">
          {entry.weightKg} kg
          <Pencil className="size-3.5 text-[#888888]" />
        </span>
      </button>
    </li>
  );
}

export function WeightTab({ logs: initialLogs }: { logs: WeightLogEntry[] }) {
  const [logs, setLogs] = useState(initialLogs);
  const [range, setRange] = useState<Range>("month");

  const today = todayDateString();
  const todayEntry = logs.find((l) => l.date === today);

  function handleSaved(entry: { date: string; weightKg: number }) {
    setLogs((prev) => {
      const withoutDate = prev.filter((l) => l.date !== entry.date);
      const next = [...withoutDate, { id: entry.date, date: entry.date, weightKg: entry.weightKg }];
      return next.sort((a, b) => a.date.localeCompare(b.date));
    });
  }

  const filteredLogs = filterByRange(logs, range);
  const chartPoints: ChartPoint[] = filteredLogs.map((l) => ({
    date: l.date,
    label: shortDateLabel(l.date),
    value: l.weightKg,
  }));

  const historyDescending = [...logs].reverse();

  return (
    <div className="flex flex-col gap-6">
      <TodayWeightCard todayEntry={todayEntry} onSaved={handleSaved} />

      {logs.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="Todavía no registraste tu peso."
          description="Registrá tu peso de hoy para empezar a ver tu evolución."
        />
      ) : (
        <>
          <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
            <div className="mb-3 flex gap-2">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={`min-h-[36px] flex-1 cursor-pointer touch-manipulation rounded-full text-xs font-semibold tracking-wide uppercase transition-colors ${
                    range === r ? "bg-[#e8001c] text-white" : "bg-white/5 text-[#888888]"
                  }`}
                >
                  {RANGE_LABEL[r]}
                </button>
              ))}
            </div>
            <EvolutionChart
              title="Evolución de peso"
              unit="kg"
              points={chartPoints}
              emptyMessage="Seguí registrando tu peso para ver tu evolución."
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-white">Historial</p>
            <ul className="flex flex-col gap-2">
              {historyDescending.map((entry) => (
                <HistoryRow key={entry.date} entry={entry} onSaved={handleSaved} />
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
