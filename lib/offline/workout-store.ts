import type { FinishWorkoutInput } from "@/app/client/log-workout/actions";

const DB_NAME = "fitcoach-offline";
const DB_VERSION = 1;
const STORE_NAME = "pending_workouts";

export type PendingWorkout = {
  localId: string;
  createdAt: string;
  payload: FinishWorkoutInput;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "localId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePendingWorkout(
  payload: FinishWorkoutInput
): Promise<void> {
  const db = await openDb();
  const entry: PendingWorkout = {
    localId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    payload,
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getPendingWorkouts(): Promise<PendingWorkout[]> {
  const db = await openDb();
  const result = await new Promise<PendingWorkout[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as PendingWorkout[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

export async function deletePendingWorkout(localId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(localId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function countPendingWorkouts(): Promise<number> {
  const db = await openDb();
  const count = await new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return count;
}
