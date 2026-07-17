"use client";

import { useActionState, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Check, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  type PaymentMethod,
} from "@/lib/constants/access";
import {
  activateClientAccess,
  deactivateClientAccess,
  type AccessFormState,
  type DeactivateAccessState,
} from "./actions";
import {
  generatePaymentLink,
  cancelPaypalSubscription,
  type GeneratePaymentLinkState,
  type CancelPaypalState,
} from "./paypal-actions";
import type { ClientSubscription } from "@/lib/supabase/subscriptions";

type AccessFormValues = {
  payment_method: PaymentMethod | "";
  subscription_end_date: string;
};

const SUBSCRIPTION_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  active: { label: "Activa", className: "bg-green-500/15 text-green-400" },
  pending: { label: "Pendiente de aprobación", className: "bg-yellow-500/15 text-yellow-400" },
  past_due: { label: "Pago fallido", className: "bg-[#e8001c]/15 text-[#ff4d4d]" },
  canceled: { label: "Cancelada", className: "bg-white/10 text-[#888888]" },
};

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-[#1e1e1e] bg-[#0d0d0d] p-2">
      <p className="min-w-0 flex-1 truncate text-xs text-[#888888]">{url}</p>
      <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 gap-1" onClick={handleCopy}>
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}

function PayPalPanel({
  clientId,
  subscription,
}: {
  clientId: string;
  subscription: ClientSubscription | null;
}) {
  const [linkState, generateAction, generatePending] = useActionState<
    GeneratePaymentLinkState,
    FormData
  >(generatePaymentLink.bind(null, clientId), undefined);

  const [cancelState, cancelAction, cancelPending] = useActionState<CancelPaypalState, FormData>(
    cancelPaypalSubscription.bind(null, clientId),
    undefined
  );

  const statusInfo = subscription ? SUBSCRIPTION_STATUS_LABEL[subscription.status] : null;
  const canCancel = subscription && subscription.status !== "canceled";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white">Suscripción PayPal</p>
        {statusInfo && (
          <Badge variant="default" className={statusInfo.className}>
            {statusInfo.label}
          </Badge>
        )}
      </div>

      {subscription?.paypalPayerEmail && (
        <p className="text-xs text-[#888888]">Pagador: {subscription.paypalPayerEmail}</p>
      )}

      <form action={generateAction} className="flex flex-col gap-2">
        <Label htmlFor="monthly_price_usd" className="text-xs">
          Precio mensual (USD)
        </Label>
        <div className="flex gap-2">
          <Input
            id="monthly_price_usd"
            name="monthly_price_usd"
            type="text"
            inputMode="decimal"
            placeholder="50"
            className="h-11"
            required
          />
          <Button type="submit" disabled={generatePending} className="h-11 shrink-0">
            {generatePending && <Spinner size="sm" className="border-white/30 border-t-white" />}
            {generatePending ? "Generando..." : "Generar link"}
          </Button>
        </div>
      </form>

      {linkState && "error" in linkState && (
        <p className="text-sm text-destructive">{linkState.error}</p>
      )}
      {linkState && "success" in linkState && <CopyLinkButton url={linkState.approvalUrl} />}

      {canCancel && (
        <form action={cancelAction}>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={cancelPending}
            className="w-fit text-destructive"
          >
            {cancelPending && <Spinner size="sm" className="border-white/30 border-t-white" />}
            {cancelPending ? "Cancelando..." : "Cancelar suscripción"}
          </Button>
        </form>
      )}

      {cancelState && "error" in cancelState && (
        <p className="text-sm text-destructive">{cancelState.error}</p>
      )}
      {cancelState && "warning" in cancelState && (
        <p className="text-sm text-amber-400">{cancelState.warning}</p>
      )}
      {cancelState && "success" in cancelState && (
        <p className="text-sm text-green-400">{cancelState.message}</p>
      )}
    </div>
  );
}

export function AccessForm({
  clientId,
  currentPaymentMethod,
  currentEndDate,
  isCurrentlyActive,
  subscription,
}: {
  clientId: string;
  currentPaymentMethod: string | null;
  currentEndDate: string | null;
  isCurrentlyActive: boolean;
  subscription: ClientSubscription | null;
}) {
  const action = activateClientAccess.bind(null, clientId);
  const [state, formAction, pending] = useActionState<
    AccessFormState,
    FormData
  >(action, undefined);

  const [deactivateState, deactivateAction, deactivatePending] = useActionState<
    DeactivateAccessState,
    FormData
  >(deactivateClientAccess.bind(null, clientId), undefined);

  // `values` (no `defaultValues`) mantiene los campos controlados desde el
  // primer render y los resincroniza si currentPaymentMethod/currentEndDate
  // cambian tras revalidar — evita el warning de Base UI por pasar
  // defaultValue a un input no controlado después de montado.
  const { control } = useForm<AccessFormValues>({
    values: {
      payment_method: (currentPaymentMethod as PaymentMethod | null) ?? "",
      subscription_end_date: currentEndDate ? currentEndDate.slice(0, 10) : "",
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="payment_method">Método de pago</Label>
            <Controller
              name="payment_method"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <NativeSelect
                  id="payment_method"
                  name="payment_method"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  required
                >
                  <option value="" disabled>
                    Elegir...
                  </option>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {PAYMENT_METHOD_LABEL[method]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="subscription_end_date">Vence el</Label>
            <Controller
              name="subscription_end_date"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <Input
                  id="subscription_end_date"
                  name="subscription_end_date"
                  type="date"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  required
                />
              )}
            />
          </div>
        </div>

        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}

        <Button type="submit" disabled={pending} className="w-fit">
          {pending && <Spinner size="sm" className="border-white/30 border-t-white" />}
          {pending ? "Guardando..." : "Guardar y activar acceso"}
        </Button>
      </form>

      <PayPalPanel clientId={clientId} subscription={subscription} />

      {isCurrentlyActive && (
        <form action={deactivateAction} className="flex flex-col gap-2">
          <Button
            type="submit"
            variant="outline"
            disabled={deactivatePending}
            className="w-fit text-destructive"
          >
            {deactivatePending && <Spinner size="sm" className="border-white/30 border-t-white" />}
            {deactivatePending ? "Desactivando..." : "Desactivar acceso"}
          </Button>
          {deactivateState && "error" in deactivateState && (
            <p className="text-sm text-destructive">{deactivateState.error}</p>
          )}
          {deactivateState && "warning" in deactivateState && (
            <p className="text-sm text-amber-400">{deactivateState.warning}</p>
          )}
          {deactivateState && "success" in deactivateState && (
            <p className="text-sm text-green-400">{deactivateState.message}</p>
          )}
        </form>
      )}
    </div>
  );
}
