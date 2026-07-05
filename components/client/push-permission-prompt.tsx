"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { urlBase64ToUint8Array, PUSH_PROMPTED_KEY } from "@/lib/constants/push";
import { savePushSubscription } from "@/app/client/actions";

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

  useEffect(() => {
    if (!isPushSupported()) return;
    if (localStorage.getItem(PUSH_PROMPTED_KEY)) return;
    if (Notification.permission !== "default") return;
    // Chequeo único de soporte/estado del navegador al montar, no un valor
    // derivado que deba mantenerse sincronizado.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);
  }, []);

  async function activate() {
    localStorage.setItem(PUSH_PROMPTED_KEY, "1");
    setVisible(false);

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

    await savePushSubscription({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    });
  }

  function dismiss() {
    localStorage.setItem(PUSH_PROMPTED_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-[72px] z-40 mx-4 mb-[env(safe-area-inset-bottom)] flex items-center gap-3 rounded-xl border border-[#1e1e1e] bg-[#111111] px-4 py-3 text-white shadow-lg">
      <Bell className="size-5 shrink-0 text-[#e8001c]" />
      <p className="flex-1 text-sm leading-snug">
        Activá las notificaciones para enterarte cuando tu coach te deje
        feedback.
      </p>
      <button
        onClick={activate}
        className="flex min-h-[36px] shrink-0 items-center rounded-lg bg-[#e8001c] px-3 text-sm font-medium active:bg-[#b8001a]"
      >
        Activar
      </button>
      <button
        onClick={dismiss}
        aria-label="Ahora no"
        className="flex size-[36px] shrink-0 items-center justify-center rounded-full text-[#888888] active:text-white"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
