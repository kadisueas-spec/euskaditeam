"use client";

import { useActionState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  type PaymentMethod,
} from "@/lib/constants/access";
import {
  activateClientAccess,
  deactivateClientAccess,
  type AccessFormState,
} from "./actions";

type AccessFormValues = {
  payment_method: PaymentMethod | "";
  subscription_end_date: string;
};

export function AccessForm({
  clientId,
  currentPaymentMethod,
  currentEndDate,
  isCurrentlyActive,
}: {
  clientId: string;
  currentPaymentMethod: string | null;
  currentEndDate: string | null;
  isCurrentlyActive: boolean;
}) {
  const action = activateClientAccess.bind(null, clientId);
  const [state, formAction, pending] = useActionState<
    AccessFormState,
    FormData
  >(action, undefined);

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
                <select
                  id="payment_method"
                  name="payment_method"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm text-white"
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
                </select>
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
          {pending ? "Guardando..." : "Guardar y activar acceso"}
        </Button>
      </form>

      {isCurrentlyActive && (
        <form action={deactivateClientAccess.bind(null, clientId)}>
          <Button
            type="submit"
            variant="outline"
            className="w-fit text-destructive"
          >
            Desactivar acceso
          </Button>
        </form>
      )}
    </div>
  );
}
