-- Integración PayPal para suscripciones mensuales (jul-2026). subscriptions
-- está vacía hoy (0 filas) y stripe_subscription_id es NOT NULL — Stripe
-- nunca se terminó de conectar (sin rutas /api, sin checkout, sin webhook),
-- así que no hay ningún dato que migrar al relajar esa columna.
--
-- Correr a mano en el SQL Editor del Dashboard de Supabase (este proyecto
-- no tiene conexión directa a Postgres desde el entorno de desarrollo).

alter table public.subscriptions
  alter column stripe_subscription_id drop not null,
  add column paypal_subscription_id text,
  add column paypal_plan_id text,
  add column paypal_payer_email text;

-- IMPORTANTE: tiene que ser un constraint único NORMAL, no un índice
-- parcial — PostgREST arma el upsert de webhooks.ts como
-- "ON CONFLICT (paypal_subscription_id)" sin predicado WHERE, y Postgres
-- no puede resolver eso contra un índice parcial (error 42P10, confirmado
-- corriendo el webhook real contra un servidor de prueba). Como esta
-- tabla solo la escribe el flujo de PayPal (el acceso manual
-- cash/transferencia nunca toca subscriptions), no hay filas sin
-- paypal_subscription_id que la parcialidad necesitara proteger.
alter table public.subscriptions
  add constraint subscriptions_paypal_subscription_id_key unique (paypal_subscription_id);

-- La tabla tiene RLS activado desde el schema original pero CERO policies
-- — hoy queda completamente bloqueada para cualquier cosa que no sea el
-- service role. Sin policy de insert/update/delete a propósito: todas las
-- escrituras las hacen el webhook o las server actions (coach/cliente)
-- usando createAdminClient(), nunca un cliente RLS-scoped directo.
create policy "Coach views subscriptions of own clients"
  on public.subscriptions for select
  using (client_id in (select clients.id from public.clients where clients.coach_id = auth.uid()));

create policy "Client views own subscriptions"
  on public.subscriptions for select
  using (client_id in (select clients.id from public.clients where clients.user_id = auth.uid()));
