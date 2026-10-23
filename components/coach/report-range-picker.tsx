"use client";

import { Input } from "@/components/ui/input";
import { rangeShortcuts } from "@/lib/reports/periods";
import { kindForRange, validateRange } from "@/lib/reports/periods";
import { weekRangeLabel } from "@/lib/reports/format";

export type DateRange = { start: string; end: string };

const KIND_HINT = {
  weekly: "Se guarda como reporte semanal (lunes a viernes).",
  monthly: "Se guarda como reporte mensual (mes completo).",
  custom: "Reporte de período libre.",
} as const;

// Selector de período para los reportes (oct-2026): desde / hasta con
// atajos. `today` viene del servidor (fecha de Paraguay).
export function ReportRangePicker({
  value,
  onChange,
  today,
  idPrefix,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  today: string;
  idPrefix: string;
}) {
  const error = value.start && value.end ? validateRange(value.start, value.end, today) : null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {rangeShortcuts(today).map((s) => {
          const active = value.start === s.start && value.end === s.end;
          return (
            <button
              key={s.label}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ start: s.start, end: s.end })}
              className={`min-h-11 rounded-full px-3 text-sm ${
                active ? "bg-[#e8001c] text-white" : "bg-white/5 text-[#c9c9c9] hover:bg-white/10"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-start`} className="text-xs text-[#888888]">
            Desde
          </label>
          <Input
            id={`${idPrefix}-start`}
            type="date"
            max={today}
            value={value.start}
            onChange={(e) => onChange({ ...value, start: e.target.value })}
            className="min-h-11 w-44"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-end`} className="text-xs text-[#888888]">
            Hasta
          </label>
          <Input
            id={`${idPrefix}-end`}
            type="date"
            max={today}
            value={value.end}
            onChange={(e) => onChange({ ...value, end: e.target.value })}
            className="min-h-11 w-44"
          />
        </div>
      </div>
      {value.start && value.end && (
        <p className={`text-xs ${error ? "text-[#e8001c]" : "text-[#888888]"}`}>
          {error ?? `${weekRangeLabel(value.start, value.end)} · ${KIND_HINT[kindForRange(value.start, value.end)]}`}
        </p>
      )}
    </div>
  );
}
