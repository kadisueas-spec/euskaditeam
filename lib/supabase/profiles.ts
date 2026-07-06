import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth-user";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "coach" | "client";
};

// cache(): se llama tanto en el layout del coach como en varias páginas
// dentro del mismo request. getAuthUser() ya no pega contra Supabase (lee
// el resultado que dejó el middleware), así que esto queda en 1 sola
// consulta real (profiles), no 2.
export const getCurrentProfile = cache(async function getCurrentProfile(): Promise<Profile | null> {
  const authUser = await getAuthUser();
  if (!authUser) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url, role")
    .eq("id", authUser.id)
    .single();

  return data;
});
