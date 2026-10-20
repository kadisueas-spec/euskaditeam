"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TourStep } from "@/lib/constants/onboarding-tour";

// Recorrido de bienvenida (oct-2026). Overlay que oscurece la pantalla y
// "recorta" el elemento marcado con data-tour="<target>" de cada paso, con
// una tarjeta explicativa arriba o abajo según el espacio. CSS puro para
// las animaciones (nada de librerías de motion — fallan en Safari iOS).
//
// - El recorte es un div del tamaño del elemento con un box-shadow enorme
//   (0 0 0 9999px) que oscurece todo lo demás + borde y glow rojos.
// - La posición se re-mide en cada frame mientras está activo (scroll del
//   <main>, rotación, teclado): getBoundingClientRect es barato y así el
//   recorte sigue al elemento sin listeners de scroll por contenedor.
// - Avanza con "Siguiente" o tocando afuera; "Saltar" lo cierra. Se marca
//   como visto apenas aparece el primer paso (onStart), así que cerrarlo a
//   mitad — o cerrar la app — no lo vuelve a mostrar.
// - Pasos cuyo elemento no está en pantalla al arrancar se saltean.

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 8; // aire alrededor del elemento resaltado
const GAP = 14; // distancia entre el recorte y la tarjeta
const MARGIN = 16; // margen mínimo con los bordes de la pantalla
const CARD_EST_HEIGHT = 240; // alto estimado hasta medir la tarjeta real
const SPOTLIGHT_SHADOW =
  "0 0 0 9999px rgba(8, 8, 8, 0.8), 0 0 18px 2px rgba(232, 0, 28, 0.35)";

function findTarget(target: string | undefined): HTMLElement | null {
  if (!target) return null;
  return document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
}

function sameRect(a: Rect | null, b: Rect | null): boolean {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

export function OnboardingTour({
  steps,
  enabled,
  waitForEvent,
  onStart,
  startDelayMs = 500,
}: {
  steps: TourStep[];
  // El recorrido arranca recién cuando enabled pasa a true (ej. Entrenar
  // espera a que carguen las sugerencias y se cierre el calentamiento). Una
  // vez arrancado, sigue aunque enabled vuelva a false.
  enabled: boolean;
  // Si se pasa, además espera a que se dispare este evento de window (ej.
  // el cierre del banner "Empecemos").
  waitForEvent?: string;
  onStart: () => void;
  startDelayMs?: number;
}) {
  const [eventFired, setEventFired] = useState(!waitForEvent);
  const [status, setStatus] = useState<"idle" | "active" | "done">("idle");
  const [activeSteps, setActiveSteps] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardHeight, setCardHeight] = useState(CARD_EST_HEIGHT);
  const cardRef = useRef<HTMLDivElement>(null);
  const onStartRef = useRef(onStart);

  useEffect(() => {
    onStartRef.current = onStart;
  }, [onStart]);

  useEffect(() => {
    if (!waitForEvent) return;
    const handler = () => setEventFired(true);
    window.addEventListener(waitForEvent, handler);
    return () => window.removeEventListener(waitForEvent, handler);
  }, [waitForEvent]);

  // Arranque: con un pequeño delay para que la pantalla termine de
  // acomodarse (FadeIn, carga de datos) antes de medir.
  useEffect(() => {
    if (status !== "idle" || !enabled || !eventFired) return;
    const timer = setTimeout(() => {
      const available = steps.filter((s) => !s.target || findTarget(s.target));
      if (available.length === 0) {
        setStatus("done");
        return;
      }
      setActiveSteps(available);
      setIndex(0);
      setStatus("active");
      onStartRef.current();
    }, startDelayMs);
    return () => clearTimeout(timer);
  }, [status, enabled, eventFired, steps, startDelayMs]);

  const step = status === "active" ? activeSteps[index] : undefined;
  const isLast = index === activeSteps.length - 1;

  // En cada paso: llevar el elemento a la vista y seguir su posición.
  // El paso sin elemento (cierre) no usa rect; entre dos pasos con elemento
  // el recorte se desliza del anterior al nuevo (transition en el estilo).
  // El alto real de la tarjeta se mide en el mismo frame, para ubicarla sin
  // que se salga de la pantalla.
  useEffect(() => {
    if (!step) return;
    const el = findTarget(step.target);
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });

    let frame = 0;
    let last: Rect | null = null;
    let lastCardHeight = 0;
    const measure = () => {
      if (el) {
        const r = el.getBoundingClientRect();
        const next = { top: r.top, left: r.left, width: r.width, height: r.height };
        if (!sameRect(last, next)) {
          last = next;
          setRect(next);
        }
      }
      const h = cardRef.current?.offsetHeight ?? 0;
      if (h > 0 && h !== lastCardHeight) {
        lastCardHeight = h;
        setCardHeight(h);
      }
      frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [step]);

  const finish = useCallback(() => setStatus("done"), []);
  const next = useCallback(() => {
    if (isLast) finish();
    else setIndex((i) => i + 1);
  }, [isLast, finish]);

  useEffect(() => {
    if (!step) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "Enter" || e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, next, finish]);

  if (!step) return null;

  const hasTarget = !!step.target;
  // Paso con elemento pero todavía sin medir (scroll en curso): solo el
  // oscurecido, para que la tarjeta no aparezca en un lugar y salte a otro.
  const waitingForRect = hasTarget && !rect;

  let cardStyle: React.CSSProperties | undefined;
  if (hasTarget && rect) {
    const vh = window.innerHeight;
    const spotTop = rect.top - PAD;
    const spotBottom = rect.top + rect.height + PAD;
    const spaceBelow = vh - spotBottom;
    const spaceAbove = spotTop;
    const fitsBelow = spaceBelow >= cardHeight + GAP + MARGIN;
    if (fitsBelow || spaceBelow >= spaceAbove) {
      cardStyle = { top: Math.min(spotBottom + GAP, vh - cardHeight - MARGIN) };
    } else {
      cardStyle = { bottom: Math.min(vh - spotTop + GAP, vh - cardHeight - MARGIN) };
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Recorrido de la app"
      className="animate-tour-overlay-in fixed inset-0 z-[80] touch-manipulation"
      onClick={next}
    >
      {hasTarget && rect ? (
        <div
          aria-hidden
          className="animate-tour-ring pointer-events-none fixed rounded-[18px] border-[1.5px] border-[#e8001c]/75 transition-[top,left,width,height] duration-300 ease-out"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: SPOTLIGHT_SHADOW,
          }}
        />
      ) : (
        <div aria-hidden className="pointer-events-none fixed inset-0 bg-[#080808]/85 backdrop-blur-[2px]" />
      )}

      {!waitingForRect && (
        <div
          className={`pointer-events-none fixed inset-x-0 flex px-4 ${
            hasTarget ? "" : "inset-y-0 items-center"
          }`}
          style={cardStyle}
        >
          <div
            key={index}
            ref={cardRef}
            onClick={(e) => e.stopPropagation()}
            aria-live="polite"
            className="animate-tour-card-in pointer-events-auto relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-[#1e1e1e] bg-[#111111] shadow-[0_18px_48px_-12px_rgba(0,0,0,0.75)]"
          >
            {/* Acento rojo: línea fina arriba, mismo lenguaje que los
                bordes/glow de la marca (nada de gradientes). */}
            <div className="h-[3px] w-full bg-[#e8001c]" />
            <div className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-2xl leading-none tracking-wide text-[#f5f5f5] uppercase">
                  {step.title}
                </h2>
                <span className="shrink-0 text-xs font-medium text-[#888888] tabular-nums">
                  {index + 1} de {activeSteps.length}
                </span>
              </div>
              <p className="text-[15px] leading-relaxed whitespace-pre-line text-[#c9c9c9]">
                {step.body}
              </p>

              <div className="mt-1 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5" aria-hidden>
                  {activeSteps.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === index ? "w-5 bg-[#e8001c]" : "w-1.5 bg-white/15"
                      }`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  {!isLast && (
                    <button
                      type="button"
                      onClick={finish}
                      className="min-h-[44px] rounded-lg px-3 text-sm font-medium text-[#888888] transition-colors active:bg-white/5 active:text-white"
                    >
                      Saltar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={next}
                    className="min-h-[44px] min-w-[44px] rounded-xl bg-[#e8001c] px-5 font-display text-lg tracking-widest text-white uppercase shadow-[0_0_18px_rgba(232,0,28,0.4)] transition-transform active:scale-95"
                  >
                    {step.cta ?? "Siguiente"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
