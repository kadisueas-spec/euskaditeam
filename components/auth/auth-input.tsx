import type { InputHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// Input premium con ícono a la izquierda y slot opcional a la derecha (el
// ojito de mostrar/ocultar contraseña). <input> nativo a propósito, sin el
// primitive de shadcn/Base UI — el estilo acá es muy específico (foco en
// rojo, ícono adentro) y no hace falta nada de su comportamiento extra.
//
// shape="pill" (nov-2026, login): píldora sobre una superficie un escalón
// más clara que la tarjeta, sin borde duro; el foco se marca con un anillo
// rojo de 2px (visible también con teclado). Las demás pantallas siguen con
// la forma de siempre.
export function AuthInput({
  icon: Icon,
  rightSlot,
  className,
  shape = "default",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  icon: LucideIcon;
  rightSlot?: ReactNode;
  shape?: "default" | "pill";
}) {
  if (shape === "pill") {
    return (
      <div className="relative flex items-center">
        <Icon aria-hidden className="pointer-events-none absolute left-5 size-5 text-[#9a9a9a]" />
        <input
          {...props}
          className={`h-14 w-full scroll-my-24 rounded-full border border-transparent bg-[#232323] pl-13 text-base text-[#f5f5f5] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] placeholder:text-[#9a9a9a] outline-none transition-[background-color,box-shadow] focus:bg-[#262626] focus:ring-2 focus:ring-(--login-accent) ${
            rightSlot ? "pr-14" : "pr-5"
          } ${className ?? ""}`}
        />
        {rightSlot && <div className="absolute right-2 flex items-center">{rightSlot}</div>}
      </div>
    );
  }
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
