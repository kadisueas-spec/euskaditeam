import type { LucideIcon } from "lucide-react";
import { ClipboardList, Dumbbell, LayoutDashboard, Users } from "lucide-react";

export type CoachNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const COACH_NAV_ITEMS: CoachNavItem[] = [
  { href: "/coach/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/coach/clients", label: "Clientes", icon: Users },
  { href: "/coach/exercises", label: "Ejercicios", icon: Dumbbell },
  { href: "/coach/routines", label: "Rutinas", icon: ClipboardList },
];
