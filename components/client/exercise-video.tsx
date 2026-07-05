import { getYouTubeEmbedUrl } from "@/lib/constants/youtube";

export function ExerciseVideo({ videoId }: { videoId: string | null }) {
  if (!videoId) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-white/5 text-center text-sm text-[#888888]">
        Video demostrativo próximamente
      </div>
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
      <iframe
        src={getYouTubeEmbedUrl(videoId)}
        title="Video demostrativo"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="size-full"
      />
    </div>
  );
}
