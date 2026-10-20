-- Recorrido de bienvenida (oct-2026): una marca por parte y por rutina.
-- NULL = todavía no lo vio. Una rutina nueva es una fila nueva, así que el
-- recorrido vuelve a salir cuando el coach asigna otra.
--   tour_home_seen_at    → parte Inicio (entrenamiento del día, navegación,
--                          Mi Cuerpo, cierre)
--   tour_workout_seen_at → parte Entrenar (sugerencia de peso, RIR,
--                          Completar serie)
--
-- Sin UPDATE de las rutinas existentes a propósito: los clientes actuales
-- también lo ven la próxima vez que abran la app.
--
-- Sin policies nuevas: el cliente no tiene UPDATE sobre routines; la marca
-- se escribe desde app/client/onboarding-actions.ts con el service role
-- después de verificar que la rutina es suya (mismo patrón que
-- dismissWelcomeBanner).
alter table public.routines
  add column if not exists tour_home_seen_at timestamptz,
  add column if not exists tour_workout_seen_at timestamptz;
