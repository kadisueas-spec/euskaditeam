-- GIF animado de ExerciseDB por ejercicio (oct-2026). Guarda la URL pública
-- del GIF copiado al bucket "exercise-gifs" de Supabase Storage (ver
-- scripts/import-exercise-gifs.mjs) — no la de ExerciseDB, para no depender
-- de que su servidor siga arriba. NULL = sin GIF: la pantalla de Entrenar
-- muestra el video de YouTube como fallback.
--
-- Sin policies nuevas: las de SELECT de exercises ya cubren la columna.
alter table public.exercises
  add column if not exists gif_url text;
