import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";

// Lista del plan en la pantalla de inicio (ago-2026): cada fila muestra un
// DATO REAL de esa sección, no solo su nombre — esa es la diferencia entre
// un menú y un panel que comunica el valor de la asesoría integral. Cuando
// el cliente todavía no tiene ese dato (nunca subió una foto, no tiene
// evaluación, etc.) la fila se muestra IGUAL — nunca se oculta — pero más
// tenue y con un texto que invita en vez de "sin datos": así entiende desde
// el día 1 todo lo que incluye su plan, no solo lo que ya usó.
//
// Rediseño nov-2026 ("Vestuario en capas"): una sola superficie con filas
// separadas por líneas finas (lista agrupada), en vez de seis tarjetas
// idénticas una debajo de la otra.
export function PlanList({ children }: { children: ReactNode }) {
  return (
    <nav aria-label="Tu plan" className="surface-raised overflow-hidden rounded-3xl">
      <ul className="divide-y divide-white/[0.06]">{children}</ul>
    </nav>
  );
}

export function PlanRow({
  href,
  icon: Icon,
  label,
  detail,
  hasData,
  badge,
  tour,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  detail: string;
  hasData: boolean;
  badge?: string;
  // Marca del recorrido de bienvenida (data-tour), si esta fila es un paso.
  tour?: string;
}) {
  return (
    <li data-tour={tour}>
      <Link
        href={href}
        className="flex min-h-[60px] items-center gap-3 px-4 py-3 transition-colors active:bg-white/5"
      >
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
            hasData ? "bg-(--home-accent)/15 text-(--home-accent)" : "bg-white/5 text-[#888888]"
          }`}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block font-medium ${hasData ? "text-[#f5f5f5]" : "text-[#c9c9c9]"}`}>{label}</span>
          <span className={`block truncate text-sm ${hasData ? "text-[#c9c9c9]" : "text-[#888888] italic"}`}>
            {detail}
          </span>
        </span>
        {badge && (
          <span className="shrink-0 rounded-full bg-(--home-accent-dark) px-2 py-0.5 text-xs font-bold text-white">{badge}</span>
        )}
        <ChevronRight className="size-4 shrink-0 text-[#888888]" aria-hidden />
      </Link>
    </li>
  );
}
