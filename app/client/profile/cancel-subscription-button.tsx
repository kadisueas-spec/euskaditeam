"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cancelMyPaypalSubscription, type CancelMyPaypalState } from "../paypal-actions";

export function CancelSubscriptionButton() {
  const [state, action, pending] = useActionState<CancelMyPaypalState, FormData>(
    cancelMyPaypalSubscription,
    undefined
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <Button
        type="submit"
        variant="outline"
        disabled={pending}
        className="w-fit text-destructive"
      >
        {pending && <Spinner size="sm" className="border-white/30 border-t-white" />}
        {pending ? "Cancelando..." : "Cancelar suscripción"}
      </Button>
      {state && "error" in state && <p className="text-sm text-destructive">{state.error}</p>}
      {state && "warning" in state && <p className="text-sm text-amber-400">{state.warning}</p>}
      {state && "success" in state && (
        <p className="text-sm text-green-400">{state.message}</p>
      )}
    </form>
  );
}
