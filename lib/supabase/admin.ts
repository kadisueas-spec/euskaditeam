import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente con service role: ignora RLS. Uso exclusivo en código de servidor
// de confianza (envío de push notifications, Edge Functions). NUNCA importar
// esto desde un componente cliente ni exponer la key al browser.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
