import {
  Flame,
  Lightbulb,
  MessageSquare,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export const FEEDBACK_TYPES = [
  "correction",
  "tip",
  "motivation",
  "load_adjustment",
  "general",
] as const;

export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_TYPE_LABEL: Record<FeedbackType, string> = {
  correction: "Corrección",
  tip: "Tip",
  motivation: "Motivación",
  load_adjustment: "Ajuste de carga",
  general: "General",
};

export const FEEDBACK_TYPE_ICON: Record<FeedbackType, LucideIcon> = {
  correction: Wrench,
  tip: Lightbulb,
  motivation: Flame,
  load_adjustment: TrendingUp,
  general: MessageSquare,
};
