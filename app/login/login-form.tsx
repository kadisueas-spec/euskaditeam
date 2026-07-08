"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { AuthInput } from "@/components/auth/auth-input";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    login,
    undefined
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-3xl tracking-wide text-white uppercase">
          Iniciar sesión
        </h2>
        <p className="mt-1 text-sm text-[#888888]">¿Listo para entrenar?</p>
      </div>

      <div className="flex flex-col gap-3">
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
          autoComplete="current-password"
          placeholder="Contraseña"
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
      </div>

      <Link
        href="/forgot-password"
        className="-mt-2 self-end text-sm font-medium text-[#e8001c]"
      >
        ¿Olvidaste tu contraseña?
      </Link>

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
          "Ingresando..."
        ) : (
          <>
            Iniciar sesión <ArrowRight className="size-5" />
          </>
        )}
      </button>

      <p className="text-center text-sm text-[#888888]">
        ¿Nuevo por acá?{" "}
        <Link href="/register" className="font-medium text-[#e8001c]">
          Creá tu cuenta
        </Link>
      </p>
    </form>
  );
}
