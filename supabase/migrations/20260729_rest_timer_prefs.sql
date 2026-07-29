-- Preferencias del temporizador de descanso automático (jul-2026). Se
-- guardan en clients (no localStorage) para que persistan entre
-- dispositivos -- ver components/client/rest-timer-settings.tsx y
-- /client/profile. Los 3 arrancan activados por defecto (true), que es el
-- comportamiento que ya tenía la pantalla de Entrenar antes de que
-- existiera el toggle.
--
-- Correr a mano en el SQL Editor del Dashboard de Supabase (este proyecto
-- no tiene conexión directa a Postgres desde el entorno de desarrollo).

alter table public.clients
  add column rest_timer_enabled boolean not null default true,
  add column rest_timer_sound_enabled boolean not null default true,
  add column rest_timer_vibration_enabled boolean not null default true;
