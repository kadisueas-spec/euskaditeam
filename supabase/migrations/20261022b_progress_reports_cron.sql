-- Cron de reportes de progreso (oct-2026). Correr DESPUÉS de que el deploy
-- con /api/cron/progress-reports esté en producción y de cargar CRON_SECRET
-- en Vercel (Settings → Environment Variables).
--
-- Cada hora, a los :05, pg_cron llama a la ruta de la app. La ruta decide
-- qué hacer (todo idempotente, correrla dos veces no duplica nada):
-- - sábado desde las 11:00 de Paraguay: borradores semanales (lunes a viernes);
-- - día 1 desde las 7:00: borradores mensuales del mes anterior;
-- - siempre: envía los reportes PROGRAMADOS cuya hora ya llegó.
-- Nunca envía un borrador: solo lo que el coach programó.
--
-- Por qué pg_cron y no Vercel Cron: en el plan Hobby, Vercel Cron corre una
-- vez por día con hasta 1 h de desfase — no sirve para "el domingo a la
-- hora que elijo".

create extension if not exists pg_net;

-- 1) El secreto va en Vault (no queda en texto plano en cron.job).
--    Reemplazá PEGAR-ACA-EL-MISMO-VALOR-QUE-CRON_SECRET-EN-VERCEL antes de
--    correr. Generalo con: openssl rand -hex 32
select vault.create_secret(
  'PEGAR-ACA-EL-MISMO-VALOR-QUE-CRON_SECRET-EN-VERCEL',
  'progress_reports_cron_secret'
);

-- 2) La tarea horaria. Ojo: con www — euskaditeam.app redirige (308) a
--    www.euskaditeam.app y pg_net no sigue redirecciones.
select cron.schedule(
  'progress-reports-hourly',
  '5 * * * *',
  $$
  select net.http_post(
    url := 'https://www.euskaditeam.app/api/cron/progress-reports',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'progress_reports_cron_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- Para verificar: select * from cron.job where jobname = 'progress-reports-hourly';
-- Últimas corridas:  select * from net._http_response order by created desc limit 5;
-- Para borrarla:     select cron.unschedule('progress-reports-hourly');
