import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  ClipboardList,
  Dumbbell,
  MessageSquare,
  TrendingUp,
  User,
} from "lucide-react";

export type ClientNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const CLIENT_NAV_ITEMS: ClientNavItem[] = [
  { href: "/client/my-routine", label: "Mi Rutina", icon: ClipboardList },
  { href: "/client/log-workout", label: "Entrenar", icon: Dumbbell },
  { href: "/client/my-month", label: "Mi Mes", icon: Calendar },
  { href: "/client/feedback", label: "Feedback", icon: MessageSquare },
  { href: "/client/progress", label: "Progreso", icon: TrendingUp },
  { href: "/client/profile", label: "Perfil", icon: User },
];
