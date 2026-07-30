-- Biblioteca de videos explicativos (ago-2026). Correr a mano en el SQL
-- Editor del Dashboard de Supabase.
--
-- videos: cada fila es un video de YouTube que el coach carga. is_general
-- = true -> lo ven TODOS los clientes de ese coach. is_general = false ->
-- solo lo ven los clientes listados en video_assignments. Un video siempre
-- tiene coach_id (a diferencia de los ejercicios globales, acá no hay
-- concepto de "compartido entre coaches" — "general" es sobre los propios
-- clientes de Luis, no cross-coach).
create table public.videos (
  id uuid primary key default extensions.uuid_generate_v4(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  youtube_id text not null,
  category text not null check (category in (
    'concepts', 'warmup', 'mobility', 'technique', 'nutrition', 'app_usage'
  )),
  is_general boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_videos_coach_id on public.videos (coach_id);

-- video_assignments: a qué cliente(s) puntuales se les asignó un video no
-- general. Muchos-a-muchos (un video puede ir a varios clientes, un
-- cliente puede tener varios videos asignados).
create table public.video_assignments (
  id uuid primary key default extensions.uuid_generate_v4(),
  video_id uuid not null references public.videos(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (video_id, client_id)
);

create index idx_video_assignments_client_id on public.video_assignments (client_id);

-- video_views: marca de "ya lo vio" por cliente — independiente de
-- video_assignments porque un video general no tiene fila de asignación
-- pero igual necesita rastrearse por cliente (cada uno lo ve o no por su
-- cuenta). upsert desde el cliente al abrir el detalle (ver
-- app/client/videos/actions.ts, mismo patrón que markFeedbackRead).
create table public.video_views (
  id uuid primary key default extensions.uuid_generate_v4(),
  video_id uuid not null references public.videos(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  unique (video_id, client_id)
);

create index idx_video_views_client_id on public.video_views (client_id);

alter table public.videos enable row level security;
alter table public.video_assignments enable row level security;
alter table public.video_views enable row level security;

-- Coach: gestiona (crea/edita/borra) los videos que él mismo cargó.
create policy "Coach manages own videos"
  on public.videos
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

-- Cliente: ve los videos generales de SU coach, más los que le asignaron
-- puntualmente a él.
create policy "Client views general or assigned videos"
  on public.videos
  for select
  using (
    exists (
      select 1 from public.clients
      where clients.user_id = auth.uid()
        and clients.coach_id = videos.coach_id
        and (
          videos.is_general = true
          or exists (
            select 1 from public.video_assignments va
            where va.video_id = videos.id and va.client_id = clients.id
          )
        )
    )
  );

-- Coach: gestiona asignaciones, solo de sus propios videos hacia sus
-- propios clientes (ambos lados verificados en el with check).
create policy "Coach manages assignments of own videos and clients"
  on public.video_assignments
  using (
    video_id in (select id from public.videos where coach_id = auth.uid())
  )
  with check (
    video_id in (select id from public.videos where coach_id = auth.uid())
    and client_id in (select id from public.clients where coach_id = auth.uid())
  );

-- Cliente: solo lee sus propias asignaciones (para saber qué se le asignó
-- puntualmente, ver getMyVideos).
create policy "Client views own assignments"
  on public.video_assignments
  for select
  using (client_id in (select id from public.clients where user_id = auth.uid()));

-- Cliente: gestiona sus propias marcas de "visto" (insert al abrir el
-- detalle). El coach no necesita ver esto — no se pidió un indicador de
-- "visto por el cliente" en el panel del coach.
create policy "Client manages own video views"
  on public.video_views
  using (client_id in (select id from public.clients where user_id = auth.uid()))
  with check (client_id in (select id from public.clients where user_id = auth.uid()));
