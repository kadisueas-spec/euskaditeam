-- Algoritmo de progresión de carga (jul-2026). Ya corrida a mano en el SQL
-- Editor del Dashboard de Supabase — este archivo documenta el SQL real
-- ejecutado.
--
-- weight_suggestion (text, ya existía, sin uso) queda sin tocar — este es un
-- campo nuevo y separado.

alter table public.routine_exercises
  add column weight_increment numeric(5,2) not null default 2.5;
