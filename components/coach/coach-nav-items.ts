import type { LucideIcon } from "lucide-react";
import { ClipboardList, Dumbbell, LayoutDashboard, PlayCircle, Sparkles, Users } from "lucide-react";

export type CoachNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const COACH_NAV_ITEMS: CoachNavItem[] = [
  { href: "/coach/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/coach/clients", label: "Clientes", icon: Users },
  // Bandeja de reportes de progreso (oct-2026).
  { href: "/coach/reports", label: "Reportes", icon: Sparkles },
  { href: "/coach/exercises", label: "Ejercicios", icon: Dumbbell },
  { href: "/coach/routines", label: "Rutinas", icon: ClipboardList },
  { href: "/coach/videos", label: "Videos", icon: PlayCircle },
];
