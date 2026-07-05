const YT_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

// Acepta el ID pelado o cualquier formato común de URL de YouTube
// (watch, youtu.be, embed, shorts, con o sin "www"/"m").
export function extractYouTubeId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  if (YT_ID_REGEX.test(value)) return value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\.|^m\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return YT_ID_REGEX.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v");
      return id && YT_ID_REGEX.test(id) ? id : null;
    }
    const match = url.pathname.match(/^\/(?:embed|shorts)\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
  }

  return null;
}

export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}

export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
