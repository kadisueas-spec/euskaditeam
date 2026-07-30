import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ExerciseVideo } from "@/components/client/exercise-video";
import { FadeIn } from "@/components/motion/fade-in";
import { getVideoDetailForClient, VIDEO_CATEGORY_LABEL } from "@/lib/supabase/videos";
import { MarkVideoSeenOnMount } from "./mark-video-seen-on-mount";

export default async function ClientVideoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const video = await getVideoDetailForClient(id);

  if (!video) notFound();

  return (
    <FadeIn className="flex flex-col gap-4">
      <MarkVideoSeenOnMount id={video.id} alreadySeen={video.isSeen} />

      <Link
        href="/client/videos"
        className="flex items-center gap-1.5 text-sm text-[#888888] hover:text-white"
      >
        <ArrowLeft className="size-4" />
        Volver a videos
      </Link>

      <div>
        <div className="flex flex-wrap gap-1.5">
          {video.isAssignedToMe && (
            <Badge className="w-fit border-[#e8001c]/40 bg-[#e8001c]/15 text-[#e8001c]">
              Para vos
            </Badge>
          )}
          <Badge variant="secondary" className="w-fit">
            {VIDEO_CATEGORY_LABEL[video.category]}
          </Badge>
        </div>
        <h1 className="mt-2 font-display text-3xl tracking-wide text-[#f5f5f5] uppercase">
          {video.title}
        </h1>
      </div>

      <ExerciseVideo videoId={video.youtubeId} />

      {video.description && (
        <p className="text-sm text-[#c9c9c9]">{video.description}</p>
      )}
    </FadeIn>
  );
}
