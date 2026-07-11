import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  sm: "size-3.5 border-2",
  default: "size-4 border-2",
  lg: "size-6 border-[3px]",
} as const;

// Bloque 3 (jul-2026): fallback visual para cualquier espera sin otro
// indicador — nunca una pantalla/botón congelado sin señal. CSS puro
// (@keyframes spinner-spin en globals.css), rojo de marca.
function Spinner({
  size = "default",
  className,
}: {
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={cn(
        "animate-spinner-spin inline-block shrink-0 rounded-full border-[#e8001c]/25 border-t-[#e8001c]",
        SIZE_CLASS[size],
        className
      )}
    />
  );
}

export { Spinner };
