// Textos del recorrido de bienvenida (oct-2026). Cada paso apunta a un
// elemento marcado con data-tour="<target>"; sin target = tarjeta centrada
// sin resaltar nada (cierre). Si el elemento no existe en pantalla, el paso
// se saltea (ej. la sugerencia de peso en la primera sesión de un cliente).
export type TourStep = {
  target?: string;
  title: string;
  body: string;
  // Texto del botón principal en este paso (default "Siguiente").
  cta?: string;
};

// Evento que dispara el banner "Empecemos" al cerrarse: el recorrido de
// Inicio espera a que el banner se cierre para no superponerse.
export const WELCOME_BANNER_CLOSED_EVENT = "fitcoach:welcome-banner-closed";
// El recorrido de Inicio terminó (oct-2026): el reporte que se abre solo lo
// espera para no superponerse.
export const HOME_TOUR_DONE_EVENT = "fitcoach:home-tour-done";

export const HOME_TOUR_STEPS: TourStep[] = [
  {
    target: "today-workout",
    title: "Tu entrenamiento del día",
    body:
      "Acá encontrás tu entrenamiento del día. Tu coach lo armó especialmente para vos. Tocá 'Iniciar entrenamiento' cuando estés listo.",
  },
  {
    target: "bottom-nav",
    title: "Explorá tu app",
    body:
      "🏠 Inicio — tu entrenamiento del día\n📋 Rutina — todos tus días de entrenamiento\n📏 Mi Cuerpo — evaluaciones, fotos y peso\n📈 Progreso — tus métricas y avance\n👤 Perfil — configuración",
  },
  {
    target: "body-card",
    title: "Mi Cuerpo",
    body:
      "Acá vas a ver tus evaluaciones antropométricas, tus fotos de progreso y tu peso corporal. Tu coach las va cargando.",
  },
  {
    title: "¡Listo!",
    body: "Ya sabés cómo moverte por la app.\nCualquier duda, escribile a tu coach.",
    cta: "Empezar",
  },
];

// Paso de la sugerencia: dos versiones según haya o no recuadro amarillo.
// En la primera sesión de un cliente no hay historial, así que no hay
// sugerencia todavía — se explica qué va a aparecer ahí.
export function workoutTourSteps(hasSuggestion: boolean): TourStep[] {
  return [
    hasSuggestion
      ? {
          target: "set-inputs",
          title: "Tu sugerencia de hoy",
          body:
            "Este es el peso y las reps que tu coach te sugiere para hoy. Se calcula automáticamente desde tu última sesión. Podés editarlo si necesitás.",
        }
      : {
          target: "set-inputs",
          title: "Tus series",
          body:
            "Cargá acá el peso y las reps de cada serie. Desde tu próxima sesión, tu coach te va a sugerir acá el peso y las reps automáticamente según tu última vez.",
        },
    {
      target: "rir",
      title: "El RIR",
      body:
        "RIR = Repeticiones En Reserva. Es cuántas reps te quedan en el tanque al terminar la serie. RIR 3 = te quedan 3 reps más. Cuanto más bajo, más cerca del límite.",
    },
    {
      target: "complete-set",
      title: "Completar serie",
      body:
        "Cargá el peso, las reps y el RIR real de tu serie y tocá Completar. La app guarda todo y te sugiere la siguiente serie.",
      cta: "A entrenar",
    },
  ];
}
