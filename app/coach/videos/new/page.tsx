import { getClientsForSelect } from "@/lib/supabase/routines";
import { createVideo } from "../actions";
import { VideoForm } from "../video-form";

export default async function NewVideoPage() {
  const clients = await getClientsForSelect();

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-[#f5f5f5] uppercase">
          Nuevo video
        </h1>
        <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
      </div>
      <VideoForm action={createVideo} clients={clients} />
    </div>
  );
}
