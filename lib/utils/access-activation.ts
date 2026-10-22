// clients.access_activated_at se escribe UNA sola vez: en la primera
// activación (columna vacía). Nunca en una renovación ni en una
// "reactivación".
//
// Bug real (oct-2026): daily-checks pasa al cliente a inactive el MISMO día
// que vence (10am PYT). Si el coach renovaba unas horas después, el estado
// previo ya no era "active", la renovación contaba como reactivación y la
// fecha se reiniciaba — Luz Aranda quedó con activación 29/09 entrenando
// desde julio, y su adherencia de septiembre salía 4 planificados (100%)
// en vez de 12 de 17. Una reactivación real tras una baja larga no existe:
// al día +5 sin renovar, daily-checks elimina al cliente, y si vuelve es
// una fila nueva con la columna vacía.
export function shouldSetAccessActivatedAt(
  current: { access_activated_at: string | null } | null
): boolean {
  return current !== null && current.access_activated_at === null;
}
