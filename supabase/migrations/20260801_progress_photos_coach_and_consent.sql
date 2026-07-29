-- Gestión de fotos de progreso para el coach + consentimiento de uso
-- público (jul-2026).
--
-- uploaded_by: quién subió la foto (el coach ahora puede subir directo
-- desde su vista del cliente, ej. en una evaluación presencial) — se usa
-- para mostrarle al cliente "Subida por tu coach" / "Subida por vos".
--
-- public_use_authorized: el cliente autoriza (o no) que su coach use ESA
-- foto puntual como contenido público (ej. resultados). Default NO a
-- propósito — es opt-in, nunca opt-out. Solo el cliente puede cambiarlo
-- (RLS existente "Client manages own progress photos" ya cubre el UPDATE
-- de sus propias filas; el coach no tiene policy de UPDATE sobre esta
-- tabla, así que no puede tocarlo ni por error).
--
-- Correr a mano en el SQL Editor del Dashboard de Supabase, igual que el
-- resto de las migraciones de este proyecto.

alter table public.progress_photos
  add column uploaded_by text not null default 'client'
    check (uploaded_by in ('client', 'coach')),
  add column public_use_authorized boolean not null default false;

-- El coach ahora puede subir fotos para sus propios clientes (además de
-- solo verlas, que ya tenía). Sin policy de UPDATE/DELETE para el coach a
-- propósito: el consentimiento y el borrado siguen siendo exclusivos del
-- cliente. El "and uploaded_by = 'coach' and public_use_authorized =
-- false" en el WITH CHECK evita que el coach pueda insertar una fila ya
-- marcada como autorizada o atribuida al cliente.
create policy "Coach uploads progress photos for own clients"
  on public.progress_photos
  for insert
  with check (
    client_id in (select clients.id from public.clients where clients.coach_id = auth.uid())
    and uploaded_by = 'coach'
    and public_use_authorized = false
  );

create policy "Coach uploads progress photo files for own clients"
  on storage.objects
  for insert
  with check (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1]::uuid in (
      select clients.id from public.clients where clients.coach_id = auth.uid()
    )
  );
