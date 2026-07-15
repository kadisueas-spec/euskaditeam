// El teclado numérico de iOS (inputMode="decimal") no deja escribir "," en
// un <input type="number"> — el navegador solo acepta "." como separador
// decimal ahí, sin importar el idioma del dispositivo. Por eso estos campos
// usan type="text" + este sanitizador en vez de la validación nativa.

// Se aplica en cada onChange: deja solo dígitos y UN separador decimal
// (admite "," o "." tal cual lo escribió el cliente, no lo normaliza acá
// para no pelearse con el cursor mientras tipea).
export function sanitizeDecimalInput(raw: string): string {
  let value = raw.replace(/[^0-9.,]/g, "");
  const sepMatch = value.match(/[.,]/);
  if (sepMatch) {
    const idx = value.indexOf(sepMatch[0]);
    value = value.slice(0, idx + 1) + value.slice(idx + 1).replace(/[.,]/g, "");
  }
  return value;
}

// Se aplica recién al guardar: "," y "." son equivalentes, pero en la base
// siempre se guarda con punto (numeric de Postgres).
export function parseDecimalInput(value: string): number | null {
  if (!value) return null;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
