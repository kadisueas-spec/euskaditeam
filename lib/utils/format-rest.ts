// F5: mostrar el descanso como minutos/mm:ss en vez de segundos crudos
// (ej. "90s" -> "1:30"), que es como se lee naturalmente un tiempo de
// descanso. El dato en base sigue guardado en segundos, esto es solo para
// mostrarlo.
export function formatRestTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
