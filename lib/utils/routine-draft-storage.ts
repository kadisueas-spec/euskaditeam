// Borrador del creador de rutinas (oct-2026) — localStorage, no la base:
// es trabajo en curso del coach en ESTE navegador, que solo tiene que
// sobrevivir a cerrar la pestaña, apagar la compu o navegar afuera del
// wizard. Un solo borrador por coach (la key lleva su id, para no mezclar
// si dos cuentas usan el mismo navegador). Mismo manejo de errores que
// rest-timer-storage.ts: si localStorage falla (modo privado, cuota llena)
// el wizard sigue funcionando, solo sin autoguardado.

function storageKey(coachId: string): string {
  return `routine-wizard-draft:${coachId}`;
}

export function readRoutineDraft(coachId: string): unknown {
  try {
    const raw = localStorage.getItem(storageKey(coachId));
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export function writeRoutineDraft(coachId: string, draft: unknown): void {
  try {
    localStorage.setItem(storageKey(coachId), JSON.stringify(draft));
  } catch {
    // idem arriba
  }
}

export function clearRoutineDraft(coachId: string): void {
  try {
    localStorage.removeItem(storageKey(coachId));
  } catch {
    // idem arriba
  }
}
