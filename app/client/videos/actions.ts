"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";

// Mismo patrón que markFeedbackRead (app/client/feedback/actions.ts): la
// mutación vive en un Server Action separado de la lectura de la página
// para poder revalidar el layout y que el badge de "no vistos" del perfil
// se actualice al instante, sin esperar un refresh completo.
export async function markVideoView(videoId: string): Promise<void> {
  const client = await getCurrentClientRecord();
  if (!client) return;

  const supabase = await createClient();
  await supabase
    .from("video_views")
    .upsert(
      { video_id: videoId, client_id: client.id },
      { onConflict: "video_id,client_id", ignoreDuplicates: true }
    );

  revalidatePath("/client", "layout");
}
