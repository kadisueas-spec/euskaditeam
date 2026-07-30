import Link from "next/link";
import { PlayCircle, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/motion/fade-in";
import { getVideosForCoach, VIDEO_CATEGORIES, VIDEO_CATEGORY_LABEL } from "@/lib/supabase/videos";
import type { VideoCategory } from "@/lib/supabase/videos";
import { getYouTubeThumbnailUrl } from "@/lib/constants/youtube";
import { cn } from "@/lib/utils";

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const allVideos = await getVideosForCoach();
  const videos = category
    ? allVideos.filter((v) => v.category === category)
    : allVideos;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-wide text-[#f5f5f5] uppercase">
            Videos
          </h1>
          <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
        </div>
        <Link href="/coach/videos/new" className={buttonVariants({ variant: "default" })}>
          + Nuevo video
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/coach/videos"
          className={cn(
            "rounded-full px-3 py-1.5 text-sm",
            !category
              ? "bg-[#e8001c] text-white"
              : "bg-white/5 text-[#888888] hover:bg-white/10"
          )}
        >
          Todos
        </Link>
        {VIDEO_CATEGORIES.map((cat) => (
          <Link
            key={cat}
            href={`/coach/videos?category=${cat}`}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm",
              category === cat
                ? "bg-[#e8001c] text-white"
                : "bg-white/5 text-[#888888] hover:bg-white/10"
            )}
          >
            {VIDEO_CATEGORY_LABEL[cat as VideoCategory]}
          </Link>
        ))}
      </div>

      {videos.length === 0 ? (
        <EmptyState
          icon={PlayCircle}
          title="No hay videos todavía."
          description="Cargá el primero para explicar un concepto o asignarle material puntual a un cliente."
          className="py-8"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video, i) => (
            <FadeIn key={video.id} delay={Math.min(i * 0.04, 0.4)}>
              <Link href={`/coach/videos/${video.id}/edit`}>
                <Card className="h-full border-[#1e1e1e] bg-[#111111]">
                  <CardContent className="flex flex-col gap-3">
                    <div className="relative flex aspect-video items-center justify-center rounded-lg bg-white/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getYouTubeThumbnailUrl(video.youtubeId)}
                        alt={video.title}
                        className="size-full rounded-lg object-cover"
                      />
                      <span className="absolute bottom-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-black/70 text-white">
                        <PlayCircle className="size-3.5" />
                      </span>
                    </div>
                    <p className="font-medium text-white">{video.title}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="w-fit">
                        {VIDEO_CATEGORY_LABEL[video.category]}
                      </Badge>
                      {video.isGeneral ? (
                        <Badge className="w-fit border-[#e8001c]/40 bg-[#e8001c]/15 text-[#e8001c]">
                          General
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="w-fit gap-1">
                          <Users className="size-3" />
                          {video.assignedClientNames.length === 1
                            ? video.assignedClientNames[0]
                            : `${video.assignedClientNames.length} clientes`}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}
