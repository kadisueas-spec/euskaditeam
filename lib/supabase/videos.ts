import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";

export { VIDEO_CATEGORIES, VIDEO_CATEGORY_LABEL } from "@/lib/constants/videos";
export type { VideoCategory } from "@/lib/constants/videos";
import type { VideoCategory } from "@/lib/constants/videos";

// --- Coach ---

export type CoachVideoListItem = {
  id: string;
  title: string;
  category: VideoCategory;
  youtubeId: string;
  isGeneral: boolean;
  assignedClientNames: string[];
};

type CoachVideoRow = {
  id: string;
  title: string;
  category: VideoCategory;
  youtube_id: string;
  is_general: boolean;
  video_assignments: {
    clients: { profiles: { full_name: string | null; email: string } | null } | null;
  }[];
};

export async function getVideosForCoach(): Promise<CoachVideoListItem[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("videos")
    .select(
      `id, title, category, youtube_id, is_general,
       video_assignments ( clients ( profiles!clients_user_id_fkey ( full_name, email ) ) )`
    )
    .order("created_at", { ascending: false })
    .returns<CoachVideoRow[]>();

  return (data ?? []).map((v) => ({
    id: v.id,
    title: v.title,
    category: v.category,
    youtubeId: v.youtube_id,
    isGeneral: v.is_general,
    assignedClientNames: v.video_assignments
      .map((a) => a.clients?.profiles?.full_name ?? a.clients?.profiles?.email ?? null)
      .filter((n): n is string => !!n),
  }));
}

export type CoachVideoDetail = {
  id: string;
  title: string;
  description: string | null;
  youtubeId: string;
  category: VideoCategory;
  isGeneral: boolean;
  assignedClientIds: string[];
};

type CoachVideoDetailRow = {
  id: string;
  title: string;
  description: string | null;
  youtube_id: string;
  category: VideoCategory;
  is_general: boolean;
  video_assignments: { client_id: string }[];
};

export async function getVideoDetailForCoach(id: string): Promise<CoachVideoDetail | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("videos")
    .select(
      `id, title, description, youtube_id, category, is_general,
       video_assignments ( client_id )`
    )
    .eq("id", id)
    .maybeSingle()
    .returns<CoachVideoDetailRow | null>();

  if (!data) return null;

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    youtubeId: data.youtube_id,
    category: data.category,
    isGeneral: data.is_general,
    assignedClientIds: data.video_assignments.map((a) => a.client_id),
  };
}

// --- Cliente ---

export type ClientVideoListItem = {
  id: string;
  title: string;
  category: VideoCategory;
  youtubeId: string;
  isAssignedToMe: boolean;
  isSeen: boolean;
};

type ClientVideoRow = {
  id: string;
  title: string;
  category: VideoCategory;
  youtube_id: string;
  is_general: boolean;
  video_assignments: { client_id: string }[];
};

// Trae los videos visibles para el cliente (RLS ya filtra generales +
// asignados a él) y los cruza en JS contra sus propias vistas para marcar
// "nuevo" — a esta escala (una biblioteca de decenas de videos, no miles)
// no hace falta un JOIN de base para esto.
export async function getMyVideos(): Promise<ClientVideoListItem[]> {
  const client = await getCurrentClientRecord();
  if (!client) return [];

  const supabase = await createClient();

  const [{ data: videos }, { data: views }] = await Promise.all([
    supabase
      .from("videos")
      .select(`id, title, category, youtube_id, is_general, video_assignments ( client_id )`)
      .order("created_at", { ascending: false })
      .returns<ClientVideoRow[]>(),
    supabase.from("video_views").select("video_id").eq("client_id", client.id),
  ]);

  const seenIds = new Set((views ?? []).map((v) => v.video_id));

  return (videos ?? []).map((v) => ({
    id: v.id,
    title: v.title,
    category: v.category,
    youtubeId: v.youtube_id,
    isAssignedToMe: v.video_assignments.some((a) => a.client_id === client.id),
    isSeen: seenIds.has(v.id),
  }));
}

export type ClientVideoDetail = {
  id: string;
  title: string;
  description: string | null;
  youtubeId: string;
  category: VideoCategory;
  isAssignedToMe: boolean;
  isSeen: boolean;
};

export async function getVideoDetailForClient(id: string): Promise<ClientVideoDetail | null> {
  const client = await getCurrentClientRecord();
  if (!client) return null;

  const supabase = await createClient();

  const [{ data }, { data: view }] = await Promise.all([
    supabase
      .from("videos")
      .select(`id, title, description, youtube_id, category, video_assignments ( client_id )`)
      .eq("id", id)
      .maybeSingle()
      .returns<
        | (Omit<ClientVideoRow, "is_general" | "youtube_id"> & {
            description: string | null;
            youtube_id: string;
          })
        | null
      >(),
    supabase
      .from("video_views")
      .select("id")
      .eq("video_id", id)
      .eq("client_id", client.id)
      .maybeSingle(),
  ]);

  if (!data) return null;

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    youtubeId: data.youtube_id,
    category: data.category,
    isAssignedToMe: data.video_assignments.some((a) => a.client_id === client.id),
    isSeen: !!view,
  };
}

// Badge de "no vistos" en el link de Videos del perfil — mismo criterio de
// "pura lectura" que getUnreadFeedbackCount (la mutación de marcar visto
// vive en un Server Action aparte, ver app/client/videos/actions.ts).
export async function getUnseenVideoCount(): Promise<number> {
  const client = await getCurrentClientRecord();
  if (!client) return 0;

  const supabase = await createClient();

  const [{ data: videos }, { data: views }] = await Promise.all([
    supabase.from("videos").select("id"),
    supabase.from("video_views").select("video_id").eq("client_id", client.id),
  ]);

  const seenIds = new Set((views ?? []).map((v) => v.video_id));
  return (videos ?? []).filter((v) => !seenIds.has(v.id)).length;
}
