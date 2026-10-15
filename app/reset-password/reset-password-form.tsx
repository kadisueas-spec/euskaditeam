"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock } from "lucide-react";
import { AuthInput } from "@/components/auth/auth-input";
import { Spinner } from "@/components/ui/spinner";
import { resetPassword, type ResetPasswordState } from "./actions";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<ResetPasswordState, FormData>(
    resetPassword,
    undefined
  );
  const [showPassword, setShowPassword] = useState(false);

  const eyeButton = (
    <button
      type="button"
      onClick={() => setShowPassword((v) => !v)}
      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
      className="flex size-9 items-center justify-center text-[#888888] active:text-white"
    >
      {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
    </button>
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-3xl tracking-wide text-white uppercase">
          Nueva contraseña
        </h2>
        <p className="mt-1 text-sm text-[#888888]">Mínimo 8 caracteres.</p>
      </div>

      <div className="flex flex-col gap-3">
        <AuthInput
          icon={Lock}
          id="newPassword"
          name="newPassword"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Contraseña nueva"
          minLength={8}
          required
          rightSlot={eyeButton}
        />
        <AuthInput
          icon={Lock}
          id="confirmPassword"
          name="confirmPassword"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Repetí la contraseña"
          minLength={8}
          required
        />
      </div>

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
            Guardando...
          </>
        ) : (
          <>
            Guardar contraseña <ArrowRight className="size-5" />
          </>
        )}
      </button>
    </form>
  );
}
