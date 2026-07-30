-- Bug de adherencia (ago-2026): los días planificados del mes se contaban
-- desde el día 1, sin importar cuándo el cliente activó su acceso. Esta
-- columna guarda esa fecha para que lib/utils/planned-days.ts pueda arrancar
-- el conteo desde ahí (ver activateClientAccess y el webhook de PayPal).
alter table public.clients
  add column access_activated_at timestamptz;

-- Backfill best-effort: no existía ningún registro histórico de cuándo se
-- activó el acceso, así que para los clientes YA activos hoy se usa su
-- created_at (fecha de alta del registro) como aproximación más razonable
-- disponible. Es una aproximación, no un dato exacto — si Luis sabe que la
-- fecha real de algún cliente puntual fue otra, se puede corregir a mano:
--   update public.clients set access_activated_at = 'YYYY-MM-DD' where id = '...';
update public.clients
set access_activated_at = created_at
where subscription_status = 'active'
  and access_activated_at is null;
