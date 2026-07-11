-- Permite al coach editar (fecha, estado completado) y eliminar
-- entrenamientos de SUS clientes desde /coach/clients/[id] — hasta ahora
-- solo el cliente dueño podía tocar sus propios workout_logs (política
-- "Client manages own workout logs", sin FOR = aplica a todos los
-- comandos). El coach solo tenía SELECT ("Coach views client workout
-- logs"), así que UPDATE/DELETE desde la app fallaban en silencio por RLS.
--
-- Correr a mano en el SQL Editor del Dashboard de Supabase.

create policy "Coach updates client workout logs"
  on public.workout_logs for update
  using (
    client_id in (
      select clients.id from public.clients
      where clients.coach_id = auth.uid()
    )
  )
  with check (
    client_id in (
      select clients.id from public.clients
      where clients.coach_id = auth.uid()
    )
  );

create policy "Coach deletes client workout logs"
  on public.workout_logs for delete
  using (
    client_id in (
      select clients.id from public.clients
      where clients.coach_id = auth.uid()
    )
  );

-- No hace falta tocar workout_set_logs: al borrar un workout_log, sus
-- series se borran solas via ON DELETE CASCADE (set_logs_workout_log_id_fkey).
