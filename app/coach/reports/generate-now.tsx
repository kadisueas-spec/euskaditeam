"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { generateReportNow } from "./actions";

type Kind = "weekly" | "monthly";

const STATUS_LABEL = {
  draft: "un borrador",
  scheduled: "un reporte programado",
  discarded: "un borrador descartado",
} as const;

// "Generar ahora": un borrador para el cliente elegido, sin esperar al cron.
// Solo crea borradores — enviarlo sigue siendo decisión del coach en la
// pantalla del reporte.
export function GenerateNow({
  clients,
  periodLabels,
}: {
  clients: { id: string; name: string }[];
  periodLabels: Record<Kind, string>;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [kind, setKind] = useState<Kind>("weekly");
  const [confirm, setConfirm] = useState<keyof typeof STATUS_LABEL | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate(confirmRegenerate: boolean) {
    if (!clientId) {
      setError("Elegí un cliente.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await generateReportNow(clientId, kind, confirmRegenerate);
      if ("reportId" in result) {
        setConfirm(null);
        router.push(`/coach/reports/${result.reportId}`);
      } else if ("needsConfirm" in result) {
        setConfirm(result.needsConfirm.status);
      } else {
        setConfirm(null);
        setError(result.error);
      }
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
      <div>
        <h2 className="text-sm font-semibold text-white">Generar ahora</h2>
        <p className="text-xs text-[#888888]">
          Arma un borrador sin esperar al sábado o al día 1. No le llega nada al cliente hasta que lo envíes.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[200px] flex-1 flex-col gap-1">
          <label htmlFor="generate-client" className="text-xs text-[#888888]">
            Cliente
          </label>
          <NativeSelect
            id="generate-client"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setConfirm(null);
              setError(null);
            }}
          >
            <option value="">Elegí un cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <fieldset className="flex gap-2">
          <legend className="sr-only">Tipo de reporte</legend>
          {(["weekly", "monthly"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => {
                setKind(k);
                setConfirm(null);
                setError(null);
              }}
              className={`min-h-11 rounded-full px-4 text-sm font-medium ${
                kind === k ? "bg-[#e8001c] text-white" : "bg-white/5 text-[#c9c9c9] hover:bg-white/10"
              }`}
            >
              {k === "weekly" ? "Semanal" : "Mensual"}
            </button>
          ))}
        </fieldset>
        <Button size="lg" className="min-h-11" disabled={pending} onClick={() => generate(false)}>
          {pending ? "Generando…" : "Generar ahora"}
        </Button>
      </div>
      <p className="text-xs text-[#888888]">Período: {periodLabels[kind]}</p>

      {confirm && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#f5c542]/40 bg-[#f5c542]/10 p-3 text-sm text-[#f5f5f5]">
          <span>
            Ya hay {STATUS_LABEL[confirm]} de este período. ¿Regenerarlo con los datos de hoy? Tu nota se mantiene
            {confirm === "scheduled" ? " y sigue programado" : ""}.
          </span>
          <Button size="sm" disabled={pending} onClick={() => generate(true)}>
            Sí, regenerar
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirm(null)}>
            No
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-[#e8001c]">
          {error}
        </p>
      )}
    </section>
  );
}
