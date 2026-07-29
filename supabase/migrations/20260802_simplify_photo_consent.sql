-- Simplifica el consentimiento de fotos de progreso: de un toggle por
-- foto a UNA sola decisión en el perfil del cliente (jul-2026 lo había
-- dejado por foto; se simplifica ahora porque en la práctica el cliente
-- pensaba en "autorizo a mi coach" como una decisión única, no una por
-- cada imagen).
--
-- photos_public_use_authorized en clients:
--   NULL  = todavía no se le preguntó (dispara el modal la primera vez
--           que entra a la sección de fotos)
--   true  = autorizó
--   false = no autorizó
-- Nunca preseleccionado — arranca en NULL, no en false, para poder
-- distinguir "no respondió" de "respondió que no".
--
-- Correr a mano en el SQL Editor del Dashboard de Supabase.

-- 1) La policy de INSERT del coach sobre progress_photos exigía
--    public_use_authorized = false en el WITH CHECK — hay que sacarle esa
--    condición antes de poder borrar la columna.
drop policy "Coach uploads progress photos for own clients" on public.progress_photos;

create policy "Coach uploads progress photos for own clients"
  on public.progress_photos
  for insert
  with check (
    client_id in (select clients.id from public.clients where clients.coach_id = auth.uid())
    and uploaded_by = 'coach'
  );

-- 2) Ya no hace falta el consentimiento por foto.
alter table public.progress_photos
  drop column public_use_authorized;

-- 3) Consentimiento único, a nivel de cliente.
alter table public.clients
  add column photos_public_use_authorized boolean;
