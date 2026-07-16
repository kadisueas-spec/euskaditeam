// Bloque 5 (jul-2026) — "Voz Euskadi" para notificaciones push: voseo para
// hablarle al cliente, "tienes" para hablarle al coach. Cuando hay más de
// una variante, se elige al azar en cada envío (no alterna en secuencia,
// simplemente no repite SIEMPRE la misma).
export function pickPushCopy<T>(options: readonly T[]): T {
  return options[Math.floor(Math.random() * options.length)];
}

// Feedback nuevo del coach -> cliente. El body sigue siendo el mensaje real
// que escribió el coach (info única, no la reemplaza esta frase).
export const FEEDBACK_PUSH_TITLES = [
  "Tu coach tiene algo para decirte. ¿Estás listo para ver qué?",
  "Luis te dejó un mensaje. Entrá y leé lo que tiene para vos.",
] as const;

// Rutina nueva o actualizada -> cliente. El body sigue siendo el nombre de
// la rutina.
export const NEW_ROUTINE_PUSH_TITLES = [
  "¡Tenés un nuevo desafío! Entrá a ver tu nueva rutina.",
  "Tu nueva rutina está lista. Esto se pone serio.",
] as const;

// Cliente cruza 80% de adherencia del mes -> coach.
export function adherence80PushTitle(clientName: string): string {
  return pickPushCopy([
    `${clientName} ya va por el 80% de su rutina este mes 🔥`,
    `${clientName} la está rompiendo este mes. Ya va por el 80%.`,
  ]);
}

// Evaluación antropométrica nueva -> cliente. Sin variantes, texto fijo
// pedido tal cual.
export const NEW_EVALUATION_PUSH_TITLE = "Nueva evaluación disponible";
export const NEW_EVALUATION_PUSH_BODY =
  "Tu coach cargó tus nuevas mediciones. Entrá a ver tus resultados y cómo evolucionás.";

// Plan de alimentación nuevo -> cliente. Sin variantes, texto fijo pedido
// tal cual.
export const NEW_NUTRITION_PLAN_PUSH_TITLE = "Nuevo plan de alimentación";
export const NEW_NUTRITION_PLAN_PUSH_BODY =
  "Tu coach subió tu plan de alimentación. Entrá a descargarlo.";
