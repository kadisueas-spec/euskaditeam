"use client";

import { useEffect, useState } from "react";
import { X, Share, SquarePlus } from "lucide-react";

const DISMISSED_KEY = "fitcoach-install-banner-dismissed";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari exposes this non-standard property
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

function isSafariOnIOS() {
  const ua = window.navigator.userAgent;
  const isIOSDevice = /iphone|ipad|ipod/i.test(ua);
  // Chrome/Firefox/Edge/Opera en iOS usan WebKit pero se identifican con
  // estos sufijos; solo Safari muestra el botón compartir esperado.
  const isOtherIOSBrowser = /crios|fxios|edgios|opios|duckduckgo/i.test(ua);
  return isIOSDevice && !isOtherIOSBrowser;
}

export function InstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    // One-time browser capability check on mount, not derived React state to
    // sync or an external store to subscribe to.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isSafariOnIOS()) setVisible(true);
  }, []);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex items-center gap-3 border-t border-[#1e1e1e] bg-[#111111] px-4 py-3 text-white shadow-lg">
      <p className="flex-1 text-sm leading-snug">
        Para instalar: tocá el botón compartir{" "}
        <Share className="inline size-4 -translate-y-0.5" aria-hidden /> y
        luego{" "}
        <span className="font-semibold">
          &quot;Agregar a pantalla de inicio&quot;
        </span>{" "}
        <SquarePlus className="inline size-4 -translate-y-0.5" aria-hidden />.
      </p>
      <button
        onClick={dismiss}
        aria-label="Cerrar"
        className="shrink-0 rounded-full p-1 text-[#888888] hover:text-white"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
