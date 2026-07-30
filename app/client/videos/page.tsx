import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/motion/fade-in";
import {
  getMyVideos,
  VIDEO_CATEGORIES,
  VIDEO_CATEGORY_LABEL,
  type ClientVideoListItem,
} from "@/lib/supabase/videos";
import { getYouTubeThumbnailUrl } from "@/lib/constants/youtube";

function VideoRow({ video }: { video: ClientVideoListItem }) {
  return (
    <Link
      href={`/client/videos/${video.id}`}
      className="flex min-h-[44px] items-center gap-3 rounded-2xl bg-white/5 p-2.5 active:bg-white/10"
    >
      <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-white/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getYouTubeThumbnailUrl(video.youtubeId)}
          alt=""
          className="size-full object-cover"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-black/30">
          <PlayCircle className="size-5 text-white" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-white">{video.title}</p>
        <p className="text-xs text-[#888888]">{VIDEO_CATEGORY_LABEL[video.category]}</p>
      </div>
      {!video.isSeen && (
        <span className="shrink-0 rounded-full bg-[#e8001c] px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
          Nuevo
        </span>
      )}
    </Link>
  );
}

export default async function ClientVideosPage() {
  const videos = await getMyVideos();

  if (videos.length === 0) {
    return (
      <EmptyState
        icon={PlayCircle}
        title="Todavía no hay videos para vos."
        description="Acá van a aparecer los videos que tu coach cargue."
        className="py-8"
      />
    );
  }

  const assigned = videos.filter((v) => v.isAssignedToMe);
  const general = videos.filter((v) => !v.isAssignedToMe);
  const byCategory = VIDEO_CATEGORIES.map((cat) => ({
    category: cat,
    items: general.filter((v) => v.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-3xl tracking-wide text-[#f5f5f5] uppercase">
          Aprendé
        </h1>
        <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
      </div>

      {assigned.length > 0 && (
        <FadeIn className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Badge className="w-fit border-[#e8001c]/40 bg-[#e8001c]/15 text-[#e8001c]">
              Para vos
            </Badge>
          </div>
          <div className="flex flex-col gap-2">
            {assigned.map((video) => (
              <VideoRow key={video.id} video={video} />
            ))}
          </div>
        </FadeIn>
      )}

      {byCategory.map((group, i) => (
        <FadeIn key={group.category} delay={Math.min(i * 0.05, 0.3)} className="flex flex-col gap-2">
          <p className="text-sm font-medium text-[#888888]">
            {VIDEO_CATEGORY_LABEL[group.category]}
          </p>
          <div className="flex flex-col gap-2">
            {group.items.map((video) => (
              <VideoRow key={video.id} video={video} />
            ))}
          </div>
        </FadeIn>
      ))}
    </div>
  );
}
