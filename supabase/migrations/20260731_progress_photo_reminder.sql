-- Recordatorio mensual de fotos de progreso (jul-2026). Guarda cuándo el
-- cliente descartó el aviso por última vez, para poder silenciarlo 7 días
-- (la lógica de "cuándo mostrar" vive en lib/supabase/progress-photos.ts,
-- comparando esta fecha + la fecha de la última foto/alta del cliente
-- contra la fecha actual — no hace falta nada más en la base).
--
-- Correr a mano en el SQL Editor del Dashboard de Supabase, igual que el
-- resto de las migraciones de este proyecto.

alter table public.clients
  add column progress_photo_reminder_dismissed_at timestamptz;
