"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Lock, Mail, Ticket, User } from "lucide-react";
import { AuthInput } from "@/components/auth/auth-input";
import { register, type RegisterState } from "./actions";

export function RegisterForm() {
  const [state, action, pending] = useActionState<RegisterState, FormData>(
    register,
    undefined
  );
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (state && "error" in state && state.debug) {
      console.error("[Euskadi Team register] Supabase signUp error:", state.debug);
    }
  }, [state]);

  if (state && "success" in state) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-3xl tracking-wide text-white uppercase">
          Crear cuenta
        </h2>
        <p className="text-sm text-[#888888]">
          Cuenta creada. Revisá tu email para confirmar la cuenta y después{" "}
          <Link href="/login" className="font-medium text-[#e8001c]">
            iniciá sesión
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-3xl tracking-wide text-white uppercase">
          Crear cuenta
        </h2>
        <p className="mt-1 text-sm text-[#888888]">Sumate al equipo</p>
      </div>

      <div className="flex flex-col gap-3">
        <AuthInput
          icon={User}
          id="fullName"
          name="fullName"
          autoComplete="name"
          placeholder="Nombre completo"
          required
        />
        <AuthInput
          icon={Mail}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="Email"
          required
        />
        <AuthInput
          icon={Lock}
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Contraseña"
          minLength={8}
          required
          rightSlot={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="flex size-9 items-center justify-center text-[#888888] active:text-white"
            >
              {showPassword ? (
                <EyeOff className="size-5" />
              ) : (
                <Eye className="size-5" />
              )}
            </button>
          }
        />
        <AuthInput
          icon={Ticket}
          id="code"
          name="code"
          autoComplete="off"
          placeholder="Código de invitación"
          className="uppercase placeholder:normal-case"
          required
        />
      </div>

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl font-display text-xl tracking-widest text-white uppercase shadow-[0_0_24px_rgba(232,0,28,0.45)] disabled:opacity-60"
        style={{
          background: "linear-gradient(to right, #e8001c, #ff4d4d)",
        }}
      >
        {pending ? (
          "Creando cuenta..."
        ) : (
          <>
            Crear cuenta <ArrowRight className="size-5" />
          </>
        )}
      </button>

      <p className="text-center text-sm text-[#888888]">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-medium text-[#e8001c]">
          Ingresá
        </Link>
      </p>
    </form>
  );
}
