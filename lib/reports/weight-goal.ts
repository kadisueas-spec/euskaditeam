// Dirección de peso que festejan los reportes (oct-2026), según el texto
// del objetivo: bajar se festeja solo si el objetivo habla de perder grasa
// o peso; subir solo si habla de ganar masa/músculo/peso. Sin objetivo de
// peso → la tarjeta es neutra (dato + tendencia, sin festejo).
//
// Reemplaza a parseGoalDirection (el de Mi Mes, ya borrado): con "Perder
// grasa, ganar fuerza y desarrollar glúteos" veía "perder" y "ganar" y
// devolvía null, pero "ganar fuerza" no es ganar masa — este objetivo es
// de bajar.
export type WeightDirection = "lose" | "gain" | null;

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const LOSE = [
  /\b(perder|bajar|reducir|quemar)\b[^,.;]*\b(grasa|peso|kilos?|panza)\b/,
  /\badelgazar\b/,
  /\bdefinir\b|\bdefinicion\b/,
  /\bbajar de peso\b/,
];

const GAIN = [
  /\b(ganar|subir|aumentar)\b[^,.;]*\b(masa|musculo|musculos|peso|kilos?)\b/,
  /\bhipertrofia\b/,
  /\bvolumen\b/,
  /\bengordar\b/,
];

export function weightDirectionFromGoal(goal: string | null | undefined): WeightDirection {
  if (!goal) return null;
  const g = normalize(goal);
  const lose = LOSE.some((r) => r.test(g));
  const gain = GAIN.some((r) => r.test(g));
  if (lose && !gain) return "lose";
  if (gain && !lose) return "gain";
  return null;
}

export function goalMentions(goal: string | null | undefined, topic: "fuerza" | "gluteos" | "grasa"): boolean {
  if (!goal) return false;
  const g = normalize(goal);
  if (topic === "fuerza") return /\bfuerza|\bfuerte/.test(g);
  if (topic === "gluteos") return /\bglute/.test(g);
  return /\bgrasa\b/.test(g);
}
