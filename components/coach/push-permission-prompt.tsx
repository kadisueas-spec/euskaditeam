"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { formatErrorDetail, urlBase64ToUint8Array, PUSH_PROMPTED_KEY_COACH } from "@/lib/constants/push";
import { saveCoachPushSubscription } from "@/app/coach/actions";

function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// Mismo flujo que components/client/push-permission-prompt.tsx, pero para
// el coach (avisos de adherencia y de mesociclo por terminar) — clave de
// localStorage e insert (coach_id en vez de client_id) separados.
export function CoachPushPermissionPrompt() {
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ver el comentario equivalente en components/client/push-permission-prompt.tsx
  // (caso Fabrizzio, jul-2026): Notification.permission sobrevive a
  // reinstalar la PWA y queda en "granted" para siempre apenas se concede
  // una vez, sin importar si subscribe()/el guardado fallaron después —
  // usarlo acá escondía el banner para siempre en ese escenario.
  // PUSH_PROMPTED_KEY_COACH ya solo se pone en éxito o descarte explícito,
  // así que alcanza sola.
  useEffect(() => {
    if (!isPushSupported()) return;
    if (localStorage.getItem(PUSH_PROMPTED_KEY_COACH)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);
  }, []);

  // Ver el comentario equivalente en components/client/push-permission-prompt.tsx
  // (diagnóstico jul-2026 de por qué las notificaciones nunca se registraban
  // en Android): cada paso ahora loguea su propio error y muestra un
  // mensaje, y el banner ya no se oculta si algo falla — es la única forma
  // de reintentar una vez que el permiso quedó en "granted".
  async function activate() {
    setError(null);

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setError(
        permission === "denied"
          ? "Bloqueaste las notificaciones. Activalas desde la configuración del navegador."
          : "No se activaron las notificaciones."
      );
      return;
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      console.error("CoachPushPermissionPrompt: falta NEXT_PUBLIC_VAPID_PUBLIC_KEY");
      setError("No se pudo activar. Probá de nuevo más tarde.");
      return;
    }

    let subscription: PushSubscription;
    try {
      const registration = await navigator.serviceWorker.ready;
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    } catch (err) {
      console.error("CoachPushPermissionPrompt: pushManager.subscribe() falló", err);
      setError(`No se pudieron activar las notificaciones.\nError: ${formatErrorDetail(err)}`);
      return;
    }

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      console.error("CoachPushPermissionPrompt: suscripción incompleta", json);
      setError("No se pudo activar. Probá de nuevo más tarde.");
      return;
    }

    try {
      const result = await saveCoachPushSubscription({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      });
      if (result?.error) {
        console.error("CoachPushPermissionPrompt: saveCoachPushSubscription devolvió error", result.error);
        setError(`No se pudieron activar las notificaciones.\nError: ${result.error}`);
        return;
      }
    } catch (err) {
      console.error("CoachPushPermissionPrompt: saveCoachPushSubscription lanzó una excepción", err);
      setError(`No se pudieron activar las notificaciones.\nError: ${formatErrorDetail(err)}`);
      return;
    }

    localStorage.setItem(PUSH_PROMPTED_KEY_COACH, "1");
    setVisible(false);
  }

  function dismiss() {
    localStorage.setItem(PUSH_PROMPTED_KEY_COACH, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-[72px] z-40 mx-4 mb-[env(safe-area-inset-bottom)] flex flex-col gap-2 rounded-xl border border-[#1e1e1e] bg-[#111111] px-4 py-3 text-white shadow-lg sm:bottom-4">
      <div className="flex items-center gap-3">
        <Bell className="size-5 shrink-0 text-[#e8001c]" />
        <p className="flex-1 text-sm leading-snug">
          Activa las notificaciones para enterarte de la adherencia de tus
          clientes y cuándo termina cada mesociclo.
        </p>
        <button
          onClick={activate}
          className="flex min-h-[36px] shrink-0 items-center rounded-lg bg-[#e8001c] px-3 text-sm font-medium active:bg-[#b8001a]"
        >
          {error ? "Reintentar" : "Activar"}
        </button>
        <button
          onClick={dismiss}
          aria-label="Ahora no"
          className="flex size-[36px] shrink-0 items-center justify-center rounded-full text-[#888888] active:text-white"
        >
          <X className="size-4" />
        </button>
      </div>
      {error && (
        <p className="pl-8 text-xs whitespace-pre-line text-[#ff6b6b]">{error}</p>
      )}
    </div>
  );
}
