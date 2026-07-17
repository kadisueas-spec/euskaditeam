"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { checkMySubscriptionStatus } from "../paypal-actions";

const MAX_POLLS = 6;
const POLL_INTERVAL_MS = 3000;

// Nunca activa nada acá — solo lee el estado que ya actualizó el webhook
// (BILLING.SUBSCRIPTION.ACTIVATED). Si activara el acceso a partir de los
// parámetros de esta URL, cualquiera podría fabricarla a mano y activarse
// sin pagar; por eso esta pantalla es puramente informativa y hace polling
// esperando a que el webhook (la única fuente real de verdad) haga su
// trabajo.
export function SubscriptionConfirmedView({ initialStatus }: { initialStatus: string | null }) {
  const [status, setStatus] = useState(initialStatus);
  const [pollsLeft, setPollsLeft] = useState(MAX_POLLS);

  useEffect(() => {
    if (status === "active" || pollsLeft <= 0) return;
    const timer = setTimeout(async () => {
      const next = await checkMySubscriptionStatus();
      setStatus(next);
      setPollsLeft((n) => n - 1);
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [status, pollsLeft]);

  if (status === "active") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <CheckCircle2 className="size-12 text-green-400" />
        <p className="font-display text-2xl tracking-wide text-white uppercase">
          Suscripción activa
        </p>
        <p className="text-sm text-[#888888]">
          Bienvenido/a. Ya podés usar la app con normalidad.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Spinner size="lg" />
      <p className="font-display text-xl tracking-wide text-white uppercase">
        Confirmando tu suscripción...
      </p>
      <p className="text-sm text-[#888888]">
        {pollsLeft > 0
          ? "Esto puede tardar unos segundos."
          : "Está tardando más de lo esperado — revisá tu perfil en un rato, o contactá a tu coach si no se activa."}
      </p>
    </div>
  );
}
