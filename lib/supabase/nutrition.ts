import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";

export type NutritionPlan = {
  id: string;
  name: string;
  validFrom: string | null;
  validUntil: string | null;
  status: "active" | "archived";
  fileName: string;
  // Signed URL (bucket privado) — se genera fresca en cada request del
  // lado del servidor, no hace falta un endpoint aparte para descargar.
  downloadUrl: string | null;
  createdAt: string;
};

type NutritionPlanRow = {
  id: string;
  name: string;
  valid_from: string | null;
  valid_until: string | null;
  status: string;
  file_path: string;
  file_name: string;
  created_at: string;
};

const SIGNED_URL_TTL_SECONDS = 300;

async function withDownloadUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: NutritionPlanRow
): Promise<NutritionPlan> {
  // Oct-2026: el path en Storage ya no lleva el nombre original del archivo
  // (Storage rechazaba tildes/espacios, ver uploadNutritionPlan) — el
  // nombre real vive en file_name y se aplica a la descarga con la opción
  // `download` (Content-Disposition). El atributo download del <a> no
  // alcanza: el navegador lo ignora en URLs de otro dominio.
  const { data } = await supabase.storage
    .from("nutrition-plans")
    .createSignedUrl(row.file_path, SIGNED_URL_TTL_SECONDS, {
      download: row.file_name || true,
    });

  return {
    id: row.id,
    name: row.name,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    status: row.status as "active" | "archived",
    fileName: row.file_name,
    downloadUrl: data?.signedUrl ?? null,
    createdAt: row.created_at,
  };
}

export async function getNutritionPlansForClient(
  clientId: string
): Promise<NutritionPlan[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("nutrition_plans")
    .select("id, name, valid_from, valid_until, status, file_path, file_name, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .returns<NutritionPlanRow[]>();

  return Promise.all((data ?? []).map((row) => withDownloadUrl(supabase, row)));
}

export async function getMyNutritionPlans(): Promise<NutritionPlan[]> {
  const client = await getCurrentClientRecord();
  if (!client) return [];
  return getNutritionPlansForClient(client.id);
}
