// Datos de prueba reusados entre specs. Números elegidos a propósito
// (no triviales como 0/1) para que un cálculo roto no pase desapercibido
// por coincidencia.

export const DW4_SAMPLE = {
  evaluationDate: new Date().toISOString().slice(0, 10),
  weightKg: "80",
  heightCm: "178",
  sex: "male" as const,
  birthDate: "1996-03-15", // ~edad 30 al momento de escribir esto, ajusta solo con el tiempo
  protocol: "DW4" as const,
  skinfoldsMm: {
    biceps: "10",
    triceps: "15",
    subscapular: "12",
    suprailiac: "13",
  },
};

export const WEIGHT_LOG_SAMPLE_KG = "78,5";

export const WORKOUT_SET_SAMPLE = {
  weightKg: "60",
  reps: "8",
  rir: "2",
};

export function newRoutineName(): string {
  return `E2E Rutina ${Date.now()}`;
}
