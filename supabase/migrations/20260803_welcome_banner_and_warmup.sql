-- Dos banners nuevos para el cliente (ago-2026).
--
-- 1) Banner de bienvenida — una sola vez por rutina, marca guardada en la
--    base (no localStorage) para que sobreviva entre dispositivos/reinstalos
--    de la PWA. NULL = todavía no se mostró para esta rutina.
alter table public.routines
  add column welcome_banner_shown_at timestamptz;

-- 2) Banner de calentamiento — tipo de calentamiento por ejercicio, elegido
--    por el coach en el creador/editor de rutinas. 'none' es el default
--    (el wizard/editor arranca el primer ejercicio de cada día en
--    'percentage_with_kg' en vez de 'none', pero eso es una decisión de UI,
--    no de la base).
--    warmup_fixed_weight_kg solo se usa cuando warmup_type = 'fixed_weight'
--    (Tipo C, peso fijo que carga el coach) — nullable porque no aplica a
--    los otros tres tipos.
alter table public.routine_exercises
  add column warmup_type text not null default 'none'
    check (warmup_type in ('none', 'percentage_with_kg', 'percentage_of_max', 'fixed_weight')),
  add column warmup_fixed_weight_kg numeric(5,2);
