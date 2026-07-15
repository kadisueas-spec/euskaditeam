-- Módulo de Evaluación Antropométrica y Nutrición (jul-2026).
-- Correr a mano en el SQL Editor del Dashboard de Supabase (este proyecto
-- no tiene conexión directa a Postgres desde el entorno de desarrollo).
--
-- Antes de correr esto: crear el bucket de Storage "nutrition-plans" a
-- mano (Dashboard > Storage > New bucket), marcado como PRIVADO (no
-- público) — las políticas de storage.objects de más abajo asumen que
-- el bucket ya existe.

-- anthropometric_evaluations: una fila por evaluación que el coach le
-- hace a un cliente. height_cm se guarda en cada fila (no solo una vez en
-- clients) para que el IMC de evaluaciones pasadas siga siendo correcto
-- aunque la altura se actualice más adelante — el formulario la precarga
-- con el último valor conocido, el coach solo la toca si cambió.
create table public.anthropometric_evaluations (
  id uuid primary key default extensions.uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  coach_id uuid references public.profiles(id) on delete set null,
  evaluation_date date not null default current_date,
  weight_kg numeric(5,2) not null,
  height_cm numeric(5,2) not null,
  protocol text not null check (protocol in ('DW4', 'JP3', 'JP7', 'ISAK8')),
  body_fat_percentage numeric(4,2),
  fat_mass_kg numeric(5,2),
  muscle_mass_kg numeric(5,2),
  bmi numeric(4,2),
  waist_hip_ratio numeric(4,3),
  coach_notes text,
  created_at timestamptz not null default now()
);

create index idx_anthropometric_evaluations_client_id
  on public.anthropometric_evaluations (client_id);

-- body_measurements: perímetros (cm) y pliegues cutáneos (mm) de cada
-- evaluación, en formato clave/valor en vez de una columna por tipo — así
-- cualquier combinación de protocolo entra sin volver a migrar el schema.
-- La unidad (cm vs mm) depende de measurement_type, no se guarda acá.
create table public.body_measurements (
  id uuid primary key default extensions.uuid_generate_v4(),
  evaluation_id uuid not null references public.anthropometric_evaluations(id) on delete cascade,
  measurement_type text not null check (measurement_type in (
    -- perímetros (cm)
    'waist', 'hip', 'thigh_right', 'thigh_left',
    'arm_right_relaxed', 'arm_right_flexed',
    'arm_left_relaxed', 'arm_left_flexed', 'chest_perimeter',
    -- pliegues cutáneos (mm)
    'biceps', 'triceps', 'subscapular', 'suprailiac',
    'chest_skinfold', 'midaxillary', 'abdominal', 'thigh_skinfold',
    'iliac_crest', 'calf'
  )),
  value numeric(5,2) not null,
  unique (evaluation_id, measurement_type)
);

create index idx_body_measurements_evaluation_id
  on public.body_measurements (evaluation_id);

-- nutrition_plans: metadata del PDF (el archivo en sí vive en Storage,
-- bucket "nutrition-plans", path "{client_id}/{archivo}"). Como máximo un
-- plan "active" por cliente a la vez — el coach tiene que archivar el
-- anterior antes de subir uno nuevo (lo hace la server action; este índice
-- es la red de seguridad a nivel de datos).
create table public.nutrition_plans (
  id uuid primary key default extensions.uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  coach_id uuid references public.profiles(id) on delete set null,
  name text not null,
  valid_from date,
  valid_until date,
  status text not null default 'active' check (status in ('active', 'archived')),
  file_path text not null,
  file_name text not null,
  created_at timestamptz not null default now()
);

create index idx_nutrition_plans_client_id on public.nutrition_plans (client_id);

create unique index idx_nutrition_plans_one_active_per_client
  on public.nutrition_plans (client_id)
  where status = 'active';

-- RLS: mismo patrón que ya usan workout_logs/feedback — el coach
-- gestiona todo lo de sus propios clientes, el cliente solo lee lo suyo.

alter table public.anthropometric_evaluations enable row level security;
alter table public.body_measurements enable row level security;
alter table public.nutrition_plans enable row level security;

create policy "Coach manages evaluations of own clients"
  on public.anthropometric_evaluations
  using (client_id in (select clients.id from public.clients where clients.coach_id = auth.uid()))
  with check (client_id in (select clients.id from public.clients where clients.coach_id = auth.uid()));

create policy "Client views own evaluations"
  on public.anthropometric_evaluations
  for select
  using (client_id in (select clients.id from public.clients where clients.user_id = auth.uid()));

create policy "Coach manages measurements of own clients"
  on public.body_measurements
  using (evaluation_id in (
    select ae.id from public.anthropometric_evaluations ae
    join public.clients c on c.id = ae.client_id
    where c.coach_id = auth.uid()
  ))
  with check (evaluation_id in (
    select ae.id from public.anthropometric_evaluations ae
    join public.clients c on c.id = ae.client_id
    where c.coach_id = auth.uid()
  ));

create policy "Client views own measurements"
  on public.body_measurements
  for select
  using (evaluation_id in (
    select ae.id from public.anthropometric_evaluations ae
    join public.clients c on c.id = ae.client_id
    where c.user_id = auth.uid()
  ));

create policy "Coach manages nutrition plans of own clients"
  on public.nutrition_plans
  using (client_id in (select clients.id from public.clients where clients.coach_id = auth.uid()))
  with check (client_id in (select clients.id from public.clients where clients.coach_id = auth.uid()));

create policy "Client views own nutrition plans"
  on public.nutrition_plans
  for select
  using (client_id in (select clients.id from public.clients where clients.user_id = auth.uid()));

-- Storage: el bucket "nutrition-plans" ya tiene que existir (ver nota al
-- principio del archivo). Convención de path: "{client_id}/{archivo}.pdf"
-- — storage.foldername(name) devuelve el path partido en segmentos, el
-- primero es la carpeta = client_id.

create policy "Coach manages nutrition plan files of own clients"
  on storage.objects
  for all
  using (
    bucket_id = 'nutrition-plans'
    and (storage.foldername(name))[1]::uuid in (
      select clients.id from public.clients where clients.coach_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'nutrition-plans'
    and (storage.foldername(name))[1]::uuid in (
      select clients.id from public.clients where clients.coach_id = auth.uid()
    )
  );

create policy "Client views own nutrition plan files"
  on storage.objects
  for select
  using (
    bucket_id = 'nutrition-plans'
    and (storage.foldername(name))[1]::uuid in (
      select clients.id from public.clients where clients.user_id = auth.uid()
    )
  );
