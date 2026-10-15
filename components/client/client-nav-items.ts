import type { LucideIcon } from "lucide-react";
import { ClipboardList, House, Ruler, TrendingUp, User } from "lucide-react";

export type ClientNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  // Rutas que también marcan este ítem como activo — las secciones que
  // salieron de la nav (oct-2026: Entrenar, Mi Mes, Feedback) siguen
  // existiendo y se entra desde adentro de otra sección, así que la nav
  // resalta la sección "dueña" en vez de quedar sin nada activo.
  matches: string[];
};

// 5 ítems (oct-2026, antes 6): Entrenar salió de la nav — se entra desde
// el botón "Iniciar entrenamiento" de Inicio o desde un día de Rutina, y
// mientras hay una sesión abierta la barra "Entrenamiento en curso"
// (active-workout-bar.tsx) lleva de vuelta desde cualquier pantalla. Mi
// Mes pasó a Progreso y Feedback a Perfil.
export const CLIENT_NAV_ITEMS: ClientNavItem[] = [
  { href: "/client/home", label: "Inicio", icon: House, matches: ["/client/home"] },
  {
    href: "/client/my-routine",
    label: "Rutina",
    icon: ClipboardList,
    matches: ["/client/my-routine", "/client/log-workout"],
  },
  { href: "/client/body", label: "Mi Cuerpo", icon: Ruler, matches: ["/client/body"] },
  {
    href: "/client/progress",
    label: "Progreso",
    icon: TrendingUp,
    matches: ["/client/progress", "/client/my-month"],
  },
  {
    href: "/client/profile",
    label: "Perfil",
    icon: User,
    matches: ["/client/profile", "/client/feedback", "/client/videos"],
  },
];
