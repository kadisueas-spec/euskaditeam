-- Fotos de progreso corporal (jul-2026). Es el dato más sensible que
-- maneja la app (fotos corporales) — estándar de privacidad más alto:
-- bucket privado, RLS estricto por client_id, URLs firmadas de vida corta.
--
-- Antes de correr esto: crear el bucket de Storage "progress-photos" a
-- mano (Dashboard > Storage > New bucket), marcado como PRIVADO (no
-- público) — igual que se hizo con "nutrition-plans". Las políticas de
-- storage.objects de más abajo asumen que el bucket ya existe.
--
-- Correr a mano en el SQL Editor del Dashboard de Supabase (este proyecto
-- no tiene conexión directa a Postgres desde el entorno de desarrollo).

create table public.progress_photos (
  id uuid primary key default extensions.uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  taken_at date not null default current_date,
  category text check (category in ('front', 'side', 'back')),
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index idx_progress_photos_client_id on public.progress_photos (client_id);

alter table public.progress_photos enable row level security;

-- Mismo patrón que nutrition_plans, pero INVERTIDO: acá el cliente es
-- quien sube y borra (el coach solo mira) — nutrition_plans es al revés.

create policy "Client manages own progress photos"
  on public.progress_photos
  using (client_id in (select clients.id from public.clients where clients.user_id = auth.uid()))
  with check (client_id in (select clients.id from public.clients where clients.user_id = auth.uid()));

create policy "Coach views progress photos of own clients"
  on public.progress_photos for select
  using (client_id in (select clients.id from public.clients where clients.coach_id = auth.uid()));

-- Storage: el bucket "progress-photos" ya tiene que existir (ver nota al
-- principio). Convención de path: "{client_id}/{archivo}" — igual que
-- nutrition-plans, (storage.foldername(name))[1] da el primer segmento
-- del path = client_id, lo que permite verificar que un cliente autenticado
-- solo pueda tocar/ver archivos bajo SU PROPIO client_id, nunca el de otro
-- manipulando la URL o el path a mano.

create policy "Client manages own progress photo files"
  on storage.objects
  for all
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1]::uuid in (
      select clients.id from public.clients where clients.user_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1]::uuid in (
      select clients.id from public.clients where clients.user_id = auth.uid()
    )
  );

create policy "Coach views progress photo files of own clients"
  on storage.objects
  for select
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1]::uuid in (
      select clients.id from public.clients where clients.coach_id = auth.uid()
    )
  );
