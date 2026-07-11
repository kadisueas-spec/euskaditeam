import { cn } from "@/lib/utils";

// Bloque 3 (jul-2026): shimmer sutil izquierda->derecha sobre #111111 en vez
// del pulse de opacidad genérico — mismo componente, así los 18 loading.tsx
// existentes se actualizan solos sin tocarlos uno por uno.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("skeleton-shimmer rounded-md", className)}
      {...props}
    >
      <span className="animate-shimmer-sweep absolute inset-0 block" />
    </div>
  );
}

export { Skeleton };
