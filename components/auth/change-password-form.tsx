"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { AuthInput } from "@/components/auth/auth-input";
import { Spinner } from "@/components/ui/spinner";
import { Toast, type ToastState } from "@/components/ui/toast";
import { changePassword, type ChangePasswordState } from "@/lib/supabase/change-password";

type FieldKey = "currentPassword" | "newPassword" | "confirmPassword";

const TOAST_DURATION_MS = 3500;

// Compartido entre /client/profile y /coach/profile (Bloque "Seguridad").
// Mismo AuthInput premium que login/registro: ícono adentro, 56px, foco
// rojo, fondo #1A1A1A — con ojito independiente por campo.
export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<
    ChangePasswordState,
    FormData
  >(changePassword, undefined);
  const [visible, setVisible] = useState<Record<FieldKey, boolean>>({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(next: ToastState) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }

  useEffect(() => {
    if (!state) return;
    if ("success" in state) {
      showToast({ type: "success", message: "Contraseña actualizada correctamente" });
      formRef.current?.reset();
      setNewPassword("");
      setConfirmPassword("");
    } else if ("error" in state) {
      showToast({ type: "error", message: state.error });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function toggleVisible(field: FieldKey) {
    setVisible((v) => ({ ...v, [field]: !v[field] }));
  }

  function eyeButton(field: FieldKey) {
    return (
      <button
        type="button"
        onClick={() => toggleVisible(field)}
        aria-label={visible[field] ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="flex size-9 items-center justify-center text-[#888888] active:text-white"
      >
        {visible[field] ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    );
  }

  const mismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;
  const tooShort = newPassword.length > 0 && newPassword.length < 8;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    // Chequeos que ya se pueden validar sin ir al servidor — evita el viaje
    // de red para el caso más común (typo en la confirmación).
    if (newPassword.length < 8) {
      e.preventDefault();
      showToast({
        type: "error",
        message: "La nueva contraseña debe tener al menos 8 caracteres.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      e.preventDefault();
      showToast({ type: "error", message: "Las contraseñas no coinciden." });
    }
  }

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        onSubmit={handleSubmit}
        className="flex flex-col gap-3"
      >
        <AuthInput
          icon={Lock}
          name="currentPassword"
          type={visible.currentPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Contraseña actual"
          required
          rightSlot={eyeButton("currentPassword")}
        />
        <AuthInput
          icon={Lock}
          name="newPassword"
          type={visible.newPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Nueva contraseña"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          rightSlot={eyeButton("newPassword")}
        />
        {tooShort ? (
          <p className="-mt-1.5 text-xs text-[#e8001c]">Mínimo 8 caracteres.</p>
        ) : (
          <p className="-mt-1.5 text-xs text-[#666666]">Mínimo 8 caracteres.</p>
        )}
        <AuthInput
          icon={Lock}
          name="confirmPassword"
          type={visible.confirmPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Confirmar nueva contraseña"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          rightSlot={eyeButton("confirmPassword")}
        />
        {mismatch && (
          <p className="-mt-1.5 text-xs text-[#e8001c]">Las contraseñas no coinciden.</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-1 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl font-display text-lg tracking-widest text-white uppercase shadow-[0_0_20px_rgba(232,0,28,0.4)] disabled:opacity-60"
          style={{ background: "linear-gradient(to right, #e8001c, #ff4d4d)" }}
        >
          {pending && <Spinner size="sm" className="border-white/30 border-t-white" />}
          {pending ? "Actualizando..." : "Actualizar contraseña"}
        </button>
      </form>

      {toast && <Toast type={toast.type} message={toast.message} />}
    </>
  );
}
