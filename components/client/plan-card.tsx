import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

// Tarjetas del plan en la pantalla de inicio (ago-2026): cada una muestra
// un DATO REAL de esa sección, no solo su nombre — esa es la diferencia
// entre un menú y un panel que comunica el valor de la asesoría integral.
// Cuando el cliente todavía no tiene ese dato (nunca subió una foto, no
// tiene evaluación, etc.) la tarjeta se muestra IGUAL — nunca se oculta —
// pero más tenue (borde/ícono/texto apagados, sin el glow rojo) y con un
// texto que invita en vez de "sin datos": así entiende desde el día 1 todo
// lo que incluye su plan, no solo lo que ya usó.
export function PlanCard({
  href,
  icon: Icon,
  label,
  detail,
  hasData,
  badge,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  detail: string;
  hasData: boolean;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-[44px] items-center gap-3 rounded-2xl border p-4 transition-colors active:bg-white/5 ${
        hasData ? "border-[#1e1e1e] bg-[#111111]" : "border-[#1e1e1e]/60 bg-[#111111]/40"
      }`}
    >
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
          hasData ? "bg-[#e8001c]/15 text-[#e8001c]" : "bg-white/5 text-[#666666]"
        }`}
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-medium ${hasData ? "text-white" : "text-[#888888]"}`}>
          {label}
        </span>
        <span className={`block truncate text-sm ${hasData ? "text-[#c9c9c9]" : "text-[#666666] italic"}`}>
          {detail}
        </span>
      </span>
      {badge && (
        <span className="shrink-0 rounded-full bg-[#e8001c] px-2 py-0.5 text-xs font-bold text-white">
          {badge}
        </span>
      )}
      <ChevronRight className="size-4 shrink-0 text-[#888888]" />
    </Link>
  );
}
