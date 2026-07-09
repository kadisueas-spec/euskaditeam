"use client";

import { useEffect, useState } from "react";
import { ClientBottomNav } from "@/components/client/client-bottom-nav";

// EXPERIMENTAL — herramienta de diagnóstico temporal para medir con datos
// reales (no suposiciones) el problema de la nav inferior en iOS. Sin auth
// a propósito, para acceso rápido desde el celular. Se borra apenas
// terminemos de diagnosticar. No renderiza nada del layout real de
// cliente — arma el mismo esqueleto (h-dvh flex-col) a mano y monta la
// ClientBottomNav real para medir el componente de producción, no una
// copia.

type Row = { label: string; value: string };

function px(n: number) {
  return `${Math.round(n * 100) / 100}px`;
}

export default function SafeAreaDiagnosticPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [tick, setTick] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // env() no se puede leer directo desde JS — se mide con un elemento
    // sonda cuya altura/padding depende de env(), y se lee su bounding box
    // ya renderizado.
    const probeBottom = document.createElement("div");
    probeBottom.style.cssText =
      "position:fixed;bottom:0;left:0;width:1px;height:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none;";
    document.body.appendChild(probeBottom);

    const probeTop = document.createElement("div");
    probeTop.style.cssText =
      "position:fixed;top:0;left:0;width:1px;height:env(safe-area-inset-top);visibility:hidden;pointer-events:none;";
    document.body.appendChild(probeTop);

    const container = document.querySelector(
      "[data-diagnostic-container]"
    ) as HTMLElement | null;
    const navWrap = document.querySelector("[data-diagnostic-nav]");
    const nav = navWrap?.querySelector("nav") ?? null;
    const itemsRow = nav?.firstElementChild as HTMLElement | null;
    const safeSpacer = nav?.lastElementChild as HTMLElement | null;
    const root = document.documentElement;
    const body = document.body;

    const cs = (el: Element | null) => (el ? getComputedStyle(el) : null);
    const navRect = nav?.getBoundingClientRect();
    const itemsRect = itemsRow?.getBoundingClientRect();
    const safeSpacerRect = safeSpacer?.getBoundingClientRect();

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    const data: Row[] = [
      { label: "── CONTEXTO ──", value: "" },
      {
        label: "Modo",
        value: isStandalone ? "PWA instalada (standalone)" : "Pestaña de Safari",
      },
      { label: "User Agent", value: navigator.userAgent },
      { label: "screen.width x height", value: `${screen.width} x ${screen.height}` },
      { label: "devicePixelRatio", value: String(window.devicePixelRatio) },
      { label: "window.innerHeight", value: px(window.innerHeight) },
      {
        label: "documentElement.clientHeight",
        value: px(root.clientHeight),
      },
      {
        label: "visualViewport.height",
        value: window.visualViewport ? px(window.visualViewport.height) : "no soportado",
      },

      { label: "── SAFE AREA (medida real) ──", value: "" },
      {
        label: "env(safe-area-inset-top)",
        value: px(probeTop.getBoundingClientRect().height),
      },
      {
        label: "env(safe-area-inset-bottom)",
        value: px(probeBottom.getBoundingClientRect().height),
      },

      { label: "── NAV: DIMENSIONES ──", value: "" },
      {
        label: "nav — altura total",
        value: navRect ? px(navRect.height) : "no encontrado",
      },
      {
        label: "nav — fila de ítems, altura",
        value: itemsRect ? px(itemsRect.height) : "no encontrado",
      },
      {
        label: "nav — franja safe-area, altura",
        value: safeSpacerRect ? px(safeSpacerRect.height) : "no encontrado",
      },
      {
        label: "nav.bottom (debería = viewport)",
        value: navRect ? px(navRect.bottom) : "no encontrado",
      },
      {
        label: "GAP nav.bottom vs innerHeight",
        value: navRect ? px(window.innerHeight - navRect.bottom) : "no encontrado",
      },

      { label: "── COLORES DE FONDO ──", value: "" },
      { label: "html — background-color", value: cs(root)?.backgroundColor ?? "?" },
      { label: "body — background-color", value: cs(body)?.backgroundColor ?? "?" },
      {
        label: "contenedor raíz — background-color",
        value: cs(container)?.backgroundColor ?? "?",
      },
      {
        label: "nav fila ítems — background-color",
        value: cs(itemsRow)?.backgroundColor ?? "?",
      },
      {
        label: "nav franja safe-area — background-color",
        value: cs(safeSpacer)?.backgroundColor ?? "?",
      },
      {
        label: "nav fila ítems — backdrop-filter",
        value: cs(itemsRow)?.backdropFilter ?? "?",
      },

      { label: "── PADDING / MARGIN ──", value: "" },
      { label: "html — padding / margin", value: `${cs(root)?.padding} / ${cs(root)?.margin}` },
      { label: "body — padding / margin", value: `${cs(body)?.padding} / ${cs(body)?.margin}` },
      {
        label: "contenedor raíz — padding / margin",
        value: `${cs(container)?.padding} / ${cs(container)?.margin}`,
      },
      { label: "nav — padding / margin", value: `${cs(nav)?.padding} / ${cs(nav)?.margin}` },
      {
        label: "nav fila ítems — padding / margin",
        value: `${cs(itemsRow)?.padding} / ${cs(itemsRow)?.margin}`,
      },
      {
        label: "nav franja safe-area — padding / margin",
        value: `${cs(safeSpacer)?.padding} / ${cs(safeSpacer)?.margin}`,
      },
    ];

    setRows(data);
    probeBottom.remove();
    probeTop.remove();
  }, [tick]);

  function copyAll() {
    const text = rows
      .map((r) => (r.value ? `${r.label}: ${r.value}` : r.label))
      .join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      data-diagnostic-container
      className="flex h-dvh flex-col bg-[#080808] text-white"
    >
      <div className="shrink-0 border-b border-[#1e1e1e] p-4">
        <h1 className="font-display text-2xl tracking-wide text-[#e8001c] uppercase">
          Diagnóstico Safe Area
        </h1>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => setTick((t) => t + 1)}
            className="min-h-[44px] flex-1 rounded-lg bg-[#e8001c] px-4 text-sm font-medium active:scale-95"
          >
            Medir de nuevo
          </button>
          <button
            onClick={copyAll}
            className="min-h-[44px] flex-1 rounded-lg border border-[#1e1e1e] px-4 text-sm font-medium active:scale-95"
          >
            {copied ? "Copiado ✓" : "Copiar todo"}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-0.5">
          {rows.map((r, i) =>
            r.value === "" ? (
              <p
                key={i}
                className="mt-3 text-xs font-bold tracking-wide text-[#e8001c] first:mt-0"
              >
                {r.label}
              </p>
            ) : (
              <div
                key={i}
                className="flex flex-col gap-0.5 border-b border-[#1e1e1e] py-1.5 text-xs"
              >
                <span className="text-[#888888]">{r.label}</span>
                <span className="font-mono break-all text-white">{r.value}</span>
              </div>
            )
          )}
        </div>
      </div>

      <div data-diagnostic-nav>
        <ClientBottomNav />
      </div>
    </div>
  );
}
