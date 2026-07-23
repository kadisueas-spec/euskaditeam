"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { formatErrorDetail, urlBase64ToUint8Array, PUSH_PROMPTED_KEY } from "@/lib/constants/push";
import { hasPushSubscription, savePushSubscription } from "@/app/client/actions";

function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function PushPermissionPrompt() {
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 2do bug real encontrado jul-2026 (caso Fabrizzio, sigue sin verse el
  // banner después del fix anterior): PUSH_PROMPTED_KEY en localStorage
  // puede quedar en "1" sin que exista ninguna suscripción real — por
  // ejemplo si el usuario tocó la ✕ (dismiss) antes de intentar activar
  // siquiera. Ese flag local sobrevive a reinstalar la PWA igual que
  // Notification.permission, así que confiar solo en él tiene el mismo
  // problema de fondo. Ahora, si el permiso ya está "granted", se
  // consulta la fuente de verdad real (¿hay una fila en push_subscriptions
  // para este cliente?) antes de decidir esconder el banner — sin
  // importar qué diga el flag local. Con permiso "default"/"denied" (el
  // usuario ni llegó a conceder nada) el flag local alcanza, para no
  // insistir en cada visita a alguien que ya dijo que no quiere.
  useEffect(() => {
    if (!isPushSupported()) return;

    (async () => {
      if (Notification.permission === "granted") {
        const subscribed = await hasPushSubscription();
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (!subscribed) setVisible(true);
        return;
      }
      if (localStorage.getItem(PUSH_PROMPTED_KEY)) return;
      if (Notification.permission === "denied") return;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
    })();
  }, []);

  // Diagnóstico jul-2026: notificaciones que funcionan en iPhone pero nunca
  // se registran en Android — con esta función sin try/catch no había forma
  // de saber en qué paso fallaba (permiso, subscribe(), o el guardado en
  // Supabase), porque cualquier rechazo quedaba como una promesa sin
  // manejar. Ahora cada paso loguea su propio error y muestra un mensaje —
  // y a diferencia de antes, si algo falla el banner NO se oculta (una vez
  // que el permiso ya quedó en "granted", el navegador nunca vuelve a
  // "default", así que es la única forma de reintentar en la misma visita).
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
      console.error("PushPermissionPrompt: falta NEXT_PUBLIC_VAPID_PUBLIC_KEY");
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
      console.error("PushPermissionPrompt: pushManager.subscribe() falló", err);
      setError(`No se pudieron activar las notificaciones.\nError: ${formatErrorDetail(err)}`);
      return;
    }

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      console.error("PushPermissionPrompt: suscripción incompleta", json);
      setError("No se pudo activar. Probá de nuevo más tarde.");
      return;
    }

    try {
      const result = await savePushSubscription({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      });
      if (result?.error) {
        console.error("PushPermissionPrompt: savePushSubscription devolvió error", result.error);
        setError(`No se pudieron activar las notificaciones.\nError: ${result.error}`);
        return;
      }
    } catch (err) {
      console.error("PushPermissionPrompt: savePushSubscription lanzó una excepción", err);
      setError(`No se pudieron activar las notificaciones.\nError: ${formatErrorDetail(err)}`);
      return;
    }

    localStorage.setItem(PUSH_PROMPTED_KEY, "1");
    setVisible(false);
  }

  function dismiss() {
    localStorage.setItem(PUSH_PROMPTED_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-[72px] z-40 mx-4 mb-[env(safe-area-inset-bottom)] flex flex-col gap-2 rounded-xl border border-[#1e1e1e] bg-[#111111] px-4 py-3 text-white shadow-lg">
      <div className="flex items-center gap-3">
        <Bell className="size-5 shrink-0 text-[#e8001c]" />
        <p className="flex-1 text-sm leading-snug">
          Activá las notificaciones para enterarte cuando tu coach te deje
          feedback.
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
