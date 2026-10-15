"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { AuthInput } from "@/components/auth/auth-input";
import { Spinner } from "@/components/ui/spinner";
import { requestPasswordReset, type ForgotPasswordState } from "./actions";

export function ForgotPasswordForm({ expired }: { expired: boolean }) {
  const [state, action, pending] = useActionState<ForgotPasswordState, FormData>(
    requestPasswordReset,
    undefined
  );

  if (state && "success" in state) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-3xl tracking-wide text-white uppercase">
          Revisá tu email
        </h2>
        <p className="text-sm text-[#888888]">
          Si hay una cuenta con ese email, te mandamos un link para crear una
          contraseña nueva. Revisá también la carpeta de spam. El link vence
          en una hora.
        </p>
        <Link href="/login" className="mt-2 font-medium text-[#e8001c]">
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-3xl tracking-wide text-white uppercase">
          ¿Olvidaste tu contraseña?
        </h2>
        <p className="mt-1 text-sm text-[#888888]">
          Ingresá tu email y te mandamos un link para crear una nueva.
        </p>
      </div>

      {expired && !state?.error && (
        <p className="rounded-xl border border-[#1e1e1e] bg-white/5 px-4 py-3 text-sm text-[#f5f5f5]">
          El link venció o ya se usó. Pedí uno nuevo.
        </p>
      )}

      <AuthInput
        icon={Mail}
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="Email"
        required
      />

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl font-display text-xl tracking-widest text-white uppercase shadow-[0_0_24px_rgba(232,0,28,0.45)] disabled:opacity-60"
        style={{ background: "linear-gradient(to right, #e8001c, #ff4d4d)" }}
      >
        {pending ? (
          <>
            <Spinner size="sm" className="border-white/30 border-t-white" />
            Enviando...
          </>
        ) : (
          <>
            Enviar link <ArrowRight className="size-5" />
          </>
        )}
      </button>

      <Link href="/login" className="text-center text-sm font-medium text-[#e8001c]">
        Volver a iniciar sesión
      </Link>
    </form>
  );
}
