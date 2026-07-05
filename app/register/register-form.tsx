"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { register, type RegisterState } from "./actions";

export function RegisterForm() {
  const [state, action, pending] = useActionState<RegisterState, FormData>(
    register,
    undefined
  );

  useEffect(() => {
    if (state && "error" in state && state.debug) {
      console.error("[Euskadi Team register] Supabase signUp error:", state.debug);
    }
  }, [state]);

  if (state && "success" in state) {
    return (
      <p className="text-sm text-[#888888]">
        Cuenta creada. Revisá tu email para confirmar la cuenta y después{" "}
        <Link href="/login" className="text-white underline underline-offset-4">
          iniciá sesión
        </Link>
        .
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="fullName">Nombre completo</Label>
        <Input id="fullName" name="fullName" autoComplete="name" required className="h-11 border-[#333]" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="h-11 border-[#333]"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="h-11 border-[#333]"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">Código de invitación</Label>
        <Input
          id="code"
          name="code"
          autoComplete="off"
          className="h-11 border-[#333] uppercase"
          required
        />
      </div>
      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <Button type="submit" disabled={pending} className="mt-2 h-11 text-base">
        {pending ? "Creando cuenta..." : "Crear cuenta"}
      </Button>
      <p className="text-center text-sm text-[#888888]">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="text-white underline underline-offset-4">
          Ingresá
        </Link>
      </p>
    </form>
  );
}
