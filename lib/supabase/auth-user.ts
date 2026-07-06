import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type AuthUser = {
  id: string;
  email: string;
  role: "coach" | "client" | null;
  fullName: string | null;
};

// Fuente única de la identidad del usuario para toda la request. El
// middleware (proxy.ts) ya valida la sesión contra Supabase Auth una vez
// por navegación y deja el resultado en headers internos — acá solo se
// leen (sin red). cache() además comparte esta misma promesa entre
// getCurrentProfile, getCurrentClientRecord y cualquier otra función que
// la necesite dentro del mismo render, así nadie vuelve a llamar a
// auth.getUser() por su cuenta.
export const getAuthUser = cache(async function getAuthUser(): Promise<AuthUser | null> {
  const h = await headers();
  const id = h.get("x-user-id");
  if (id) {
    return {
      id,
      email: h.get("x-user-email") ?? "",
      role: (h.get("x-user-role") as AuthUser["role"]) || null,
      fullName: h.get("x-user-full-name") || null,
    };
  }

  // Fallback defensivo por si el header no llegó (no debería pasar en
  // producción, el matcher de proxy.ts cubre todas las rutas de la app).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return {
    id: user.id,
    email: user.email ?? "",
    role: (user.user_metadata?.role as AuthUser["role"]) ?? null,
    fullName: (user.user_metadata?.full_name as string) ?? null,
  };
});
