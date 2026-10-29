"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, Send, Smartphone } from "lucide-react";
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
import { activateCoachPush, isPushSupported } from "@/components/coach/push-permission-prompt";
import { sendBroadcast, sendBroadcastTest, type BroadcastResult, type BroadcastTestResult } from "./actions";

// ¿Este dispositivo tiene las notificaciones activadas? (para la prueba)
type DeviceState = "checking" | "on" | "off" | "denied" | "unsupported";

async function checkThisDevice(): Promise<DeviceState> {
  if (!isPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  try {
    const registration = await navigator.serviceWorker.ready;
    return (await registration.pushManager.getSubscription()) ? "on" : "off";
  } catch {
    return "off";
  }
}

const DEVICE_MESSAGE: Record<Exclude<DeviceState, "checking" | "on">, string> = {
  off: "En este dispositivo no tenés las notificaciones activadas: la prueba no te va a llegar acá.",
  denied:
    "En este dispositivo bloqueaste las notificaciones: activalas desde la configuración del navegador para recibir la prueba acá.",
  unsupported:
    "Este navegador no recibe notificaciones. En iPhone, instalá la app (Compartir → Agregar a inicio) y abrila desde ahí.",
};

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
  // Prueba "solo a mí" (oct-2026)
  const [device, setDevice] = useState<DeviceState>("checking");
  const [testResult, setTestResult] = useState<BroadcastTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    checkThisDevice().then((state) => {
      if (!cancelled) setDevice(state);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function activateHere() {
    setActivating(true);
    setActivateError(null);
    const failure = await activateCoachPush();
    setActivating(false);
    if (failure) setActivateError(failure);
    setDevice(await checkThisDevice());
  }

  async function sendTest() {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await sendBroadcastTest(title, body));
    } catch {
      setTestResult({ error: "Sin conexión. Revisá tu red y reintentá." });
    } finally {
      setTesting(false);
    }
  }

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

      {/* Prueba "solo a mí": antes del envío a todos */}
      <div className="flex flex-col gap-2 rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
        <Button
          variant="outline"
          className="min-h-11 self-start"
          disabled={testing || !!invalid}
          onClick={sendTest}
        >
          <Smartphone className="size-4" aria-hidden />
          {testing ? "Enviando prueba…" : "Enviar prueba solo a mí"}
        </Button>
        <p className="text-xs text-[#888888]">
          Llega solo a tus dispositivos con la cuenta de coach. Ningún cliente la recibe.
        </p>
        {device !== "checking" && device !== "on" && (
          <div className="flex flex-col gap-2 rounded-xl border border-[#f5c542]/40 bg-[#f5c542]/10 p-3 text-sm text-[#f5f5f5]">
            <p>{DEVICE_MESSAGE[device]}</p>
            {device === "off" && (
              <Button size="sm" className="min-h-11 self-start" disabled={activating} onClick={activateHere}>
                <Bell className="size-4" aria-hidden />
                {activating ? "Activando…" : "Activar en este dispositivo"}
              </Button>
            )}
            {activateError && <p className="text-xs whitespace-pre-line text-[#ff6b6b]">{activateError}</p>}
          </div>
        )}
        {testResult && (
          <p role="status" className={`text-sm ${"error" in testResult || testResult.delivered === 0 ? "text-[#e8001c]" : "text-white"}`}>
            {"error" in testResult
              ? testResult.error
              : testResult.devices === 0
                ? "No tenés notificaciones activadas en ningún dispositivo con tu cuenta de coach: la prueba no se envió."
                : testResult.delivered === 0
                  ? "No se pudo entregar a tus dispositivos. Volvé a activar las notificaciones y probá de nuevo."
                  : `Prueba enviada a ${testResult.delivered} de ${testResult.devices} ${testResult.devices === 1 ? "dispositivo" : "dispositivos"}.${device === "on" ? "" : " En este dispositivo no te va a llegar."}`}
          </p>
        )}
      </div>

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
