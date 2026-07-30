export type VideoCategory =
  | "concepts"
  | "warmup"
  | "mobility"
  | "technique"
  | "nutrition"
  | "app_usage";

export const VIDEO_CATEGORIES: VideoCategory[] = [
  "concepts",
  "warmup",
  "mobility",
  "technique",
  "nutrition",
  "app_usage",
];

export const VIDEO_CATEGORY_LABEL: Record<VideoCategory, string> = {
  concepts: "Conceptos",
  warmup: "Calentamiento",
  mobility: "Movilidad",
  technique: "Técnica",
  nutrition: "Nutrición",
  app_usage: "Uso de la app",
};
