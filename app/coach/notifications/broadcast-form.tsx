"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BROADCAST_BODY_MAX,
  BROADCAST_COOLDOWN_SECONDS,
  BROADCAST_DEFAULTS,
  BROADCAST_TITLE_MAX,
  buildBroadcastPayload,
} from "@/lib/push/broadcast";
import { sendBroadcast, type BroadcastResult } from "./actions";

// Formulario de novedades (oct-2026): título y texto precargados y
// editables, vista previa tipo notificación, confirmación "Vas a enviar
// esto a N clientes" y botón bloqueado unos segundos después de enviar
// (un doble toque no la manda dos veces).
export function BroadcastForm({ activeClients, withPush }: { activeClients: number; withPush: number }) {
  const [title, setTitle] = useState(BROADCAST_DEFAULTS.title);
  const [body, setBody] = useState(BROADCAST_DEFAULTS.body);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<BroadcastResult | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const built = buildBroadcastPayload({ title, body });
  const invalid = "error" in built ? built.error : null;
  const blocked = pending || cooldown > 0 || activeClients === 0 || !!invalid;

  function send() {
    setConfirming(false);
    setCooldown(BROADCAST_COOLDOWN_SECONDS);
    startTransition(async () => {
      try {
        setResult(await sendBroadcast(title, body));
      } catch {
        setResult({ error: "Sin conexión. Revisá tu red y reintentá." });
      }
    });
  }

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="broadcast-title">Título</Label>
        <Input
          id="broadcast-title"
          value={title}
          maxLength={BROADCAST_TITLE_MAX}
          onChange={(e) => {
            setTitle(e.target.value);
            setConfirming(false);
          }}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="broadcast-body">Texto</Label>
        <Textarea
          id="broadcast-body"
          value={body}
          rows={3}
          maxLength={BROADCAST_BODY_MAX}
          onChange={(e) => {
            setBody(e.target.value);
            setConfirming(false);
          }}
        />
        <p className="text-right text-xs text-[#666666]">
          {[...body].length}/{BROADCAST_BODY_MAX}
        </p>
      </div>

      {/* Vista previa: cómo se ve en la pantalla bloqueada del teléfono */}
      <div className="flex flex-col gap-2">
        <p className="text-xs tracking-wide text-[#888888] uppercase">Vista previa</p>
        <div className="flex gap-3 rounded-2xl border border-[#1e1e1e] bg-[#1a1a1a] p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#e8001c]">
            <Bell className="size-5 text-white" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center justify-between gap-2 text-xs text-[#888888]">
              <span>Euskadi Team</span>
              <span>ahora</span>
            </p>
            <p className="truncate text-sm font-semibold text-white">{title.trim() || "Título"}</p>
            <p className="line-clamp-3 text-sm text-[#c9c9c9]">{body.trim() || "Texto"}</p>
          </div>
        </div>
      </div>

      <p className="text-sm text-[#c9c9c9]">
        La van a recibir <b className="text-white">{activeClients}</b>{" "}
        {activeClients === 1 ? "cliente activo" : "clientes activos"}
        {activeClients > 0 && (
          <span className="text-[#888888]">
            {" "}
            · {withPush} con notificaciones activadas
            {activeClients - withPush > 0 ? ` (los otros ${activeClients - withPush} se saltean)` : ""}
          </span>
        )}
      </p>

      {invalid && <p className="text-sm text-[#e8001c]">{invalid}</p>}

      {confirming ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#e8001c]/40 bg-[#e8001c]/10 p-4">
          <p className="text-sm font-medium text-white">
            Vas a enviar esto a {activeClients} {activeClients === 1 ? "cliente" : "clientes"}. ¿Confirmás?
          </p>
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11" disabled={blocked} onClick={send}>
              <Send className="size-4" aria-hidden /> Sí, enviar
            </Button>
            <Button variant="ghost" className="min-h-11" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="lg"
          className="min-h-12 self-start"
          disabled={blocked}
          onClick={() => {
            setResult(null);
            setConfirming(true);
          }}
        >
          <Send className="size-4" aria-hidden />
          {pending ? "Enviando…" : cooldown > 0 ? `Enviar a todos (${cooldown} s)` : "Enviar a todos"}
        </Button>
      )}

      {result && (
        <div role="status" className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4 text-sm">
          {"error" in result ? (
            <p className="text-[#e8001c]">{result.error}</p>
          ) : (
            <>
              <p className="font-medium text-white">
                La recibieron {result.delivered} de {result.total}{" "}
                {result.total === 1 ? "cliente" : "clientes"}.
              </p>
              {(result.withoutPush > 0 || result.failed > 0) && (
                <p className="mt-1 text-[#888888]">
                  {result.withoutPush > 0 &&
                    `${result.withoutPush} sin notificaciones activadas. `}
                  {result.failed > 0 && `${result.failed} con un error de entrega (teléfono sin conexión o permiso vencido).`}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
