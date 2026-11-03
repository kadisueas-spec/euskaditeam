import { Flame } from "lucide-react";

// Racha y adherencia en Inicio (nov-2026, "Vestuario en capas"): dos
// bloques de distinto tamaño a propósito — la racha, ancha, con el número
// protagonista; la adherencia del mes, angosta, con su anillo. Antes eran
// tres números iguales en fila ("Días s/ evaluación" pasó a la fila de Mi
// Cuerpo de la lista del plan).
export function HomeStats({ dailyStreak, adherencePercent }: { dailyStreak: number; adherencePercent: number }) {
  return (
    <div className="grid grid-cols-[1.6fr_1fr] gap-3">
      <div className="surface-raised flex flex-col justify-between rounded-3xl p-4">
        <span className="flex size-9 items-center justify-center rounded-full bg-[#e8001c]/15">
          <Flame className="size-5 text-[#e8001c]" aria-hidden />
        </span>
        <div className="mt-3">
          <p className="font-display text-6xl leading-none text-[#f5f5f5]">{dailyStreak}</p>
          <p className="mt-1 text-sm text-[#c9c9c9]">{dailyStreak === 1 ? "día de racha" : "días de racha"}</p>
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
          stroke="#e8001c"
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
