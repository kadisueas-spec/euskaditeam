import { Flame } from "lucide-react";

// Iniciales de los días (getUTCDay: 0 = domingo).
const WEEKDAY_INITIALS = ["D", "L", "M", "M", "J", "V", "S"];

// Racha y adherencia en Inicio (nov-2026, "Vestuario en capas"): dos
// bloques de distinto tamaño a propósito — la racha, ancha, con el número
// protagonista; la adherencia del mes, angosta, con su anillo. Antes eran
// tres números iguales en fila ("Días s/ evaluación" pasó a la fila de Mi
// Cuerpo de la lista del plan). La racha suma la mejor racha y los últimos
// 7 días entrenados (nov-2026), calculados con los datos que ya existen.

export function HomeStats({
  dailyStreak,
  bestDailyStreak,
  recentDays,
  adherencePercent,
}: {
  dailyStreak: number;
  bestDailyStreak: number;
  recentDays: { date: string; trained: boolean }[];
  adherencePercent: number;
}) {
  return (
    <div className="grid grid-cols-[1.6fr_1fr] gap-3">
      <div className="surface-raised flex flex-col justify-between rounded-3xl p-4">
        <span className="flex size-9 items-center justify-center rounded-full bg-(--home-accent)/15">
          <Flame className="size-5 text-(--home-accent)" aria-hidden />
        </span>
        <div className="mt-3">
          <p className="font-display text-6xl leading-none text-[#f5f5f5]">{dailyStreak}</p>
          <p className="mt-1 text-sm text-[#c9c9c9]">{dailyStreak === 1 ? "día de racha" : "días de racha"}</p>
          {bestDailyStreak > 0 && (
            <p className="mt-2 text-sm text-[#f5f5f5]">
              Mejor racha: <b className="font-semibold">{bestDailyStreak}</b> {bestDailyStreak === 1 ? "día" : "días"}
            </p>
          )}
          {recentDays.length > 0 && <RecentDays days={recentDays} />}
        </div>
      </div>
      <div className="surface-raised flex flex-col items-center justify-center rounded-3xl p-4">
        <AdherenceRing percent={adherencePercent} />
        <p className="mt-2 text-center text-sm text-[#c9c9c9]">Adherencia del mes</p>
      </div>
    </div>
  );
}

// Anillo de adherencia: SVG con el trazo rojo proporcional al %. La
// transición del trazo se apaga con movimiento reducido.
function AdherenceRing({ percent }: { percent: number }) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-20" role="img" aria-label={`Adherencia del mes: ${value}%`}>
      <svg viewBox="0 0 72 72" className="size-full -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="7" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="var(--home-accent)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-2xl text-[#f5f5f5]">
        {value}%
      </span>
    </div>
  );
}

// Últimos 7 días, del más viejo a hoy: punto rojo = entrenó ese día.
function RecentDays({ days }: { days: { date: string; trained: boolean }[] }) {
  const trainedCount = days.filter((d) => d.trained).length;
  return (
    <div
      className="mt-3 flex gap-1.5"
      role="img"
      aria-label={`Entrenaste ${trainedCount} de los últimos ${days.length} días`}
    >
      {days.map((d) => (
        <span key={d.date} className="flex flex-col items-center gap-1">
          <span className={`size-3 rounded-full ${d.trained ? "bg-(--home-accent)" : "bg-white/15"}`} />
          <span className="text-[10px] leading-none text-[#888888]">
            {WEEKDAY_INITIALS[new Date(`${d.date}T12:00:00Z`).getUTCDay()]}
          </span>
        </span>
      ))}
    </div>
  );
}
