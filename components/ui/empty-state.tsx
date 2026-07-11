import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Estado vacío diseñado (Bloque 1 — Solidez, jul-2026): antes cada "sin
// datos todavía" era un <p> gris suelto. Nunca rojo — no es un error, un
// ícono neutro alcanza; el rojo queda reservado para lo que sí lo amerita.
export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 py-6 text-center",
        className
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-white/5">
        <Icon className="size-5 text-[#888888]" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-sm text-[#c9c9c9]">{title}</p>
        {description && (
          <p className="max-w-xs text-xs text-[#666666]">{description}</p>
        )}
      </div>
    </div>
  );
}
