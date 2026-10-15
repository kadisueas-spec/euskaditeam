import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

// Ficha del cliente (oct-2026): tarjeta colapsable para lo que el coach
// consulta poco (acceso/PayPal, datos, feedback ya dejado). <details> nativo
// — mismo patrón que el "Historial de rutinas", sin JS ni estado. El
// `summary` va siempre visible en el título para ver el estado sin abrirla.
export function CollapsibleCard({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-[#1e1e1e] bg-[#111111]"
    >
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-3 px-4 py-3 select-none [&::-webkit-details-marker]:hidden">
        <span className="text-base font-medium text-white">{title}</span>
        {summary && (
          <span className="ml-auto truncate text-xs text-[#888888]">{summary}</span>
        )}
        <ChevronDown
          className={`size-4 shrink-0 text-[#888888] transition-transform group-open:rotate-180 ${
            summary ? "" : "ml-auto"
          }`}
        />
      </summary>
      <div className="border-t border-[#1e1e1e] px-4 py-4">{children}</div>
    </details>
  );
}
