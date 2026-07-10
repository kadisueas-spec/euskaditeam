-- Ejercicios globales (base compartida Euskadi): coach_id = NULL pasa a
-- significar "ejercicio del sistema, visible para cualquier coach, de solo
-- lectura para todos". coach_id YA era nullable en el schema original (no
-- hace falta ALTER TABLE), así que esta migración solo reemplaza las
-- políticas RLS de public.exercises.
--
-- Correr a mano en el SQL Editor del Dashboard de Supabase (este proyecto
-- no tiene conexión directa a Postgres desde el entorno de desarrollo).

-- 1) Sacar las dos políticas viejas de exercises (una cubría SELECT para
--    clientes, la otra cubría TODOS los comandos para el coach dueño).
drop policy if exists "Clients can view exercises from their coach" on public.exercises;
drop policy if exists "Coach manages their exercises" on public.exercises;

-- 2) Clientes: ven los ejercicios de su coach + los globales (los
--    necesitan para ver el detalle de un ejercicio de su rutina, sea
--    propio del coach o de la base Euskadi).
create policy "Clients can view exercises from their coach or global"
  on public.exercises for select
  using (
    coach_id is null
    or coach_id in (
      select clients.coach_id from public.clients
      where clients.user_id = auth.uid()
    )
  );

-- 3) Coach: ve sus propios ejercicios + todos los globales.
create policy "Coach views own and global exercises"
  on public.exercises for select
  using (coach_id = auth.uid() or coach_id is null);

-- 4) Coach: puede crear ejercicios propios (coach_id = su id) o globales
--    (coach_id NULL) siempre que su perfil sea de rol "coach" — sin este
--    chequeo, un ejercicio global no tiene dueño que lo proteja, así que
--    hace falta confirmar el rol acá en vez de solo comparar coach_id.
create policy "Coach creates own or global exercises"
  on public.exercises for insert
  with check (
    coach_id = auth.uid()
    or (
      coach_id is null
      and exists (
        select 1 from public.profiles
        where profiles.id = auth.uid() and profiles.role = 'coach'
      )
    )
  );

-- 5) Coach: solo puede editar SUS ejercicios (coach_id = su id). Un
--    ejercicio global (coach_id NULL) nunca matchea coach_id = auth.uid(),
--    así que queda automáticamente de solo lectura para todos, incluido
--    quien originalmente lo haya creado como global.
create policy "Coach updates own exercises"
  on public.exercises for update
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

-- 6) Coach: solo puede borrar SUS ejercicios (mismo motivo que el update).
create policy "Coach deletes own exercises"
  on public.exercises for delete
  using (coach_id = auth.uid());

-- =====================================================================
-- OPCIONAL — convertir los ejercicios ya cargados por Luis a globales.
-- =====================================================================
-- Estado actual verificado en la base (jul-2026):
--   - 24 ejercicios con coach_id = 'dbf1b301-1921-4b8e-a05a-901d7bd5883e'
--     (la cuenta real de Luis, luismineurfacu@gmail.com)
--   - 1 ejercicio con coach_id = '94b5442e-24f3-4e28-9ca1-0ec2fa544d94'
--     (cuenta de preview/test "Luis Coach") — esta NO se toca.
--   - Hay un nombre duplicado: "Press banca" aparece dos veces.
--
-- IMPORTANTE: una vez que estos 24 pasan a coach_id = NULL, quedan de
-- solo lectura para SIEMPRE desde la app (política "Coach updates own
-- exercises" de arriba) — ni vos los vas a poder editar ni borrar desde
-- /coach/exercises, ni siquiera siendo el creador original. Si querés
-- seguir pudiendo editarlos, dejalos como están (no corras este UPDATE)
-- y agregá los ejercicios nuevos de la Tarea 2 directamente como
-- globales.
--
-- Descomentar para ejecutar:
--
-- update public.exercises
--   set coach_id = null
--   where coach_id = 'dbf1b301-1921-4b8e-a05a-901d7bd5883e';
