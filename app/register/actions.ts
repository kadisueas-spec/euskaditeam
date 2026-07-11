"use server";

import { createClient } from "@/lib/supabase/server";

export type RegisterState =
  | { error: string; debug?: unknown }
  | { success: true }
  | undefined;

export async function register(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();

  if (!fullName || !email || !password || !code) {
    return { error: "Completá todos los campos, incluido el código de invitación." };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const supabase = await createClient();

  // Validate the invite code via a SECURITY DEFINER RPC (see supabase/schema.sql)
  // so unauthenticated visitors never query the invite_codes table directly.
  const { data: role, error: codeError } = await supabase.rpc(
    "validate_invite_code",
    { code_input: code }
  );

  if (codeError || !role) {
    if (codeError) console.error("validate_invite_code RPC error:", codeError);
    return { error: "Código de invitación inválido o ya utilizado." };
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
    {
      email,
      password,
      options: {
        data: { role, full_name: fullName },
      },
    }
  );

  if (signUpError || !signUpData.user) {
    // Plain-object copy: Error instances don't survive the Server Action ->
    // Client Component serialization boundary (Next.js Flight only ships
    // enumerable own properties of plain objects).
    const debug = signUpError
      ? {
          name: signUpError.name,
          message: signUpError.message,
          status: signUpError.status,
          code: signUpError.code,
          stack: signUpError.stack,
        }
      : { note: "signUpData.user is falsy but no error was returned", signUpData };
    console.error("supabase.auth.signUp error:", debug);
    return {
      error:
        signUpError?.message === "User already registered"
          ? "Ya existe una cuenta con ese email."
          : "No se pudo crear la cuenta. Intentá de nuevo.",
      debug,
    };
  }

  const { data: claimed } = await supabase.rpc("claim_invite_code", {
    code_input: code,
    user_id_input: signUpData.user.id,
  });

  if (!claimed) {
    return { error: "El código ya fue utilizado por otra persona." };
  }

  return { success: true };
}
