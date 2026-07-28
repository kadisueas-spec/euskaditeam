import { MessageCircle } from "lucide-react";
import type { MonthCoachMessage } from "@/lib/supabase/month-summary";

// Único bloque humano en una pantalla de números (jul-2026, pedido
// explícito) — mismo lenguaje visual "celebración" que ya usa el resto de
// la app (border+fondo rojo tenue, ver el banner de racha en streaks.tsx),
// pero con cita en cursiva + firma del coach para que se sienta escrito
// por una persona, no generado por la app. Solo se monta si el coach
// completó el cierre de mes (chequeado en el orquestador) — sin hueco si
// no hay mensaje.
export function MonthRecapCoachMessage({ message }: { message: MonthCoachMessage }) {
  const initials = message.coachName.slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col gap-4 py-10">
      <div className="flex flex-col gap-4 rounded-2xl border border-[#e8001c]/40 bg-[#e8001c]/10 p-5">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[#e8001c] uppercase">
          <MessageCircle className="size-4" />
          Mensaje de tu coach
        </div>
        <p className="text-lg leading-relaxed text-white italic">“{message.summary}”</p>
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e8001c] text-xs font-semibold text-white">
            {initials}
          </span>
          <span className="text-sm text-[#888888]">— {message.coachName}</span>
        </div>
      </div>
    </div>
  );
}
