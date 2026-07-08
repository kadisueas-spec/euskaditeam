import type { InputHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// Input premium con ícono a la izquierda y slot opcional a la derecha (el
// ojito de mostrar/ocultar contraseña). <input> nativo a propósito, sin el
// primitive de shadcn/Base UI — el estilo acá es muy específico (foco en
// rojo, ícono adentro) y no hace falta nada de su comportamiento extra.
export function AuthInput({
  icon: Icon,
  rightSlot,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  icon: LucideIcon;
  rightSlot?: ReactNode;
}) {
  return (
    <div className="relative flex items-center">
      <Icon className="pointer-events-none absolute left-4 size-5 text-[#666666]" />
      <input
        {...props}
        className={`h-14 w-full rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] pl-12 text-base text-white placeholder:text-[#666666] outline-none transition-colors focus:border-[#e8001c] ${
          rightSlot ? "pr-12" : "pr-4"
        } ${className ?? ""}`}
      />
      {rightSlot && (
        <div className="absolute right-2 flex items-center">{rightSlot}</div>
      )}
    </div>
  );
}
