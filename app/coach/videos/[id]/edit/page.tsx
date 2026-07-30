import { notFound } from "next/navigation";
import { getClientsForSelect } from "@/lib/supabase/routines";
import { getVideoDetailForCoach } from "@/lib/supabase/videos";
import { updateVideo } from "../../actions";
import { VideoForm } from "../../video-form";
import { DeleteVideoButton } from "../delete-video-button";

export default async function EditVideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [video, clients] = await Promise.all([
    getVideoDetailForCoach(id),
    getClientsForSelect(),
  ]);

  if (!video) notFound();

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-[#f5f5f5] uppercase">
          Editar video
        </h1>
        <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
      </div>
      <VideoForm
        action={updateVideo.bind(null, video.id)}
        clients={clients}
        initialData={video}
      />
      <DeleteVideoButton videoId={video.id} />
    </div>
  );
}
