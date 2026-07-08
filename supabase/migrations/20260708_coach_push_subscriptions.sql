-- Push notifications al coach (mesociclo por terminar, 80% de adherencia).
-- push_subscriptions hoy es solo para clientes (client_id NOT NULL, sin
-- coach_id). Esta migración lo hace soportar ambos roles sin tocar las
-- filas existentes: client_id pasa a nullable, se agrega coach_id
-- (nullable) y un CHECK que obliga a que se use exactamente uno de los dos.
--
-- Correr a mano en el SQL Editor del Dashboard de Supabase (este proyecto
-- no tiene conexión directa a Postgres desde el entorno de desarrollo).

alter table public.push_subscriptions
  alter column client_id drop not null;

alter table public.push_subscriptions
  add column coach_id uuid references public.profiles(id) on delete cascade;

alter table public.push_subscriptions
  add constraint push_subscriptions_owner_check check (
    (client_id is not null and coach_id is null)
    or (client_id is null and coach_id is not null)
  );

create policy "Coach manages own push subscriptions"
  on public.push_subscriptions
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());
