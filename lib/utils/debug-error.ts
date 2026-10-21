// TEMPORAL (oct-2026) — diagnóstico de las subidas que fallan en iPhone/iPad.
// Arma un mensaje con la etapa exacta donde falló y el error crudo que
// devolvió Supabase (Storage o Postgres) o la excepción. Se muestra en la
// pantalla en vez del mensaje genérico. SACAR cuando esté resuelto (buscar
// "debugError" en el repo).
export function debugError(stage: string, err: unknown): string {
  if (err == null) return `[debug] ${stage}: error vacío`;
  if (typeof err === "string") return `[debug] ${stage}: ${err}`;
  const e = err as Record<string, unknown>;
  const parts = [
    e.name && e.name !== "Error" ? `${String(e.name)}` : null,
    e.message ? String(e.message) : null,
    e.code ? `code=${String(e.code)}` : null,
    e.statusCode ? `status=${String(e.statusCode)}` : null,
    e.status ? `status=${String(e.status)}` : null,
    e.error && typeof e.error === "string" ? `error=${e.error}` : null,
    e.details ? `details=${String(e.details)}` : null,
    e.hint ? `hint=${String(e.hint)}` : null,
  ].filter(Boolean);
  return `[debug] ${stage}: ${parts.length ? parts.join(" · ") : JSON.stringify(err)}`;
}

// Qué llegó realmente en el campo "file" del FormData (para ver si el
// archivo se pierde en el camino desde iOS).
export function describeFormFile(value: FormDataEntryValue | null): string {
  if (value == null) return "null (el campo no llegó)";
  if (typeof value === "string") return `string de ${value.length} caracteres (no es un archivo)`;
  const f = value as File;
  return `${f.constructor?.name ?? "objeto"} name="${f.name}" type="${f.type}" size=${f.size}`;
}
