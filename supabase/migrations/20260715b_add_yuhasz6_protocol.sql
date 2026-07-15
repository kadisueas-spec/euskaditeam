-- Suma el protocolo YUHASZ6 (Yuhasz 1974, 6 pliegues) a los 4 ya
-- creados en 20260715_anthropometrics_and_nutrition.sql. Se corre aparte
-- porque se decidió después de la migración original.
--
-- Correr a mano en el SQL Editor del Dashboard de Supabase.
--
-- Nota: el nombre del constraint es el que Postgres le puso automático a
-- un CHECK sin nombre explícito ("{tabla}_{columna}_check"). Si este DROP
-- tira error porque el nombre no coincide, correr primero:
--   select conname from pg_constraint
--   where conrelid = 'public.anthropometric_evaluations'::regclass and contype = 'c';
-- y avisarme el nombre real para ajustar el script.

alter table public.anthropometric_evaluations
  drop constraint anthropometric_evaluations_protocol_check;

alter table public.anthropometric_evaluations
  add constraint anthropometric_evaluations_protocol_check
  check (protocol in ('DW4', 'JP3', 'YUHASZ6', 'JP7', 'ISAK8'));
