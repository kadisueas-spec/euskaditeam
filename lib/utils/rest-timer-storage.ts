// Persistencia del temporizador de descanso (jul-2026) — localStorage, no
// el servidor: es un dato puramente efímero de la sesión de entrenamiento
// en curso, no algo que el coach necesite ver ni que deba sincronizarse
// entre dispositivos (a diferencia de las preferencias on/off, que sí
// viven en clients — ver app/client/profile/actions.ts). Guardado por
// workoutLogId para no mezclar el temporizador de una sesión vieja con
// una nueva.

export type StoredRestTimer = {
  instanceId: string;
  routineExerciseId: string;
  endsAt: number;
};

function storageKey(workoutLogId: string): string {
  return `rest-timer:${workoutLogId}`;
}

export function readStoredRestTimer(workoutLogId: string): StoredRestTimer | null {
  try {
    const raw = localStorage.getItem(storageKey(workoutLogId));
    if (!raw) return null;
    return JSON.parse(raw) as StoredRestTimer;
  } catch {
    return null;
  }
}

export function writeStoredRestTimer(workoutLogId: string, value: StoredRestTimer): void {
  try {
    localStorage.setItem(storageKey(workoutLogId), JSON.stringify(value));
  } catch {
    // localStorage puede fallar (modo privado, cuota llena) — el
    // temporizador sigue funcionando en memoria, solo no sobrevive a
    // cerrar la app.
  }
}

export function clearStoredRestTimer(workoutLogId: string): void {
  try {
    localStorage.removeItem(storageKey(workoutLogId));
  } catch {
    // idem
  }
}
