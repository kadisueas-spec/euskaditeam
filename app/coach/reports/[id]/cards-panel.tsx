"use client";

import { useState } from "react";
import { AlertTriangle, GripVertical, Lock, Pencil, RotateCcw } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { EDITED_PHRASE_MAX, arrangeCards, cardBasis, cardLabel, isTextEditable } from "@/lib/reports/layout";
import type { ArrangedCard, CardLayout } from "@/lib/reports/layout";
import type { ReportCard } from "@/lib/reports/types";

// Panel "Tarjetas" del borrador (oct-2026): prender/apagar y reordenar.
// Mismo arrastre que el editor de rutinas: siempre desde el ícono de agarre
// (44x44, touch-none) para no pelear con el scroll en iPhone; MouseSensor +
// TouchSensor con delay, no PointerSensor. Portada, cierre e imagen para
// compartir son fijas. Los gráficos de ejercicios apagados no se listan
// (serían muchos): se agregan desde el selector de abajo.
//
// "Editar texto" (oct-2026): cambia SOLO la frase de la tarjeta; números,
// gráficos y listas de marcas salen de los datos y no se tocan. La vista
// previa se actualiza mientras se escribe.

type TextActions = {
  onText: (item: ArrangedCard, phrase: string) => void;
  onRevert: (item: ArrangedCard) => void;
  onReviewed: (item: ArrangedCard) => void;
};

function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className="flex size-11 shrink-0 items-center justify-center"
    >
      <span className={`relative h-6 w-10 rounded-full transition-colors ${checked ? "bg-[#e8001c]" : "bg-[#2a2a2a]"}`}>
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white transition-[left] ${checked ? "left-[18px]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

function EditedBadges({ item }: { item: ArrangedCard }) {
  if (!item.edited) return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {item.needsReview && (
        <span className="flex items-center gap-1 rounded-full bg-[#f5c542]/15 px-2 py-0.5 text-[11px] text-[#f5c542]">
          <AlertTriangle className="size-3" aria-hidden /> Revisar
        </span>
      )}
      <span className="rounded-full border border-[#e8001c]/50 px-2 py-0.5 text-[11px] text-[#ff6b7a]">Editada</span>
    </span>
  );
}

// Editor de la frase, debajo de la fila. Vacío o igual al original = texto
// original (la vista previa lo muestra mientras el campo está vacío).
function TextEditor({ item, actions }: { item: ArrangedCard; actions: TextActions }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(item.card.phrase ?? "");
  if (!isTextEditable(item.original)) return null;
  const label = cardLabel(item.original);
  const id = `edit-text-${item.key}`;

  function revert() {
    setValue(item.original.phrase ?? "");
    actions.onRevert(item);
  }

  return (
    <div className="flex flex-col gap-2 px-2 pb-2">
      {item.needsReview && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#f5c542]/40 bg-[#f5c542]/10 px-3 py-2 text-xs text-[#f5f5f5]">
          <span className="min-w-0 flex-1">
            Los datos de esta tarjeta cambiaron desde que editaste el texto. Revisá que siga siendo cierto.
          </span>
          <button
            type="button"
            onClick={() => actions.onReviewed(item)}
            className="min-h-11 rounded-lg px-2 font-medium text-[#f5c542] active:bg-white/10"
          >
            Ya lo revisé
          </button>
        </div>
      )}
      {open ? (
        <>
          <label htmlFor={id} className="sr-only">
            Texto de {label}
          </label>
          <Textarea
            id={id}
            value={value}
            rows={3}
            maxLength={EDITED_PHRASE_MAX}
            placeholder={item.original.phrase ?? "Escribí el texto de esta tarjeta"}
            onChange={(e) => {
              setValue(e.target.value);
              actions.onText(item, e.target.value);
            }}
          />
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-11 rounded-lg px-3 text-sm font-medium text-white active:bg-white/10"
            >
              Listo
            </button>
            {item.edited && (
              <button
                type="button"
                onClick={revert}
                className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-[#c9c9c9] active:bg-white/10"
              >
                <RotateCcw className="size-4" aria-hidden /> Volver al texto original
              </button>
            )}
            <span className="ml-auto text-xs text-[#666666]">
              {value.length}/{EDITED_PHRASE_MAX}
            </span>
          </div>
          <p className="text-xs text-[#888888]">Solo cambia el texto. Los números y gráficos salen de los datos.</p>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setValue(item.card.phrase ?? "");
              setOpen(true);
            }}
            aria-label={`Editar texto de ${label}`}
            className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-[#c9c9c9] active:bg-white/10"
          >
            <Pencil className="size-4" aria-hidden /> Editar texto
          </button>
          {item.edited && (
            <button
              type="button"
              onClick={revert}
              className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-[#888888] active:bg-white/10"
            >
              <RotateCcw className="size-4" aria-hidden /> Volver al texto original
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ item, onToggle, actions }: { item: ArrangedCard; onToggle: () => void; actions: TextActions }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex flex-col rounded-xl border bg-[#111111] ${isDragging ? "z-10 border-[#e8001c]" : "border-[#1e1e1e]"}`}
    >
      <div className="flex items-center gap-1 pr-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Mover ${cardLabel(item.card)}`}
          className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-[#888888] active:cursor-grabbing active:bg-white/10 active:text-[#e8001c]"
        >
          <GripVertical className="size-5" />
        </button>
        <span className={`min-w-0 flex-1 truncate text-sm ${item.enabled ? "text-white" : "text-[#666666]"}`}>
          {cardLabel(item.card)}
        </span>
        <EditedBadges item={item} />
        <Switch checked={item.enabled} onChange={onToggle} label={`Mostrar ${cardLabel(item.card)}`} />
      </div>
      {item.enabled && <TextEditor item={item} actions={actions} />}
    </li>
  );
}

function FixedRow({ item, actions }: { item: ArrangedCard; actions: TextActions }) {
  return (
    <li className="flex flex-col rounded-xl border border-dashed border-[#1e1e1e]">
      <div className="flex min-h-11 items-center gap-1 pr-3">
        <span className="flex size-11 shrink-0 items-center justify-center text-[#555555]">
          <Lock className="size-4" aria-hidden />
        </span>
        <span className="flex-1 text-sm text-[#888888]">{cardLabel(item.card)}</span>
        <EditedBadges item={item} />
        <span className="text-xs text-[#666666]">Fija</span>
      </div>
      <TextEditor item={item} actions={actions} />
    </li>
  );
}

export function CardsPanel({
  cards,
  layout,
  onChange,
  hideWeight,
  saveState,
}: {
  cards: ReportCard[];
  layout: CardLayout | null;
  onChange: (layout: CardLayout) => void;
  hideWeight: boolean;
  saveState: "idle" | "saving" | "saved" | "error";
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const arranged = arrangeCards(cards, layout);
  const head = arranged.filter((a) => a.fixed && a.card.type === "opening");
  const tail = arranged.filter((a) => a.fixed && a.card.type !== "opening");
  const movable = arranged.filter((a) => !a.fixed && (a.card.type !== "exercise" || a.enabled));
  const addableExercises = arranged.filter((a) => a.card.type === "exercise" && !a.enabled);

  const current = (): CardLayout => ({
    order: arranged.filter((a) => !a.fixed).map((a) => a.key),
    enabled: Object.fromEntries(arranged.filter((a) => !a.fixed).map((a) => [a.key, a.enabled])),
    ...(layout?.texts ? { texts: { ...layout.texts } } : {}),
  });

  function toggle(key: string) {
    const next = current();
    next.enabled[key] = !next.enabled[key];
    onChange(next);
  }

  function withText(key: string, phrase: string | null, basis: string) {
    const next = current();
    const texts = { ...(next.texts ?? {}) };
    if (phrase === null) delete texts[key];
    else texts[key] = { phrase, basis };
    if (Object.keys(texts).length > 0) next.texts = texts;
    else delete next.texts;
    onChange(next);
  }

  const actions: TextActions = {
    // Escribir la frase = revisarla contra los datos de hoy (huella nueva).
    // Vacía, o igual a la original, no cuenta como editada.
    onText: (item, phrase) => {
      const clean = phrase.trim();
      const unchanged = !clean || clean === (item.original.phrase ?? "").trim();
      withText(item.key, unchanged ? null : clean, cardBasis(item.original));
    },
    onRevert: (item) => withText(item.key, null, ""),
    onReviewed: (item) => {
      const text = layout?.texts?.[item.key];
      if (text) withText(item.key, text.phrase, cardBasis(item.original));
    },
  };

  function addExercise(key: string) {
    const next = current();
    next.enabled[key] = true;
    // Al final de la lista visible (antes de las apagadas que no se listan).
    next.order = [...movable.map((a) => a.key), key, ...next.order.filter((k) => k !== key && !movable.some((m) => m.key === k))];
    onChange(next);
  }

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const keys = movable.map((a) => a.key);
    const from = keys.indexOf(String(e.active.id));
    const to = keys.indexOf(String(e.over.id));
    if (from < 0 || to < 0) return;
    const moved = arrayMove(keys, from, to);
    const next = current();
    next.order = [...moved, ...next.order.filter((k) => !moved.includes(k))];
    onChange(next);
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-white">Tarjetas</h2>
          <p className="text-xs text-[#888888]">
            Prendé, apagá, arrastrá para ordenar y editá el texto. La vista previa se actualiza sola.
          </p>
        </div>
        <span className="shrink-0 text-xs text-[#888888]" aria-live="polite">
          {saveState === "saving" ? "Guardando…" : saveState === "saved" ? "Guardado ✓" : saveState === "error" ? "No se pudo guardar" : ""}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {head.map((item) => (
          <FixedRow key={item.key} item={item} actions={actions} />
        ))}
      </ul>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={movable.map((a) => a.key)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-2">
            {movable.map((item) => (
              <Row key={item.key} item={item} onToggle={() => toggle(item.key)} actions={actions} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <ul className="flex flex-col gap-2">
        {tail.map((item) => (
          <FixedRow key={item.key} item={item} actions={actions} />
        ))}
      </ul>

      {addableExercises.length > 0 && (
        <div className="flex flex-col gap-1">
          <label htmlFor="add-exercise-card" className="text-xs text-[#888888]">
            Agregar el gráfico de un ejercicio
          </label>
          <NativeSelect
            id="add-exercise-card"
            value=""
            onChange={(e) => {
              if (e.target.value) addExercise(e.target.value);
            }}
          >
            <option value="">Elegí un ejercicio</option>
            {addableExercises.map((a) => (
              <option key={a.key} value={a.key}>
                {a.card.type === "exercise" ? a.card.exercise : cardLabel(a.card)}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      {hideWeight && (
        <p className="text-xs text-[#888888]">
          Peso: no disponible porque este cliente tiene “No mostrar peso en reportes”.
        </p>
      )}
      <p className="text-xs text-[#888888]">La tarjeta “Solo lo ves vos” nunca le llega al cliente.</p>
    </section>
  );
}
