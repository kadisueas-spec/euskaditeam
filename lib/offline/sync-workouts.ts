import { addSet } from "@/app/client/log-workout/actions";
import { deletePendingSet, getPendingSets } from "@/lib/offline/workout-store";

export type SyncResult = { synced: number; failed: number };

// Sincroniza las series que se guardaron localmente porque el guardado
// directo al servidor falló (sin conexión durante el entrenamiento). El
// workout_log ya existe en el servidor (se creó al abrir la pantalla,
// online); acá solo faltan las series individuales.
export async function syncPendingWorkouts(): Promise<SyncResult> {
  const pending = await getPendingSets();
  let synced = 0;
  let failed = 0;

  for (const set of pending) {
    try {
      const result = await addSet(set.payload);
      if ("success" in result) {
        await deletePendingSet(set.localId);
        synced++;
      } else {
        failed++;
      }
    } catch {
      // Todavía sin red real: dejamos de intentar, se reintenta en el
      // próximo evento "online".
      failed += pending.length - synced - failed;
      break;
    }
  }

  return { synced, failed };
}
