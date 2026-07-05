import { finishWorkout } from "@/app/client/log-workout/actions";
import {
  deletePendingWorkout,
  getPendingWorkouts,
} from "@/lib/offline/workout-store";

export type SyncResult = { synced: number; failed: number };

export async function syncPendingWorkouts(): Promise<SyncResult> {
  const pending = await getPendingWorkouts();
  let synced = 0;
  let failed = 0;

  for (const workout of pending) {
    try {
      const result = await finishWorkout(workout.payload);
      if ("success" in result) {
        await deletePendingWorkout(workout.localId);
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
