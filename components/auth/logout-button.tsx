"use client";

import { useState } from "react";
import { countPendingSets } from "@/lib/offline/workout-store";
import { purgeOfflineData } from "@/lib/offline/purge";

const PENDING_SETS_WARNING =
  "Tenés entrenamientos sin sincronizar. ¿Cerrar sesión de todas formas?";

// Reemplaza el <form action={logout}> de antes: el logout en sí sigue
// siendo un server action (signOut + redirect), pero antes de llamarlo hay
// que limpiar cache del SW e IndexedDB desde el navegador — eso el server
// action no lo puede hacer.
export function LogoutButton({
  action,
  checkPendingSets = false,
  className,
  children,
  "aria-label": ariaLabel,
  title,
}: {
  action: () => Promise<void>;
  // Solo tiene sentido para el flujo del cliente: el coach entrena sin
  // sincronización offline (ver WorkoutLogger enableOfflineSync={false}),
  // así que nunca tiene series pendientes en IndexedDB.
  checkPendingSets?: boolean;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
  title?: string;
}) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleClick() {
    if (isLoggingOut) return;

    if (checkPendingSets) {
      const pending = await countPendingSets();
      if (pending > 0 && !window.confirm(PENDING_SETS_WARNING)) return;
    }

    setIsLoggingOut(true);
    await purgeOfflineData();
    await action();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoggingOut}
      aria-label={ariaLabel}
      title={title}
      className={className}
    >
      {children}
    </button>
  );
}
