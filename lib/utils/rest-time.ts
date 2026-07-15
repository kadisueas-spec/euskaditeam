// El coach carga el descanso en minutos con decimales (ej. 1.5 = 1:30) en
// vez de segundos crudos — más natural de tipear/leer. En la base sigue
// guardado en segundos (routine_exercises.rest_seconds), esta conversión
// vive solo en el borde del formulario.
export function secondsToMinutesInput(seconds: number | null): string {
  if (seconds == null) return "";
  const minutes = seconds / 60;
  // Sin decimales de más si es un valor redondo (90s -> "1.5", 60s -> "1").
  return String(Math.round(minutes * 100) / 100);
}

export function minutesInputToSeconds(value: string): number | null {
  if (!value) return null;
  const minutes = Number(value.replace(",", "."));
  if (!Number.isFinite(minutes)) return null;
  return Math.round(minutes * 60);
}
