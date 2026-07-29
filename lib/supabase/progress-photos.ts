import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";

export type PhotoCategory = "front" | "side" | "back";

export type ProgressPhoto = {
  id: string;
  takenAt: string;
  category: PhotoCategory | null;
  // Signed URL (bucket privado) — se genera fresca en cada request del
  // lado del servidor, mismo patrón que nutrition_plans. Vida corta a
  // propósito: son fotos corporales, el dato más sensible que maneja la
  // app.
  photoUrl: string | null;
};

type ProgressPhotoRow = {
  id: string;
  taken_at: string;
  category: string | null;
  storage_path: string;
};

const SIGNED_URL_TTL_SECONDS = 300;

async function withPhotoUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: ProgressPhotoRow
): Promise<ProgressPhoto> {
  const { data } = await supabase.storage
    .from("progress-photos")
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);

  return {
    id: row.id,
    takenAt: row.taken_at,
    category: (row.category as PhotoCategory | null) ?? null,
    photoUrl: data?.signedUrl ?? null,
  };
}

const PROGRESS_PHOTO_SELECT = "id, taken_at, category, storage_path";

export async function getProgressPhotosForClient(
  clientId: string
): Promise<ProgressPhoto[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("progress_photos")
    .select(PROGRESS_PHOTO_SELECT)
    .eq("client_id", clientId)
    .order("taken_at", { ascending: false })
    .returns<ProgressPhotoRow[]>();

  return Promise.all((data ?? []).map((row) => withPhotoUrl(supabase, row)));
}

export async function getMyProgressPhotos(): Promise<ProgressPhoto[]> {
  const client = await getCurrentClientRecord();
  if (!client) return [];
  return getProgressPhotosForClient(client.id);
}

const PHOTO_REMINDER_THRESHOLD_DAYS = 30;
const PHOTO_REMINDER_SNOOZE_DAYS = 7;

function daysSince(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
}

// Recordatorio mensual (jul-2026): se dispara si pasaron 30+ días desde la
// última foto (o desde el alta del cliente si nunca subió ninguna), salvo
// que lo haya descartado hace menos de 7 días (getCurrentClientRecord ya
// memoiza la consulta a "clients" con React cache, así que llamarla acá de
// nuevo no pega una query extra si la página ya la pidió antes).
export async function shouldShowPhotoReminder(photos: ProgressPhoto[]): Promise<boolean> {
  const client = await getCurrentClientRecord();
  if (!client) return false;

  const referenceDate = photos[0]?.takenAt ?? client.createdAt;
  if (daysSince(referenceDate) < PHOTO_REMINDER_THRESHOLD_DAYS) return false;

  if (
    client.progressPhotoReminderDismissedAt &&
    daysSince(client.progressPhotoReminderDismissedAt) < PHOTO_REMINDER_SNOOZE_DAYS
  ) {
    return false;
  }

  return true;
}
