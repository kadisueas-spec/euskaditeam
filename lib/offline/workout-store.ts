import type { AddSetInput } from "@/app/client/log-workout/actions";

const DB_NAME = "fitcoach-offline";
const DB_VERSION = 2;
const STORE_NAME = "pending_sets";

export type PendingSet = {
  localId: string;
  createdAt: string;
  payload: AddSetInput;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      // v1 tenía "pending_workouts" (se guardaba todo el entrenamiento recién
      // al finalizar). Ahora cada serie se guarda apenas se completa, así
      // que se reemplaza por "pending_sets" — solo se usa cuando el guardado
      // directo al servidor falla por falta de conexión.
      if (event.oldVersion < 2 && db.objectStoreNames.contains("pending_workouts")) {
        db.deleteObjectStore("pending_workouts");
      }
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "localId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePendingSet(payload: AddSetInput): Promise<void> {
  const db = await openDb();
  const entry: PendingSet = {
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

export async function getPendingSets(): Promise<PendingSet[]> {
  const db = await openDb();
  const result = await new Promise<PendingSet[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as PendingSet[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

export async function deletePendingSet(localId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(localId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function countPendingSets(): Promise<number> {
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
