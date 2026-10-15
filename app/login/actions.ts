"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string } | undefined;

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresá tu email y contraseña." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  // Confirmación de email (oct-2026): con "Confirm email" activado en
  // Supabase Auth, una cuenta sin confirmar no puede entrar aunque la
  // contraseña esté bien — decirlo explícitamente en vez del genérico.
  if (error?.code === "email_not_confirmed") {
    return {
      error:
        "Confirmá tu email antes de entrar. Revisá tu bandeja de entrada (y la carpeta de spam).",
    };
  }

  if (error || !data.user) {
    return { error: "Email o contraseña incorrectos." };
  }

  const role = data.user.user_metadata?.role;
  redirect(role === "coach" ? "/coach/dashboard" : "/client/home");
}
