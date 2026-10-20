"use client";

import { OnboardingTour } from "@/components/client/onboarding-tour";
import {
  HOME_TOUR_STEPS,
  WELCOME_BANNER_CLOSED_EVENT,
} from "@/lib/constants/onboarding-tour";
import { markTourSeen } from "@/app/client/onboarding-actions";

// Recorrido de bienvenida, parte Inicio (oct-2026). Si en esta misma visita
// se muestra el banner "Empecemos", espera a que se cierre para no
// superponerse.
export function HomeTour({
  routineId,
  waitForWelcomeBanner,
}: {
  routineId: string;
  waitForWelcomeBanner: boolean;
}) {
  return (
    <OnboardingTour
      steps={HOME_TOUR_STEPS}
      enabled
      waitForEvent={waitForWelcomeBanner ? WELCOME_BANNER_CLOSED_EVENT : undefined}
      onStart={() => {
        markTourSeen(routineId, "home").catch(() => {});
      }}
    />
  );
}
