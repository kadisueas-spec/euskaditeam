// Funciones puras (sin dependencias de React/DOM) para los charts de
// evolución — separadas de components/charts/evaluation-evolution-chart.tsx
// (que tiene "use client" por Recharts) para que se puedan llamar desde
// Server Components. Bug real encontrado jul-2026: ClientWeightChart (un
// Server Component) llamaba shortDateLabel() como función común, pero
// cualquier export de un archivo "use client" se vuelve una referencia de
// cliente — se puede pasar como prop o renderizar como JSX, nunca invocar
// directo desde código de servidor. Explotaba en producción (ruta dinámica,
// no se pre-renderiza en build) mostrando el error boundary genérico.
export type ChartPoint = { date: string; label: string; value: number };

export function shortDateLabel(dateStr: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${dateStr}T00:00:00Z`));
}

export function trendOf(points: ChartPoint[]) {
  if (points.length === 0) return null;
  const current = points[points.length - 1].value;
  const delta = points.length >= 2 ? current - points[points.length - 2].value : null;
  return { current, delta };
}
