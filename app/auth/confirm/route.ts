import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Links de los emails de Supabase Auth (oct-2026): recuperación de
// contraseña y confirmación de cuenta. Acepta las dos formas en que puede
// llegar el link:
// - token_hash + type (plantilla de email personalizada, ver CLAUDE.md
//   ítem 62): se verifica acá con verifyOtp. Funciona aunque el link se
//   abra en otro navegador que el que pidió el email — importante en
//   iPhone, donde la PWA instalada y Safari no comparten cookies.
// - code (plantilla por defecto, flujo PKCE): exchangeCodeForSession. Solo
//   funciona en el mismo navegador que pidió el email (el "code verifier"
//   vive en una cookie de ese navegador).
// `next` solo acepta rutas internas, para que el link no pueda usarse como
// redirect abierto a otro sitio.
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/login";
  return value;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  const supabase = await createClient();
  let ok = false;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) console.error("auth/confirm verifyOtp error:", error);
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) console.error("auth/confirm exchangeCode error:", error);
    ok = !error;
  }

  if (!ok) {
    const fallback = next === "/reset-password" ? "/forgot-password?expired=1" : "/login?notice=link";
    return NextResponse.redirect(new URL(fallback, request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
