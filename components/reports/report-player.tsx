"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { CardTheme, ReportCard } from "@/lib/reports/types";
import { ReportCardView } from "./report-card-view";
import styles from "./report-player.module.css";

// Reproductor de reportes tipo historias (oct-2026). Mismo componente para
// el cliente (pantalla completa, en portal a body — el transform que deja
// PageTransition descoloca un position: fixed, mismo problema que el
// recorrido de bienvenida) y para la vista previa del coach (embebido en un
// marco de teléfono, links sin navegar).
//
// Gestos: tocar a la derecha o deslizar a la izquierda avanza; tocar a la
// izquierda o deslizar a la derecha retrocede; deslizar hacia abajo cierra.
// Sin avance automático (aprobado): cada uno lee a su ritmo.

const SWIPE_MIN_PX = 50;
const CLOSE_MIN_PX = 90;

export type ExtraSlide = { key: string; theme: CardTheme; content: React.ReactNode };

type Props = {
  cards: ReportCard[];
  title: string;
  periodLabel: string;
  variant: "fullscreen" | "embedded";
  // Solo coach: tarjetas que nunca llegan al cliente ("Solo lo ves vos").
  extraSlides?: ExtraSlide[];
  initialIndex?: number;
  onClose?: () => void;
  // Se llama una vez al llegar a la última tarjeta.
  onComplete?: () => void;
};

type Slide = { key: string; theme: CardTheme; card?: ReportCard; content?: React.ReactNode };

export function ReportPlayer({
  cards,
  title,
  periodLabel,
  variant,
  extraSlides = [],
  initialIndex = 0,
  onClose,
  onComplete,
}: Props) {
  const slides: Slide[] = [
    ...cards.map((card, i) => ({ key: `${card.type}-${i}`, theme: card.theme, card })),
    ...extraSlides,
  ];
  const last = slides.length - 1;
  const [index, setIndex] = useState(Math.min(Math.max(0, initialIndex), last));
  const [mounted, setMounted] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const completed = useRef(false);
  const interactive = variant === "fullscreen";

  const go = useCallback(
    (step: number) => setIndex((i) => Math.min(Math.max(0, i + step), last)),
    [last]
  );

  // El portal solo existe en el navegador (document.body).
  // eslint-disable-next-line react-hooks/set-state-in-effect -- montaje del portal
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (index === last && !completed.current) {
      completed.current = true;
      onComplete?.();
    }
  }, [index, last, onComplete]);

  useEffect(() => {
    if (variant !== "fullscreen") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [variant, go, onClose]);

  const slide = slides[index];
  if (!slide) return null;

  const player = (
    <section
      className={`${styles.player} ${variant === "fullscreen" ? styles.fullscreen : styles.embedded}`}
      data-theme={slide.theme}
      role={variant === "fullscreen" ? "dialog" : "region"}
      aria-modal={variant === "fullscreen" ? true : undefined}
      aria-label={`${title}, ${periodLabel}`}
      onTouchStart={(e) => {
        const t = e.touches[0];
        touch.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const start = touch.current;
        touch.current = null;
        if (!start) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        if (Math.abs(dx) > SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
        else if (onClose && dy > CLOSE_MIN_PX && dy > Math.abs(dx)) onClose();
      }}
    >
      <div className={styles.chrome}>
        <div className={styles.bars} aria-hidden>
          {slides.map((s, i) => (
            <span key={s.key} className={i < index ? styles.done : i === index ? styles.now : undefined} />
          ))}
        </div>
        <div className={styles.top}>
          <p className={styles.who}>
            <b>{title}</b>
            {periodLabel}
          </p>
          {onClose && (
            <button type="button" className={styles.close} aria-label="Cerrar" onClick={onClose}>
              <X aria-hidden strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>
      <div className={styles.stage}>
        <div className={styles.zones}>
          <div className={styles.prev} onClick={() => go(-1)} aria-hidden />
          <div className={styles.next} onClick={() => go(1)} aria-hidden />
        </div>
        <article key={slide.key} className={styles.card} aria-live="polite">
          {slide.card ? <ReportCardView card={slide.card} interactive={interactive} /> : slide.content}
        </article>
      </div>
      <p style={{ position: "absolute", left: -9999 }}>
        Tarjeta {index + 1} de {slides.length}
      </p>
    </section>
  );

  if (variant === "embedded") return player;
  return mounted ? createPortal(player, document.body) : null;
}

export { styles as reportPlayerStyles };
