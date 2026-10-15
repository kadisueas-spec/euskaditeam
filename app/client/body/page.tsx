import { ProgressTabs } from "@/components/client/progress-tabs";
import { BodyTab } from "@/components/client/body-tab";
import { WeightTab } from "@/components/client/weight-tab";
import { NutritionClientTab } from "@/components/client/nutrition-tab";
import { getMyBodyEvaluations } from "@/lib/supabase/anthropometrics";
import { getMyWeightLogs } from "@/lib/supabase/weight-logs";
import { getMyNutritionPlans } from "@/lib/supabase/nutrition";
import { getMyProgressPhotos, shouldShowPhotoReminder } from "@/lib/supabase/progress-photos";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";

// Mi Cuerpo (oct-2026): sección propia de la nav con lo que antes eran 3
// de las 4 pestañas de Progreso (evaluaciones + fotos, peso diario,
// nutrición) — Progreso quedó solo con el entrenamiento. Las keys de las
// pestañas (cuerpo/peso/nutricion) se mantienen iguales a las de antes
// para que los deep links de push sigan funcionando (ver redirect en
// app/client/progress/page.tsx).
export default async function BodyPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ tab }, evaluations, weightLogs, nutritionPlans, photos, client] = await Promise.all([
    searchParams,
    getMyBodyEvaluations(),
    getMyWeightLogs(),
    getMyNutritionPlans(),
    getMyProgressPhotos(),
    getCurrentClientRecord(),
  ]);
  const showPhotoReminder = await shouldShowPhotoReminder(photos);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-3xl tracking-wide text-[#f5f5f5] uppercase">
          Mi Cuerpo
        </h1>
        <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
      </div>

      <ProgressTabs
        initialTab={tab}
        tabs={[
          {
            key: "cuerpo",
            label: "Medidas",
            content: (
              <BodyTab
                evaluations={evaluations}
                photos={photos}
                showPhotoReminder={showPhotoReminder}
                photosConsent={client?.photosPublicUseAuthorized ?? null}
              />
            ),
          },
          { key: "peso", label: "Peso", content: <WeightTab logs={weightLogs} /> },
          {
            key: "nutricion",
            label: "Nutrición",
            content: <NutritionClientTab plans={nutritionPlans} />,
          },
        ]}
      />
    </div>
  );
}
