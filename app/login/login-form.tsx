"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { AuthInput } from "@/components/auth/auth-input";
import { Spinner } from "@/components/ui/spinner";
import { login, type LoginState } from "./actions";

export function LoginForm({ notice = null }: { notice?: string | null }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    login,
    undefined
  );
  const [showPassword, setShowPassword] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const [focused, setFocused] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);

  // Teclado (nov-2026): mientras un campo está enfocado, el campo y el
  // botón "Iniciar sesión" quedan por encima del borde del teclado. En
  // Android el teclado achica la pantalla; en iPhone NO (la tapa), así que
  // se mide con visualViewport y se deja un espacio de ese alto al final
  // del formulario para que haya lugar para subir. La página entera
  // scrollea (app/login/page.tsx). Se recalcula cada vez que cambia el área
  // visible, porque el teclado aparece después del foco.
  useEffect(() => {
    if (!focused) return;
    const form = formRef.current;
    const vv = window.visualViewport;
    function reveal() {
      if (!form) return;
      const main = form.closest("main");
      const submit = form.querySelector<HTMLElement>('button[type="submit"]');
      const field = document.activeElement instanceof HTMLInputElement ? document.activeElement : null;
      const visibleBottom = vv ? vv.height + vv.offsetTop : window.innerHeight;
      setKeyboardInset(vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0);
      if (!main || !submit) return;
      const overflow = submit.getBoundingClientRect().bottom + 16 - visibleBottom;
      if (overflow > 0) main.scrollBy({ top: overflow });
      const top = field?.getBoundingClientRect().top ?? 0;
      if (field && top < 16) main.scrollBy({ top: top - 16 });
    }
    const timers = [setTimeout(reveal, 50), setTimeout(reveal, 350)];
    vv?.addEventListener("resize", reveal);
    vv?.addEventListener("scroll", reveal);
    window.addEventListener("resize", reveal);
    return () => {
      timers.forEach(clearTimeout);
      vv?.removeEventListener("resize", reveal);
      vv?.removeEventListener("scroll", reveal);
      window.removeEventListener("resize", reveal);
    };
  }, [focused]);

  return (
    <form
      ref={formRef}
      action={action}
      onFocus={(e) => {
        if (e.target instanceof HTMLInputElement) setFocused(true);
      }}
      onBlur={(e) => {
        // Pasar de un campo al otro no cuenta como salir del formulario.
        if (!(e.relatedTarget instanceof HTMLInputElement) || !e.currentTarget.contains(e.relatedTarget)) {
          setFocused(false);
          setKeyboardInset(0);
        }
      }}
      className="flex flex-col gap-5"
    >
      <div>
        <h2 className="font-display text-4xl leading-none tracking-wide text-[#f5f5f5] uppercase">
          Iniciar sesión
        </h2>
        <p className="mt-2 text-base text-[#c9c9c9]">¿Listo para entrenar?</p>
      </div>

      {notice && !state?.error && (
        <p className="rounded-2xl bg-[#232323] px-4 py-3 text-sm text-[#f5f5f5]">
          {notice}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <AuthInput
          shape="pill"
          icon={Mail}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="Email"
          required
        />
        <AuthInput
          shape="pill"
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
              className="flex size-11 items-center justify-center rounded-full text-[#9a9a9a] outline-none focus-visible:ring-2 focus-visible:ring-(--login-accent) active:text-white"
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
        className="-mt-3 flex min-h-11 items-center self-end rounded-full px-1 text-sm font-medium text-(--login-accent) outline-none focus-visible:ring-2 focus-visible:ring-(--login-accent)"
      >
        ¿Olvidaste tu contraseña?
      </Link>

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="login-gradient login-glow relative flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full text-[1.1875rem] font-bold text-white outline-none transition-[filter,transform] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#171717] active:scale-[0.98] disabled:opacity-60 motion-reduce:transition-none"
      >
        {pending ? (
          <>
            <Spinner size="sm" className="border-white/30 border-t-white" />
            Ingresando...
          </>
        ) : (
          <>
            Iniciar sesión
            <span aria-hidden className="absolute right-2 flex size-10 items-center justify-center rounded-full bg-black/15">
              <ArrowRight className="size-5" />
            </span>
          </>
        )}
      </button>

      <p className="text-center text-sm text-[#c9c9c9]">
        ¿Nuevo por acá?{" "}
        <Link
          href="/register"
          className="inline-flex min-h-11 items-center rounded-full px-1 font-semibold text-(--login-accent) outline-none focus-visible:ring-2 focus-visible:ring-(--login-accent)"
        >
          Creá tu cuenta
        </Link>
      </p>
      {/* Lugar para que el formulario suba por encima del teclado en iPhone */}
      {keyboardInset > 0 && <div aria-hidden style={{ height: keyboardInset }} />}
    </form>
  );
}
